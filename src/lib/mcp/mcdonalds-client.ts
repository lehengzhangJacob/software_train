import "server-only"

import { Client } from "@modelcontextprotocol/sdk/client/index.js"
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js"
import {
  MCP_MAX_OUTPUT_BYTES,
  MCP_TIMEOUT_MS,
  MCDONALD_TOOL_DEFINITIONS,
  McpToolError,
  type McDonaldToolName,
} from "@/lib/mcp/contracts"
import { getMcDonaldMcpConfig, type McDonaldMcpConfig } from "@/lib/mcp/settings"
import type { AgentTraceReporter } from "@/lib/agent/trace"

export interface McDonaldMcpSession {
  listTools(): Promise<string[]>
  callTool(name: McDonaldToolName, input?: Record<string, unknown>): Promise<unknown>
}

function parseToolResult(result: Awaited<ReturnType<Client["callTool"]>>) {
  if (result.isError) throw new McpToolError("麦当劳 MCP 工具执行失败")
  const structured = "structuredContent" in result ? result.structuredContent : undefined
  if (structured !== undefined) return structured

  const content = Array.isArray(result.content)
    ? result.content as Array<{ type?: unknown; text?: unknown }>
    : []
  const text = content
    .flatMap((item) => item.type === "text" && typeof item.text === "string" ? [item.text] : [])
    .join("\n")
    .trim()
  if (!text) return null
  if (Buffer.byteLength(text, "utf8") > MCP_MAX_OUTPUT_BYTES) throw new McpToolError("麦当劳 MCP 工具输出过大")
  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

async function connectMcDonaldMcp(config: McDonaldMcpConfig) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), MCP_TIMEOUT_MS)
  const client = new Client({ name: "nutrition-agent", version: "0.1.0" })
  const transport = new StreamableHTTPClientTransport(new URL(config.endpoint), {
    requestInit: {
      headers: { Authorization: `Bearer ${config.token}` },
      signal: controller.signal,
    },
  })

  try {
    await client.connect(transport)
    return { client, timeout }
  } catch (error) {
    clearTimeout(timeout)
    await client.close().catch(() => undefined)
    if (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")) {
      throw new McpToolError("连接麦当劳 MCP 超时")
    }
    throw new McpToolError("无法连接麦当劳 MCP，请检查 Token 是否有效")
  }
}

export async function withMcDonaldMcp<T>(
  run: (session: McDonaldMcpSession) => Promise<T>,
  config?: McDonaldMcpConfig,
  accountId?: number,
  reportTrace?: AgentTraceReporter,
) {
  const connection = await connectMcDonaldMcp(config ?? await getMcDonaldMcpConfig(accountId))
  const session: McDonaldMcpSession = {
    async listTools() {
      const result = await connection.client.listTools()
      return result.tools.map((tool) => tool.name)
    },
    async callTool(name, input = {}) {
      const definition = MCDONALD_TOOL_DEFINITIONS.find((tool) => tool.name === name)
      const startedAt = Date.now()
      const started = await reportTrace?.({
        eventType: "tool.started",
        status: "running",
        label: definition?.label ?? "调用麦当劳工具",
        toolName: name,
        safeSummary: "已通过工具白名单，开始调用",
      })
      const parentId = started && typeof started === "object" && "eventId" in started ? started.eventId : undefined
      try {
        const parsed = parseToolResult(await connection.client.callTool({ name, arguments: input }))
        await reportTrace?.({
          eventType: "tool.result",
          status: "completed",
          label: definition?.label ?? "调用麦当劳工具",
          toolName: name,
          ...(parentId ? { parentId } : {}),
          durationMs: Date.now() - startedAt,
          safeSummary: "工具返回已解析，原始结果已隔离",
        })
        return parsed
      } catch (error) {
        await reportTrace?.({
          eventType: "tool.result",
          status: "failed",
          label: definition?.label ?? "调用麦当劳工具",
          toolName: name,
          ...(parentId ? { parentId } : {}),
          durationMs: Date.now() - startedAt,
          safeSummary: "工具调用失败",
        })
        throw error
      }
    },
  }
  try {
    return await run(session)
  } catch (error) {
    if (error instanceof McpToolError) throw error
    if (error instanceof Error && (error.name === "AbortError" || error.name === "TimeoutError")) {
      throw new McpToolError("麦当劳 MCP 工具请求超时")
    }
    throw new McpToolError("麦当劳 MCP 工具执行失败")
  } finally {
    clearTimeout(connection.timeout)
    await connection.client.close().catch(() => undefined)
  }
}

export async function probeMcDonaldMcp(config?: McDonaldMcpConfig, accountId?: number) {
  return withMcDonaldMcp(async (session) => {
    const tools = await session.listTools()
    const required = ["delivery-query-addresses", "delivery-query-stores", "query-meals", "calculate-price", "create-order", "query-order"]
    const missing = required.filter((tool) => !tools.includes(tool))
    if (missing.length) throw new McpToolError("麦当劳 MCP 缺少必要点餐工具")
    return { toolCount: tools.length, orderingTools: required }
  }, config, accountId)
}
