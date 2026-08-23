"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { BookOpen, LayoutDashboard } from "lucide-react"
import { cn } from "@/lib/utils"

const todayTabs = [
  { href: "/dashboard", label: "今日概览", icon: LayoutDashboard },
  { href: "/insights", label: "每日阅读", icon: BookOpen },
]

function isTodayArea(pathname: string) {
  return pathname === "/dashboard" || pathname === "/insights" || pathname.startsWith("/insights/")
}

export function TodayTabs() {
  const pathname = usePathname()

  if (!isTodayArea(pathname)) return null

  return (
    <nav
      aria-label="今天二级导航"
      className="mx-auto mb-5 flex w-full max-w-[1480px] items-center gap-1 overflow-x-auto border-b border-border/80"
    >
      {todayTabs.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative inline-flex h-10 shrink-0 items-center gap-2 px-3 text-sm font-semibold text-muted-foreground transition-[color,transform] duration-300 hover:-translate-y-0.5 hover:text-[var(--brand-heading)] focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--brand-mint-deep)]",
              active && "text-[var(--brand-heading)]"
            )}
          >
            <item.icon className="size-4" strokeWidth={active ? 2.2 : 1.8} />
            {item.label}
            <span
              aria-hidden="true"
              className={cn(
                "absolute inset-x-3 bottom-0 h-0.5 origin-center bg-[var(--brand-mint-deep)] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
                active ? "scale-x-100" : "scale-x-0"
              )}
            />
          </Link>
        )
      })}
    </nav>
  )
}
