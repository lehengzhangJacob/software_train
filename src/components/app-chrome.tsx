"use client"

import type { ReactNode } from "react"
import { usePathname } from "next/navigation"

import { Sidebar } from "@/components/sidebar"
import { cn } from "@/lib/utils"

export function AppChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const isAccessRoute = pathname === "/access"

  return (
    <div className="min-h-screen bg-[var(--app-canvas)]">
      {!isAccessRoute && <Sidebar />}
      <main
        id="main-content"
        tabIndex={-1}
        className={cn(
          "min-h-screen px-4 sm:px-5 lg:px-8",
          isAccessRoute
            ? "pb-8 pt-6 sm:pb-12 sm:pt-8 lg:pb-14 lg:pt-10"
            : "pb-[calc(5rem+env(safe-area-inset-bottom))] pt-[4.5rem] lg:pb-10 lg:pt-[6.25rem]",
        )}
      >
        <div className="app-page">{children}</div>
      </main>
    </div>
  )
}
