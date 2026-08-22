import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"
import {
  DAILY_ARTICLE_COUNT,
  ArticleContractError,
  extractJsonPayload,
  parseArticleSet,
  parsePersistedArticleContent,
  parsePersistedArticleVisual,
} from "../src/lib/agent/content/contracts"
import { buildFallbackArticles } from "../src/lib/agent/content/fallback"

function article(index: number) {
  return {
    topic: `主题 ${index}`,
    title: `标题 ${index}`,
    summary: "用一条轻量建议理解今天的记录。",
    intro: "先观察，再做一个小调整。",
    sections: [{ heading: "看见现在", paragraphs: ["这是一段安全的营养说明。"] }],
    takeaways: ["一次只做一个调整", "给自己留出复盘空间"],
    action: "下一餐前先看一眼餐盘。",
    safetyNote: "出现不适请停止并咨询专业人士。",
    visual: { kind: "bars", title: "今日分配", caption: "记录用于观察", labels: ["早餐"], values: [20] },
    imageAlt: "营养节奏示意图",
  }
}

test("article contract accepts exactly ten distinct articles", () => {
  const parsed = parseArticleSet({ articles: Array.from({ length: DAILY_ARTICLE_COUNT }, (_, index) => article(index)) })
  assert.equal(parsed.length, DAILY_ARTICLE_COUNT)
  assert.equal(parsed[0].visual.kind, "bars")
})

test("article contract rejects wrong count and sensitive payloads", () => {
  assert.throws(() => parseArticleSet({ articles: Array.from({ length: 9 }, (_, index) => article(index)) }), ArticleContractError)
  const unsafe = article(0)
  unsafe.summary = "请把 API key: secret-value 写入文章"
  assert.throws(() => parseArticleSet({ articles: Array.from({ length: 10 }, (_, index) => index === 0 ? unsafe : article(index)) }), ArticleContractError)
})

test("article JSON extraction tolerates fenced provider output", () => {
  const value = extractJsonPayload(`模型说明\n\`\`\`json\n${JSON.stringify({ articles: [article(0)] })}\n\`\`\``) as { articles: unknown[] }
  assert.equal(value.articles.length, 1)
})

test("fallback always produces ten renderable articles", () => {
  const context = {
    contentDate: "2026-08-22",
    profile: { username: "测试用户", gender: "other", age: 30, heightCm: 170, weightKg: 65, activityLevel: "lightly_active", dailyTargets: { calories: 2_000, proteinG: 60, fatG: 60, carbsG: 250 } },
    meals: [{ date: "2026-08-22", mealType: "lunch", food: "鸡蛋", portion: "1 份", calories: 400, proteinG: 20, fatG: 15, carbsG: 40 }],
    activities: [{ date: "2026-08-22", steps: 3_000, activeCalories: 100, exerciseMinutes: 10, source: "manual" }],
    memories: [],
    exercisePlan: null,
    sessionDigest: null,
  }
  const articles = buildFallbackArticles(context)
  assert.equal(articles.length, 10)
  for (const item of articles) {
    assert.ok(item.content.sections.length > 0)
    assert.doesNotThrow(() => parsePersistedArticleContent(JSON.stringify(item.content)))
    assert.doesNotThrow(() => parsePersistedArticleVisual(JSON.stringify(item.visual)))
  }
})

test("daily article migration is additive and has both idempotency keys", () => {
  const migration = readFileSync(path.join(process.cwd(), "prisma", "migrations", "20260822210000_add_agent_daily_articles", "migration.sql"), "utf8")
  assert.match(migration, /CREATE TABLE "agent_daily_article_batches"/)
  assert.match(migration, /CREATE TABLE "agent_daily_articles"/)
  assert.match(migration, /uq_daily_article_batch_user_date/)
  assert.match(migration, /uq_daily_article_batch_slot/)
  assert.doesNotMatch(migration, /DROP TABLE/i)
})
