import { spawn } from "node:child_process"
import fs from "node:fs"
import net from "node:net"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const buildId = path.join(root, ".next", "BUILD_ID")
const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next")
const timeoutMs = 20_000

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
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
  const deadline = Date.now() + timeoutMs
  let lastError = null

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

  throw lastError ?? new Error("Timed out waiting for the production server")
}

async function stopProcess(process) {
  if (process.exitCode !== null) return

  process.kill("SIGTERM")
  const exited = await Promise.race([
    new Promise((resolve) => process.once("exit", resolve)),
    sleep(5_000),
  ])

  if (exited === undefined && process.exitCode === null) {
    process.kill("SIGKILL")
  }
}

async function main() {
  assert(fs.existsSync(buildId), "Missing production build. Run npm run build before npm run smoke.")
  assert(fs.existsSync(nextBin), "Next.js binary is missing. Run npm install first.")

  const port = await reserveLoopbackPort()
  const baseUrl = `http://127.0.0.1:${port}`
  let output = ""
  const server = spawn(process.execPath, [nextBin, "start", "--hostname", "127.0.0.1", "--port", String(port)], {
    cwd: root,
    env: { ...process.env, NODE_ENV: "production" },
    stdio: ["ignore", "pipe", "pipe"],
  })

  const capture = (chunk) => {
    output = (output + chunk.toString()).slice(-8_000)
  }
  server.stdout.on("data", capture)
  server.stderr.on("data", capture)

  try {
    const home = await waitForResponse(`${baseUrl}/`)
    assert(home.headers.get("content-type")?.includes("text/html"), "Home page did not return HTML")

    const report = await fetch(`${baseUrl}/api/reports?period=weekly`)
    const reportBody = await report.json()
    assert([200, 404].includes(report.status), "Report endpoint returned an unexpected status")
    if (report.status === 404) {
      assert(reportBody?.data === null && typeof reportBody?.error === "string", "Profile-required API error envelope is invalid")
    } else {
      assert(reportBody?.error === null && Array.isArray(reportBody?.data?.daily), "Report API success envelope is invalid")
    }

    const invalidReport = await fetch(`${baseUrl}/api/reports?period=invalid`)
    assert(invalidReport.status === 422, "Invalid report period should be rejected before any external call")

    console.log(`Release smoke passed on ${baseUrl}`)
  } catch (error) {
    const detail = output ? `\nServer output:\n${output}` : ""
    throw new Error(`${error instanceof Error ? error.message : String(error)}${detail}`)
  } finally {
    await stopProcess(server)
  }
}

main().catch((error) => {
  console.error("Release smoke failed.", error)
  process.exitCode = 1
})
