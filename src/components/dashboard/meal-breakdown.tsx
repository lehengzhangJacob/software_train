"use client"

import { MEAL_LABELS, MEAL_ORDER, formatCalories, formatGrams } from "@/lib/utils"
import { Beef, Droplet, Wheat } from "lucide-react"

interface MealBreakdownProps {
  summary: {
    mealType: string
    calories: number
    proteinG: number
    fatG: number
    carbsG: number
    count: number
  }[]
}

export function MealBreakdown({ summary }: MealBreakdownProps) {
  const sorted = [...summary].sort((a, b) => (MEAL_ORDER[a.mealType] ?? 9) - (MEAL_ORDER[b.mealType] ?? 9))

  if (sorted.length === 0) {
    return <p className="text-sm text-neutral-400 text-center py-6">今日暂无饮食记录</p>
  }

  return (
    <div className="divide-y">
      {sorted.map((item) => (
        <div key={item.mealType} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-100 text-sm font-medium text-neutral-700">
              {item.mealType === "breakfast" ? "早" : item.mealType === "lunch" ? "午" : item.mealType === "dinner" ? "晚" : "加"}
            </div>
            <div>
              <p className="text-sm font-medium text-neutral-800">{MEAL_LABELS[item.mealType] ?? item.mealType}</p>
              <p className="text-xs text-neutral-400">{item.count} 项食物</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold text-neutral-800">{formatCalories(item.calories)} 千卡</p>
            <div className="flex gap-2 text-xs text-neutral-500 mt-0.5">
              <span className="flex items-center gap-0.5"><Beef className="h-3 w-3" />{formatGrams(item.proteinG)}</span>
              <span className="flex items-center gap-0.5"><Droplet className="h-3 w-3" />{formatGrams(item.fatG)}</span>
              <span className="flex items-center gap-0.5"><Wheat className="h-3 w-3" />{formatGrams(item.carbsG)}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
