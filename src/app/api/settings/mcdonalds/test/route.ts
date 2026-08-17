import { apiError, apiSuccess } from "@/lib/api-response"
import { McpToolError, McpUnavailableError } from "@/lib/mcp/contracts"
import { probeMcDonaldMcp } from "@/lib/mcp/mcdonalds-client"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST() {
  const startedAt = Date.now()
  try {
    return apiSuccess({ ...(await probeMcDonaldMcp()), latencyMs: Date.now() - startedAt })
  } catch (error) {
    if (error instanceof McpUnavailableError) return apiError(error.message, 503)
    if (error instanceof McpToolError) return apiError(error.message, 502)
    return apiError("麦当劳 MCP 连接测试失败", 500)
  }
}
