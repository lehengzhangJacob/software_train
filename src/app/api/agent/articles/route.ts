import { NextRequest } from "next/server"
import { apiError, apiSuccess } from "@/lib/api-response"
import { getCurrentAccountId, getCurrentUser } from "@/lib/current-user"
import { getDailyArticleFeed } from "@/lib/agent/content/repository"
import { ensureDailyArticleBatch } from "@/lib/agent/content/generator"
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
    const feed = await ensureDailyArticleBatch(user.userId, (await getCurrentAccountId()) ?? undefined, getContentDate())
    return apiSuccess(feed)
  } catch {
    return apiError("生成每日文章失败", 500)
  }
}
