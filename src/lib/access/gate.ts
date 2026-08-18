// Shared access gate decision logic (ADR-0007). Pure and edge-safe so the
// middleware, the verify route and contract tests share one truth.

export const ACCESS_COOKIE = "ft_access"
export const ACCESS_COOKIE_MAX_AGE = 60 * 60 * 24 * 30

export function getAccessCode(): string {
  return (process.env.APP_ACCESS_TOKEN ?? "").trim()
}

export function accessGateEnabled(): boolean {
  return getAccessCode().length > 0
}

/** Cookie carries the SHA-256 hex digest, never the access code itself. */
export async function digestAccessCode(code: string): Promise<string> {
  const bytes = new TextEncoder().encode(code)
  const digest = await crypto.subtle.digest("SHA-256", bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")
}

/** Constant-time comparison for two SHA-256 hex digests. */
export function constantTimeEqualHex(a: string, b: string): boolean {
  if (a.length !== 64 || b.length !== 64) return false
  let diff = 0
  for (let i = 0; i < 64; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export type AccessDecision = "allow" | "gate-page" | "unauthorized-api"

export function decideAccess(pathname: string, authed: boolean, enabled: boolean): AccessDecision {
  if (!enabled || authed) return "allow"
  if (pathname === "/access" || pathname.startsWith("/api/auth/")) return "allow"
  if (pathname.startsWith("/api/")) return "unauthorized-api"
  return "gate-page"
}
