import "server-only"

import type { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { parsePersistedArticleContent, parsePersistedArticleVisual } from "@/lib/agent/content/contracts"

const articleSelect = {
  articleId: true,
  batchId: true,
  userId: true,
  slot: true,
  topic: true,
  title: true,
  summary: true,
  contentJson: true,
  visualJson: true,
  status: true,
  imageStatus: true,
  imageProvider: true,
  imageAssetKey: true,
  imageMimeType: true,
  imageAlt: true,
  publishedAt: true,
  readAt: true,
  savedAt: true,
  hiddenAt: true,
} satisfies Prisma.AgentDailyArticleSelect

type ArticleRow = Prisma.AgentDailyArticleGetPayload<{ select: typeof articleSelect }>

export type ArticleView = {
  articleId: number
  batchId: number
  slot: number
  topic: string
  title: string
  summary: string
  content: ReturnType<typeof parsePersistedArticleContent>
  visual: ReturnType<typeof parsePersistedArticleVisual>
  status: string
  imageStatus: string
  imageProvider: string | null
  imageUrl: string | null
  imageMimeType: string | null
  imageAlt: string
  publishedAt: string
  readAt: string | null
  savedAt: string | null
  hiddenAt: string | null
}

export type DailyArticleFeed = {
  date: string
  batchId: number
  status: string
  sourceKind: string
  readyCount: number
  imagePendingCount: number
  totalCount: number
  unreadCount: number
  articles: ArticleView[]
}

function toArticleView(article: ArticleRow): ArticleView {
  return {
    articleId: article.articleId,
    batchId: article.batchId,
    slot: article.slot,
    topic: article.topic,
    title: article.title,
    summary: article.summary,
    content: parsePersistedArticleContent(article.contentJson),
    visual: parsePersistedArticleVisual(article.visualJson),
    status: article.status,
    imageStatus: article.imageStatus,
    imageProvider: article.imageProvider,
    imageUrl: article.imageAssetKey ? `/api/agent/articles/${article.articleId}/image` : null,
    imageMimeType: article.imageMimeType,
    imageAlt: article.imageAlt,
    publishedAt: article.publishedAt.toISOString(),
    readAt: article.readAt?.toISOString() ?? null,
    savedAt: article.savedAt?.toISOString() ?? null,
    hiddenAt: article.hiddenAt?.toISOString() ?? null,
  }
}

export async function getDailyArticleFeed(userId: number, contentDate: string): Promise<DailyArticleFeed | null> {
  const batch = await prisma.agentDailyArticleBatch.findUnique({
    where: { uq_daily_article_batch_user_date: { userId, contentDate } },
    include: {
      articles: {
        where: { status: "ready", hiddenAt: null },
        select: articleSelect,
        orderBy: { slot: "asc" },
      },
    },
  })
  if (!batch) return null
  const unreadCount = await prisma.agentDailyArticle.count({
    where: { batchId: batch.batchId, status: "ready", hiddenAt: null, readAt: null },
  })
  return {
    date: batch.contentDate,
    batchId: batch.batchId,
    status: batch.status,
    sourceKind: batch.sourceKind,
    readyCount: batch.readyCount,
    imagePendingCount: batch.imagePendingCount,
    totalCount: batch.articles.length,
    unreadCount,
    articles: batch.articles.map(toArticleView),
  }
}

export async function getDailyArticleSummary(userId: number, contentDate: string) {
  const batch = await prisma.agentDailyArticleBatch.findUnique({
    where: { uq_daily_article_batch_user_date: { userId, contentDate } },
    select: { batchId: true, status: true, readyCount: true, imagePendingCount: true },
  })
  if (!batch) return { batchId: null, status: "missing", readyCount: 0, unreadCount: 0, imagePendingCount: 0 }
  const unreadCount = await prisma.agentDailyArticle.count({
    where: { batchId: batch.batchId, status: "ready", hiddenAt: null, readAt: null },
  })
  return { ...batch, unreadCount }
}

export async function getUnreadArticleCount(userId: number) {
  return prisma.agentDailyArticle.count({
    where: {
      userId,
      status: "ready",
      hiddenAt: null,
      readAt: null,
      batch: { status: "ready" },
    },
  })
}

export async function getOwnedArticle(userId: number, articleId: number) {
  return prisma.agentDailyArticle.findFirst({
    where: { articleId, userId },
    select: articleSelect,
  })
}

export type ArticleStateInput = {
  read?: boolean
  saved?: boolean
  hidden?: boolean
}

export async function updateArticleState(userId: number, articleId: number, input: ArticleStateInput) {
  const owned = await prisma.agentDailyArticle.findFirst({
    where: { articleId, userId },
    select: { articleId: true },
  })
  if (!owned) return null
  const now = new Date()
  const article = await prisma.agentDailyArticle.update({
    where: { articleId: owned.articleId },
    data: {
      ...(input.read === undefined ? {} : { readAt: input.read ? now : null }),
      ...(input.saved === undefined ? {} : { savedAt: input.saved ? now : null }),
      ...(input.hidden === undefined ? {} : { hiddenAt: input.hidden ? now : null }),
    },
    select: articleSelect,
  })
  return toArticleView(article)
}

export async function getOwnedArticleImage(userId: number, articleId: number) {
  return prisma.agentDailyArticle.findFirst({
    where: { articleId, userId, status: "ready", imageAssetKey: { not: null } },
    select: { imageAssetKey: true, imageMimeType: true },
  })
}
