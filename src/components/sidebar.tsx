"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import {
  LayoutDashboard,
  UtensilsCrossed,
  CalendarDays,
  Dumbbell,
  BarChart3,
  User,
  Salad,
} from "lucide-react"

const navItems = [
  { href: "/dashboard", label: "营养看板", icon: LayoutDashboard },
  { href: "/meals", label: "饮食记录", icon: UtensilsCrossed },
  { href: "/calendar", label: "日历", icon: CalendarDays },
  { href: "/exercise", label: "运动建议", icon: Dumbbell },
  { href: "/reports", label: "营养报告", icon: BarChart3 },
  { href: "/profile", label: "个人设置", icon: User },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r bg-white shadow-sm lg:flex">
        <div className="flex h-16 items-center gap-2 border-b px-6">
          <Salad className="h-6 w-6 text-emerald-600" />
          <span className="text-lg font-semibold text-neutral-800">Food Tracker</span>
        </div>
        <nav aria-label="主导航" className="flex-1 space-y-1 p-4">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2",
                  isActive
                    ? "bg-emerald-50 text-emerald-700"
                    : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            )
          })}
        </nav>
        <div className="border-t p-4 text-xs text-neutral-400">
          Food Tracker v1.0
        </div>
      </aside>

      <nav aria-label="移动端主导航" className="fixed bottom-0 left-0 right-0 z-30 flex h-[calc(4rem+env(safe-area-inset-bottom))] items-center border-t bg-white pb-[env(safe-area-inset-bottom)] shadow-sm lg:hidden">
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex min-h-11 flex-1 flex-col items-center justify-center gap-0.5 rounded-md px-1 py-1 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-inset",
                isActive ? "text-emerald-700" : "text-neutral-500"
              )}
            >
              <item.icon className="h-5 w-5" />
              <span>{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </>
  )
}
