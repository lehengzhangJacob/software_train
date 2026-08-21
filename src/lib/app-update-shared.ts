export type AppVersionPayload = {
  version: string
  build: string
  releaseUrl: string
  androidReleaseUrl: string
}

export function parseAppVersionPayload(value: unknown): AppVersionPayload | null {
  if (!value || typeof value !== "object") return null

  const envelope = value as { data?: unknown; error?: unknown }
  if (envelope.error !== null || !envelope.data || typeof envelope.data !== "object") return null

  const data = envelope.data as Record<string, unknown>
  if (
    typeof data.version !== "string" ||
    typeof data.build !== "string" ||
    typeof data.releaseUrl !== "string" ||
    typeof data.androidReleaseUrl !== "string" ||
    data.version.length === 0 ||
    data.build.length === 0 ||
    data.releaseUrl.length === 0 ||
    data.androidReleaseUrl.length === 0
  ) {
    return null
  }

  return {
    version: data.version,
    build: data.build,
    releaseUrl: data.releaseUrl,
    androidReleaseUrl: data.androidReleaseUrl,
  }
}

export function shouldPromptForUpdate(currentBuild: string, remoteBuild: string): boolean {
  return currentBuild.length > 0 && remoteBuild.length > 0 && currentBuild !== remoteBuild
}
