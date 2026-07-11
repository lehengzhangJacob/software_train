import { NextRequest } from "next/server"
import { apiError, apiSuccess } from "@/lib/api-response"
import { getCurrentUser } from "@/lib/current-user"
import { prisma } from "@/lib/prisma"
import { getTodayStr } from "@/lib/utils"
import {
  parseDate,
  parseExerciseAdoptionInput,
  parseExerciseSuggestionStatusInput,
  ValidationError,
} from "@/lib/validation"

export const dynamic = "force-dynamic"

const MIN_SUGGESTED_MINUTES = 15
const MAX_SUGGESTED_MINUTES = 90

class NotFoundError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "NotFoundError"
  }
}

function requestFailure(error: unknown, fallback: string) {
  if (error instanceof ValidationError) return apiError(error.message, 422)
  if (error instanceof SyntaxError) return apiError("请求 JSON 格式无效", 400)
  if (error instanceof NotFoundError) return apiError(error.message, 404)
  return apiError(fallback, 500)
}

function roundToOneDecimal(value: number) {
  return Math.round(value * 10) / 10
}

function caloriesForDuration(caloriesPer30min: number, durationMinutes: number) {
  return roundToOneDecimal((caloriesPer30min * durationMinutes) / 30)
}

function caloriesPer30Minutes(referenceCalories: number, weightKg: number) {
  return Math.round(referenceCalories * (weightKg / 60))
}

function intensityForCategory(category: string | null) {
  if (category === "flexibility") return "low"
  if (category === "aerobic" || category === "strength") return "moderate"
  return "low"
}

function suggestedDuration(caloriesPer30min: number, surplus: number) {
  const minutes = surplus > 0 ? Math.ceil((surplus / caloriesPer30min) * 30) : 30
  return Math.max(MIN_SUGGESTED_MINUTES, Math.min(minutes, MAX_SUGGESTED_MINUTES))
}

async function dailyCalorieTotal(userId: number, date: string) {
  const totals = await prisma.mealRecord.aggregate({
    where: { userId, recordDate: date },
    _sum: { calories: true },
  })
  return totals._sum.calories ?? 0
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const date = parseDate(searchParams.get("date") ?? getTodayStr(), "查询日期")
    const user = await getCurrentUser()
    if (!user) return apiError("请先创建个人档案", 404)

    const [totalCalories, references, adopted] = await Promise.all([
      dailyCalorieTotal(user.userId, date),
      prisma.exerciseCalorieReference.findMany({
        where: { category: "aerobic" },
        orderBy: { CaloriesPer30min: "asc" },
      }),
      prisma.exerciseSuggestion.findMany({
        where: { userId: user.userId, suggestionDate: date, isAdopted: 1 },
        orderBy: { createdAt: "asc" },
      }),
    ])
    const surplus = totalCalories - user.dailyCalorieTarget

    const candidates = references
      .map((reference) => {
        const caloriesPer30min = caloriesPer30Minutes(reference.CaloriesPer30min, user.weightKg)
        const durationMinutes = suggestedDuration(caloriesPer30min, surplus)
        return {
          exerciseId: reference.exerciseId,
          exerciseName: reference.exerciseName,
          category: reference.category,
          description: reference.description,
          caloriesPer30min,
          suggestedMinutes: durationMinutes,
          calorieBurnEstimate: caloriesForDuration(caloriesPer30min, durationMinutes),
        }
      })
      .filter((candidate) => surplus > 0 ? candidate.caloriesPer30min > 0 : true)
      .sort((left, right) => surplus > 0
        ? Math.abs(left.calorieBurnEstimate - surplus) - Math.abs(right.calorieBurnEstimate - surplus)
        : left.caloriesPer30min - right.caloriesPer30min
      )
      .slice(0, 5)

    return apiSuccess({
      date,
      totalCalories,
      dailyTarget: user.dailyCalorieTarget,
      surplus: roundToOneDecimal(surplus),
      candidates,
      adopted,
    })
  } catch (error) {
    return requestFailure(error, "读取运动建议失败")
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) return apiError("请先创建个人档案", 404)

    const input = parseExerciseAdoptionInput(await request.json())
    const adopted = await prisma.$transaction(async (tx) => {
      const reference = await tx.exerciseCalorieReference.findUnique({
        where: { exerciseId: input.exerciseId },
      })
      if (!reference) throw new NotFoundError("运动参考不存在")

      const mealTotals = await tx.mealRecord.aggregate({
        where: { userId: user.userId, recordDate: input.date },
        _sum: { calories: true },
      })
      const calorieSurplus = (mealTotals._sum.calories ?? 0) - user.dailyCalorieTarget
      const caloriesPer30min = caloriesPer30Minutes(reference.CaloriesPer30min, user.weightKg)
      const data = {
        calorieSurplus: roundToOneDecimal(calorieSurplus),
        exerciseType: reference.exerciseName,
        durationMinutes: input.durationMinutes,
        calorieBurnEstimate: caloriesForDuration(caloriesPer30min, input.durationMinutes),
        intensity: intensityForCategory(reference.category),
        suggestionDetail: reference.description,
        isAdopted: 1,
      }

      const existing = await tx.exerciseSuggestion.findFirst({
        where: {
          userId: user.userId,
          suggestionDate: input.date,
          exerciseType: reference.exerciseName,
        },
        orderBy: { suggestionId: "asc" },
      })

      if (existing) {
        return tx.exerciseSuggestion.update({
          where: { suggestionId: existing.suggestionId },
          data,
        })
      }

      return tx.exerciseSuggestion.create({
        data: {
          userId: user.userId,
          suggestionDate: input.date,
          ...data,
        },
      })
    })

    return apiSuccess(adopted)
  } catch (error) {
    return requestFailure(error, "采用运动计划失败")
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) return apiError("请先创建个人档案", 404)

    const input = parseExerciseSuggestionStatusInput(await request.json())
    const owned = await prisma.exerciseSuggestion.findFirst({
      where: { suggestionId: input.suggestionId, userId: user.userId },
      select: { suggestionId: true },
    })
    if (!owned) return apiError("运动计划不存在", 404)

    const suggestion = await prisma.exerciseSuggestion.update({
      where: { suggestionId: owned.suggestionId },
      data: { isAdopted: input.isAdopted ? 1 : 0 },
    })
    return apiSuccess(suggestion)
  } catch (error) {
    return requestFailure(error, "更新运动计划失败")
  }
}
