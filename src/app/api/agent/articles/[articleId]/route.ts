import { apiError, apiSuccess } from "@/lib/api-response"
import { getCurrentUser } from "@/lib/current-user"
import { updateArticleState } from "@/lib/agent/content/repository"

export const dynamic = "force-dynamic"

function parseArticleId(value: string) {
  const articleId = Number(value)
  if (!Number.isSafeInteger(articleId) || articleId < 1) throw new Error("文章编号无效")
  return articleId
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ articleId: string }> },
) {
  const user = await getCurrentUser()
  if (!user) return apiError("请先创建个人档案", 404)
  try {
    const articleId = parseArticleId((await params).articleId)
    const body = await request.json() as Record<string, unknown>
    const keys = ["read", "saved", "hidden"] as const
    const input: { read?: boolean; saved?: boolean; hidden?: boolean } = {}
    for (const key of keys) {
      if (body[key] !== undefined) {
        if (typeof body[key] !== "boolean") return apiError(`${key} 必须是布尔值`, 422)
        input[key] = body[key]
      }
    }
    if (Object.keys(input).length === 0) return apiError("没有可更新的阅读状态", 422)
    const article = await updateArticleState(user.userId, articleId, input)
    if (!article) return apiError("文章不存在", 404)
    return apiSuccess(article)
  } catch (error) {
    if (error instanceof SyntaxError) return apiError("请求 JSON 格式无效", 400)
    return apiError(error instanceof Error ? error.message : "更新文章状态失败", 422)
  }
}
