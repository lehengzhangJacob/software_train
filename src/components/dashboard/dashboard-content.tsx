"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { NutrientProgress } from "@/components/dashboard/nutrient-progress"
import { formatCalories, formatGrams, calcCaloriePercent } from "@/lib/utils"
import { CalorieTrendChart } from "@/components/charts/calorie-trend"
import { MacroDonut } from "@/components/charts/macro-donut"
import { MealBreakdown } from "@/components/dashboard/meal-breakdown"
import { Flame, Wheat, Beef, Droplet, Utensils } from "lucide-react"

interface DashboardContentProps {
  user: {
    username: string
    dailyCalorieTarget: number
    dailyProteinTarget: number
    dailyFatTarget: number
    dailyCarbsTarget: number
  }
  today: string
  totalCalories: number
  totalProtein: number
  totalFat: number
  totalCarbs: number
  trends: [string, number][]
  dailySummary: {
    mealType: string
    calories: number
    proteinG: number
    fatG: number
    carbsG: number
    count: number
  }[]
}

export function DashboardContent({ user, totalCalories, totalProtein, totalFat, totalCarbs, trends, dailySummary }: DashboardContentProps) {
  const caloriePercent = calcCaloriePercent(totalCalories, user.dailyCalorieTarget)
  const proteinPercent = calcCaloriePercent(totalProtein, user.dailyProteinTarget)
  const fatPercent = calcCaloriePercent(totalFat, user.dailyFatTarget)
  const carbsPercent = calcCaloriePercent(totalCarbs, user.dailyCarbsTarget)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">营养看板</h1>
        <p className="text-sm text-neutral-500 mt-1">{user.username}，记录你的每一餐</p>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-neutral-600">热量</CardTitle>
            <Flame className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-neutral-900">{formatCalories(totalCalories)}</div>
            <p className="text-xs text-neutral-500 mt-1">目标 {formatCalories(user.dailyCalorieTarget)} 千卡</p>
            <NutrientProgress value={caloriePercent} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-neutral-600">蛋白质</CardTitle>
            <Beef className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-neutral-900">{formatGrams(totalProtein)}</div>
            <p className="text-xs text-neutral-500 mt-1">目标 {formatGrams(user.dailyProteinTarget)} 克</p>
            <NutrientProgress value={proteinPercent} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-neutral-600">脂肪</CardTitle>
            <Droplet className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-neutral-900">{formatGrams(totalFat)}</div>
            <p className="text-xs text-neutral-500 mt-1">目标 {formatGrams(user.dailyFatTarget)} 克</p>
            <NutrientProgress value={fatPercent} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-neutral-600">碳水</CardTitle>
            <Wheat className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-neutral-900">{formatGrams(totalCarbs)}</div>
            <p className="text-xs text-neutral-500 mt-1">目标 {formatGrams(user.dailyCarbsTarget)} 克</p>
            <NutrientProgress value={carbsPercent} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">宏量营养素分布</CardTitle>
          </CardHeader>
          <CardContent>
            <MacroDonut protein={totalProtein} fat={totalFat} carbs={totalCarbs} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">近 7 天热量趋势</CardTitle>
          </CardHeader>
          <CardContent>
            <CalorieTrendChart data={trends} target={user.dailyCalorieTarget} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Utensils className="h-4 w-4" />
            今日餐别详情
          </CardTitle>
        </CardHeader>
        <CardContent>
          <MealBreakdown summary={dailySummary} />
        </CardContent>
      </Card>
    </div>
  )
}
