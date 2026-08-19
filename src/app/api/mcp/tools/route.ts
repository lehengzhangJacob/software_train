import { apiError, apiSuccess } from "@/lib/api-response"
import { getAccountScope } from "@/lib/auth/scope"
import { listMcpTools } from "@/lib/mcp/gateway"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const scope = await getAccountScope()
    if (scope.unauthorized) return apiError("unauthorized", 401)
    return apiSuccess({ tools: await listMcpTools(scope.accountId) })
  } catch {
    return apiError("读取 MCP 工具状态失败", 500)
  }
}
