import { readFile } from "node:fs/promises"
import { NextResponse } from "next/server"
import { apiError } from "@/lib/api-response"
import { getCurrentUser } from "@/lib/current-user"
import { getOwnedArticleImage } from "@/lib/agent/content/repository"
import { getArticleImagePath } from "@/lib/agent/content/dashscope-image"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function parseArticleId(value: string) {
  const articleId = Number(value)
  if (!Number.isSafeInteger(articleId) || articleId < 1) throw new Error("文章编号无效")
  return articleId
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ articleId: string }> },
) {
  const user = await getCurrentUser()
  if (!user) return apiError("请先创建个人档案", 404)
  try {
    const article = await getOwnedArticleImage(user.userId, parseArticleId((await params).articleId))
    if (!article?.imageAssetKey || !article.imageMimeType) return apiError("图片尚未准备好", 404)
    const file = await readFile(getArticleImagePath(article.imageAssetKey))
    return new NextResponse(file, {
      headers: {
        "Content-Type": article.imageMimeType,
        "Cache-Control": "private, max-age=86400",
        "X-Content-Type-Options": "nosniff",
      },
    })
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return apiError("图片文件不存在", 404)
    return apiError(error instanceof Error ? error.message : "读取图片失败", 422)
  }
}
