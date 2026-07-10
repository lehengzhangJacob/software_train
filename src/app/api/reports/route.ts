import { NextRequest } from "next/server"
import { apiError, apiSuccess } from "@/lib/api-response"
import { getCurrentUser } from "@/lib/current-user"
import { prisma } from "@/lib/prisma"
import { parseReportPeriod, ValidationError } from "@/lib/validation"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const period = parseReportPeriod(searchParams.get("period") ?? "weekly")
    const user = await getCurrentUser()
    if (!user) return apiError("请先创建个人档案", 404)

    const days = period === "monthly" ? 30 : 7
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)
    const start = startDate.toISOString().slice(0, 10)

    const records = await prisma.mealRecord.findMany({
      where: {
        userId: user.userId,
        recordDate: { gte: start },
      },
      select: { recordDate: true, calories: true, proteinG: true, fatG: true, carbsG: true },
      orderBy: { recordDate: "asc" },
    })

    const dailyMap = new Map<string, { calories: number; protein: number; fat: number; carbs: number; count: number }>()
    for (const record of records) {
      const existing = dailyMap.get(record.recordDate) ?? { calories: 0, protein: 0, fat: 0, carbs: 0, count: 0 }
      existing.calories += record.calories
      existing.protein += record.proteinG
      existing.fat += record.fatG
      existing.carbs += record.carbsG
      existing.count++
      dailyMap.set(record.recordDate, existing)
    }

    const dailyData = Array.from(dailyMap.entries()).map(([date, data]) => ({
      date,
      ...data,
      target: user.dailyCalorieTarget,
      diff: data.calories - user.dailyCalorieTarget,
    }))

    const daysRecorded = dailyData.length
    const avgCalories = daysRecorded > 0 ? Math.round(dailyData.reduce((sum, day) => sum + day.calories, 0) / daysRecorded) : 0
    const avgProtein = daysRecorded > 0 ? Math.round((dailyData.reduce((sum, day) => sum + day.protein, 0) / daysRecorded) * 10) / 10 : 0
    const avgFat = daysRecorded > 0 ? Math.round((dailyData.reduce((sum, day) => sum + day.fat, 0) / daysRecorded) * 10) / 10 : 0
    const avgCarbs = daysRecorded > 0 ? Math.round((dailyData.reduce((sum, day) => sum + day.carbs, 0) / daysRecorded) * 10) / 10 : 0
    const onTargetDays = dailyData.filter((day) => day.calories <= user.dailyCalorieTarget).length
    const complianceRate = daysRecorded > 0 ? Math.round((onTargetDays / daysRecorded) * 100) : 0

    return apiSuccess({
      period,
      days,
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
    })
  } catch (error) {
    if (error instanceof ValidationError) return apiError(error.message, 422)
    return apiError("读取营养报告失败", 500)
  }
}
