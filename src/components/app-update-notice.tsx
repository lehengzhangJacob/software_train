"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Capacitor } from "@capacitor/core"
import { Download, ExternalLink, RefreshCw, X } from "lucide-react"

import {
  parseAppVersionPayload,
  shouldPromptForUpdate,
  type AppVersionPayload,
} from "@/lib/app-update-shared"

const CHECK_INTERVAL_MS = 10 * 60 * 1000
const DISMISSED_BUILD_KEY = "foodmoment-dismissed-update-build"

function readDismissedBuild() {
  try {
    return window.sessionStorage.getItem(DISMISSED_BUILD_KEY)
  } catch {
    return null
  }
}

function rememberDismissedBuild(build: string) {
  try {
    window.sessionStorage.setItem(DISMISSED_BUILD_KEY, build)
  } catch {
    // Private browsing may disable sessionStorage; dismissal still works in memory.
  }
}

export function AppUpdateNotice({ currentBuild }: { currentBuild: string }) {
  const [remoteVersion, setRemoteVersion] = useState<AppVersionPayload | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const isAndroid = useMemo(
    () => typeof window !== "undefined" && Capacitor.getPlatform() === "android",
    [],
  )

  const checkForUpdate = useCallback(async () => {
    try {
      const response = await fetch("/api/app/version", {
        cache: "no-store",
        headers: { Accept: "application/json", "Cache-Control": "no-cache" },
      })
      if (!response.ok) return

      const payload = parseAppVersionPayload(await response.json())
      if (!payload || !shouldPromptForUpdate(currentBuild, payload.build)) {
        setRemoteVersion(null)
        setDismissed(false)
        return
      }

      setRemoteVersion(payload)
      setDismissed(readDismissedBuild() === payload.build)
    } catch {
      // Update detection is advisory and must never block the product shell.
    }
  }, [currentBuild])

  useEffect(() => {
    const initialCheck = window.setTimeout(() => void checkForUpdate(), 0)

    const handleFocus = () => void checkForUpdate()
    const handleVisibility = () => {
      if (document.visibilityState === "visible") void checkForUpdate()
    }

    window.addEventListener("focus", handleFocus)
    document.addEventListener("visibilitychange", handleVisibility)
    const interval = window.setInterval(() => void checkForUpdate(), CHECK_INTERVAL_MS)

    return () => {
      window.clearTimeout(initialCheck)
      window.removeEventListener("focus", handleFocus)
      document.removeEventListener("visibilitychange", handleVisibility)
      window.clearInterval(interval)
    }
  }, [checkForUpdate])

  if (!remoteVersion || dismissed) return null
  const nextVersion = remoteVersion

  function dismiss() {
    rememberDismissedBuild(nextVersion.build)
    setDismissed(true)
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-3 top-[4.5rem] z-50 mx-auto flex max-w-3xl items-center gap-3 rounded-lg border border-[var(--brand-mint)]/40 bg-[var(--brand-plum)] px-4 py-3 text-white shadow-[0_16px_50px_rgba(45,39,53,0.24)] lg:inset-x-auto lg:right-8 lg:top-20"
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-md bg-[var(--brand-mint)] text-[var(--brand-plum)]">
        <RefreshCw aria-hidden="true" className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">发现新版本 v{nextVersion.version}</p>
        <p className="mt-0.5 text-xs text-white/70">刷新后继续使用最新内容</p>
      </div>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-[var(--brand-mint)] px-3 py-2 text-xs font-semibold text-[var(--brand-plum)] transition hover:bg-white focus:outline-none focus:ring-2 focus:ring-white"
      >
        <RefreshCw aria-hidden="true" className="size-3.5" />
        立即刷新
      </button>
      {isAndroid && (
        <a
          href={nextVersion.androidReleaseUrl}
          target="_blank"
          rel="noreferrer"
          className="hidden shrink-0 items-center gap-1.5 rounded-md border border-white/30 px-3 py-2 text-xs font-semibold text-white transition hover:border-white hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white sm:inline-flex"
        >
          <Download aria-hidden="true" className="size-3.5" />
          下载 Android
        </a>
      )}
      <a
        href={nextVersion.releaseUrl}
        target="_blank"
        rel="noreferrer"
        aria-label="查看版本发布说明"
        title="查看发布说明"
        className="hidden size-8 shrink-0 place-items-center rounded-md border border-white/30 text-white transition hover:border-white hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white sm:grid"
      >
        <ExternalLink aria-hidden="true" className="size-4" />
      </a>
      <button
        type="button"
        onClick={dismiss}
        aria-label="暂不更新"
        title="暂不更新"
        className="grid size-8 shrink-0 place-items-center rounded-md text-white/70 transition hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-white"
      >
        <X aria-hidden="true" className="size-4" />
      </button>
    </div>
  )
}
