import { apiError, apiSuccess } from "@/lib/api-response"
import { McpUnavailableError, McpToolError, McpValidationError, parseNearbyTakeoutSearchInput } from "@/lib/mcp/contracts"
import { searchNearbyTakeout } from "@/lib/mcp/gateway"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function requestFailure(error: unknown) {
  if (error instanceof McpValidationError) return apiError(error.message, 422)
  if (error instanceof McpUnavailableError) return apiError(error.message, 503)
  if (error instanceof McpToolError) return apiError(error.message, 502)
  if (error instanceof SyntaxError) return apiError("请求 JSON 格式无效", 400)
  return apiError("附近外卖搜索失败", 500)
}

export async function POST(request: Request) {
  try {
    const body = parseNearbyTakeoutSearchInput(await request.json())
    return apiSuccess({ results: await searchNearbyTakeout(body) })
  } catch (error) {
    return requestFailure(error)
  }
}
