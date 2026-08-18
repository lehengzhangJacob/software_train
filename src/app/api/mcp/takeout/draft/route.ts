import { apiError, apiSuccess } from "@/lib/api-response"
import { getAccountScope } from "@/lib/auth/scope"
import { McpValidationError, parseTakeoutOrderDraftInput } from "@/lib/mcp/contracts"
import { createTakeoutOrderDraft } from "@/lib/mcp/draft"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const scope = await getAccountScope()
    if (scope.unauthorized) return apiError("unauthorized", 401)
    return apiSuccess(createTakeoutOrderDraft(parseTakeoutOrderDraftInput(await request.json()), scope.accountId), 201)
  } catch (error) {
    if (error instanceof McpValidationError) return apiError(error.message, 422)
    if (error instanceof SyntaxError) return apiError("请求 JSON 格式无效", 400)
    return apiError("生成外卖订单草案失败", 500)
  }
}
