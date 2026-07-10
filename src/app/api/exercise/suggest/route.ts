import { NextRequest } from "next/server"
import { apiError, apiSuccess } from "@/lib/api-response"
import { getCurrentUser } from "@/lib/current-user"
import { prisma } from "@/lib/prisma"
import { getTodayStr } from "@/lib/utils"
import { parseDate, ValidationError } from "@/lib/validation"

export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const date = parseDate(searchParams.get("date") ?? getTodayStr(), "查询日期")
    const user = await getCurrentUser()
    if (!user) return apiError("请先创建个人档案", 404)

    const meals = await prisma.mealRecord.findMany({
      where: { userId: user.userId, recordDate: date },
      select: { calories: true },
    })
    const totalCalories = meals.reduce((sum, meal) => sum + meal.calories, 0)
    const existingSuggestions = await prisma.exerciseSuggestion.findMany({
      where: { userId: user.userId, suggestionDate: date },
    })
    const surplus = totalCalories - user.dailyCalorieTarget
    const reference = await prisma.exerciseCalorieReference.findMany({
      where: { category: "aerobic" },
      orderBy: { CaloriesPer30min: "asc" },
    })

    const suggestions = reference.map((exercise) => {
      const weightFactor = user.weightKg / 60
      const caloriesPer30min = Math.round(exercise.CaloriesPer30min * weightFactor)
      const suggestedMinutes = surplus > 0 ? Math.ceil((surplus / caloriesPer30min) * 30) : 30
      return {
        exerciseId: exercise.exerciseId,
        exerciseName: exercise.exerciseName,
        caloriesPer30min,
        category: exercise.category,
        suggestedMinutes: Math.max(15, Math.min(suggestedMinutes, 90)),
        description: exercise.description,
      }
    })

    const topSuggestions = suggestions
      .filter((suggestion) => surplus > 0 ? suggestion.caloriesPer30min > 0 : true)
      .sort((left, right) => surplus > 0
        ? Math.abs(left.caloriesPer30min - surplus / 0.5) - Math.abs(right.caloriesPer30min - surplus / 0.5)
        : left.caloriesPer30min - right.caloriesPer30min
      )
      .slice(0, 5)

    return apiSuccess({
      date,
      totalCalories,
      dailyTarget: user.dailyCalorieTarget,
      surplus: Math.round(surplus),
      suggestions: topSuggestions,
      existing: existingSuggestions,
    })
  } catch (error) {
    if (error instanceof ValidationError) return apiError(error.message, 422)
    return apiError("读取运动建议失败", 500)
  }
}
