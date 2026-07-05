"use client"

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts"
import { formatCalories } from "@/lib/utils"

interface CalorieTrendChartProps {
  data: [string, number][]
  target: number
}

export function CalorieTrendChart({ data, target }: CalorieTrendChartProps) {
  const chartData = data.map(([date, cal]) => ({
    date: date.slice(5),
    calories: cal,
  }))

  if (chartData.length === 0) {
    return <p className="text-sm text-neutral-400 text-center py-8">暂无数据</p>
  }

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <XAxis dataKey="date" tick={{ fontSize: 12 }} stroke="#a3a3a3" />
          <YAxis tick={{ fontSize: 12 }} stroke="#a3a3a3" tickFormatter={(v) => formatCalories(Number(v))} />
          <Tooltip
            formatter={(value) => [formatCalories(Number(value)), "热量"]}
            contentStyle={{ borderRadius: 8, border: "1px solid #e5e5e5", fontSize: 13 }}
          />
          <ReferenceLine y={target} stroke="#f97316" strokeDasharray="4 4" label={{ value: "目标", position: "right", fontSize: 12 }} />
          <Line type="monotone" dataKey="calories" stroke="#059669" strokeWidth={2} dot={{ r: 4, fill: "#059669" }} activeDot={{ r: 6 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
