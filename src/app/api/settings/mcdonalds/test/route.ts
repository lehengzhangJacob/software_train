import { apiError, apiSuccess } from "@/lib/api-response"
import { getAccountScope } from "@/lib/auth/scope"
import { McpToolError, McpUnavailableError } from "@/lib/mcp/contracts"
import { probeMcDonaldMcp } from "@/lib/mcp/mcdonalds-client"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST() {
  const startedAt = Date.now()
  try {
    const scope = await getAccountScope()
    if (scope.unauthorized) return apiError("unauthorized", 401)
    return apiSuccess({ ...(await probeMcDonaldMcp(undefined, scope.accountId)), latencyMs: Date.now() - startedAt })
  } catch (error) {
    if (error instanceof McpUnavailableError) return apiError(error.message, 503)
    if (error instanceof McpToolError) return apiError(error.message, 502)
    return apiError("麦当劳 MCP 连接测试失败", 500)
  }
}
