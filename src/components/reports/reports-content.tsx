"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
  daily: { date: string; calories: number; protein: number; fat: number; carbs: number; target: number; diff: number }[]
  target: { calories: number; protein: number; fat: number; carbs: number }
}

interface ReportsContentProps {
  userId: number
}

export function ReportsContent({ userId }: ReportsContentProps) {
  const [period, setPeriod] = useState("weekly")
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/reports?userId=${userId}&period=${period}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.data) setData(j.data)
        setLoading(false)
      })
  }, [userId, period])

  if (loading || !data) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-neutral-400">加载中...</CardContent>
      </Card>
    )
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">营养报告</h1>
        <p className="text-sm text-neutral-500 mt-1">查看饮食趋势和达标情况</p>
      </div>

      <Tabs value={period} onValueChange={setPeriod}>
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
                  <BarChart data={data.daily}>
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#a3a3a3" tickFormatter={(v: string) => v.slice(5)} />
                    <YAxis tick={{ fontSize: 11 }} stroke="#a3a3a3" tickFormatter={(v) => formatCalories(Number(v))} />
                    <Tooltip
                      formatter={(value, name) => {
                        const v = Number(value)
                        const n = String(name)
                        if (n === "calories") return [formatCalories(v), "摄入"]
                        if (n === "target") return [formatCalories(v), "目标"]
                        return [v, n]
                      }}
                      labelFormatter={(label) => `日期: ${label}`}
                      contentStyle={{ borderRadius: 8, border: "1px solid #e5e5e5", fontSize: 13 }}
                    />
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
