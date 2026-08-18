import { apiError, apiSuccess } from "@/lib/api-response"
import { getAssistantText, requestAiChatCompletion } from "@/lib/ai/client"
import { getPublicAiError } from "@/lib/ai/errors"
import { getActiveAiProviderConfig } from "@/lib/ai/settings"
import { getAccountScope } from "@/lib/auth/scope"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST() {
  const startedAt = performance.now()

  try {
    const scope = await getAccountScope()
    if (scope.unauthorized) return apiError("unauthorized", 401)
    const config = await getActiveAiProviderConfig(scope.accountId)
    const result = await requestAiChatCompletion(config, {
      messages: [{ role: "user", content: "只回复 OK" }],
      max_tokens: 32,
    })
    if (!getAssistantText(result)) return apiError("AI 提供商没有返回可用内容", 502)

    return apiSuccess({
      providerId: config.providerId,
      model: config.model,
      latencyMs: Math.round(performance.now() - startedAt),
    })
  } catch (error) {
    const failure = getPublicAiError(error)
    return apiError(failure.message, failure.status)
  }
}
