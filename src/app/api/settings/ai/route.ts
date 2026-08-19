import { apiError, apiSuccess } from "@/lib/api-response"
import { AiSettingsStoreError } from "@/lib/ai/errors"
import { getPublicAiSettings, isAiSettingsValidationError, saveAiSettings } from "@/lib/ai/settings"
import { getAccountScope } from "@/lib/auth/scope"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const MAX_SETTINGS_BYTES = 16 * 1024

export async function GET() {
  try {
    const scope = await getAccountScope()
    if (scope.unauthorized) return apiError("unauthorized", 401)
    return apiSuccess(await getPublicAiSettings(scope.accountId))
  } catch (error) {
    return apiError(error instanceof AiSettingsStoreError ? error.message : "无法读取本机 AI 设置", 500)
  }
}

export async function PUT(request: Request) {
  const scope = await getAccountScope()
  if (scope.unauthorized) return apiError("unauthorized", 401)

  const contentLength = Number(request.headers.get("content-length") ?? 0)
  if (contentLength > MAX_SETTINGS_BYTES) return apiError("AI 设置请求过大", 413)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError("AI 设置请求格式无效", 400)
  }

  try {
    return apiSuccess(await saveAiSettings(body, scope.accountId))
  } catch (error) {
    if (isAiSettingsValidationError(error)) return apiError(error.message, 400)
    return apiError(error instanceof AiSettingsStoreError ? error.message : "保存本机 AI 设置失败", 500)
  }
}
