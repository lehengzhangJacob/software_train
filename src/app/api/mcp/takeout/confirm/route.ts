import { apiError, apiSuccess } from "@/lib/api-response"
import { assertActionConfirmation, consumeActionConfirmation, ActionPolicyError } from "@/lib/actions/policy"
import { McpUnavailableError, McpToolError, McpValidationError, parseTakeoutOrderDraftInput } from "@/lib/mcp/contracts"
import { assertConfiguredMcp, submitTakeoutOrder } from "@/lib/mcp/gateway"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

interface ConfirmationRequest {
  confirmationToken?: unknown
  draft?: unknown
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ConfirmationRequest
    if (!body || typeof body !== "object" || Array.isArray(body)) throw new McpValidationError("请求内容必须是对象")
    if (typeof body.confirmationToken !== "string" || !body.confirmationToken.trim()) throw new ActionPolicyError("缺少动作确认令牌")
    const draft = parseTakeoutOrderDraftInput(body.draft)
    // Validate the connector before consuming the token. A missing connector
    // should not force the user to rebuild a still-valid draft.
    assertConfiguredMcp()
    const draftPayload = {
      ...draft,
      totalCents: draft.items.reduce((sum, item) => sum + item.quantity * item.unitPriceCents, 0),
    }
    assertActionConfirmation(body.confirmationToken, "takeout_order_submit", draftPayload)
    consumeActionConfirmation(body.confirmationToken, "takeout_order_submit", draftPayload)
    return apiSuccess(await submitTakeoutOrder(draftPayload))
  } catch (error) {
    if (error instanceof ActionPolicyError) return apiError(error.message, 409)
    if (error instanceof McpValidationError) return apiError(error.message, 422)
    if (error instanceof McpUnavailableError) return apiError(error.message, 503)
    if (error instanceof McpToolError) return apiError(error.message, 502)
    if (error instanceof SyntaxError) return apiError("请求 JSON 格式无效", 400)
    return apiError("提交外卖订单失败", 500)
  }
}
