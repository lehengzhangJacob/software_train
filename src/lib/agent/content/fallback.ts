import { DAILY_ARTICLE_COUNT, type ArticlePayload, type ArticleVisualKind } from "@/lib/agent/content/contracts"
import type { DailyArticleContext } from "@/lib/agent/content/context"

const TOPICS = [
  { topic: "蛋白质节奏", title: "把蛋白质分到每一餐", kind: "bars" as ArticleVisualKind },
  { topic: "热量安排", title: "今天的热量，留一点给晚上", kind: "donut" as ArticleVisualKind },
  { topic: "晚餐搭配", title: "晚餐用一盘饭找回平衡", kind: "steps" as ArticleVisualKind },
  { topic: "外食选择", title: "外食时先看这三个信号", kind: "bars" as ArticleVisualKind },
  { topic: "蔬菜与纤维", title: "让蔬菜成为餐盘的第一眼", kind: "donut" as ArticleVisualKind },
  { topic: "饮水习惯", title: "把喝水变成餐间的小动作", kind: "steps" as ArticleVisualKind },
  { topic: "日常活动", title: "步数之外，给身体一点连续活动", kind: "bars" as ArticleVisualKind },
  { topic: "运动恢复", title: "运动后的恢复，不只看汗量", kind: "steps" as ArticleVisualKind },
  { topic: "一周复盘", title: "从一周记录里找到一个规律", kind: "donut" as ArticleVisualKind },
  { topic: "明日行动", title: "明天只做一个更容易的选择", kind: "steps" as ArticleVisualKind },
] as const

function topFood(context: DailyArticleContext) {
  return context.meals[0]?.food || "最近记录的餐食"
}

function totalCalories(context: DailyArticleContext) {
  return Math.round(context.meals.reduce((sum, meal) => sum + meal.calories, 0))
}

function totalSteps(context: DailyArticleContext) {
  return context.activities.reduce((sum, activity) => sum + activity.steps, 0)
}

function boundedValue(value: number, minimum: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback
  return Math.min(100_000, Math.max(minimum, Math.round(value)))
}

function visual(kind: ArticleVisualKind, index: number, context: DailyArticleContext) {
  const calories = totalCalories(context)
  const target = context.profile?.dailyTargets.calories ?? 2_000
  const steps = totalSteps(context)
  const values = kind === "bars"
    ? [
        boundedValue((context.meals[0]?.proteinG ?? 0) * 2, 10, 10),
        boundedValue((context.meals[1]?.proteinG ?? 0) * 2, 12, 12),
        boundedValue((context.meals[2]?.proteinG ?? 0) * 2, 14, 14),
      ]
    : kind === "donut"
      ? [Math.min(100, Math.round((calories / Math.max(target, 1)) * 100)), Math.min(100, Math.round((steps / 8_000) * 100)), Math.max(8, 100 - index * 5)]
      : [5 + (index % 4), 10 + (index % 5), 15 + (index % 6)]
  const labels = kind === "bars" ? ["早餐", "午餐", "晚餐"] : kind === "donut" ? ["热量", "活动", "余量"] : ["看见", "安排", "坚持"]
  return {
    kind,
    title: kind === "bars" ? "每餐的分配" : kind === "donut" ? "今天的节奏" : "三个小步骤",
    caption: kind === "bars" ? "把关注点放在整天的分配，而不是某一餐的得失。" : kind === "donut" ? "记录是观察自己的工具，不是给自己打分。" : "让下一步足够小，才更容易重复。",
    labels,
    values,
  }
}

export function buildFallbackArticles(context: DailyArticleContext): ArticlePayload[] {
  const name = context.profile?.username || "你"
  const food = topFood(context)
  const articles = TOPICS.map((topic, index) => ({
    topic: topic.topic,
    title: topic.title,
    summary: `${name}，从${food}和最近的记录出发，今天给你一个轻量、可执行的调整方向。`,
    content: {
      intro: `这是一篇根据你现有记录整理的日更小文章。它不要求一次做到完美，只帮你看见一个可以继续的方向。`,
      sections: [
        {
          heading: "先看见现在",
          paragraphs: [`你最近留下了 ${context.meals.length} 条餐食记录和 ${context.activities.length} 条活动记录。把这些记录当作线索，就能比凭感觉更稳地安排下一餐。`],
        },
        {
          heading: "今天这样试",
          paragraphs: [`下一餐先保留熟悉的主食，再补一份蛋白质和一份颜色明显的蔬菜；如果已经吃过${food}，可以用不同的烹调方式换换节奏。`],
        },
      ],
      takeaways: ["一次只调整一个变量", "用下一餐验证，而不是回头责备自己"],
      action: index % 2 === 0 ? "下一餐开始前，先花十秒看一眼餐盘里有没有蛋白质和蔬菜。" : "今天找一个能连续完成五分钟的活动，把它放进日程而不是等有空。",
      safetyNote: "如果出现疼痛、头晕、持续不适或有既往疾病，请停止尝试并咨询专业人士。",
    },
    visual: visual(topic.kind, index, context),
    imageAlt: `${topic.topic}的营养节奏示意图`,
  }))
  return articles.slice(0, DAILY_ARTICLE_COUNT)
}
