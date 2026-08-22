import { MEMORY_CATEGORIES, assertMemoryContent, type MemoryCategory } from "@/lib/memory/contracts"
import { parseExercisePlanPayload, type ExercisePlanPayload } from "@/lib/exercise/plan-contracts"

export const AGENT_MESSAGE_ROLES = ["user", "assistant"] as const
export type AgentMessageRole = (typeof AGENT_MESSAGE_ROLES)[number]

export const MAX_AGENT_USER_MESSAGE_LENGTH = 4_000
export const MAX_AGENT_TITLE_LENGTH = 80
export const AGENT_CHAT_MODES = ["general", "exercise-plan"] as const
export type AgentChatMode = (typeof AGENT_CHAT_MODES)[number]

export interface AgentChatInput {
  threadId: number | null
  message: string
  mode: AgentChatMode
  exercisePlanId: number | null
}

export const AGENT_ACTIVITY_KINDS = ["context", "model", "tool", "policy"] as const
export type AgentActivityKind = (typeof AGENT_ACTIVITY_KINDS)[number]

export const AGENT_ACTIVITY_STATUSES = ["running", "completed", "failed", "blocked"] as const
export type AgentActivityStatus = (typeof AGENT_ACTIVITY_STATUSES)[number]

export interface AgentActivity {
  activityId: string
  kind: AgentActivityKind
  label: string
  status: AgentActivityStatus
  toolName?: string
  startedAt: string
  finishedAt?: string
  durationMs?: number
  detail?: string
}

export type AgentActivityReporter = (activity: AgentActivity) => void | Promise<void>

export interface AgentThreadCreateInput {
  title: string
}

export interface MemoryCandidate {
  category: MemoryCategory
  content: string
  importance: number
  confidence: number
}

export interface OrderDigest {
  orderId: string | null
  itemsTotalCents: number | null
  itemCount: number
  storeName: string
}

export interface AgentMessageMetadata {
  memoryCandidates?: MemoryCandidate[]
  memoryIds?: Record<string, number>
  usedMemoryIds?: number[]
  order?: OrderDigest
  exercisePlanId?: number
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

  const mode = value.mode === undefined || value.mode === null
    ? "general"
    : enumValue(value.mode, "Agent 模式", AGENT_CHAT_MODES)
  const exercisePlanId = value.exercisePlanId === undefined || value.exercisePlanId === null
    ? null
    : positiveInteger(value.exercisePlanId, "运动计划 ID")

  return { threadId, message, mode, exercisePlanId }
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

export function parseMemoryCandidates(value: unknown, maxCandidates = 3): MemoryCandidate[] {
  if (!Array.isArray(value)) return []
  return value
    .map(parseCandidate)
    .filter((candidate): candidate is MemoryCandidate => candidate !== null)
    .slice(0, Math.max(0, Math.min(maxCandidates, 5)))
}

export function projectAssistantVisibleText(content: string) {
  const markerNames = ["<memory-candidates>", "<exercise-plan>"] as const
  const lowerContent = content.toLowerCase()
  const markerStarts = markerNames
    .map((marker) => lowerContent.indexOf(marker))
    .filter((index) => index >= 0)
  const markerStart = markerStarts.length > 0 ? Math.min(...markerStarts) : -1
  if (markerStart >= 0) return content.slice(0, markerStart)

  const partialMarkerLength = markerNames.reduce((longest, marker) => {
    for (let length = 1; length < marker.length; length += 1) {
      if (lowerContent.endsWith(marker.slice(0, length))) return Math.max(longest, length)
    }
    return longest
  }, 0)
  return partialMarkerLength > 0 ? content.slice(0, -partialMarkerLength) : content
}

export function extractAssistantResponse(content: string) {
  let candidates: MemoryCandidate[] = []
  const memoryMarker = /<memory-candidates>\s*([\s\S]*?)\s*<\/memory-candidates>/i.exec(content)
  if (memoryMarker) {
    try {
      candidates = parseMemoryCandidates(JSON.parse(memoryMarker[1]))
    } catch {
      candidates = []
    }
  }

  let exercisePlan: ExercisePlanPayload | undefined
  const exerciseMarker = /<exercise-plan>\s*([\s\S]*?)\s*<\/exercise-plan>/i.exec(content)
  if (exerciseMarker) {
    try {
      const parsed = parseExercisePlanPayload(JSON.parse(exerciseMarker[1]))
      for (const text of [
        parsed.title,
        parsed.goal,
        parsed.safetyNote,
        ...parsed.equipment,
        ...parsed.steps.flatMap((step) => [step.name, step.instructions]),
      ]) {
        assertNoCredentialOrImage(text)
      }
      exercisePlan = parsed
    } catch {
      // Invalid model output is removed from the user-facing answer and is
      // ignored for persistence; the readable answer still completes.
    }
  }

  const visibleText = content
    .replace(/<memory-candidates>\s*[\s\S]*?\s*<\/memory-candidates>/gi, "")
    .replace(/<exercise-plan>\s*[\s\S]*?\s*<\/exercise-plan>/gi, "")
    .trim()
  return {
    visibleText: visibleText || "我暂时没有生成可读建议，请换个说法再试。",
    candidates,
    ...(exercisePlan ? { exercisePlan } : {}),
  }
}

export function sanitizeAssistantText(value: string) {
  const text = value.trim().slice(0, 12_000)
  return text
    .replace(/data:image\/[a-z0-9.+-]+;base64,[a-z0-9+/=]+/gi, "[图片内容已省略]")
    .replace(/\b(?:api[_ -]?key|access[_ -]?token|secret)\s*[:=]\s*\S+/gi, "[凭据已省略]")
    .replace(/\bbearer\s+[a-z0-9._-]{10,}/gi, "[凭据已省略]")
}

function parseOrderDigest(value: unknown): OrderDigest | undefined {
  if (!value || typeof value !== "object") return undefined
  const record = value as Record<string, unknown>
  const orderId =
    typeof record.orderId === "string" && record.orderId.trim() && !/^https?:\/\//i.test(record.orderId)
      ? record.orderId.trim().slice(0, 120)
      : null
  const itemsTotalCents =
    typeof record.itemsTotalCents === "number" && Number.isFinite(record.itemsTotalCents) && record.itemsTotalCents >= 0
      ? record.itemsTotalCents
      : null
  const itemCount =
    typeof record.itemCount === "number" && Number.isInteger(record.itemCount) && record.itemCount >= 0 && record.itemCount <= 99
      ? record.itemCount
      : 0
  const storeName = typeof record.storeName === "string" ? record.storeName.trim().slice(0, 120) : ""
  const digest: OrderDigest = { orderId, itemsTotalCents, itemCount, storeName }
  return orderId || itemCount || storeName ? digest : undefined
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
    const order = parseOrderDigest(parsed.order)
    return {
      memoryCandidates: parseMemoryCandidates(parsed.memoryCandidates),
      memoryIds,
      usedMemoryIds: Array.isArray(parsed.usedMemoryIds)
        ? parsed.usedMemoryIds.filter((id): id is number => typeof id === "number" && Number.isInteger(id) && id > 0).slice(0, 50)
        : [],
      ...(order ? { order } : {}),
      ...(typeof parsed.exercisePlanId === "number" && Number.isInteger(parsed.exercisePlanId) && parsed.exercisePlanId > 0
        ? { exercisePlanId: parsed.exercisePlanId }
        : {}),
    }
  } catch {
    return {}
  }
}
