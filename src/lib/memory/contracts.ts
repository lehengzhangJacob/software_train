export const MEMORY_CATEGORIES = ["preference", "constraint", "goal", "habit", "context", "insight"] as const
export const MEMORY_STATUSES = ["active", "disabled"] as const
export const MEMORY_SOURCE_KINDS = ["user", "profile", "meal_history", "agent_inference"] as const

export type MemoryCategory = (typeof MEMORY_CATEGORIES)[number]
export type MemoryStatus = (typeof MEMORY_STATUSES)[number]
export type MemorySourceKind = (typeof MEMORY_SOURCE_KINDS)[number]
export type MemoryQueryStatus = MemoryStatus | "all"

export interface MemoryCreateInput {
  category: MemoryCategory
  content: string
  importance: number
  expiresAt: Date | null
}

export interface MemoryUpdateInput {
  memoryId: number
  category?: MemoryCategory
  content?: string
  importance?: number
  status?: MemoryStatus
  expiresAt?: Date | null
}

export class MemoryValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "MemoryValidationError"
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function requiredString(value: unknown, label: string, maxLength: number) {
  if (typeof value !== "string") throw new MemoryValidationError(`${label}格式无效`)
  const result = value.trim()
  if (!result) throw new MemoryValidationError(`请填写${label}`)
  if (result.length > maxLength) throw new MemoryValidationError(`${label}过长`)
  return result
}

function enumValue<T extends string>(value: unknown, label: string, values: readonly T[]): T {
  if (typeof value !== "string" || !values.includes(value as T)) {
    throw new MemoryValidationError(`${label}取值无效`)
  }
  return value as T
}

function numberInRange(value: unknown, label: string, min: number, max: number) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    throw new MemoryValidationError(`${label}必须在 ${min} 到 ${max} 之间`)
  }
  return value
}

function positiveInteger(value: unknown, label: string) {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new MemoryValidationError(`${label}必须是正整数`)
  }
  return value
}

function parseExpiry(value: unknown, now: Date): Date | null {
  if (value === undefined || value === null || value === "") return null
  if (typeof value !== "string") throw new MemoryValidationError("过期时间格式无效")
  const timestamp = Date.parse(value)
  if (Number.isNaN(timestamp)) throw new MemoryValidationError("过期时间格式无效")
  const parsed = new Date(timestamp)
  if (parsed <= now) throw new MemoryValidationError("过期时间必须晚于当前时间")
  return parsed
}

export function assertMemoryContent(value: unknown): string {
  const content = requiredString(value, "记忆内容", 1_000)
  const forbidden = [
    /data:image\/[a-z0-9.+-]+;base64,/i,
    /\b(?:api[_ -]?key|access[_ -]?token|secret)\s*[:=]\s*\S+/i,
    /\bbearer\s+[a-z0-9._-]{10,}/i,
    /\b(?:sk|rk|pk)-[a-z0-9_-]{16,}/i,
  ]
  if (forbidden.some((pattern) => pattern.test(content))) {
    throw new MemoryValidationError("记忆内容不能包含凭据或图片原文")
  }
  return content
}

export function parseMemoryCreateInput(value: unknown, now = new Date()): MemoryCreateInput {
  if (!isRecord(value)) throw new MemoryValidationError("请求内容必须是对象")
  return {
    category: enumValue(value.category, "记忆分类", MEMORY_CATEGORIES),
    content: assertMemoryContent(value.content),
    importance: value.importance === undefined ? 0.6 : numberInRange(value.importance, "重要度", 0, 1),
    expiresAt: parseExpiry(value.expiresAt, now),
  }
}

export function parseMemoryUpdateInput(value: unknown, now = new Date()): MemoryUpdateInput {
  if (!isRecord(value)) throw new MemoryValidationError("请求内容必须是对象")
  const result: MemoryUpdateInput = {
    memoryId: positiveInteger(value.memoryId, "记忆 ID"),
  }

  if (Object.hasOwn(value, "category")) result.category = enumValue(value.category, "记忆分类", MEMORY_CATEGORIES)
  if (Object.hasOwn(value, "content")) result.content = assertMemoryContent(value.content)
  if (Object.hasOwn(value, "importance")) result.importance = numberInRange(value.importance, "重要度", 0, 1)
  if (Object.hasOwn(value, "status")) result.status = enumValue(value.status, "记忆状态", MEMORY_STATUSES)
  if (Object.hasOwn(value, "expiresAt")) result.expiresAt = parseExpiry(value.expiresAt, now)

  if (Object.keys(result).length === 1) throw new MemoryValidationError("没有可更新的记忆字段")
  return result
}

export function parseMemoryQueryStatus(value: string | null): MemoryQueryStatus {
  if (value === null || value === "all") return "all"
  return enumValue(value, "记忆状态", MEMORY_STATUSES)
}

export function isMemoryEligible(memory: { status: string; expiresAt: Date | null }, now = new Date()) {
  return memory.status === "active" && (!memory.expiresAt || memory.expiresAt > now)
}
