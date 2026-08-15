"use client"

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts"
import { formatGrams } from "@/lib/utils"

interface MacroDonutProps {
  protein: number
  fat: number
  carbs: number
}

const COLORS = {
  protein: "#ef4444",
  fat: "#eab308",
  carbs: "#f59e0b",
}

export function MacroDonut({ protein, fat, carbs }: MacroDonutProps) {
  const total = protein * 4 + fat * 9 + carbs * 4
  const data = [
    { name: "蛋白质", value: protein * 4, grams: protein, color: COLORS.protein },
    { name: "脂肪", value: fat * 9, grams: fat, color: COLORS.fat },
    { name: "碳水", value: carbs * 4, grams: carbs, color: COLORS.carbs },
  ].filter((d) => d.value > 0)

  if (data.length === 0) {
    return <p className="text-sm text-neutral-400 text-center py-8">暂无数据</p>
  }

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="h-48 w-48 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" innerRadius={55} outerRadius={80} dataKey="value" paddingAngle={2}>
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(_value, name) => {
                const item = Array.isArray(data) ? data.find((d) => d.name === name) : undefined
                return [`${formatGrams(item?.grams ?? 0)} 克`, name as string]
              }}
              contentStyle={{ borderRadius: 8, border: "1px solid #e5e5e5", fontSize: 13 }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="w-full space-y-2 sm:w-auto">
        {data.map((d) => (
          <div key={d.name} className="flex items-center gap-2 text-sm">
            <div className="h-3 w-3 rounded-full" style={{ backgroundColor: d.color }} />
            <span className="text-neutral-600">{d.name}</span>
            <span className="font-medium text-neutral-800">{formatGrams(d.grams)}g</span>
            <span className="text-neutral-400">({Math.round((d.value / total) * 100)}%)</span>
          </div>
        ))}
      </div>
    </div>
  )
}
