import { apiError, apiSuccess } from "@/lib/api-response"
import { getAccountScope } from "@/lib/auth/scope"
import {
  getPublicMcDonaldSettings,
  isMcDonaldSettingsValidationError,
  saveMcDonaldSettings,
} from "@/lib/mcp/settings"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const MAX_SETTINGS_BYTES = 8 * 1024

export async function GET() {
  try {
    const scope = await getAccountScope()
    if (scope.unauthorized) return apiError("unauthorized", 401)
    return apiSuccess(await getPublicMcDonaldSettings(scope.accountId))
  } catch (error) {
    return apiError(isMcDonaldSettingsValidationError(error) ? error.message : "无法读取本机麦当劳 MCP 设置", 500)
  }
}

export async function PUT(request: Request) {
  const scope = await getAccountScope()
  if (scope.unauthorized) return apiError("unauthorized", 401)

  const contentLength = Number(request.headers.get("content-length") ?? 0)
  if (contentLength > MAX_SETTINGS_BYTES) return apiError("麦当劳 MCP 设置请求过大", 413)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError("麦当劳 MCP 设置请求格式无效", 400)
  }

  try {
    return apiSuccess(await saveMcDonaldSettings(body, scope.accountId))
  } catch (error) {
    if (isMcDonaldSettingsValidationError(error)) return apiError(error.message, 400)
    return apiError("保存本机麦当劳 MCP 设置失败", 500)
  }
}
