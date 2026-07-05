import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getTodayStr } from "@/lib/utils"

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const userId = Number(searchParams.get("userId")) || 1
  const date = searchParams.get("date") || getTodayStr()

  const user = await prisma.userProfile.findUnique({ where: { userId } })
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 })

  const meals = await prisma.mealRecord.findMany({
    where: { userId, recordDate: date },
    select: { calories: true },
  })

  const totalCalories = meals.reduce((s, m) => s + m.calories, 0)

  const existingSuggestions = await prisma.exerciseSuggestion.findMany({
    where: { userId, suggestionDate: date },
  })

  const surplus = totalCalories - user.dailyCalorieTarget

  const reference = await prisma.exerciseCalorieReference.findMany({
    where: { category: "aerobic" },
    orderBy: { CaloriesPer30min: "asc" },
  })

  const suggestions = reference.map((ex) => {
    const weightFactor = user.weightKg / 60
    const calPer30min = Math.round(ex.CaloriesPer30min * weightFactor)
    const suggestedMinutes = surplus > 0 ? Math.ceil((surplus / calPer30min) * 30) : 30
    return {
      exerciseName: ex.exerciseName,
      caloriesPer30min: calPer30min,
      category: ex.category,
      suggestedMinutes: Math.max(15, Math.min(suggestedMinutes, 90)),
      description: ex.description,
    }
  })

  const topSuggestions = suggestions
    .filter((s) => surplus > 0 ? s.caloriesPer30min > 0 : true)
    .sort((a, b) => surplus > 0
      ? Math.abs(a.caloriesPer30min - surplus / 0.5) - Math.abs(b.caloriesPer30min - surplus / 0.5)
      : a.caloriesPer30min - b.caloriesPer30min
    )
    .slice(0, 5)

  return NextResponse.json({
    data: {
      date,
      totalCalories,
      dailyTarget: user.dailyCalorieTarget,
      surplus: Math.round(surplus),
      suggestions: topSuggestions,
      existing: existingSuggestions,
    },
  })
}
