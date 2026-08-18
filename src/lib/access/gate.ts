// Shared authentication gate decision logic. Pure and edge-safe so middleware
// and contract tests share one truth; database session validation stays in the
// Node.js server layer.

export const AUTH_COOKIE = "ft_session"
export const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 30

// Compatibility aliases keep older delivery imports readable while the
// production boundary moves from a shared passcode to account sessions.
export const ACCESS_COOKIE = AUTH_COOKIE
export const ACCESS_COOKIE_MAX_AGE = AUTH_COOKIE_MAX_AGE

export function authRequired(): boolean {
  return process.env.AUTH_REQUIRED === "true"
}

export function accessGateEnabled(): boolean {
  return authRequired()
}

export type AccessDecision = "allow" | "gate-page" | "unauthorized-api"

export function decideAccess(pathname: string, hasSession: boolean, enabled: boolean): AccessDecision {
  if (!enabled || hasSession) return "allow"
  if (pathname === "/auth" || pathname === "/access" || pathname.startsWith("/api/auth/")) return "allow"
  if (pathname.startsWith("/api/")) return "unauthorized-api"
  return "gate-page"
}
