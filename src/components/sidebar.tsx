"use client"

import Image from "next/image"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"
import {
  BarChart3,
  Bot,
  Brain,
  CalendarDays,
  Camera,
  ChevronDown,
  House,
  LogOut,
  Settings2,
  ShieldCheck,
  UserRound,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

type SessionUser = {
  username: string
  login: string
}

const desktopNav = [
  { href: "/dashboard", label: "今天", matches: ["/dashboard"] },
  { href: "/agent", label: "AI 教练", matches: ["/agent"] },
  { href: "/meals", label: "记一餐", matches: ["/meals"] },
  { href: "/calendar", label: "计划", matches: ["/calendar", "/exercise"] },
  { href: "/reports", label: "报告", matches: ["/reports"] },
]

const mobileNav = [
  { href: "/dashboard", label: "今天", icon: House, matches: ["/dashboard"] },
  { href: "/agent", label: "教练", icon: Bot, matches: ["/agent"] },
  { href: "/meals", label: "记一餐", icon: Camera, matches: ["/meals"], action: true },
  { href: "/calendar", label: "计划", icon: CalendarDays, matches: ["/calendar", "/exercise"] },
  { href: "/reports", label: "报告", icon: BarChart3, matches: ["/reports"] },
]

const pageTitles: Record<string, string> = {
  "/dashboard": "今天",
  "/agent": "AI 私人教练",
  "/meals": "记一餐",
  "/calendar": "饮食日历",
  "/exercise": "运动建议",
  "/reports": "营养报告",
  "/profile": "个人档案",
  "/settings": "AI 与工具",
  "/settings/memory": "长期记忆",
}

function isRouteActive(pathname: string, matches: string[]) {
  return matches.some((href) => pathname === href || pathname.startsWith(`${href}/`))
}

function getPageTitle(pathname: string) {
  const match = Object.entries(pageTitles)
    .sort(([left], [right]) => right.length - left.length)
    .find(
    ([href]) => pathname === href || pathname.startsWith(`${href}/`)
  )
  return match?.[1] ?? "营养 Agent"
}

function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid shrink-0 place-items-center rounded-md bg-[var(--brand-mint)] font-black text-[var(--brand-plum)]",
        compact ? "size-7 text-xs" : "size-8 text-sm"
      )}
    >
      <Image
        src="/brand/nutrition-agent-icon.png"
        alt=""
        width={compact ? 28 : 32}
        height={compact ? 28 : 32}
        className="size-full rounded-md object-cover"
      />
    </span>
  )
}

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null)

  useEffect(() => {
    let active = true
    void fetch("/api/auth/session", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return null
        return (await response.json()) as { data?: { user?: SessionUser } | null }
      })
      .then((payload) => {
        if (active) setSessionUser(payload?.data?.user ?? null)
      })
      .catch(() => {
        if (active) setSessionUser(null)
      })
    return () => {
      active = false
    }
  }, [])

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined)
    router.replace("/access")
    router.refresh()
  }

  const displayName = sessionUser?.username?.trim() || "我的空间"
  const avatar = displayName.slice(0, 1)

  const personalMenu = (
    <DropdownMenuContent align="end" className="w-44">
      <DropdownMenuItem onClick={() => router.push("/profile")}>
        <UserRound />
        个人档案
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={() => router.push("/settings")}>
        <Settings2 />
        AI 与工具
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => router.push("/settings/memory")}>
        <Brain />
        长期记忆
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={handleLogout}>
        <LogOut />
        退出登录
      </DropdownMenuItem>
    </DropdownMenuContent>
  )

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 hidden h-[72px] border-b border-white/10 bg-[var(--brand-plum)] text-white lg:block">
        <div className="mx-auto flex h-full max-w-[1544px] items-center gap-8 px-8">
          <Link
            href="/dashboard"
            className="flex shrink-0 items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-mint)] focus-visible:ring-offset-4 focus-visible:ring-offset-[var(--brand-plum)]"
          >
            <BrandMark />
            <span className="text-sm font-semibold">营养 Agent</span>
          </Link>

          <nav aria-label="主导航" className="flex h-full items-center gap-1">
            {desktopNav.map((item) => {
              const active = isRouteActive(pathname, item.matches)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex h-full items-center px-4 text-sm font-medium text-white/65 transition-colors hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--brand-mint)]",
                    active && "text-white"
                  )}
                >
                  {item.label}
                  {active && (
                    <span className="absolute inset-x-4 bottom-0 h-[3px] bg-[var(--brand-mint)]" />
                  )}
                </Link>
              )
            })}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <div className="flex h-9 items-center gap-2 rounded-full bg-white/8 px-3 text-xs text-white/70">
              <ShieldCheck className="size-3.5 text-[var(--brand-mint)]" />
              私密同步
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger className="flex h-9 items-center gap-2 rounded-md px-1.5 outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-mint)]">
                <span className="grid size-8 place-items-center rounded-full bg-[var(--brand-lavender)] text-xs font-bold text-white">
                  {avatar}
                </span>
                <span className="max-w-28 truncate text-xs text-white/75">{displayName}</span>
                <ChevronDown className="size-3.5 text-white/55" />
                <span className="sr-only">打开个人菜单</span>
              </DropdownMenuTrigger>
              {personalMenu}
            </DropdownMenu>
          </div>
        </div>
      </header>

      <header className="fixed inset-x-0 top-0 z-40 flex h-14 items-center justify-between border-b border-border/80 bg-white/96 dark:bg-card/96 px-4 backdrop-blur lg:hidden">
        <Link
          href="/dashboard"
          className="flex min-w-0 items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-mint)]"
        >
          <BrandMark compact />
          <span className="truncate text-sm font-semibold text-[var(--brand-heading)]">
            {getPageTitle(pathname)}
          </span>
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="打开个人菜单"
            title="个人设置"
            className="grid size-8 place-items-center rounded-full bg-[var(--brand-lavender)] text-xs font-bold text-white outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-mint-deep)]"
          >
            {avatar}
          </DropdownMenuTrigger>
          {personalMenu}
        </DropdownMenu>
      </header>

      <nav
        aria-label="移动端主导航"
        className="fixed inset-x-0 bottom-0 z-40 grid h-[calc(4.25rem+env(safe-area-inset-bottom))] grid-cols-5 border-t border-border/80 bg-white/98 dark:bg-card/98 pb-[env(safe-area-inset-bottom)] shadow-[0_-12px_35px_rgba(45,39,53,0.08)] backdrop-blur lg:hidden"
      >
        {mobileNav.map((item) => {
          const active = isRouteActive(pathname, item.matches)
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-w-0 flex-col items-center justify-center gap-1 px-1 text-[10px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--brand-mint)]",
                active ? "text-[var(--brand-mint-deep)]" : "text-muted-foreground"
              )}
            >
              {item.action ? (
                <span
                  className={cn(
                    "-mt-4 grid size-11 place-items-center rounded-full border-4 border-white bg-[var(--brand-mint)] dark:border-card text-[var(--brand-plum)] shadow-[0_8px_20px_rgba(39,211,157,.28)]",
                    active && "bg-[var(--brand-plum)] text-[var(--brand-mint)]"
                  )}
                >
                  <item.icon className="size-5" strokeWidth={2.2} />
                </span>
              ) : (
                <item.icon className="size-[18px]" strokeWidth={active ? 2.4 : 1.8} />
              )}
              <span className="truncate">{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </>
  )
}
