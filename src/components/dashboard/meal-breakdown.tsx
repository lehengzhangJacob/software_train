"use client"

import { MEAL_LABELS, MEAL_ORDER, formatCalories, formatGrams } from "@/lib/utils"
import { ArrowUpRight, Beef, Droplet, Wheat } from "lucide-react"

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
    return (
      <div className="grid min-h-44 place-items-center rounded-md bg-[var(--brand-paper)] px-5 text-center">
        <div>
          <p className="text-sm font-medium text-[var(--brand-plum)]">今天还没有饮食记录</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">拍下第一餐，今天的营养节奏就会从这里开始。</p>
        </div>
      </div>
    )
  }

  return (
    <div className="divide-y divide-border/70">
      {sorted.map((item) => (
        <div key={item.mealType} className="group flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-full bg-[var(--brand-lavender-soft)] text-sm font-semibold text-[#5f51cc]">
              {item.mealType === "breakfast" ? "早" : item.mealType === "lunch" ? "午" : item.mealType === "dinner" ? "晚" : "加"}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[var(--brand-plum)]">{MEAL_LABELS[item.mealType] ?? item.mealType}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{item.count} 项食物 · {formatCalories(item.calories)} 千卡</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <div className="hidden gap-2 text-xs text-muted-foreground sm:flex">
              <span className="flex items-center gap-0.5"><Beef className="h-3 w-3" />{formatGrams(item.proteinG)}</span>
              <span className="flex items-center gap-0.5"><Droplet className="h-3 w-3" />{formatGrams(item.fatG)}</span>
              <span className="flex items-center gap-0.5"><Wheat className="h-3 w-3" />{formatGrams(item.carbsG)}</span>
            </div>
            <ArrowUpRight className="size-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </div>
        </div>
      ))}
    </div>
  )
}
