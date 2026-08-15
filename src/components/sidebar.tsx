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
  ShieldCheck,
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
        <div className="flex h-16 items-center gap-3 border-b px-5">
          <div className="flex size-8 items-center justify-center rounded-md bg-emerald-50">
            <Salad className="size-4 text-emerald-700" />
          </div>
          <div className="min-w-0 leading-tight">
            <p className="text-sm font-semibold text-neutral-900">营养 Agent</p>
            <p className="mt-0.5 text-xs text-neutral-500">本地个人工具</p>
          </div>
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
        <div className="flex items-center gap-2 border-t p-4 text-xs text-neutral-500">
          <ShieldCheck className="size-3.5 text-emerald-700" />
          <span>数据仅存本机</span>
        </div>
      </aside>

      <header className="fixed inset-x-0 top-0 z-30 flex h-16 items-center justify-between border-b bg-white/95 px-4 backdrop-blur lg:hidden">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-md bg-emerald-50">
            <Salad className="size-4 text-emerald-700" />
          </div>
          <span className="text-sm font-semibold text-neutral-900">营养 Agent</span>
        </div>
        <span className="text-xs text-neutral-500">本机</span>
      </header>

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
