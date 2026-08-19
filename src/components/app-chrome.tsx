"use client"

import type { ReactNode } from "react"
import { usePathname } from "next/navigation"

import { Sidebar } from "@/components/sidebar"
import { cn } from "@/lib/utils"

export function AppChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const isAccessRoute = pathname === "/access" || pathname === "/auth"

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
        <div className={cn("app-page", isAccessRoute && "access-page")}>{children}</div>
      </main>
    </div>
  )
}
