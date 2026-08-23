"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { CalendarDays, Dumbbell } from "lucide-react"
import { cn } from "@/lib/utils"

const planTabs = [
  { href: "/calendar", label: "饮食日历", icon: CalendarDays },
  { href: "/exercise", label: "运动建议", icon: Dumbbell },
]

export function PlanTabs() {
  const pathname = usePathname()

  return (
    <nav aria-label="计划类型" className="inline-grid w-full grid-cols-2 rounded-md border bg-card p-1 sm:w-auto">
      {planTabs.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex h-9 items-center justify-center gap-2 overflow-hidden rounded-sm px-4 text-xs font-semibold transition-[background-color,color,box-shadow,transform] duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-mint-deep)]",
              active
                ? "bg-[var(--brand-plum)] text-white shadow-[0_6px_16px_rgba(45,39,53,0.16)]"
                : "text-muted-foreground hover:bg-[var(--brand-paper)] hover:text-[var(--brand-heading)]"
            )}
          >
            <item.icon className="size-4" />
            {item.label}
            <span
              aria-hidden="true"
              className={cn(
                "absolute inset-x-4 bottom-0 h-0.5 origin-center bg-[var(--brand-mint)] transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
                active ? "scale-x-100" : "scale-x-0"
              )}
            />
          </Link>
        )
      })}
    </nav>
  )
}
