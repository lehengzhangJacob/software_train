import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const userId = Number(searchParams.get("userId")) || 1
  const period = searchParams.get("period") || "weekly"

  const user = await prisma.userProfile.findUnique({ where: { userId } })
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const days = period === "monthly" ? 30 : 7
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)
  const start = startDate.toISOString().slice(0, 10)

  const records = await prisma.mealRecord.findMany({
    where: {
      userId,
      recordDate: { gte: start },
    },
    select: { recordDate: true, calories: true, proteinG: true, fatG: true, carbsG: true },
    orderBy: { recordDate: "asc" },
  })

  const dailyMap = new Map<string, { calories: number; protein: number; fat: number; carbs: number; count: number }>()
  for (const r of records) {
    const existing = dailyMap.get(r.recordDate) ?? { calories: 0, protein: 0, fat: 0, carbs: 0, count: 0 }
    existing.calories += r.calories
    existing.protein += r.proteinG
    existing.fat += r.fatG
    existing.carbs += r.carbsG
    existing.count++
    dailyMap.set(r.recordDate, existing)
  }

  const dailyData = Array.from(dailyMap.entries()).map(([date, d]) => ({
    date,
    ...d,
    target: user.dailyCalorieTarget,
    diff: d.calories - user.dailyCalorieTarget,
  }))

  const daysRecorded = dailyData.length
  const avgCalories = daysRecorded > 0 ? Math.round(dailyData.reduce((s, d) => s + d.calories, 0) / daysRecorded) : 0
  const avgProtein = daysRecorded > 0 ? Math.round((dailyData.reduce((s, d) => s + d.protein, 0) / daysRecorded) * 10) / 10 : 0
  const avgFat = daysRecorded > 0 ? Math.round((dailyData.reduce((s, d) => s + d.fat, 0) / daysRecorded) * 10) / 10 : 0
  const avgCarbs = daysRecorded > 0 ? Math.round((dailyData.reduce((s, d) => s + d.carbs, 0) / daysRecorded) * 10) / 10 : 0
  const onTargetDays = dailyData.filter((d) => d.calories <= user.dailyCalorieTarget).length
  const complianceRate = daysRecorded > 0 ? Math.round((onTargetDays / daysRecorded) * 100) : 0

  return NextResponse.json({
    data: {
      period,
      days: days,
      daysRecorded,
      avgCalories,
      avgProtein,
      avgFat,
      avgCarbs,
      complianceRate,
      onTargetDays,
      totalDays: days,
      daily: dailyData,
      target: {
        calories: user.dailyCalorieTarget,
        protein: user.dailyProteinTarget,
        fat: user.dailyFatTarget,
        carbs: user.dailyCarbsTarget,
      },
    },
  })
}
