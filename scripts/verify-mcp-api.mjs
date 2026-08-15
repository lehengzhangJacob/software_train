import { spawn } from "node:child_process"
import { createServer } from "node:http"
import net from "node:net"
import path from "node:path"

const root = process.cwd()
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
  throw lastError ?? new Error("Timed out waiting for MCP API server")
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

let submitCalls = 0
let connector
let app
try {
  const connectorPort = await reserveLoopbackPort()
  connector = createServer(async (request, response) => {
    let body = ""
    for await (const chunk of request) body += chunk
    const payload = JSON.parse(body)
    response.setHeader("Content-Type", "application/json")
    if (payload.tool === "nearby_takeout_search") {
      response.end(JSON.stringify({ results: Array.from({ length: 24 }, (_, index) => ({
        id: `r-${index + 1}`,
        name: `测试餐厅 ${index + 1}\n额外文本`,
        cuisine: "轻食",
        distanceKm: index / 10,
        estimatedMinutes: 20 + index,
        deliveryFeeCents: 300,
        secret: "must-not-pass-through",
      })) }))
      return
    }
    if (payload.tool === "takeout_order_submit") {
      submitCalls += 1
      response.end(JSON.stringify({ status: "accepted", orderId: "order-local-1", message: "connector accepted" }))
      return
    }
    response.writeHead(404)
    response.end(JSON.stringify({ error: "unknown tool" }))
  })
  await new Promise((resolve, reject) => connector.listen(connectorPort, "127.0.0.1", (error) => (error ? reject(error) : resolve())))

  const appPort = await reserveLoopbackPort()
  const baseUrl = `http://127.0.0.1:${appPort}`
  app = spawn(process.execPath, [nextBin, "start", "--hostname", "127.0.0.1", "--port", String(appPort)], {
    cwd: root,
    env: {
      ...process.env,
      NODE_ENV: "production",
      TAKEOUT_MCP_URL: `http://127.0.0.1:${connectorPort}`,
      TAKEOUT_MCP_API_KEY: "mcp-test-key",
    },
    stdio: ["ignore", "pipe", "pipe"],
  })
  let output = ""
  const capture = (chunk) => { output = (output + chunk.toString()).slice(-8_000) }
  app.stdout.on("data", capture)
  app.stderr.on("data", capture)

  try {
    await waitForResponse(`${baseUrl}/api/mcp/tools`)
    const tools = await jsonRequest(`${baseUrl}/api/mcp/tools`)
    assert(tools.response.status === 200, "MCP tool discovery failed")
    assert(tools.body.data.tools.some((tool) => tool.name === "nearby_takeout_search" && tool.configured), "Configured search tool was not reported")
    assert(!JSON.stringify(tools.body).includes("mcp-test-key"), "MCP credential was exposed")

    const search = await jsonRequest(`${baseUrl}/api/mcp/takeout/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ location: "徐汇区", query: "轻食" }),
    })
    assert(search.response.status === 200 && search.body.data.results.length === 20, "Search output limit was not enforced")
    assert(!JSON.stringify(search.body).includes("must-not-pass-through"), "Untrusted MCP field crossed the output boundary")
    assert(!search.body.data.results[0].name.includes("\n"), "MCP text was not normalized")

    const noToken = await jsonRequest(`${baseUrl}/api/mcp/takeout/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ draft: {} }),
    })
    assert(noToken.response.status === 409 && submitCalls === 0, "Order submit accepted a missing confirmation token")

    const draftInput = {
      restaurantId: "r-1",
      restaurantName: "测试餐厅 1",
      deliveryAddress: "徐汇区某路 1 号",
      note: "少油",
      items: [{ name: "鸡胸沙拉", quantity: 1, unitPriceCents: 3200 }],
    }
    const draft = await jsonRequest(`${baseUrl}/api/mcp/takeout/draft`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draftInput),
    })
    assert(draft.response.status === 201 && draft.body.data.confirmation?.token, "Order draft did not issue a confirmation token")

    const tampered = await jsonRequest(`${baseUrl}/api/mcp/takeout/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        confirmationToken: draft.body.data.confirmation.token,
        draft: { ...draft.body.data, deliveryAddress: "被篡改的地址" },
      }),
    })
    assert(tampered.response.status === 409 && submitCalls === 0, "Tampered order reached the external connector")

    const confirmed = await jsonRequest(`${baseUrl}/api/mcp/takeout/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmationToken: draft.body.data.confirmation.token, draft: draft.body.data }),
    })
    assert(confirmed.response.status === 200 && confirmed.body.data.orderId === "order-local-1" && submitCalls === 1, "Confirmed order did not reach the connector exactly once")

    const replay = await jsonRequest(`${baseUrl}/api/mcp/takeout/confirm`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirmationToken: draft.body.data.confirmation.token, draft: draft.body.data }),
    })
    assert(replay.response.status === 409 && submitCalls === 1, "Confirmation token replay triggered another submit")
  } catch (error) {
    throw new Error(`${error instanceof Error ? error.message : String(error)}\nServer output:\n${output}`)
  }

  console.log(JSON.stringify({
    toolDiscovery: "pass",
    untrustedOutputIsolation: "pass",
    confirmationBinding: "pass",
    replayProtection: "pass",
  }))
} finally {
  if (app) await stopProcess(app)
  if (connector) await new Promise((resolve) => connector.close(() => resolve()))
}
