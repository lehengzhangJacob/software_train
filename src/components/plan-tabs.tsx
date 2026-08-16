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
    <nav aria-label="计划类型" className="inline-grid w-full grid-cols-2 rounded-md border bg-white p-1 sm:w-auto">
      {planTabs.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`)
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-9 items-center justify-center gap-2 rounded-sm px-4 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-mint-deep)]",
              active
                ? "bg-[var(--brand-plum)] text-white"
                : "text-muted-foreground hover:bg-[var(--brand-paper)] hover:text-[var(--brand-plum)]"
            )}
          >
            <item.icon className="size-4" />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
