import { apiError, apiSuccess } from "@/lib/api-response"
import { getCurrentUser } from "@/lib/current-user"
import { prisma } from "@/lib/prisma"
import { getTodayStr } from "@/lib/utils"
import { parsePositiveInteger, ValidationError } from "@/lib/validation"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) return apiError("请先创建个人档案", 404)

    const { searchParams } = new URL(request.url)
    const rawDays = searchParams.get("days")
    let days = 7
    if (rawDays !== null) {
      days = parsePositiveInteger(rawDays === "" ? null : Number(rawDays), "天数")
      if (days > 31) days = 31
    }

    // Window: [today - (days-1), today], using local dates (same convention as
    // getTodayStr / meal record dates) so a UTC-local mismatch cannot shift a day.
    const today = new Date()
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - (days - 1))
    const startDate = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(
      start.getDate()
    ).padStart(2, "0")}`
    const endDate = getTodayStr()

    const activities = await prisma.dailyActivity.findMany({
      where: { userId: user.userId, activityDate: { gte: startDate, lte: endDate } },
      orderBy: { activityDate: "asc" },
    })

    return apiSuccess({ days, activities })
  } catch (error) {
    if (error instanceof ValidationError) return apiError(error.message, 422)
    return apiError("读取活动量失败", 500)
  }
}