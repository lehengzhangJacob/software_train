"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatCalories, formatGrams } from "@/lib/utils"
import { TrendingUp, CalendarDays, Target, Beef, Droplet, Wheat } from "lucide-react"

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

function ReportBarChart({ daily, target }: { daily: DailyReport[]; target: number }) {
  const values = daily.flatMap((day) => (day.calories === null ? [] : [day.calories]))
  const observedMax = Math.max(target, ...values)
  const chartMax = Math.max(500, Math.ceil((observedMax * 1.1) / 500) * 500)
  const targetY = Math.max(0, 100 - (target / chartMax) * 100)
  const yTicks = [chartMax, chartMax / 2, 0]

  return (
    <div className="h-72 w-full" role="img" aria-label="营养报告热量趋势">
      <div className="flex h-full">
        <div className="relative mb-7 w-12 shrink-0 text-[11px] text-neutral-400">
          {yTicks.map((value, index) => (
            <span
              key={value}
              className="absolute right-2 -translate-y-1/2"
              style={{ top: `${index * 50}%` }}
            >
              {formatCalories(value)}
            </span>
          ))}
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="relative min-h-0 flex-1 border-b border-l border-neutral-200">
            {[0, 50].map((top) => (
              <div key={top} className="absolute inset-x-0 border-t border-dashed border-neutral-200" style={{ top: `${top}%` }} />
            ))}
            <div className="absolute inset-x-0 z-20 border-t border-dashed border-orange-400" style={{ top: `${targetY}%` }}>
              <span className="absolute right-1 -top-5 rounded bg-white px-1 text-[10px] font-medium text-orange-600">目标</span>
            </div>

            <div className="absolute inset-0 z-10 flex items-end gap-1 px-1 sm:gap-2">
              {daily.map((day) => {
                const height = day.calories === null ? 0 : Math.max(1, (day.calories / chartMax) * 100)
                const description = day.recorded
                  ? `${day.date}: ${formatCalories(day.calories ?? 0)} 千卡，目标 ${formatCalories(day.target)} 千卡`
                  : `${day.date}: 无饮食记录，目标 ${formatCalories(day.target)} 千卡`

                return (
                  <div key={day.date} className="flex h-full min-w-0 flex-1 items-end justify-center" title={description} aria-label={description}>
                    {day.recorded ? (
                      <div className="w-full max-w-10 rounded-t bg-emerald-600 transition-colors hover:bg-emerald-700" style={{ height: `${height}%` }} />
                    ) : (
                      <div className="mb-1 h-1 w-1 rounded-full bg-neutral-300" />
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <div
            className="grid h-7 items-end pt-2 text-center text-[10px] text-neutral-400"
            style={{ gridTemplateColumns: `repeat(${daily.length}, minmax(0, 1fr))` }}
          >
            {daily.map((day, index) => (
              <span key={day.date}>{daily.length <= 10 || index % 5 === 0 || index === daily.length - 1 ? day.date.slice(5) : ""}</span>
            ))}
          </div>
        </div>
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
        if (!controller.signal.aborted) {
          setLoadError("暂时无法读取营养报告，请稍后重试")
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
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
      <Card>
        <CardContent className="py-12 text-center text-sm text-neutral-400">加载中...</CardContent>
      </Card>
    )
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="space-y-3 py-12 text-center">
          <p className="text-sm text-neutral-600" role="alert">{loadError || "暂时无法读取营养报告，请稍后重试"}</p>
          <Button type="button" variant="outline" onClick={retryLoad}>
            重试
          </Button>
        </CardContent>
      </Card>
    )
  }

  const chartDaily = data.daily.map((day) => ({
    ...day,
    calories: day.recorded === false ? null : day.calories,
  }))

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">营养报告</h1>
        <p className="text-sm text-neutral-500 mt-1">查看饮食趋势和达标情况</p>
      </div>

      <Tabs value={period} onValueChange={changePeriod}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="weekly">近 7 天</TabsTrigger>
          <TabsTrigger value="monthly">近 30 天</TabsTrigger>
        </TabsList>

        <TabsContent value={period} className="space-y-6 mt-6">
          <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-neutral-500">日均热量</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xl font-bold text-neutral-900">{formatCalories(data.avgCalories)}</p>
                <p className="text-xs text-neutral-400">目标 {formatCalories(data.target.calories)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-neutral-500">日均蛋白质</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xl font-bold text-neutral-900">{formatGrams(data.avgProtein)}</p>
                <p className="text-xs text-neutral-400">目标 {formatGrams(data.target.protein)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-neutral-500">日均脂肪</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xl font-bold text-neutral-900">{formatGrams(data.avgFat)}</p>
                <p className="text-xs text-neutral-400">目标 {formatGrams(data.target.fat)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-medium text-neutral-500">达标率</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xl font-bold text-neutral-900">{data.complianceRate}%</p>
                <p className="text-xs text-neutral-400">{data.onTargetDays}/{data.daysRecorded} 天</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                热量趋势
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ReportBarChart daily={chartDaily} target={data.target.calories} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CalendarDays className="h-4 w-4" />
                统计摘要
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-lg bg-neutral-50 p-3">
                  <span className="text-sm text-neutral-600">统计天数</span>
                  <span className="text-sm font-medium text-neutral-800">{data.daysRecorded} / {data.days} 天</span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-neutral-50 p-3">
                  <span className="flex items-center gap-2 text-sm text-neutral-600"><Beef className="h-4 w-4 text-red-500" /> 日均蛋白质</span>
                  <span className="text-sm font-medium text-neutral-800">{formatGrams(data.avgProtein)} 克</span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-neutral-50 p-3">
                  <span className="flex items-center gap-2 text-sm text-neutral-600"><Droplet className="h-4 w-4 text-yellow-500" /> 日均脂肪</span>
                  <span className="text-sm font-medium text-neutral-800">{formatGrams(data.avgFat)} 克</span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-neutral-50 p-3">
                  <span className="flex items-center gap-2 text-sm text-neutral-600"><Wheat className="h-4 w-4 text-amber-500" /> 日均碳水</span>
                  <span className="text-sm font-medium text-neutral-800">{formatGrams(data.avgCarbs)} 克</span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-neutral-50 p-3">
                  <span className="flex items-center gap-2 text-sm text-neutral-600"><Target className="h-4 w-4 text-emerald-500" /> 达标率</span>
                  <span className="text-sm font-medium text-neutral-800">{data.complianceRate}% ({data.onTargetDays}/{data.daysRecorded} 天未超标)</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
