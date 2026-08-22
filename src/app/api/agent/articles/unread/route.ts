import { apiError, apiSuccess } from "@/lib/api-response"
import { getCurrentUser } from "@/lib/current-user"
import { getUnreadArticleCount } from "@/lib/agent/content/repository"

export const dynamic = "force-dynamic"

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return apiError("请先创建个人档案", 404)
  return apiSuccess({ unreadCount: await getUnreadArticleCount(user.userId) })
}
