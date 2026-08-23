import { NextRequest } from "next/server"
import { apiError, apiSuccess } from "@/lib/api-response"
import { getCurrentUser } from "@/lib/current-user"
import {
  getExercisePlanProjection,
  getOwnedExercisePlan,
  setExercisePlanStepProgress,
} from "@/lib/exercise/plan-repository"
import { parseExercisePlanStepProgressInput } from "@/lib/exercise/progress"
import { parseDate } from "@/lib/validation"
import { getTodayStr } from "@/lib/utils"

export const dynamic = "force-dynamic"

function parsePlanId(value: string | null) {
  if (value === null || !/^\d+$/.test(value)) return null
  const planId = Number(value)
  return Number.isSafeInteger(planId) && planId > 0 ? planId : null
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("请先创建个人档案", 404)

  try {
    const { searchParams } = new URL(request.url)
    const planId = parsePlanId(searchParams.get("id"))
    if (searchParams.has("id") && planId === null) return apiError("运动计划 ID 无效", 422)
    if (planId !== null) {
      const plan = await getOwnedExercisePlan(user.userId, planId)
      if (!plan) return apiError("运动计划不存在", 404)
      return apiSuccess({ plan })
    }

    const date = parseDate(searchParams.get("date") ?? getTodayStr(), "计划日期")
    return apiSuccess(await getExercisePlanProjection(user.userId, date))
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "读取运动计划失败", 422)
  }
}

export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("请先创建个人档案", 404)

  try {
    const input = parseExercisePlanStepProgressInput(await request.json())
    const plan = await setExercisePlanStepProgress(user.userId, input.planId, input.stepOrder, input.completed)
    if (!plan) return apiError("运动计划不存在", 404)
    return apiSuccess({ plan })
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "更新计划完成状态失败", 422)
  }
}
