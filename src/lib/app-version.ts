import "server-only"

import { readFileSync } from "node:fs"
import path from "node:path"

import packageJson from "../../package.json"

export type AppVersion = {
  version: string
  build: string
  releaseUrl: string
  androidReleaseUrl: string
}

const defaultReleaseUrl = "https://github.com/lehengzhangJacob/software_train/releases/latest"

function readBuildId(): string {
  const configuredBuild = process.env.APP_BUILD_ID?.trim()
  if (configuredBuild) return configuredBuild

  try {
    const buildId = readFileSync(path.join(process.cwd(), ".next", "BUILD_ID"), "utf8").trim()
    if (buildId) return buildId
  } catch {
    // Development can serve before Next has produced a build manifest.
  }

  return process.env.NODE_ENV === "development" ? "dev" : "unknown"
}

export function getAppVersion(): AppVersion {
  const releaseUrl = process.env.APP_RELEASE_URL?.trim() || defaultReleaseUrl

  return {
    version: packageJson.version,
    build: readBuildId(),
    releaseUrl,
    androidReleaseUrl: process.env.ANDROID_RELEASE_URL?.trim() || releaseUrl,
  }
}
