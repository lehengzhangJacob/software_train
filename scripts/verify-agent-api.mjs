import { spawn } from "node:child_process"
import { copyFile, mkdtemp, rename, rm, writeFile } from "node:fs/promises"
import { createServer } from "node:http"
import { existsSync } from "node:fs"
import net from "node:net"
import path from "node:path"
import { DatabaseSync } from "node:sqlite"

const root = process.cwd()
const runtimeDatabase = path.join(root, "database", "food_tracker.db")
const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next")
const buildId = path.join(root, ".next", "BUILD_ID")
const candidateContent = "周三加班时倾向选择少油的热饭"
const credentialsPath = path.join(root, "data", "credentials.json")
const credentialsBackupPath = path.join(root, "data", "credentials.agent-api-backup.json")

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

async function streamRequest(url, init) {
  const response = await fetch(url, init)
  const text = await response.text()
  const events = text
    .split("\n\n")
    .filter(Boolean)
    .map((block) => {
      const event = block.match(/^event: (.+)$/m)?.[1] ?? ""
      const data = block.match(/^data: (.+)$/m)?.[1] ?? "{}"
      return { event, data: JSON.parse(data) }
    })
  return { response, events }
}

assert(await import("node:fs").then(({ existsSync }) => existsSync(buildId)), "Missing production build")

const temporaryRoot = await mkdtemp(path.join(root, "data", "agent-api-"))
let provider
let app
let database
let credentialsBackedUp = false
try {
  const databasePath = path.join(temporaryRoot, "agent.db")
  await copyFile(runtimeDatabase, databasePath)
  database = new DatabaseSync(databasePath)
  database.exec("PRAGMA foreign_keys = ON")
  const primaryUserId = Number(database.prepare("SELECT MIN(user_id) AS userId FROM user_profile").get().userId)
  database.prepare("DELETE FROM memory_items WHERE user_id = ? AND category = ? AND content = ?").run(primaryUserId, "preference", candidateContent)
  const baselineThreadCount = Number(database.prepare("SELECT COUNT(*) AS count FROM agent_threads WHERE user_id = ?").get(primaryUserId).count)
  const providerRequests = []

  const providerPort = await reserveLoopbackPort()
  provider = createServer(async (request, response) => {
    if (request.method !== "POST") {
      response.writeHead(404)
      response.end()
      return
    }
    let rawBody = ""
    for await (const chunk of request) rawBody += chunk.toString()
    providerRequests.push(JSON.parse(rawBody))
    response.setHeader("Content-Type", "application/json")
    response.end(JSON.stringify({
      choices: [{ message: { content: `结合你的记录，今晚可以把蛋白质和蔬菜补齐。<memory-candidates>[{"category":"preference","content":"${candidateContent}","importance":0.8,"confidence":0.75}]</memory-candidates>` } }],
    }))
  })
  await new Promise((resolve, reject) => provider.listen(providerPort, "127.0.0.1", (error) => (error ? reject(error) : resolve())))

  assert(!existsSync(credentialsBackupPath), "Stale Agent API credential backup must be restored before verification")
  if (existsSync(credentialsPath)) {
    await rename(credentialsPath, credentialsBackupPath)
    credentialsBackedUp = true
  }
  await writeFile(credentialsPath, `${JSON.stringify({
    version: 1,
    activeProvider: "stepfun",
    providers: {
      stepfun: {
        baseUrl: `http://127.0.0.1:${providerPort}/v1`,
        model: "local-test-model",
        apiKey: "agent-test-key",
        updatedAt: new Date().toISOString(),
      },
    },
  }, null, 2)}\n`, "utf8")

  const appPort = await reserveLoopbackPort()
  const baseUrl = `http://127.0.0.1:${appPort}`
  app = spawn(process.execPath, [nextBin, "start", "--hostname", "127.0.0.1", "--port", String(appPort)], {
    cwd: root,
    env: {
      ...process.env,
      NODE_ENV: "production",
      DATABASE_URL: databaseUrl(databasePath),
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
    const exactMemories = () => database.prepare("SELECT memory_id AS memoryId, source_message_id AS sourceMessageId, status, is_user_confirmed AS isUserConfirmed FROM memory_items WHERE user_id = ? AND category = ? AND content = ? ORDER BY memory_id").all(primaryUserId, "preference", candidateContent)
    let memories = exactMemories()
    assert(memories.length === 1, "Candidate was not materialized automatically")
    const memoryId = Number(memories[0].memoryId)
    assert(memories[0].status === "active" && Number(memories[0].isUserConfirmed) === 0, "Automatic memory provenance was incorrect")
    assert(chat.body.data.assistantMessage.memoryCandidates[0].memoryId === memoryId, "Assistant metadata did not reference the automatic memory")

    const confirmed = await jsonRequest(`${baseUrl}/api/agent/memory-candidates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId, candidateIndex: 0 }),
    })
    assert(confirmed.response.status === 201 && confirmed.body.data?.memoryId === memoryId && confirmed.body.data?.isUserConfirmed === true, "Legacy candidate confirmation compatibility failed")

    const duplicate = await jsonRequest(`${baseUrl}/api/agent/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threadId, message: "这周也想保持清淡一点。" }),
    })
    assert(duplicate.response.status === 200, "Second Agent turn failed")
    assert(providerRequests.length >= 2 && providerRequests[1].messages?.[0]?.content?.includes(candidateContent), "Automatic memory was not available to the next Agent turn")
    memories = exactMemories()
    assert(memories.length === 1, "Repeated inference duplicated the active memory")
    assert(duplicate.body.data?.assistantMessage?.memoryCandidates?.[0]?.memoryId === memoryId, "Repeated inference did not reuse the active memory")

    const disabled = await jsonRequest(`${baseUrl}/api/memories`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ memoryId, status: "disabled" }),
    })
    assert(disabled.response.status === 200 && disabled.body.data?.status === "disabled", "Automatic memory could not be disabled")

    const suppressed = await jsonRequest(`${baseUrl}/api/agent/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ threadId, message: "继续给我一个晚餐建议。" }),
    })
    assert(suppressed.response.status === 200, "Suppression verification turn failed")
    assert(providerRequests.length >= 3 && !providerRequests[2].messages?.[0]?.content?.includes(candidateContent), "Disabled memory remained in Agent context")
    memories = exactMemories()
    assert(memories.length === 1 && memories[0].status === "disabled", "Disabled duplicate was recreated or reactivated")
    assert(suppressed.body.data?.assistantMessage?.memoryCandidates?.[0]?.memoryId === null, "Suppressed inference was linked to a durable memory")

    const streamed = await streamRequest(`${baseUrl}/api/agent/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify({ threadId, message: "stream health advice" }),
    })
    assert(streamed.response.status === 200, "Agent activity stream did not return HTTP 200")
    assert(streamed.response.headers.get("content-type")?.includes("text/event-stream"), "Agent activity stream content type was incorrect")
    assert(streamed.events.some((event) => event.event === "activity"), "Agent activity stream did not emit activity")
    const done = streamed.events.find((event) => event.event === "done")
    assert(done?.data?.data?.activity?.some((step) => step.status === "completed"), "Agent activity stream did not return completed steps")
    assert(done?.data?.data?.thread?.messages?.length === 8, "Agent activity stream did not persist both messages")

    const deleted = await jsonRequest(`${baseUrl}/api/agent/threads?id=${threadId}`, { method: "DELETE" })
    assert(deleted.response.status === 200, "Thread delete failed")
    memories = exactMemories()
    assert(memories.length === 1, "Thread delete removed durable memory")
    assert(memories[0].sourceMessageId === null, "Memory source was not detached after thread delete")
  } catch (error) {
    throw new Error(`${error instanceof Error ? error.message : String(error)}\nServer output:\n${output}`)
  }

  console.log(JSON.stringify({
    threadPersistence: "pass",
    automaticMemoryMaterialization: "pass",
    nextTurnContext: "pass",
    activeDuplicateReuse: "pass",
    disabledDuplicateSuppression: "pass",
    legacyConfirmationCompatibility: "pass",
    memorySurvivesThreadDelete: "pass",
    activityStream: "pass",
  }))
} finally {
  if (app) await stopProcess(app)
  if (provider) await new Promise((resolve) => provider.close(() => resolve()))
  if (database) database.close()
  await rm(credentialsPath, { force: true })
  if (credentialsBackedUp) await rename(credentialsBackupPath, credentialsPath)
  await rm(temporaryRoot, { recursive: true, force: true })
}
