export function shouldUseSecureAuthCookie(
  env: Partial<Pick<NodeJS.ProcessEnv, "AUTH_COOKIE_SECURE" | "NODE_ENV">> = process.env,
): boolean {
  const explicit = env.AUTH_COOKIE_SECURE?.trim().toLowerCase()
  if (explicit === "true") return true
  if (explicit === "false") return false
  return env.NODE_ENV === "production"
}
