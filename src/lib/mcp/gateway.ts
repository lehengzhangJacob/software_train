import "server-only"

import {
  MCDONALD_TOOL_DEFINITIONS,
  MCP_MAX_INPUT_BYTES,
  MCP_MAX_OUTPUT_BYTES,
  MCP_TIMEOUT_MS,
  McpToolError,
  type NearbyTakeoutSearchInput,
  type TakeoutOrderSubmission,
  type TakeoutSearchResult,
} from "@/lib/mcp/contracts"
import { getMcDonaldMcpConfig, getPublicMcDonaldSettings } from "@/lib/mcp/settings"

function safeText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.replace(/[\r\n]+/g, " ").trim().slice(0, maxLength) : ""
}

function finiteNumber(value: unknown, min: number, max: number) {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max ? value : null
}

function parseSearchResults(value: unknown): TakeoutSearchResult[] {
  const array = Array.isArray(value)
    ? value
    : value && typeof value === "object" && Array.isArray((value as { results?: unknown }).results)
      ? (value as { results: unknown[] }).results
      : []

  return array.slice(0, 20).flatMap((item, index) => {
    if (!item || typeof item !== "object") return []
    const record = item as Record<string, unknown>
    const name = safeText(record.name, 160)
    if (!name) return []
    return [{
      id: safeText(record.id, 120) || `result-${index + 1}`,
      name,
      cuisine: safeText(record.cuisine, 80) || null,
      distanceKm: finiteNumber(record.distanceKm, 0, 500),
      estimatedMinutes: finiteNumber(record.estimatedMinutes, 1, 1_440),
      deliveryFeeCents: finiteNumber(record.deliveryFeeCents, 0, 10_000_000),
      priceRange: safeText(record.priceRange, 40) || null,
      description: safeText(record.description, 400) || null,
      url: safeText(record.url, 2_048) || null,
    }]
  })
}

async function callConfiguredMcp(tool: string, input: unknown, accountId?: number) {
  const config = await getMcDonaldMcpConfig(accountId)
  const body = JSON.stringify({ tool, input })
  if (Buffer.byteLength(body, "utf8") > MCP_MAX_INPUT_BYTES) throw new McpToolError("MCP 请求参数过大")

  let response: Response
  try {
    response = await fetch(config.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.token}`,
      },
      body,
      signal: AbortSignal.timeout(MCP_TIMEOUT_MS),
    })
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      throw new McpToolError("MCP 工具请求超时")
    }
    throw new McpToolError("无法连接 MCP 工具服务")
  }
  if (!response.ok) throw new McpToolError("MCP 工具服务返回了失败状态")

  const text = await response.text()
  if (Buffer.byteLength(text, "utf8") > MCP_MAX_OUTPUT_BYTES) throw new McpToolError("MCP 工具输出过大")
  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new McpToolError("MCP 工具返回了无效 JSON")
  }
}

export async function listMcpTools(accountId?: number) {
  const configured = (await getPublicMcDonaldSettings(accountId)).tokenConfigured
  return MCDONALD_TOOL_DEFINITIONS.map((tool) => ({
    ...tool,
    configured,
  }))
}

export async function searchNearbyTakeout(input: NearbyTakeoutSearchInput, accountId?: number) {
  const result = await callConfiguredMcp("nearby_takeout_search", input, accountId)
  return parseSearchResults(result)
}

export async function assertConfiguredMcp(accountId?: number) {
  await getMcDonaldMcpConfig(accountId)
}

export async function submitTakeoutOrder(draft: TakeoutOrderSubmission, accountId?: number) {
  const result = await callConfiguredMcp("takeout_order_submit", draft, accountId)
  const status = result && typeof result === "object" ? safeText((result as Record<string, unknown>).status, 40) : ""
  if (!["submitted", "accepted", "pending", "confirmed", "success"].includes(status.toLowerCase())) {
    throw new McpToolError("MCP 未确认订单已被接收")
  }
  return {
    status,
    orderId: result && typeof result === "object" ? safeText((result as Record<string, unknown>).orderId, 120) || null : null,
    message: result && typeof result === "object" ? safeText((result as Record<string, unknown>).message, 300) || "外卖连接器已返回状态" : "外卖连接器已返回状态",
  }
}
