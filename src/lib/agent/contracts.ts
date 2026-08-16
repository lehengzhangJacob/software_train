import { MEMORY_CATEGORIES, assertMemoryContent, type MemoryCategory } from "@/lib/memory/contracts"

export const AGENT_MESSAGE_ROLES = ["user", "assistant"] as const
export type AgentMessageRole = (typeof AGENT_MESSAGE_ROLES)[number]

export const MAX_AGENT_USER_MESSAGE_LENGTH = 4_000
export const MAX_AGENT_TITLE_LENGTH = 80

export interface AgentChatInput {
  threadId: number | null
  message: string
}

export interface AgentThreadCreateInput {
  title: string
}

export interface MemoryCandidate {
  category: MemoryCategory
  content: string
  importance: number
  confidence: number
}

export interface AgentMessageMetadata {
  memoryCandidates?: MemoryCandidate[]
  memoryIds?: Record<string, number>
  usedMemoryIds?: number[]
}

export interface AgentMemoryConfirmationInput {
  messageId: number
  candidateIndex: number
}

export class AgentValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "AgentValidationError"
  }
}

export class AgentNotFoundError extends Error {
  constructor(message = "对话不存在") {
    super(message)
    this.name = "AgentNotFoundError"
  }
}

export class AgentMemoryCandidateError extends Error {
  constructor(message = "记忆候选不存在") {
    super(message)
    this.name = "AgentMemoryCandidateError"
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function requiredString(value: unknown, label: string, maxLength: number) {
  if (typeof value !== "string") throw new AgentValidationError(`${label}格式无效`)
  const result = value.trim()
  if (!result) throw new AgentValidationError(`请填写${label}`)
  if (result.length > maxLength) throw new AgentValidationError(`${label}过长`)
  return result
}

function positiveInteger(value: unknown, label: string) {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new AgentValidationError(`${label}必须是正整数`)
  }
  return value
}

function boundedNumber(value: unknown, label: string, min: number, max: number) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    throw new AgentValidationError(`${label}必须在 ${min} 到 ${max} 之间`)
  }
  return value
}

function enumValue<T extends string>(value: unknown, label: string, values: readonly T[]): T {
  if (typeof value !== "string" || !values.includes(value as T)) {
    throw new AgentValidationError(`${label}取值无效`)
  }
  return value as T
}

function assertNoCredentialOrImage(value: string) {
  const forbidden = [
    /data:image\/[a-z0-9.+-]+;base64,/i,
    /\b(?:api[_ -]?key|access[_ -]?token|secret)\s*[:=]\s*\S+/i,
    /\bbearer\s+[a-z0-9._-]{10,}/i,
    /\b(?:sk|rk|pk)-[a-z0-9_-]{16,}/i,
  ]
  if (forbidden.some((pattern) => pattern.test(value))) {
    throw new AgentValidationError("对话内容不能包含 API Key、令牌或图片原文")
  }
}

export function parseAgentChatInput(value: unknown): AgentChatInput {
  if (!isRecord(value)) throw new AgentValidationError("请求内容必须是对象")
  const message = requiredString(value.message, "消息", MAX_AGENT_USER_MESSAGE_LENGTH)
  assertNoCredentialOrImage(message)

  let threadId: number | null = null
  if (value.threadId !== undefined && value.threadId !== null) {
    threadId = positiveInteger(value.threadId, "对话 ID")
  }

  return { threadId, message }
}

export function parseAgentThreadCreateInput(value: unknown): AgentThreadCreateInput {
  if (!isRecord(value)) throw new AgentValidationError("请求内容必须是对象")
  const rawTitle = value.title
  return {
    title: rawTitle === undefined || rawTitle === null ? "营养咨询" : requiredString(rawTitle, "对话标题", MAX_AGENT_TITLE_LENGTH),
  }
}

export function parseAgentMemoryConfirmationInput(value: unknown): AgentMemoryConfirmationInput {
  if (!isRecord(value)) throw new AgentValidationError("请求内容必须是对象")
  const candidateIndex = value.candidateIndex
  if (typeof candidateIndex !== "number" || !Number.isInteger(candidateIndex) || candidateIndex < 0 || candidateIndex > 2) {
    throw new AgentValidationError("记忆候选序号无效")
  }
  return {
    messageId: positiveInteger(value.messageId, "消息 ID"),
    candidateIndex,
  }
}

function parseCandidate(value: unknown): MemoryCandidate | null {
  if (!isRecord(value)) return null
  try {
    const content = assertMemoryContent(requiredString(value.content, "候选记忆", 300))
    return {
      category: enumValue(value.category, "记忆分类", MEMORY_CATEGORIES),
      content,
      importance: boundedNumber(value.importance ?? 0.6, "重要度", 0, 1),
      confidence: boundedNumber(value.confidence ?? 0.7, "置信度", 0, 1),
    }
  } catch {
    return null
  }
}

export function parseMemoryCandidates(value: unknown): MemoryCandidate[] {
  if (!Array.isArray(value)) return []
  return value.map(parseCandidate).filter((candidate): candidate is MemoryCandidate => candidate !== null).slice(0, 3)
}

export function extractAssistantResponse(content: string) {
  const marker = /<memory-candidates>\s*([\s\S]*?)\s*<\/memory-candidates>/i.exec(content)
  if (!marker) {
    return { visibleText: content.trim(), candidates: [] as MemoryCandidate[] }
  }

  let candidates: MemoryCandidate[] = []
  try {
    candidates = parseMemoryCandidates(JSON.parse(marker[1]))
  } catch {
    candidates = []
  }

  const visibleText = content.replace(marker[0], "").trim()
  return {
    visibleText: visibleText || "我暂时没有生成可读建议，请换个说法再试。",
    candidates,
  }
}

export function sanitizeAssistantText(value: string) {
  const text = value.trim().slice(0, 12_000)
  return text
    .replace(/data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=]+/gi, "[图片内容已省略]")
    .replace(/\b(?:api[_ -]?key|access[_ -]?token|secret)\s*[:=]\s*\S+/gi, "[凭据已省略]")
    .replace(/\bbearer\s+[a-z0-9._-]{10,}/gi, "[凭据已省略]")
}

export function parseAgentMessageMetadata(value: string | null): AgentMessageMetadata {
  if (!value) return {}
  try {
    const parsed: unknown = JSON.parse(value)
    if (!isRecord(parsed)) return {}
    const memoryIds: Record<string, number> = {}
    for (const source of [parsed.confirmedMemoryIds, parsed.memoryIds]) {
      if (!isRecord(source)) continue
      for (const [key, id] of Object.entries(source)) {
        if (typeof id === "number" && Number.isInteger(id) && id > 0) memoryIds[key] = id
      }
    }
    return {
      memoryCandidates: parseMemoryCandidates(parsed.memoryCandidates),
      memoryIds,
      usedMemoryIds: Array.isArray(parsed.usedMemoryIds)
        ? parsed.usedMemoryIds.filter((id): id is number => typeof id === "number" && Number.isInteger(id) && id > 0).slice(0, 50)
        : [],
    }
  } catch {
    return {}
  }
}
