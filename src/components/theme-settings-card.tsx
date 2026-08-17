"use client"

import { useSyncExternalStore } from "react"
import { useTheme } from "next-themes"
import { Monitor, Moon, Sun } from "lucide-react"
import { cn } from "@/lib/utils"

const OPTIONS = [
  { value: "light", label: "浅色", hint: "始终使用浅色外观", icon: Sun },
  { value: "dark", label: "深色", hint: "始终使用深色外观", icon: Moon },
  { value: "system", label: "跟随系统", hint: "随系统浅色 / 深色自动切换", icon: Monitor },
] as const

const emptySubscribe = () => () => {}

export function ThemeSettingsCard() {
  const { theme, setTheme } = useTheme()
  // Hydration guard without effect-side setState: the server snapshot stays
  // false so the first client render matches, then the true snapshot enables
  // the persisted selection.
  const mounted = useSyncExternalStore(emptySubscribe, () => true, () => false)

  return (
    <section className="surface-card overflow-hidden border-0" aria-label="外观设置">
      <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-7">
        <div className="min-w-0">
          <p className="page-eyebrow">Appearance</p>
          <h2 className="mt-1 text-lg font-semibold text-[var(--brand-heading)]">外观</h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            选择应用的配色方案；跟随系统时会随设备浅色 / 深色设置自动切换。偏好只保存在本机浏览器。
          </p>
        </div>
        <div
          role="radiogroup"
          aria-label="配色方案"
          className="grid grid-cols-3 gap-2 rounded-md border bg-card p-1 sm:w-auto"
        >
          {OPTIONS.map((option) => {
            const active = mounted && (theme ?? "system") === option.value
            const Icon = option.icon
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={active}
                title={option.hint}
                onClick={() => setTheme(option.value)}
                className={cn(
                  "flex min-w-20 flex-col items-center gap-1 rounded-md px-3 py-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-mint)]",
                  active
                    ? "bg-[var(--brand-plum)] text-[var(--brand-mint)]"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
                {option.label}
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}
