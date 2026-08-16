"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { ArrowRight, Beef, CalendarDays, Droplet, Loader2, RotateCcw, Sparkles, Target, Wheat } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn, formatCalories, formatGrams } from "@/lib/utils"

interface ReportData {
  period: string
  days: number
  daysRecorded: number
  avgCalories: number
  avgProtein: number
  avgFat: number
  avgCarbs: number
  complianceRate: number
  onTargetDays: number
  totalDays: number
  daily: {
    date: string
    calories: number | null
    protein: number | null
    fat: number | null
    carbs: number | null
    target: number
    diff: number | null
    recorded: boolean
  }[]
  target: { calories: number; protein: number; fat: number; carbs: number }
}

interface ApiEnvelope<T> {
  data?: T
  error?: string
}

type DailyReport = ReportData["daily"][number]

function clampPercent(value: number) {
  return Math.min(100, Math.max(0, Math.round(value)))
}

function ReportBarChart({ daily, target }: { daily: DailyReport[]; target: number }) {
  const values = daily.flatMap((day) => (day.calories === null ? [] : [day.calories]))
  const observedMax = Math.max(target, ...values)
  const chartMax = Math.max(500, observedMax * 1.08)

  return (
    <div className="flex h-44 items-end gap-1.5 sm:gap-2" role="img" aria-label="营养报告热量趋势">
      {daily.map((day, index) => {
        const height = day.calories === null ? 8 : Math.max(12, (day.calories / chartMax) * 100)
        const overTarget = day.calories !== null && day.calories > target * 1.1
        const description = day.recorded
          ? `${day.date}: ${formatCalories(day.calories ?? 0)} 千卡，目标 ${formatCalories(day.target)} 千卡`
          : `${day.date}: 无饮食记录`

        return (
          <div key={day.date} className="flex h-full min-w-0 flex-1 flex-col justify-end" title={description} aria-label={description}>
            <div
              className={day.recorded ? (overTarget ? "bg-[var(--brand-coral)]" : index % 5 === 2 ? "bg-[var(--brand-lavender)]" : "bg-[var(--brand-mint)]") : "bg-white/18"}
              style={{ height: `${height}%` }}
            />
            <span className="mt-2 h-3 truncate text-center text-[9px] text-white/45">
              {daily.length <= 10 || index % 5 === 0 || index === daily.length - 1 ? day.date.slice(5) : ""}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function GoalProgress({ label, value, detail, color }: { label: string; value: number; detail: string; color: string }) {
  return (
    <div className="border-b border-border/80 pb-4 last:border-0 last:pb-0">
      <div className="flex items-center justify-between gap-4 text-sm">
        <span className="font-medium text-[var(--brand-plum)]">{label}</span>
        <span className="text-xs font-semibold text-[var(--brand-plum)]">{detail}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#e8e4eb]">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${clampPercent(value)}%` }} />
      </div>
    </div>
  )
}

async function readApiEnvelope<T>(response: Response): Promise<ApiEnvelope<T>> {
  try {
    return (await response.json()) as ApiEnvelope<T>
  } catch {
    return { error: "暂时无法读取营养报告，请稍后重试" }
  }
}

export function ReportsContent() {
  const [period, setPeriod] = useState("weekly")
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    const loadReport = async () => {
      setLoading(true)
      setData(null)
      setLoadError(null)

      try {
        const response = await fetch(`/api/reports?period=${period}`, {
          cache: "no-store",
          signal: controller.signal,
        })
        const result = await readApiEnvelope<ReportData>(response)

        if (controller.signal.aborted) return

        if (!response.ok || !result.data) {
          setLoadError(result.error || "暂时无法读取营养报告，请稍后重试")
          return
        }

        setData(result.data)
      } catch {
        if (!controller.signal.aborted) setLoadError("暂时无法读取营养报告，请稍后重试")
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    void loadReport()
    return () => controller.abort()
  }, [period, reloadKey])

  const changePeriod = (value: string) => {
    if (value === period) return
    setLoading(true)
    setData(null)
    setLoadError(null)
    setPeriod(value)
  }

  const retryLoad = () => {
    setLoading(true)
    setData(null)
    setLoadError(null)
    setReloadKey((current) => current + 1)
  }

  if (loading) {
    return (
      <div className="surface-card grid min-h-[420px] place-items-center border-0">
        <div className="text-center">
          <Loader2 className="mx-auto size-7 animate-spin text-[var(--brand-mint-deep)]" />
          <p className="mt-4 text-sm text-muted-foreground">正在整理你的营养节奏…</p>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="surface-card grid min-h-[420px] place-items-center border-0 p-6">
        <div className="max-w-sm text-center">
          <CalendarDays className="mx-auto size-8 text-[var(--brand-coral)]" />
          <h1 className="mt-4 text-2xl font-semibold text-[var(--brand-plum)]">报告暂时没有生成</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground" role="alert">{loadError || "暂时无法读取营养报告，请稍后重试"}</p>
          <Button type="button" variant="outline" className="mt-5" onClick={retryLoad}><RotateCcw />重试</Button>
        </div>
      </div>
    )
  }

  const chartDaily = data.daily.map((day) => ({ ...day, calories: day.recorded === false ? null : day.calories }))
  const recordRate = data.days === 0 ? 0 : (data.daysRecorded / data.days) * 100
  const proteinRate = data.target.protein === 0 ? 0 : (data.avgProtein / data.target.protein) * 100
  const calorieFit = data.target.calories === 0
    ? 0
    : 100 - Math.min(100, Math.abs(data.avgCalories - data.target.calories) / data.target.calories * 100)
  const headline = recordRate < 70
    ? "先把记录连续起来。"
    : data.complianceRate >= 80
      ? "你正在建立更稳定的节奏。"
      : data.complianceRate >= 60
        ? "方向是对的，再稳定一点。"
        : "下一步，先缩小每天的波动。"
  const review = recordRate < 70
    ? `这一周期记录了 ${data.daysRecorded}/${data.days} 天。先把缺失的日子补齐，趋势会比单次数字更可信。`
    : proteinRate < 85
      ? `记录已经比较稳定，下一步优先照顾蛋白质。当前日均 ${formatGrams(data.avgProtein)} 克，目标 ${formatGrams(data.target.protein)} 克。`
      : `热量和蛋白质都已接近目标区间。继续保持当前节奏，不需要为了某一天的波动做激烈补偿。`

  const metrics = [
    { label: "日均热量", value: formatCalories(data.avgCalories), suffix: "千卡", detail: `目标 ${formatCalories(data.target.calories)}` },
    { label: "日均蛋白质", value: formatGrams(data.avgProtein), suffix: "克", detail: `目标 ${formatGrams(data.target.protein)}` },
    { label: "记录完成", value: `${data.daysRecorded}/${data.days}`, suffix: "天", detail: `${Math.round(recordRate)}% 完整` },
    { label: "目标内", value: `${data.onTargetDays}`, suffix: "天", detail: `${data.complianceRate}% 达标` },
  ]

  return (
    <div className="space-y-5">
      <Tabs value={period} onValueChange={changePeriod}>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="page-eyebrow">Nutrition review</p>
            <h1 className="page-title mt-1">营养报告</h1>
          </div>
          <TabsList className="grid w-56 grid-cols-2 bg-white">
            <TabsTrigger value="weekly">近 7 天</TabsTrigger>
            <TabsTrigger value="monthly">近 30 天</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value={period} className="mt-0 space-y-5">
          <section className="grid overflow-hidden rounded-lg bg-[var(--brand-plum)] text-white lg:grid-cols-[.72fr_1.28fr]">
            <div className="flex flex-col justify-center p-6 sm:p-8">
              <p className="text-[11px] font-semibold uppercase text-[var(--brand-mint)]">{period === "weekly" ? "7-day review" : "30-day review"}</p>
              <strong className="mt-3 text-6xl font-semibold leading-none">{data.complianceRate}%</strong>
              <p className="mt-4 text-sm text-white/72">{data.onTargetDays} 天保持在热量目标内</p>
              <p className="mt-1 text-xs text-white/45">统计基于 {data.daysRecorded} 个有记录的日期</p>
            </div>
            <div className="bg-white/[.06] px-4 pb-4 pt-7 sm:px-7">
              <ReportBarChart daily={chartDaily} target={data.target.calories} />
            </div>
          </section>

          <section className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {metrics.map((metric) => (
                  <div key={metric.label} className="surface-card p-4">
                    <p className="text-[11px] text-muted-foreground">{metric.label}</p>
                    <p className="mt-2 text-2xl font-semibold text-[var(--brand-plum)]">
                      {metric.value}<span className="ml-1 text-xs font-normal text-muted-foreground">{metric.suffix}</span>
                    </p>
                    <p className="mt-2 text-[10px] text-muted-foreground">{metric.detail}</p>
                  </div>
                ))}
              </div>

              <div className="rounded-lg bg-[var(--brand-lavender-soft)] p-5 sm:p-6">
                <div className="flex items-center gap-2 text-xs font-semibold text-[#6658c8]"><Sparkles className="size-3.5" />AI 周期回顾</div>
                <h2 className="mt-3 text-2xl font-semibold text-[var(--brand-plum)]">{headline}</h2>
                <p className="mt-3 text-sm leading-6 text-[#5d5665]">{review}</p>
                <Link href="/agent" className="mt-5 inline-flex h-10 items-center gap-2 rounded-md bg-[var(--brand-plum)] px-4 text-sm font-semibold text-white">
                  和教练继续讨论<ArrowRight className="size-4" />
                </Link>
              </div>
            </div>

            <aside className="surface-card p-5 sm:p-6">
              <p className="page-eyebrow">Target progress</p>
              <h2 className="mt-1 text-xl font-semibold text-[var(--brand-plum)]">目标完成情况</h2>
              <div className="mt-6 space-y-4">
                <GoalProgress label="热量目标贴合度" value={calorieFit} detail={`${clampPercent(calorieFit)}%`} color="bg-[var(--brand-mint)]" />
                <GoalProgress label="蛋白质目标" value={proteinRate} detail={`${clampPercent(proteinRate)}%`} color="bg-[var(--brand-lavender)]" />
                <GoalProgress label="连续记录" value={recordRate} detail={`${data.daysRecorded}/${data.days} 天`} color="bg-[var(--brand-coral)]" />
              </div>

              <div className="mt-7 grid gap-3 border-t border-border/80 pt-5 text-sm">
                <div className="flex items-center justify-between gap-3"><span className="flex items-center gap-2 text-muted-foreground"><Beef className="size-4 text-[var(--brand-coral)]" />日均蛋白质</span><b>{formatGrams(data.avgProtein)} 克</b></div>
                <div className="flex items-center justify-between gap-3"><span className="flex items-center gap-2 text-muted-foreground"><Droplet className="size-4 text-[var(--brand-lavender)]" />日均脂肪</span><b>{formatGrams(data.avgFat)} 克</b></div>
                <div className="flex items-center justify-between gap-3"><span className="flex items-center gap-2 text-muted-foreground"><Wheat className="size-4 text-[#d99c31]" />日均碳水</span><b>{formatGrams(data.avgCarbs)} 克</b></div>
                <div className="flex items-center justify-between gap-3"><span className="flex items-center gap-2 text-muted-foreground"><Target className="size-4 text-[var(--brand-mint-deep)]" />达标天数</span><b>{data.onTargetDays} 天</b></div>
              </div>
            </aside>
          </section>
        </TabsContent>
      </Tabs>
    </div>
  )
}
