import { NextResponse } from "next/server"
import { apiError, apiSuccess } from "@/lib/api-response"
import { getCurrentUser } from "@/lib/current-user"
import { prisma } from "@/lib/prisma"
import { getTodayStr } from "@/lib/utils"
import { parseActivitySyncInput, ValidationError } from "@/lib/validation"

export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) return apiError("请先创建个人档案", 404)

    const input = parseActivitySyncInput(await request.json(), { activityDate: getTodayStr() })
    const record = await prisma.dailyActivity.upsert({
      where: { uq_activity_user_date: { userId: user.userId, activityDate: input.activityDate } },
      create: {
        userId: user.userId,
        activityDate: input.activityDate,
        steps: input.steps ?? 0,
        activeCalories: input.activeCalories ?? 0,
        exerciseMinutes: input.exerciseMinutes ?? 0,
        sourceKind: input.sourceKind ?? "manual",
      },
      update: {
        ...(input.steps !== undefined ? { steps: input.steps } : {}),
        ...(input.activeCalories !== undefined ? { activeCalories: input.activeCalories } : {}),
        ...(input.exerciseMinutes !== undefined ? { exerciseMinutes: input.exerciseMinutes } : {}),
        ...(input.sourceKind !== undefined ? { sourceKind: input.sourceKind } : {}),
      },
    })

    return apiSuccess({ activity: record }, 200)
  } catch (error) {
    if (error instanceof ValidationError) return apiError(error.message, 422)
    if (error instanceof SyntaxError) return apiError("请求 JSON 格式无效", 400)
    return apiError("同步活动量失败", 500)
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}