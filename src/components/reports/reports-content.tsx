"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts"
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

function NutritionTooltip({
  active,
  label,
  dailyByDate,
}: {
  active?: boolean
  label?: string | number
  dailyByDate: Map<string, DailyReport>
}) {
  if (!active || label === undefined) return null

  const day = dailyByDate.get(String(label))
  if (!day) return null

  return (
    <div className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-xs shadow-sm">
      <p className="font-medium text-neutral-800">日期: {day.date}</p>
      <p className="mt-1 text-neutral-600">
        {day.recorded ? `摄入: ${formatCalories(day.calories ?? 0)}` : "无饮食记录"}
      </p>
      <p className="text-neutral-500">目标: {formatCalories(day.target)}</p>
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
  const dailyByDate = new Map(chartDaily.map((day) => [day.date, day]))

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
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartDaily}>
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#a3a3a3" tickFormatter={(v: string) => v.slice(5)} />
                    <YAxis tick={{ fontSize: 11 }} stroke="#a3a3a3" tickFormatter={(v) => formatCalories(Number(v))} />
                    <Tooltip content={<NutritionTooltip dailyByDate={dailyByDate} />} />
                    <ReferenceLine y={data.target.calories} stroke="#f97316" strokeDasharray="4 4" label={{ value: "目标", position: "right", fontSize: 11 }} />
                    <Bar dataKey="calories" fill="#059669" radius={[4, 4, 0, 0]} maxBarSize={period === "weekly" ? 40 : 20} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
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
