import { randomUUID } from "node:crypto"

export type ActionClass = "read" | "draft" | "external_write"

export class ActionPolicyError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ActionPolicyError"
  }
}

export const ACTION_CONFIRMATION_TTL_MS = 10 * 60 * 1_000

interface PendingConfirmation {
  token: string
  toolName: string
  paramsFingerprint: string
  createdAt: number
  expiresAt: number
}

const pendingConfirmations = new Map<string, PendingConfirmation>()

function normalizeValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeValue)
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, normalizeValue(entry)])
    )
  }
  return value
}

function fingerprint(value: unknown) {
  const normalized = JSON.stringify(normalizeValue(value))
  if (!normalized || normalized.length > 16_384) throw new ActionPolicyError("动作参数过大")
  return normalized
}

function purgeExpired(now = Date.now()) {
  for (const [token, confirmation] of pendingConfirmations) {
    if (confirmation.expiresAt <= now) pendingConfirmations.delete(token)
  }
}

export function classifyAction(toolName: string): ActionClass {
  if (toolName === "takeout_order_submit" || toolName === "create-order") return "external_write"
  if (toolName === "takeout_order_draft" || toolName === "calculate-price") return "draft"
  return "read"
}

export interface OrderingGrant {
  claimCreateOrder(): void
}

// ADR-0004: explicit ordering intent in the current message authorizes at
// most one unpaid order per request. The intent verdict itself stays in
// agent/ordering-intent.ts so the gate has a single source of truth.
export function issueOrderingGrant(intentRecognized: boolean): OrderingGrant {
  if (!intentRecognized) throw new ActionPolicyError("缺少明确点餐意图，拒绝自动点餐授权")
  let createOrderClaimed = false
  return {
    claimCreateOrder() {
      if (createOrderClaimed) throw new ActionPolicyError("同一请求最多创建一笔未支付订单")
      createOrderClaimed = true
    },
  }
}

export function issueActionConfirmation(toolName: string, params: unknown, now = Date.now()) {
  if (classifyAction(toolName) !== "external_write") {
    throw new ActionPolicyError("只有外部写操作需要确认")
  }
  purgeExpired(now)
  const token = randomUUID()
  const confirmation: PendingConfirmation = {
    token,
    toolName,
    paramsFingerprint: fingerprint(params),
    createdAt: now,
    expiresAt: now + ACTION_CONFIRMATION_TTL_MS,
  }
  pendingConfirmations.set(token, confirmation)
  return {
    token,
    createdAt: new Date(confirmation.createdAt).toISOString(),
    expiresAt: new Date(confirmation.expiresAt).toISOString(),
  }
}

export function assertActionConfirmation(token: unknown, toolName: string, params: unknown, now = Date.now()) {
  if (typeof token !== "string" || !token.trim()) throw new ActionPolicyError("缺少动作确认令牌")
  purgeExpired(now)
  const confirmation = pendingConfirmations.get(token)
  if (!confirmation || confirmation.toolName !== toolName) throw new ActionPolicyError("动作确认令牌无效或已过期")
  if (confirmation.paramsFingerprint !== fingerprint(params)) throw new ActionPolicyError("订单参数已变化，请重新确认")
  return confirmation
}

export function consumeActionConfirmation(token: unknown, toolName: string, params: unknown, now = Date.now()) {
  const confirmation = assertActionConfirmation(token, toolName, params, now)
  pendingConfirmations.delete(confirmation.token)
  return confirmation
}

export function pendingConfirmationCount(now = Date.now()) {
  purgeExpired(now)
  return pendingConfirmations.size
}
