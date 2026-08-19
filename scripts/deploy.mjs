// Cloud deploy pipeline (ADR-0007 / contract C-11-S1).
// Builds the standalone bundle on the dev machine, ships it to the cloud
// server, runs `prisma migrate deploy` there and restarts the systemd unit.
// The server never builds; the bundle is the only release source.
//
// Usage:
//   node scripts/deploy.mjs [--skip-build]
//
// Required once (provisioning is manual, see dev_repo evidence C-11-S1):
//   - SSH key auth for DEPLOY_USER@DEPLOY_HOST (BatchMode, no password)
//   - sudoers NOPASSWD for systemctl on foodtracker.service
//   - shared/.env.production (0600) and shared/database seed on the server

import { execFileSync } from "node:child_process"
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, statSync, writeFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

const HOST = process.env.DEPLOY_HOST || "8.148.206.131"
const USER = process.env.DEPLOY_USER || "soft"
const APP_DIR = process.env.DEPLOY_APP_DIR || "/home/soft/final/app"
const PORT = process.env.DEPLOY_PORT || "8000"
const KEY = process.env.DEPLOY_SSH_KEY || path.join(process.env.USERPROFILE || process.env.HOME, ".ssh", "foodtracker_deploy_ed25519")
const NODE_BIN = "/home/soft/.nvm/versions/node/v22.23.2/bin"
const DB_URL = `file:${APP_DIR}/shared/database/food_tracker.db`

const skipBuild = process.argv.includes("--skip-build")

function run(cmd, args, opts = {}) {
  execFileSync(cmd, args, { stdio: "inherit", shell: process.platform === "win32", ...opts })
}

function sshRemote(script) {
  const arg = `set -e; ${script}`
  execFileSync("ssh", [
    "-o", "BatchMode=yes",
    "-o", "StrictHostKeyChecking=accept-new",
    "-i", KEY,
    `${USER}@${HOST}`,
    arg,
  ], { stdio: "inherit" })
}

function copyDir(src, dest) {
  mkdirSync(dest, { recursive: true })
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name)
    const to = path.join(dest, entry.name)
    // Next tracing emits absolute symlinks into the workspace (e.g. the
    // Prisma client). Dereference them so the bundle stays self-contained.
    if (entry.isSymbolicLink()) {
      const real = realpathSync(from)
      if (statSync(real).isDirectory()) copyDir(real, to)
      else copyFileSync(real, to)
    } else if (entry.isDirectory()) {
      copyDir(from, to)
    } else {
      copyFileSync(from, to)
    }
  }
}

function main() {
  if (!existsSync(KEY)) {
    throw new Error(`missing SSH key ${KEY}; provisioning step 1 not done`)
  }

  if (!skipBuild) {
    console.log("[deploy] building standalone bundle...")
    run("npm", ["run", "build"], { cwd: root })
  }

  const standalone = path.join(root, ".next", "standalone")
  if (!existsSync(path.join(standalone, "server.js"))) {
    throw new Error("standalone server.js missing; run a full build first")
  }

  const debianEngine = existsSync(
    path.join(standalone, "node_modules", ".prisma", "client", "libquery_engine-debian-openssl-3.0.x.so.node")
  )
  if (!debianEngine) {
    throw new Error("debian prisma engine missing from standalone bundle; run `npm run db:generate` and rebuild")
  }

  console.log("[deploy] staging bundle...")
  const stage = path.join(root, ".deploy-stage")
  rmSync(stage, { recursive: true, force: true })
  mkdirSync(path.join(stage, "app"), { recursive: true })
  copyDir(standalone, path.join(stage, "app"))
  copyDir(path.join(root, ".next", "static"), path.join(stage, "app", ".next", "static"))
  if (existsSync(path.join(root, "public"))) {
    copyDir(path.join(root, "public"), path.join(stage, "app", "public"))
  }
  mkdirSync(path.join(stage, "prisma"), { recursive: true })
  copyFileSync(path.join(root, "prisma", "schema.prisma"), path.join(stage, "prisma", "schema.prisma"))
  copyDir(path.join(root, "prisma", "migrations"), path.join(stage, "prisma", "migrations"))
  const prismaVersion = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")).dependencies.prisma
  writeFileSync(
    path.join(stage, "package.json"),
    `${JSON.stringify({ name: "foodtracker-deploy-tools", private: true, dependencies: { prisma: prismaVersion } }, null, 2)}\n`
  )

  console.log("[deploy] packing...")
  run("tar", ["-czf", ".deploy-stage/bundle.tgz", "-C", ".deploy-stage", "app", "prisma", "package.json"], { cwd: root })

  console.log("[deploy] uploading...")
  run("scp", [
    "-o", "BatchMode=yes",
    "-i", KEY,
    path.join(stage, "bundle.tgz"),
    `${USER}@${HOST}:${APP_DIR}/bundle.tgz`,
  ])

  console.log("[deploy] remote release + migrate + restart...")
  sshRemote(`
cd ${APP_DIR}
TS=$(date +%Y%m%d%H%M%S)
mkdir -p releases/$TS shared/database shared/data shared/deploy-tools
tar -xzf bundle.tgz -C releases/$TS
ln -sfn ${APP_DIR}/releases/$TS/app/database releases/$TS/app/database
ln -sfn ${APP_DIR}/shared/data releases/$TS/app/data
ln -sfn ${APP_DIR}/releases/$TS current
if [ ! -d shared/deploy-tools/node_modules/prisma ]; then
  cp releases/$TS/package.json shared/deploy-tools/package.json
  export PATH=${NODE_BIN}:$PATH
  cd shared/deploy-tools && npm install --no-audit --no-fund && cd ${APP_DIR}
fi
rm -rf shared/deploy-tools/prisma
cp -r releases/$TS/prisma shared/deploy-tools/prisma
export PATH=${NODE_BIN}:$PATH
cd shared/deploy-tools
DATABASE_URL='${DB_URL}' ./node_modules/.bin/prisma migrate deploy
cd ${APP_DIR}
sudo -n systemctl restart foodtracker
sleep 2
CODE=$(curl -s -o /tmp/ft-smoke.html -w '%{http_code}' http://127.0.0.1:${PORT}/access || true)
echo "smoke /access -> $CODE"
if [ "$CODE" != "200" ]; then
  sudo -n systemctl status foodtracker --no-pager -l | tail -20
  exit 1
fi
API_CODE=$(curl -s -o /tmp/ft-smoke-api.json -w '%{http_code}' http://127.0.0.1:${PORT}/api/users || true)
echo "smoke anonymous /api/users -> $API_CODE"
if [ "$API_CODE" != "401" ] && [ "$API_CODE" != "200" ]; then
  sudo -n systemctl status foodtracker --no-pager -l | tail -20
  exit 1
fi
echo "deploy $TS complete"
`)

  console.log("[deploy] done.")
}

main()
