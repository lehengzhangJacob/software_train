import { spawn } from "node:child_process"
import { copyFile, mkdir, mkdtemp, rm } from "node:fs/promises"
import net from "node:net"
import path from "node:path"
import { DatabaseSync } from "node:sqlite"

const root = process.cwd()
const buildId = path.join(root, ".next", "BUILD_ID")
const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next")
const runtimeDatabase = path.join(root, "database", "food_tracker.db")

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function databaseUrl(databasePath) {
  return `file:${path.relative(path.join(root, "prisma"), databasePath).replaceAll("\\", "/")}`
}

async function reserveLoopbackPort() {
  const server = net.createServer()
  await new Promise((resolve, reject) => {
    server.once("error", reject)
    server.listen(0, "127.0.0.1", resolve)
  })
  const address = server.address()
  assert(address && typeof address !== "string", "Unable to reserve a loopback port")
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
  return address.port
}

async function waitForResponse(url) {
  const deadline = Date.now() + 20_000
  let lastError
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url)
      if (response.ok) return response
      lastError = new Error(`Unexpected HTTP ${response.status}`)
    } catch (error) {
      lastError = error
    }
    await sleep(250)
  }
  throw lastError ?? new Error("Timed out waiting for memory API server")
}

async function stopProcess(process) {
  if (process.exitCode !== null) return
  process.kill("SIGTERM")
  await Promise.race([
    new Promise((resolve) => process.once("exit", resolve)),
    sleep(5_000),
  ])
  if (process.exitCode === null) process.kill("SIGKILL")
}

async function jsonRequest(url, init) {
  const response = await fetch(url, init)
  return { response, body: await response.json() }
}

assert(await import("node:fs").then(({ existsSync }) => existsSync(buildId)), "Missing production build")

const verificationRoot = path.join(root, "data")
await mkdir(verificationRoot, { recursive: true })
const temporaryRoot = await mkdtemp(path.join(verificationRoot, "memory-api-"))
const safeTemporaryRoot = path.resolve(verificationRoot) + path.sep
assert(path.resolve(temporaryRoot).startsWith(safeTemporaryRoot), "temporary API path escaped repository data directory")

let server
try {
  const databasePath = path.join(temporaryRoot, "api.db")
  await copyFile(runtimeDatabase, databasePath)

  const database = new DatabaseSync(databasePath)
  database.exec("PRAGMA foreign_keys = ON")
  const secondaryUser = database.prepare("SELECT MAX(user_id) AS id FROM user_profile").get().id
  const foreignMemoryId = Number(database.prepare("INSERT INTO memory_items (user_id, category, content, source_kind, status, is_user_confirmed) VALUES (?, ?, ?, ?, ?, ?)").run(secondaryUser, "context", "secondary profile memory", "user", "active", 1).lastInsertRowid)
  database.close()

  const port = await reserveLoopbackPort()
  const baseUrl = `http://127.0.0.1:${port}`
  server = spawn(process.execPath, [nextBin, "start", "--hostname", "127.0.0.1", "--port", String(port)], {
    cwd: root,
    env: { ...process.env, NODE_ENV: "production", DATABASE_URL: databaseUrl(databasePath) },
    stdio: ["ignore", "pipe", "pipe"],
  })
  let output = ""
  const capture = (chunk) => { output = (output + chunk.toString()).slice(-8_000) }
  server.stdout.on("data", capture)
  server.stderr.on("data", capture)

  try {
    await waitForResponse(`${baseUrl}/api/memories?status=all`)

    const initial = await jsonRequest(`${baseUrl}/api/memories?status=all`)
    assert(initial.response.status === 200 && Array.isArray(initial.body.data) && initial.body.data.length === 0, "primary profile memory list was not isolated")

    const created = await jsonRequest(`${baseUrl}/api/memories`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        category: "preference",
        content: "晚餐更喜欢清淡口味",
        importance: 0.8,
        userId: secondaryUser,
        sourceKind: "agent_inference",
      }),
    })
    assert(created.response.status === 201, "memory creation failed")
    assert(created.body.data?.sourceKind === "user" && created.body.data?.isUserConfirmed === true, "server-owned provenance was not enforced")
    assert(!Object.hasOwn(created.body.data ?? {}, "userId"), "memory API exposed userId")
    const memoryId = created.body.data.memoryId

    const foreignUpdate = await jsonRequest(`${baseUrl}/api/memories`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memoryId: foreignMemoryId, content: "ownership bypass" }),
    })
    assert(foreignUpdate.response.status === 404, "secondary profile memory was writable")

    const disabled = await jsonRequest(`${baseUrl}/api/memories`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memoryId, status: "disabled" }),
    })
    assert(disabled.response.status === 200 && disabled.body.data?.status === "disabled", "memory disable failed")

    const active = await jsonRequest(`${baseUrl}/api/memories?status=active`)
    assert(active.response.status === 200 && active.body.data.length === 0, "disabled memory appeared in active filter")

    const deleted = await jsonRequest(`${baseUrl}/api/memories?id=${memoryId}`, { method: "DELETE" })
    assert(deleted.response.status === 200 && deleted.body.data?.deleted === true, "memory delete failed")

    const foreignDelete = await jsonRequest(`${baseUrl}/api/memories?id=${foreignMemoryId}`, { method: "DELETE" })
    assert(foreignDelete.response.status === 404, "secondary profile memory was deletable")
  } catch (error) {
    throw new Error(`${error instanceof Error ? error.message : String(error)}\nServer output:\n${output}`)
  }

  console.log(JSON.stringify({
    primaryProfileIsolation: "pass",
    serverOwnedProvenance: "pass",
    disableAndFilter: "pass",
    hardDelete: "pass",
  }))
} finally {
  if (server) await stopProcess(server)
  await rm(temporaryRoot, { recursive: true, force: true })
}
