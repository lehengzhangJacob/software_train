import { cookies } from "next/headers"

import { apiError, apiSuccess } from "@/lib/api-response"
import {
  ACCESS_COOKIE,
  ACCESS_COOKIE_MAX_AGE,
  accessGateEnabled,
  constantTimeEqualHex,
  digestAccessCode,
  getAccessCode,
} from "@/lib/access/gate"
import { resetAttempts, takeAttempt } from "@/lib/access/rate-limit"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const MAX_BODY_BYTES = 1024

export async function POST(request: Request) {
  if (!accessGateEnabled()) return apiSuccess({ ok: true })

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "local"
  const attempt = takeAttempt(ip)
  if (!attempt.allowed) {
    return apiError(`尝试过于频繁，请 ${Math.max(1, Math.ceil(attempt.retryAfterSeconds / 60))} 分钟后再试`, 429)
  }

  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
    return apiError("请求过大", 413)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return apiError("请求格式无效", 400)
  }
  const code = (body as { code?: unknown } | null)?.code
  if (typeof code !== "string" || code.length === 0 || code.length > 128) {
    return apiError("访问码不正确", 401)
  }

  const submitted = await digestAccessCode(code)
  const expected = await digestAccessCode(getAccessCode())
  if (!constantTimeEqualHex(submitted, expected)) {
    return apiError("访问码不正确", 401)
  }

  resetAttempts(ip)
  const jar = await cookies()
  jar.set(ACCESS_COOKIE, submitted, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: ACCESS_COOKIE_MAX_AGE,
  })
  return apiSuccess({ ok: true })
}
