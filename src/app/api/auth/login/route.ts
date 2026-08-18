import { apiError, apiSuccess } from "@/lib/api-response"
import { takeAttempt, resetAttempts } from "@/lib/access/rate-limit"
import { AuthFailure, setSessionCookie } from "@/lib/auth/server"
import { loginAccount, toAuthResponse } from "@/lib/auth/service"
import { AuthValidationError, parseLoginInput } from "@/lib/auth/validation"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const MAX_BODY_BYTES = 4 * 1024

function clientKey(request: Request, login = "") {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local"
  return `login:${ip}:${login.trim().toLowerCase()}`
}

export async function POST(request: Request) {
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) return apiError("璇锋眰杩囧ぇ", 413)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError("璇锋眰 JSON 鏍煎紡鏃犳晥", 400)
  }

  let input
  try {
    input = parseLoginInput(body)
  } catch (error) {
    return error instanceof AuthValidationError ? apiError(error.message, 422) : apiError("璇锋眰鏍煎紡鏃犳晥", 400)
  }

  const key = clientKey(request, input.login)
  const attempt = takeAttempt(key)
  if (!attempt.allowed) return apiError(`灏濊瘯杩囧锛岃 ${Math.max(1, Math.ceil(attempt.retryAfterSeconds / 60))} 鍒嗛挓鍚庡啀璇�`, 429)

  try {
    const result = await loginAccount(input)
    await setSessionCookie(result.token)
    resetAttempts(key)
    return apiSuccess(toAuthResponse(result))
  } catch (error) {
    if (error instanceof AuthFailure) return apiError(error.message, error.status)
    return apiError("鐧诲綍澶辫触锛岃绋嶅悗閲嶈瘯", 500)
  }
}
