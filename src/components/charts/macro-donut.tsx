"use client"

import { formatCalories, formatGrams } from "@/lib/utils"

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
  ].filter((item) => item.value > 0)

  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-neutral-400">暂无数据</p>
  }

  const radius = 34
  const circumference = 2 * Math.PI * radius
  let consumedRatio = 0
  const segments = data.map((item) => {
    const ratio = item.value / total
    const dashLength = Math.max(0, ratio * circumference - 2)
    const dashOffset = -consumedRatio * circumference
    consumedRatio += ratio
    return { ...item, ratio, dashLength, dashOffset }
  })

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <svg
        viewBox="0 0 100 100"
        className="h-48 w-48 shrink-0"
        role="img"
        aria-label={`宏量营养素总计 ${formatCalories(total)} 千卡`}
      >
        <circle cx="50" cy="50" r={radius} fill="none" stroke="var(--chart-track)" strokeWidth="16" />
        {segments.map((segment) => (
          <circle
            key={segment.name}
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke={segment.color}
            strokeWidth="16"
            strokeLinecap="round"
            strokeDasharray={`${segment.dashLength} ${circumference - segment.dashLength}`}
            strokeDashoffset={segment.dashOffset}
            transform="rotate(-90 50 50)"
          >
            <title>{`${segment.name}: ${formatGrams(segment.grams)} 克，占 ${Math.round(segment.ratio * 100)}%`}</title>
          </circle>
        ))}
        <text x="50" y="48" textAnchor="middle" className="fill-neutral-900 text-[11px] font-semibold">
          {formatCalories(total)}
        </text>
        <text x="50" y="58" textAnchor="middle" className="fill-neutral-400 text-[6px]">
          千卡
        </text>
      </svg>

      <div className="w-full space-y-2 sm:w-auto">
        {segments.map((segment) => (
          <div key={segment.name} className="flex items-center gap-2 text-sm">
            <div className="h-3 w-3 rounded-full" style={{ backgroundColor: segment.color }} />
            <span className="text-neutral-600">{segment.name}</span>
            <span className="font-medium text-neutral-800">{formatGrams(segment.grams)}g</span>
            <span className="text-neutral-400">({Math.round(segment.ratio * 100)}%)</span>
          </div>
        ))}
      </div>
    </div>
  )
}
