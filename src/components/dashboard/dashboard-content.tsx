"use client"

import Image from "next/image"
import Link from "next/link"
import { ArrowRight, Camera, Flame, Sparkles } from "lucide-react"
import { NutrientProgress } from "@/components/dashboard/nutrient-progress"
import { formatCalories, formatGrams, calcCaloriePercent } from "@/lib/utils"
import { CalorieTrendChart } from "@/components/charts/calorie-trend"
import { MacroDonut } from "@/components/charts/macro-donut"
import { MealBreakdown } from "@/components/dashboard/meal-breakdown"

interface DashboardContentProps {
  user: {
    username: string
    dailyCalorieTarget: number
    dailyProteinTarget: number
    dailyFatTarget: number
    dailyCarbsTarget: number
  }
  totalCalories: number
  totalProtein: number
  totalFat: number
  totalCarbs: number
  trends: { date: string; calories: number | null }[]
  dailySummary: {
    mealType: string
    calories: number
    proteinG: number
    fatG: number
    carbsG: number
    count: number
  }[]
}

export function DashboardContent({
  user,
  totalCalories,
  totalProtein,
  totalFat,
  totalCarbs,
  trends,
  dailySummary,
}: DashboardContentProps) {
  const remainingCalories = Math.max(0, user.dailyCalorieTarget - totalCalories)
  const caloriePercent = calcCaloriePercent(totalCalories, user.dailyCalorieTarget)
  const proteinPercent = calcCaloriePercent(totalProtein, user.dailyProteinTarget)
  const fatPercent = calcCaloriePercent(totalFat, user.dailyFatTarget)
  const carbsPercent = calcCaloriePercent(totalCarbs, user.dailyCarbsTarget)
  const recordedMeals = dailySummary.reduce((sum, item) => sum + item.count, 0)

  const nutrients = [
    {
      label: "热量",
      value: `${formatCalories(totalCalories)} 千卡`,
      target: `${formatCalories(user.dailyCalorieTarget)} 千卡`,
      percent: caloriePercent,
      color: "bg-[var(--brand-mint)]",
    },
    {
      label: "蛋白质",
      value: `${formatGrams(totalProtein)} 克`,
      target: `${formatGrams(user.dailyProteinTarget)} 克`,
      percent: proteinPercent,
      color: "bg-[var(--brand-coral)]",
    },
    {
      label: "脂肪",
      value: `${formatGrams(totalFat)} 克`,
      target: `${formatGrams(user.dailyFatTarget)} 克`,
      percent: fatPercent,
      color: "bg-[var(--brand-lavender)]",
    },
    {
      label: "碳水",
      value: `${formatGrams(totalCarbs)} 克`,
      target: `${formatGrams(user.dailyCarbsTarget)} 克`,
      percent: carbsPercent,
      color: "bg-[#f2ba48]",
    },
  ]

  return (
    <div className="space-y-5 lg:space-y-6">
      <section className="grid min-h-[330px] overflow-hidden rounded-lg bg-[var(--brand-plum)] text-white lg:grid-cols-[1.03fr_.97fr]">
        <div className="flex flex-col justify-between gap-8 p-6 sm:p-8 lg:p-10">
          <div>
            <div className="mb-4 flex items-center gap-2 text-[11px] font-semibold uppercase text-[var(--brand-mint)]">
              <Sparkles className="size-3.5" />
              Today&apos;s rhythm
            </div>
            <h1 className="max-w-xl text-[clamp(2rem,4vw,4.2rem)] font-semibold leading-[.98]">
              今天，照顾好
              <br />
              你的晚餐。
            </h1>
          </div>

          <div className="flex flex-wrap items-end justify-between gap-5">
            <div>
              <p className="text-sm text-white/60">
                {user.username}，{recordedMeals > 0 ? `今天已经记录 ${recordedMeals} 项` : "从第一餐开始记录"}
              </p>
              <div className="mt-1 flex items-end gap-2">
                <strong className="text-5xl font-semibold leading-none text-[var(--brand-mint)]">
                  {formatCalories(remainingCalories)}
                </strong>
                <span className="pb-1 text-sm text-white/65">千卡可安排</span>
              </div>
            </div>
            <Link
              href="/meals"
              className="inline-flex h-11 items-center gap-2 rounded-md bg-[var(--brand-mint)] px-4 text-sm font-semibold text-[var(--brand-plum)] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <Camera className="size-4" />
              记录这一餐
            </Link>
          </div>
        </div>

        <div className="relative min-h-64 lg:min-h-full">
          <Image
            src="/images/nutrition/meal-hero.webp"
            alt="包含三文鱼、牛油果和蔬菜的健康餐"
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 48vw"
            className="object-cover"
          />
          <div className="absolute inset-x-4 bottom-4 rounded-md bg-white/94 p-3 text-[var(--brand-plum)] shadow-lg backdrop-blur sm:inset-x-auto sm:right-5 sm:w-64">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-semibold uppercase text-[var(--brand-mint-deep)]">下一步</p>
                <p className="mt-1 text-sm font-semibold">给晚餐留一点余量</p>
              </div>
              <Flame className="size-5 text-[var(--brand-coral)]" />
            </div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              当前完成 {Math.round(Math.min(caloriePercent, 100))}%，优先补足蛋白质和蔬菜。
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
        <div className="surface-card p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="page-eyebrow">Today&apos;s meals</p>
              <h2 className="mt-1 text-xl font-semibold text-[var(--brand-plum)]">今天吃了什么</h2>
            </div>
            <Link href="/meals" className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--brand-mint-deep)]">
              添加记录
              <ArrowRight className="size-4" />
            </Link>
          </div>
          <MealBreakdown summary={dailySummary} />
        </div>

        <aside className="surface-card p-5 sm:p-6">
          <p className="page-eyebrow">Daily targets</p>
          <h2 className="mt-1 text-xl font-semibold text-[var(--brand-plum)]">今天的身体账本</h2>
          <div className="mt-6 space-y-5">
            {nutrients.map((item) => (
              <div key={item.label}>
                <div className="flex items-baseline justify-between gap-4 text-sm">
                  <span className="font-medium text-[var(--brand-plum)]">{item.label}</span>
                  <span className="text-xs text-muted-foreground">
                    <b className="mr-1 text-foreground">{item.value}</b>/ {item.target}
                  </span>
                </div>
                <NutrientProgress
                  value={item.percent}
                  className="mt-2"
                  indicatorClassName={item.color}
                />
              </div>
            ))}
          </div>
        </aside>
      </section>

      <section className="surface-card grid overflow-hidden lg:grid-cols-[.72fr_1.28fr]">
        <div className="border-b border-border/80 p-5 sm:p-6 lg:border-b-0 lg:border-r">
          <p className="page-eyebrow">Macro balance</p>
          <h2 className="mt-1 text-xl font-semibold text-[var(--brand-plum)]">宏量营养分布</h2>
          <div className="mt-4">
            <MacroDonut protein={totalProtein} fat={totalFat} carbs={totalCarbs} />
          </div>
        </div>
        <div className="p-5 sm:p-6">
          <div className="mb-2 flex items-end justify-between gap-4">
            <div>
              <p className="page-eyebrow">Seven days</p>
              <h2 className="mt-1 text-xl font-semibold text-[var(--brand-plum)]">最近的节奏</h2>
            </div>
            <span className="text-xs text-muted-foreground">目标 {formatCalories(user.dailyCalorieTarget)} 千卡</span>
          </div>
          <CalorieTrendChart data={trends} target={user.dailyCalorieTarget} />
        </div>
      </section>
    </div>
  )
}
