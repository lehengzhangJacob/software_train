import { apiError, apiSuccess } from "@/lib/api-response"
import { takeAttempt, resetAttempts } from "@/lib/access/rate-limit"
import { AuthFailure, setSessionCookie } from "@/lib/auth/server"
import { registerAccount, toAuthResponse } from "@/lib/auth/service"
import { AuthValidationError, parseRegisterInput } from "@/lib/auth/validation"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const MAX_BODY_BYTES = 8 * 1024

function clientKey(request: Request) {
  return `register:${request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local"}`
}

export async function POST(request: Request) {
  const key = clientKey(request)
  const attempt = takeAttempt(key)
  if (!attempt.allowed) return apiError(`尝试次数过多，请 ${Math.max(1, Math.ceil(attempt.retryAfterSeconds / 60))} 分钟后再试`, 429)

  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) return apiError("请求过大", 413)

  try {
    const input = parseRegisterInput(await request.json())
    const result = await registerAccount(input)
    await setSessionCookie(result.token)
    resetAttempts(key)
    return apiSuccess(toAuthResponse(result), 201)
  } catch (error) {
    if (error instanceof AuthValidationError) return apiError(error.message, 422)
    if (error instanceof AuthFailure) return apiError(error.message, error.status)
    if (error instanceof SyntaxError) return apiError("请求 JSON 格式无效", 400)
    return apiError("注册失败，请稍后重试", 500)
  }
}
