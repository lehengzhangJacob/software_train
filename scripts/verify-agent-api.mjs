import { spawn } from "node:child_process"
import { copyFile, mkdtemp, rm } from "node:fs/promises"
import { createServer } from "node:http"
import net from "node:net"
import path from "node:path"
import { DatabaseSync } from "node:sqlite"

const root = process.cwd()
const runtimeDatabase = path.join(root, "database", "food_tracker.db")
const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next")
const buildId = path.join(root, ".next", "BUILD_ID")

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
  assert(address && typeof address !== "string", "Unable to reserve loopback port")
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
  return address.port
}

function databaseUrl(databasePath) {
  return `file:${path.relative(path.join(root, "prisma"), databasePath).replaceAll("\\", "/")}`
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
  throw lastError ?? new Error("Timed out waiting for Agent API server")
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

const temporaryRoot = await mkdtemp(path.join(root, "data", "agent-api-"))
let provider
let app
try {
  const databasePath = path.join(temporaryRoot, "agent.db")
  await copyFile(runtimeDatabase, databasePath)
  const database = new DatabaseSync(databasePath)
  const baselineThreadCount = Number(database.prepare("SELECT COUNT(*) AS count FROM agent_threads").get().count)

  const providerPort = await reserveLoopbackPort()
  provider = createServer(async (request, response) => {
    if (request.method !== "POST") {
      response.writeHead(404)
      response.end()
      return
    }
    response.setHeader("Content-Type", "application/json")
    response.end(JSON.stringify({
      choices: [{ message: { content: "结合你的记录，今晚可以把蛋白质和蔬菜补齐。<memory-candidates>[{\"category\":\"preference\",\"content\":\"工作日晚餐希望清淡一些\",\"importance\":0.8,\"confidence\":0.75}]</memory-candidates>" } }],
    }))
  })
  await new Promise((resolve, reject) => provider.listen(providerPort, "127.0.0.1", (error) => (error ? reject(error) : resolve())))

  const appPort = await reserveLoopbackPort()
  const baseUrl = `http://127.0.0.1:${appPort}`
  app = spawn(process.execPath, [nextBin, "start", "--hostname", "127.0.0.1", "--port", String(appPort)], {
    cwd: root,
    env: {
      ...process.env,
      NODE_ENV: "production",
      DATABASE_URL: databaseUrl(databasePath),
      STEP_API_KEY: "agent-test-key",
      STEP_API_BASE_URL: `http://127.0.0.1:${providerPort}/v1`,
      STEP_API_MODEL: "local-test-model",
    },
    stdio: ["ignore", "pipe", "pipe"],
  })
  let output = ""
  const capture = (chunk) => { output = (output + chunk.toString()).slice(-8_000) }
  app.stdout.on("data", capture)
  app.stderr.on("data", capture)

  try {
    await waitForResponse(`${baseUrl}/api/agent/threads`)
    const initial = await jsonRequest(`${baseUrl}/api/agent/threads`)
    assert(initial.response.status === 200 && initial.body.data.length === baselineThreadCount, "Agent thread list did not preserve the existing local state")

    const chat = await jsonRequest(`${baseUrl}/api/agent/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "我最近晚餐总是太油，怎么调整？" }),
    })
    assert(chat.response.status === 200, `Agent chat failed: ${JSON.stringify(chat.body)}`)
    assert(chat.body.data?.thread?.messages?.length === 2, "Chat did not persist both messages")
    assert(chat.body.data?.assistantMessage?.memoryCandidates?.length === 1, "Memory candidate was not returned")

    const threadId = chat.body.data.thread.threadId
    const messageId = chat.body.data.assistantMessage.messageId
    assert(Number(database.prepare("SELECT COUNT(*) AS count FROM memory_items").get().count) === 0, "Candidate was persisted before confirmation")

    const confirmed = await jsonRequest(`${baseUrl}/api/agent/memory-candidates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId, candidateIndex: 0 }),
    })
    assert(confirmed.response.status === 201 && confirmed.body.data?.isUserConfirmed === true, "Candidate confirmation failed")
    assert(Number(database.prepare("SELECT COUNT(*) AS count FROM memory_items").get().count) === 1, "Confirmed memory was not persisted")

    const confirmedAgain = await jsonRequest(`${baseUrl}/api/agent/memory-candidates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId, candidateIndex: 0 }),
    })
    assert(confirmedAgain.response.status === 201, "Repeated confirmation was not idempotent")
    assert(Number(database.prepare("SELECT COUNT(*) AS count FROM memory_items").get().count) === 1, "Repeated confirmation duplicated memory")

    const deleted = await jsonRequest(`${baseUrl}/api/agent/threads?id=${threadId}`, { method: "DELETE" })
    assert(deleted.response.status === 200, "Thread delete failed")
    assert(Number(database.prepare("SELECT COUNT(*) AS count FROM memory_items").get().count) === 1, "Thread delete removed durable memory")
    assert(database.prepare("SELECT source_message_id AS sourceMessageId FROM memory_items").get().sourceMessageId === null, "Memory source was not detached after thread delete")
    database.close()
  } catch (error) {
    throw new Error(`${error instanceof Error ? error.message : String(error)}\nServer output:\n${output}`)
  }

  console.log(JSON.stringify({
    threadPersistence: "pass",
    candidateConfirmationGate: "pass",
    confirmationIdempotency: "pass",
    memorySurvivesThreadDelete: "pass",
  }))
} finally {
  if (app) await stopProcess(app)
  if (provider) await new Promise((resolve) => provider.close(() => resolve()))
  await rm(temporaryRoot, { recursive: true, force: true })
}
