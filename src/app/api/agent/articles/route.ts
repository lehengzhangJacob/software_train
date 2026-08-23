import { NextRequest } from "next/server"
import { apiError, apiSuccess } from "@/lib/api-response"
import { getCurrentUser } from "@/lib/current-user"
import { getDailyArticleFeed } from "@/lib/agent/content/repository"
import { queueDailyArticleBatch } from "@/lib/agent/content/generator"
import { scheduleDailyArticleJob } from "@/lib/agent/content/background"
import { getContentDate } from "@/lib/agent/content/time"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function parseDate(value: string | null) {
  if (!value) return getContentDate()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("日期格式必须是 YYYY-MM-DD")
  return value
}

export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return apiError("请先创建个人档案", 404)
  try {
    const date = parseDate(new URL(request.url).searchParams.get("date"))
    return apiSuccess(await getDailyArticleFeed(user.userId, date))
  } catch (error) {
    return apiError(error instanceof Error ? error.message : "读取每日文章失败", 422)
  }
}

export async function POST() {
  const user = await getCurrentUser()
  if (!user) return apiError("请先创建个人档案", 404)
  try {
    const date = getContentDate()
    const feed = await queueDailyArticleBatch(user.userId, date)
    scheduleDailyArticleJob(date)
    return apiSuccess(feed, 202)
  } catch {
    return apiError("提交每日文章后台任务失败", 500)
  }
}
