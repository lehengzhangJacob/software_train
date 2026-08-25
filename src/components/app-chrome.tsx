"use client"

import type { ReactNode } from "react"
import { usePathname } from "next/navigation"
import { useEffect } from "react"

import { AppUpdateNotice } from "@/components/app-update-notice"
import { Sidebar } from "@/components/sidebar"
import { TodayTabs } from "@/components/today-tabs"
import { cn } from "@/lib/utils"

function useKeyboardAwareViewport() {
  useEffect(() => {
    const root = document.documentElement
    const viewport = window.visualViewport
    if (!viewport) return

    let keyboardOpen = false
    const updateViewport = () => {
      const inset = Math.max(0, Math.round(window.innerHeight - viewport.height - viewport.offsetTop))
      keyboardOpen = inset >= 120
      root.style.setProperty("--keyboard-inset", `${inset}px`)
      root.dataset.keyboardOpen = keyboardOpen ? "true" : "false"
    }

    const handleFocusIn = (event: FocusEvent) => {
      const target = event.target
      if (!(target instanceof HTMLElement) || !target.matches("input, textarea, select, [contenteditable='true']")) return

      window.setTimeout(() => {
        if (!keyboardOpen) return
        target.scrollIntoView({ block: "center", inline: "nearest", behavior: "smooth" })
      }, 320)
    }

    updateViewport()
    viewport.addEventListener("resize", updateViewport)
    viewport.addEventListener("scroll", updateViewport)
    document.addEventListener("focusin", handleFocusIn)

    return () => {
      viewport.removeEventListener("resize", updateViewport)
      viewport.removeEventListener("scroll", updateViewport)
      document.removeEventListener("focusin", handleFocusIn)
      root.style.removeProperty("--keyboard-inset")
      delete root.dataset.keyboardOpen
    }
  }, [])
}

export function AppChrome({
  children,
  currentBuild,
}: {
  children: ReactNode
  currentBuild: string
}) {
  const pathname = usePathname()
  const isAccessRoute = pathname === "/access" || pathname === "/auth"
  useKeyboardAwareViewport()

  return (
    <div
      className={cn(
        "min-h-screen bg-[var(--app-canvas)]",
        isAccessRoute && "access-app-shell lg:h-[100dvh] lg:overflow-hidden",
      )}
    >
      {!isAccessRoute && <Sidebar />}
      <main
        id="main-content"
        tabIndex={-1}
        className={cn(
          "px-4 sm:px-5 lg:px-8",
          isAccessRoute
            ? "access-main min-h-screen pb-8 pt-6 sm:pb-12 sm:pt-8 lg:flex lg:h-[100dvh] lg:min-h-0 lg:items-center lg:overflow-hidden lg:py-6"
            : "min-h-screen pb-[calc(5rem+env(safe-area-inset-bottom))] pt-[4.5rem] lg:pb-10 lg:pt-[6.25rem]",
        )}
      >
        {!isAccessRoute && <AppUpdateNotice currentBuild={currentBuild} />}
        {!isAccessRoute && <TodayTabs />}
        <div
          key={pathname}
          className={cn("app-page", !isAccessRoute && "app-route-transition", isAccessRoute && "access-page")}
        >
          {children}
        </div>
      </main>
    </div>
  )
}
