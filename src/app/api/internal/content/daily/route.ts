import { NextRequest } from "next/server"
import { apiError, apiSuccess } from "@/lib/api-response"
import { runDailyArticleJob } from "@/lib/agent/content/generator"
import { getContentDate } from "@/lib/agent/content/time"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function isAuthorized(request: NextRequest) {
  const configured = process.env.CONTENT_JOB_TOKEN?.trim()
  if (!configured) return false
  return request.headers.get("authorization") === `Bearer ${configured}`
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) return apiError("内容任务未授权", 401)
  try {
    const date = new URL(request.url).searchParams.get("date") || getContentDate()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return apiError("日期格式必须是 YYYY-MM-DD", 422)
    return apiSuccess(await runDailyArticleJob(date))
  } catch {
    return apiError("每日内容任务失败", 500)
  }
}
