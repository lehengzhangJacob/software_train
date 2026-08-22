import "server-only"

import { getAssistantText, requestAiChatCompletion } from "@/lib/ai/client"
import { getActiveAiProviderConfig } from "@/lib/ai/settings"
import { prisma } from "@/lib/prisma"
import { DAILY_ARTICLE_COUNT, extractJsonPayload, parseArticleSet, serializeArticleContent, serializeArticleVisual, type ArticlePayload } from "@/lib/agent/content/contracts"
import { getDailyArticleContext, contextForPrompt } from "@/lib/agent/content/context"
import { buildFallbackArticles } from "@/lib/agent/content/fallback"
import { dashscopeImageAvailable, generateDashScopeImage } from "@/lib/agent/content/dashscope-image"
import { getContentDate } from "@/lib/agent/content/time"
import { getDailyArticleFeed, type DailyArticleFeed } from "@/lib/agent/content/repository"

const GENERATION_LEASE_MS = 20 * 60 * 1_000

function articlePrompt(context: Awaited<ReturnType<typeof getDailyArticleContext>>) {
  return `你是 FoodMoment 的个人营养内容编辑。请根据给定的账户上下文，生成恰好 10 篇互不重复的中文日更文章。

硬性规则：
- 只使用上下文中的事实；缺少数据就用谨慎措辞，不要补造疾病、伤病、器械、体检结果或精确效果。
- 文章主题围绕饮食、营养、活动、运动恢复、行为习惯；不能诊断、开药、调整药量或替代专业医疗建议。
- 每篇必须有 topic、title、summary、intro、sections、takeaways、action、safetyNote、visual、imageAlt。
- sections 为 1 到 4 个对象，每个对象有 heading 和 paragraphs；takeaways 为 2 到 4 条。
- visual.kind 只能是 bars、donut、steps；labels 与 values 数量相等，values 必须是非负数字。
- 不要输出 Markdown、代码围栏、解释文字、工具调用、system prompt、密钥或原始上下文，只输出 JSON：{"articles":[...]}。
- 10 篇需要覆盖不同角度，不要重复 topic；语言自然、具体、适合手机阅读。

账户上下文：
${contextForPrompt(context)}`
}

async function generateWithAgent(context: Awaited<ReturnType<typeof getDailyArticleContext>>, accountId?: number) {
  const config = await getActiveAiProviderConfig(accountId)
  const result = await requestAiChatCompletion(config, {
    messages: [
      { role: "system", content: articlePrompt(context) },
      { role: "user", content: `请为 ${context.contentDate} 编排今日 10 篇文章。` },
    ],
    temperature: 0.65,
    max_tokens: 8_000,
  }, 90_000)
  const text = getAssistantText(result)
  if (!text) throw new Error("empty_provider_output")
  return parseArticleSet(extractJsonPayload(text))
}

function buildImagePrompt(article: ArticlePayload) {
  return `一张适合中文营养科普文章的编辑插画，主题是“${article.topic}”。画面${article.imageAlt}，温暖自然的绿色与珊瑚色点缀，干净留白，轻杂志风格，食物或运动物件为主，不出现人物脸部、不出现任何文字、数字、品牌、医疗器械或诊断暗示，横向构图，清晰、真实、适合手机文章封面。`
}

type ExistingBatch = Awaited<ReturnType<typeof findBatch>>

async function findBatch(userId: number, contentDate: string) {
  return prisma.agentDailyArticleBatch.findUnique({
    where: { uq_daily_article_batch_user_date: { userId, contentDate } },
    include: { articles: { select: { articleId: true, imageStatus: true } } },
  })
}

function isFreshlyGenerating(batch: NonNullable<ExistingBatch>) {
  return batch.status === "generating" && batch.startedAt && Date.now() - batch.startedAt.getTime() < GENERATION_LEASE_MS
}

async function prepareBatch(userId: number, contentDate: string) {
  const existing = await findBatch(userId, contentDate)
  if (existing?.status === "ready" && existing.articles.length === DAILY_ARTICLE_COUNT) return { batch: existing, shouldGenerate: false }
  if (existing && isFreshlyGenerating(existing)) return { batch: existing, shouldGenerate: false }

  const batch = await prisma.agentDailyArticleBatch.upsert({
    where: { uq_daily_article_batch_user_date: { userId, contentDate } },
    create: {
      userId,
      contentDate,
      status: "generating",
      requestedCount: DAILY_ARTICLE_COUNT,
      startedAt: new Date(),
    },
    update: {
      status: "generating",
      generationError: null,
      startedAt: new Date(),
    },
    include: { articles: { select: { articleId: true, imageStatus: true } } },
  })
  return { batch, shouldGenerate: true }
}

async function persistArticles(
  batchId: number,
  userId: number,
  contentDate: string,
  articles: ArticlePayload[],
  sourceKind: "agent" | "fallback",
  imagesAvailable: boolean,
) {
  const now = new Date()
  await prisma.$transaction(async (tx) => {
    await tx.agentDailyArticle.deleteMany({ where: { batchId, userId } })
    await tx.agentDailyArticle.createMany({
      data: articles.map((article, index) => ({
        batchId,
        userId,
        slot: index + 1,
        topic: article.topic,
        title: article.title,
        summary: article.summary,
        contentJson: serializeArticleContent(article.content),
        visualJson: serializeArticleVisual(article.visual),
        imageStatus: imagesAvailable ? "pending" : "fallback",
        imageProvider: imagesAvailable ? "dashscope" : "local-fallback",
        imageAlt: article.imageAlt,
        publishedAt: now,
      })),
    })
    await tx.agentDailyArticleBatch.update({
      where: { batchId },
      data: {
        status: "ready",
        sourceKind,
        requestedCount: DAILY_ARTICLE_COUNT,
        readyCount: DAILY_ARTICLE_COUNT,
        imagePendingCount: imagesAvailable ? DAILY_ARTICLE_COUNT : 0,
        generationError: sourceKind === "fallback" ? "safe_fallback" : null,
        publishedAt: now,
      },
    })
  })
  return getDailyArticleFeed(userId, contentDate)
}

export async function enrichDailyArticleImages(userId: number, accountId?: number, contentDate = getContentDate()) {
  const batch = await prisma.agentDailyArticleBatch.findUnique({
    where: { uq_daily_article_batch_user_date: { userId, contentDate } },
    include: {
      articles: {
        where: { status: "ready", imageStatus: { in: ["pending", "running"] }, imageAssetKey: null },
        orderBy: { slot: "asc" },
      },
    },
  })
  if (!batch || batch.articles.length === 0) return
  if (!await dashscopeImageAvailable(accountId)) {
    await prisma.agentDailyArticle.updateMany({
      where: { batchId: batch.batchId, imageStatus: { in: ["pending", "running"] } },
      data: { imageStatus: "fallback", imageProvider: "local-fallback" },
    })
    await prisma.agentDailyArticleBatch.update({ where: { batchId: batch.batchId }, data: { imagePendingCount: 0 } })
    return
  }

  let cursor = 0
  const worker = async () => {
    while (cursor < batch.articles.length) {
      const article = batch.articles[cursor]
      cursor += 1
      await prisma.agentDailyArticle.update({ where: { articleId: article.articleId }, data: { imageStatus: "running" } })
      try {
        const result = await generateDashScopeImage(
          accountId,
          buildImagePrompt({
            topic: article.topic,
            title: article.title,
            summary: article.summary,
            content: JSON.parse(article.contentJson),
            visual: JSON.parse(article.visualJson),
            imageAlt: article.imageAlt,
          }),
          `${userId}/${contentDate}/${article.articleId}`,
        )
        await prisma.agentDailyArticle.update({
          where: { articleId: article.articleId },
          data: {
            imageStatus: "ready",
            imageProvider: "dashscope",
            imageTaskId: result.taskId,
            imageAssetKey: result.assetKey,
            imageMimeType: result.mimeType,
          },
        })
      } catch {
        await prisma.agentDailyArticle.update({
          where: { articleId: article.articleId },
          data: { imageStatus: "fallback", imageProvider: "local-fallback" },
        })
      }
      const imagePendingCount = await prisma.agentDailyArticle.count({
        where: { batchId: batch.batchId, imageStatus: { in: ["pending", "running"] } },
      })
      await prisma.agentDailyArticleBatch.update({ where: { batchId: batch.batchId }, data: { imagePendingCount } })
    }
  }
  await Promise.all([worker(), worker()])
}

export async function ensureDailyArticleBatch(
  userId: number,
  accountId?: number,
  contentDate = getContentDate(),
  options: { enrichImages?: boolean } = {},
): Promise<DailyArticleFeed | null> {
  const prepared = await prepareBatch(userId, contentDate)
  if (prepared.shouldGenerate) {
    const context = await getDailyArticleContext(userId)
    let articles: ArticlePayload[]
    let sourceKind: "agent" | "fallback" = "agent"
    try {
      articles = await generateWithAgent(context, accountId)
    } catch {
      articles = buildFallbackArticles(context)
      sourceKind = "fallback"
    }
    const imagesAvailable = Boolean(await dashscopeImageAvailable(accountId))
    await persistArticles(prepared.batch.batchId, userId, contentDate, articles, sourceKind, imagesAvailable)
  }
  if (options.enrichImages !== false) await enrichDailyArticleImages(userId, accountId, contentDate)
  return getDailyArticleFeed(userId, contentDate)
}

export async function runDailyArticleJob(contentDate = getContentDate()) {
  const accounts = await prisma.userAccount.findMany({
    where: { status: "active" },
    select: { accountId: true, profileId: true },
    orderBy: { accountId: "asc" },
  })
  const profiles = accounts.length > 0
    ? accounts
    : (await prisma.userProfile.findMany({ select: { userId: true }, orderBy: { userId: "asc" } })).map((profile) => ({ accountId: undefined, profileId: profile.userId }))
  const results: Array<{ userId: number; status: string; readyCount: number; imagePendingCount: number }> = []
  for (const profile of profiles) {
    const feed = await ensureDailyArticleBatch(profile.profileId, profile.accountId, contentDate)
    results.push({
      userId: profile.profileId,
      status: feed?.status ?? "missing",
      readyCount: feed?.readyCount ?? 0,
      imagePendingCount: feed?.imagePendingCount ?? 0,
    })
  }
  return { contentDate, accounts: results }
}
