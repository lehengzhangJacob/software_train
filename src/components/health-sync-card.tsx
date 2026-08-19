"use client"

import { Capacitor } from "@capacitor/core"
import { useCallback, useEffect, useMemo, useState } from "react"
import {
  Activity,
  CheckCircle2,
  HeartPulse,
  LoaderCircle,
  RefreshCw,
  Smartphone,
  XCircle,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface ApiEnvelope<T> {
  data: T | null
  error: string | null
}

interface ActivityRow {
  activityId: number
  activityDate: string
  steps: number
  activeCalories: number
  exerciseMinutes: number
  sourceKind: "manual" | "health_connect"
}

interface RecentResponse {
  days: number
  activities: ActivityRow[]
}

type PlatformKind = "web" | "native" | null
type AuthState = "unknown" | "granted" | "denied" | "unavailable"

function bucketDate(iso: string): string {
  const date = new Date(iso)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

function dayString(offsetDaysAgo: number): string {
  const date = new Date()
  date.setDate(date.getDate() - offsetDaysAgo)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

export function HealthSyncCard() {
  const [platform, setPlatform] = useState<PlatformKind>(null)
  const [authState, setAuthState] = useState<AuthState>("unknown")
  const [syncing, setSyncing] = useState(false)
  const [recent, setRecent] = useState<ActivityRow[]>([])
  const [manualSteps, setManualSteps] = useState("")
  const [manualCalories, setManualCalories] = useState("")
  const [savingManual, setSavingManual] = useState(false)

  const loadRecent = useCallback(async () => {
    const response = await fetch("/api/health/recent?days=7", { cache: "no-store" })
    const payload = (await response.json()) as ApiEnvelope<RecentResponse>
    if (!response.ok || !payload.data) throw new Error(payload.error || "读取活动量失败")
    setRecent(payload.data.activities)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void fetch("/api/health/recent?days=7", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = (await response.json()) as ApiEnvelope<RecentResponse>
        if (!response.ok || !payload.data) throw new Error(payload.error || "读取活动量失败")
        setRecent(payload.data.activities)
      })
      .catch((error) => {
        if (!controller.signal.aborted) toast.error(error instanceof Error ? error.message : "读取活动量失败")
      })

    // Defer synchronous platform detection to a microtask so the initial
    // render stays hydration-safe and we never setState synchronously in the
    // effect body.
    void Promise.resolve().then(async () => {
      const isNative = Capacitor.isNativePlatform()
      setPlatform(isNative ? "native" : "web")
      if (!isNative) return
      try {
        const { Health } = await import("@capgo/capacitor-health")
        const availability = await Health.isAvailable()
        setAuthState(availability.available ? "unknown" : "unavailable")
      } catch {
        setAuthState("unavailable")
      }
    })
    return () => controller.abort()
  }, [])

  const todaySteps = useMemo(
    () => recent.find((row) => row.activityDate === dayString(0))?.steps ?? 0,
    [recent]
  )
  const todayCalories = useMemo(
    () => recent.find((row) => row.activityDate === dayString(0))?.activeCalories ?? 0,
    [recent]
  )

  const authorizeAndSync = async () => {
    setSyncing(true)
    try {
      const { Health } = await import("@capgo/capacitor-health")
      const availability = await Health.isAvailable()
      if (!availability.available) {
        setAuthState("unavailable")
        toast.error("设备未安装 Health Connect，请先安装后重试")
        return
      }

      const status = await Health.requestAuthorization({
        read: ["steps", "calories", "exerciseTime"],
        write: [],
        requestHistoryAccess: false,
      })
      const granted = status.readAuthorized.length > 0
      setAuthState(granted ? "granted" : "denied")
      if (!granted) {
        toast.error("未获得健康数据读取授权，无法同步")
        return
      }

      const end = new Date()
      const start = new Date()
      start.setDate(start.getDate() - 6)
      const startIso = start.toISOString()
      const endIso = end.toISOString()

      const [stepsAgg, caloriesAgg, exerciseAgg] = await Promise.all([
        Health.queryAggregated({ dataType: "steps", startDate: startIso, endDate: endIso, bucket: "day", aggregation: "sum" }),
        Health.queryAggregated({ dataType: "calories", startDate: startIso, endDate: endIso, bucket: "day", aggregation: "sum" }),
        Health.queryAggregated({ dataType: "exerciseTime", startDate: startIso, endDate: endIso, bucket: "day", aggregation: "sum" }),
      ])

      const byDate = new Map<string, { steps: number; calories: number; minutes: number }>()
      const touch = (date: string) => {
        if (!byDate.has(date)) byDate.set(date, { steps: 0, calories: 0, minutes: 0 })
        return byDate.get(date)!
      }
      for (const sample of stepsAgg.samples) {
        const slot = touch(bucketDate(sample.startDate))
        slot.steps = Math.round(sample.value)
      }
      for (const sample of caloriesAgg.samples) {
        const slot = touch(bucketDate(sample.startDate))
        slot.calories = Math.round(sample.value * 10) / 10
      }
      for (const sample of exerciseAgg.samples) {
        const slot = touch(bucketDate(sample.startDate))
        slot.minutes = Math.round(sample.value)
      }

      let synced = 0
      for (const [activityDate, slot] of byDate) {
        const response = await fetch("/api/health/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            activityDate,
            steps: slot.steps,
            activeCalories: slot.calories,
            exerciseMinutes: slot.minutes,
            sourceKind: "health_connect",
          }),
        })
        const payload = (await response.json()) as ApiEnvelope<{ activity: ActivityRow }>
        if (!response.ok || !payload.data) throw new Error(payload.error || "同步活动量失败")
        synced += 1
      }

      await loadRecent()
      toast.success(`已同步最近 7 天活动量（${synced} 天）`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "同步手机健康数据失败")
    } finally {
      setSyncing(false)
    }
  }

  const saveManual = async () => {
    setSavingManual(true)
    try {
      const steps = Number(manualSteps)
      const calories = Number(manualCalories)
      if (!Number.isInteger(steps) || steps < 0) throw new Error("步数必须是 ≥0 的整数")
      if (!Number.isFinite(calories) || calories < 0) throw new Error("活动消耗必须是 ≥0 的数字")

      const response = await fetch("/api/health/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ steps, activeCalories: calories, sourceKind: "manual" }),
      })
      const payload = (await response.json()) as ApiEnvelope<{ activity: ActivityRow }>
      if (!response.ok || !payload.data) throw new Error(payload.error || "保存活动量失败")

      setManualSteps("")
      setManualCalories("")
      await loadRecent()
      toast.success("今日活动量已保存")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存活动量失败")
    } finally {
      setSavingManual(false)
    }
  }

  return (
    <section className="surface-card mt-6 overflow-hidden border-0">
      <div className="grid lg:grid-cols-[24rem_minmax(0,1fr)]">
        <aside className="bg-[var(--brand-lavender)] p-6 text-[var(--brand-heading)] sm:p-8">
          <div className="grid size-16 place-items-center rounded-md bg-[var(--brand-plum)] text-[var(--brand-mint)]">
            <HeartPulse className="size-8" />
          </div>
          <p className="mt-6 text-[11px] font-semibold uppercase text-[var(--brand-lavender-deep)]">Activity data</p>
          <h2 className="mt-3 text-3xl font-semibold leading-tight">让建议看得见你的运动。</h2>
          <p className="mt-3 text-sm leading-6 text-[var(--brand-heading)]/68">
            步数与活动消耗进入本地数据库，Agent 在给出饮食建议时会一并参考你的当天运动量。
          </p>
          {platform === "native" && (
            <div className="mt-6 flex items-center gap-2 text-xs font-semibold text-[var(--brand-lavender-deep)]">
              <Smartphone className="size-4" /> 正在 App 壳内运行
            </div>
          )}
        </aside>

        <div className="bg-[var(--brand-paper)] p-5 sm:p-7 lg:p-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="page-eyebrow">Health Connect + manual</p>
              <h2 className="mt-2 text-3xl font-semibold text-[var(--brand-heading)]">同步活动量。</h2>
            </div>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {authState === "granted" ? <CheckCircle2 className="size-3.5 text-[var(--brand-mint-deep)]" /> : <Activity className="size-3.5 text-[var(--brand-coral)]" />}
              {authState === "granted" ? "已授权" : authState === "denied" ? "未授权" : authState === "unavailable" ? "Health Connect 不可用" : "未连接"}
            </span>
          </div>

          {platform === "web" ? (
            <div className="mt-5 rounded-md bg-[var(--brand-amber-soft)] px-3 py-2 text-xs leading-5 text-[var(--brand-amber-ink)]">
              当前浏览器环境无法读取系统健康数据。在 App 壳内运行时可通过 Health Connect 自动同步；在网页中可先用下方手动输入记录今日活动量。
            </div>
          ) : (
            <div className="mt-5 rounded-md bg-[var(--brand-mint-soft)] px-3 py-2 text-xs leading-5 text-[var(--brand-mint-ink)]">
              读取步数、活动卡路里与运动分钟（最近 7 天），数据只保存在本机。授权弹窗仅在首次出现，之后可在系统设置中随时撤回。
            </div>
          )}

          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-muted-foreground">
              今日：<span className="font-semibold text-[var(--brand-heading)]">{todaySteps.toLocaleString()}</span> 步 ·{" "}
              <span className="font-semibold text-[var(--brand-heading)]">{Math.round(todayCalories)}</span> kcal 活动消耗
            </div>
            {platform === "native" && (
              <Button
                type="button"
                variant="outline"
                disabled={syncing || authState === "unavailable"}
                onClick={() => void authorizeAndSync()}
              >
                {syncing ? <LoaderCircle className="animate-spin" /> : <RefreshCw />}
                {authState === "granted" ? "重新同步" : "授权并同步"}
              </Button>
            )}
          </div>

          <div className="mt-6 rounded-md border bg-card p-4">
            <Label className="text-sm font-semibold text-[var(--brand-heading)]">手动记录今日活动量（网页/壳内皆可）</Label>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="manual-steps" className="text-xs text-muted-foreground">今日步数</Label>
                <Input
                  id="manual-steps"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={manualSteps}
                  onChange={(event) => setManualSteps(event.target.value)}
                  placeholder="如 8000"
                  className="min-w-0 bg-card"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="manual-calories" className="text-xs text-muted-foreground">活动消耗（kcal）</Label>
                <Input
                  id="manual-calories"
                  type="number"
                  min={0}
                  inputMode="decimal"
                  value={manualCalories}
                  onChange={(event) => setManualCalories(event.target.value)}
                  placeholder="如 320"
                  className="min-w-0 bg-card"
                />
              </div>
            </div>
            <div className="mt-3 flex justify-end">
              <Button type="button" disabled={savingManual} onClick={() => void saveManual()}>
                {savingManual ? <LoaderCircle className="animate-spin" /> : null}保存今日活动量
              </Button>
            </div>
          </div>

          <div className="mt-6">
            <h3 className="text-sm font-semibold text-[var(--brand-heading)]">最近 7 天</h3>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[28rem] text-left text-sm">
                <thead>
                  <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">日期</th>
                    <th className="py-2 pr-4 font-medium">步数</th>
                    <th className="py-2 pr-4 font-medium">活动消耗</th>
                    <th className="py-2 pr-4 font-medium">运动分钟</th>
                    <th className="py-2 font-medium">来源</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 7 }, (_, index) => {
                    const date = dayString(6 - index)
                    const row = recent.find((item) => item.activityDate === date)
                    return (
                      <tr key={date} className="border-b border-dashed last:border-0">
                        <td className="py-2.5 pr-4 text-muted-foreground">{date}</td>
                        <td className="py-2.5 pr-4 font-medium text-[var(--brand-heading)]">
                          {row ? row.steps.toLocaleString() : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="py-2.5 pr-4 font-medium text-[var(--brand-heading)]">
                          {row ? `${Math.round(row.activeCalories)} kcal` : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="py-2.5 pr-4">
                          {row && row.exerciseMinutes > 0 ? `${row.exerciseMinutes} 分钟` : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="py-2.5">
                          {row ? (
                            row.sourceKind === "health_connect" ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--brand-mint-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--brand-mint-deep)]">
                                <Smartphone className="size-3" /> Health
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-[var(--brand-coral-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--brand-coral-ink)]">
                                手动
                              </span>
                            )
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {platform === "native" && authState === "unavailable" && (
            <div className="mt-5 flex items-center gap-2 rounded-md bg-[var(--brand-coral-soft)] px-3 py-2 text-xs leading-5 text-[#8a3a2e] dark:text-[#ffb0a0]">
              <XCircle className="size-4 shrink-0" />
              Health Connect 未安装：请从手机 Play 商店安装「Health Connect by Android」（Android 14+ 已自带）后重试。
            </div>
          )}
        </div>
      </div>
    </section>
  )
}