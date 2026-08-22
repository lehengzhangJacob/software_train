export const DAILY_ARTICLE_COUNT = 10 as const

export const ARTICLE_VISUAL_KINDS = ["bars", "donut", "steps"] as const
export type ArticleVisualKind = (typeof ARTICLE_VISUAL_KINDS)[number]

export type ArticleSection = {
  heading: string
  paragraphs: string[]
}

export type ArticleContent = {
  intro: string
  sections: ArticleSection[]
  takeaways: string[]
  action: string
  safetyNote: string
}

export type ArticleVisual = {
  kind: ArticleVisualKind
  title: string
  caption: string
  labels: string[]
  values: number[]
}

export type ArticlePayload = {
  topic: string
  title: string
  summary: string
  content: ArticleContent
  visual: ArticleVisual
  imageAlt: string
}

export class ArticleContractError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ArticleContractError"
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function cleanText(value: unknown, label: string, maxLength: number, required = true) {
  if (typeof value !== "string") {
    if (!required && (value === null || value === undefined)) return ""
    throw new ArticleContractError(`${label} 必须是文本`)
  }
  const text = value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").replace(/\s+/g, " ").trim()
  if (required && !text) throw new ArticleContractError(`${label} 不能为空`)
  if (text.length > maxLength) throw new ArticleContractError(`${label} 超出长度限制`)
  if (/data:image\//i.test(text) || /(?:api[_ -]?key|access[_ -]?token|bearer\s+|password\s*[:=])/i.test(text)) {
    throw new ArticleContractError(`${label} 包含禁止内容`)
  }
  return text
}

function boundedStringArray(value: unknown, label: string, min: number, max: number, itemMax: number) {
  if (!Array.isArray(value) || value.length < min || value.length > max) {
    throw new ArticleContractError(`${label} 数量无效`)
  }
  return value.map((item, index) => cleanText(item, `${label}[${index}]`, itemMax))
}

function parseSections(value: unknown): ArticleSection[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 4) {
    throw new ArticleContractError("文章段落数量无效")
  }
  return value.map((item, index) => {
    if (!isRecord(item)) throw new ArticleContractError(`文章段落 ${index + 1} 无效`)
    return {
      heading: cleanText(item.heading, `文章段落 ${index + 1} 标题`, 80),
      paragraphs: boundedStringArray(item.paragraphs, `文章段落 ${index + 1} 正文`, 1, 3, 520),
    }
  })
}

function parseVisual(value: unknown): ArticleVisual {
  if (!isRecord(value)) throw new ArticleContractError("视觉描述无效")
  const kind = value.kind
  if (typeof kind !== "string" || !ARTICLE_VISUAL_KINDS.includes(kind as ArticleVisualKind)) {
    throw new ArticleContractError("视觉类型无效")
  }
  if (!Array.isArray(value.values) || value.values.length < 1 || value.values.length > 6) {
    throw new ArticleContractError("视觉数据数量无效")
  }
  const values = value.values.map((item, index) => {
    if (typeof item !== "number" || !Number.isFinite(item) || item < 0 || item > 100_000) {
      throw new ArticleContractError(`视觉数据 ${index + 1} 无效`)
    }
    return Math.round(item * 10) / 10
  })
  const labels = boundedStringArray(value.labels, "视觉标签", values.length, values.length, 60)
  return {
    kind: kind as ArticleVisualKind,
    title: cleanText(value.title, "视觉标题", 100),
    caption: cleanText(value.caption, "视觉说明", 240),
    labels,
    values,
  }
}

function parseOne(value: unknown, index: number): ArticlePayload {
  if (!isRecord(value)) throw new ArticleContractError(`第 ${index + 1} 篇文章不是对象`)
  const sections = parseSections(value.sections)
  return {
    topic: cleanText(value.topic, `第 ${index + 1} 篇主题`, 80),
    title: cleanText(value.title, `第 ${index + 1} 篇标题`, 120),
    summary: cleanText(value.summary, `第 ${index + 1} 篇摘要`, 320),
    content: {
      intro: cleanText(value.intro, `第 ${index + 1} 篇导语`, 320),
      sections,
      takeaways: boundedStringArray(value.takeaways, `第 ${index + 1} 篇要点`, 2, 4, 220),
      action: cleanText(value.action, `第 ${index + 1} 篇行动建议`, 260),
      safetyNote: cleanText(value.safetyNote, `第 ${index + 1} 篇安全提示`, 260),
    },
    visual: parseVisual(value.visual),
    imageAlt: cleanText(value.imageAlt ?? value.title, `第 ${index + 1} 篇图片说明`, 240),
  }
}

export function parseArticleSet(value: unknown): ArticlePayload[] {
  const articles = Array.isArray(value)
    ? value
    : isRecord(value) && Array.isArray(value.articles)
      ? value.articles
      : null
  if (!articles || articles.length !== DAILY_ARTICLE_COUNT) {
    throw new ArticleContractError(`文章数量必须严格为 ${DAILY_ARTICLE_COUNT} 篇`)
  }
  const parsed = articles.map(parseOne)
  const topics = new Set(parsed.map((article) => article.topic))
  if (topics.size < 8) throw new ArticleContractError("文章主题重复过多")
  return parsed
}

export function parsePersistedArticleContent(value: string): ArticleContent {
  try {
    const parsed = JSON.parse(value) as unknown
    if (!isRecord(parsed)) throw new Error("not object")
    return {
      intro: cleanText(parsed.intro, "文章导语", 320),
      sections: parseSections(parsed.sections),
      takeaways: boundedStringArray(parsed.takeaways, "文章要点", 2, 4, 220),
      action: cleanText(parsed.action, "文章行动建议", 260),
      safetyNote: cleanText(parsed.safetyNote, "文章安全提示", 260),
    }
  } catch {
    throw new ArticleContractError("文章内容已损坏")
  }
}

export function parsePersistedArticleVisual(value: string): ArticleVisual {
  try {
    return parseVisual(JSON.parse(value))
  } catch {
    throw new ArticleContractError("文章视觉已损坏")
  }
}

export function serializeArticleContent(content: ArticleContent) {
  return JSON.stringify(content)
}

export function serializeArticleVisual(visual: ArticleVisual) {
  return JSON.stringify(visual)
}

export function extractJsonPayload(text: string): unknown {
  const trimmed = text.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)?.[1]
  const candidate = (fenced ?? trimmed).trim()
  try {
    return JSON.parse(candidate)
  } catch {
    const start = Math.min(...[candidate.indexOf("{"), candidate.indexOf("[")].filter((index) => index >= 0))
    const end = Math.max(candidate.lastIndexOf("}"), candidate.lastIndexOf("]"))
    if (!Number.isFinite(start) || start < 0 || end <= start) throw new ArticleContractError("模型没有返回合法文章 JSON")
    try {
      return JSON.parse(candidate.slice(start, end + 1))
    } catch {
      throw new ArticleContractError("模型文章 JSON 无法解析")
    }
  }
}
