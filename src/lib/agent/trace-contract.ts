export const AGENT_TRACE_VERSION = 1 as const

export const AGENT_TRACE_EVENT_TYPES = [
  "run.started",
  "step.started",
  "step.updated",
  "step.completed",
  "tool.started",
  "tool.result",
  "model.started",
  "model.delta",
  "answer.delta",
  "run.completed",
  "run.failed",
  "run.cancelled",
] as const

export type AgentTraceEventType = (typeof AGENT_TRACE_EVENT_TYPES)[number]

export const AGENT_TRACE_STATUSES = [
  "running",
  "completed",
  "failed",
  "cancelled",
  "fallback",
] as const

export type AgentTraceStatus = (typeof AGENT_TRACE_STATUSES)[number]

export type AgentTraceEvent = {
  version: typeof AGENT_TRACE_VERSION
  traceId: string
  runId: string
  eventId: string
  parentId?: string
  sequence: number
  occurredAt: string
  eventType: AgentTraceEventType
  status: AgentTraceStatus
  label: string
  toolName?: string
  safeSummary?: string
  textDelta?: string
  durationMs?: number
  retryOf?: string
}

export type AgentTraceEventInput = Omit<AgentTraceEvent, "version" | "traceId" | "runId" | "eventId" | "sequence" | "occurredAt"> & {
  eventId?: string
  sequence?: number
  occurredAt?: string
}

const SECRET_PATTERNS = [
  /bearer\s+[a-z0-9._-]+/gi,
  /(?:sk|pk|token|secret|password|passwd|api[_ -]?key)\s*[:=]\s*[^\s,;]+/gi,
  /https?:\/\/[^\s)]+/gi,
  /(?:payment|pay[_ -]?url|checkout)[^\s,;]*/gi,
]

export function sanitizeTraceSummary(value: unknown, maxLength = 180): string | undefined {
  if (typeof value !== "string") return undefined

  const cleaned = SECRET_PATTERNS.reduce(
    (result, pattern) => result.replace(pattern, "[redacted]"),
    value.replace(/[\r\n\t]+/g, " ").trim(),
  )

  if (!cleaned) return undefined
  return cleaned.length > maxLength ? `${cleaned.slice(0, maxLength - 1).trimEnd()}…` : cleaned
}

export function sanitizeTraceText(value: unknown, maxLength = 1_200): string | undefined {
  if (typeof value !== "string") return undefined
  const cleaned = SECRET_PATTERNS.reduce(
    (result, pattern) => result.replace(pattern, "[redacted]"),
    value.replace(/[\r\n\t]+/g, " "),
  )
  const trimmed = cleaned.trim()
  if (!trimmed) return undefined
  return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength - 1).trimEnd()}…` : trimmed
}

export function isAgentTraceEvent(value: unknown): value is AgentTraceEvent {
  if (!value || typeof value !== "object") return false
  const event = value as Partial<AgentTraceEvent>
  return (
    event.version === AGENT_TRACE_VERSION &&
    typeof event.traceId === "string" &&
    typeof event.runId === "string" &&
    typeof event.eventId === "string" &&
    typeof event.sequence === "number" &&
    Number.isInteger(event.sequence) &&
    event.sequence >= 0 &&
    typeof event.occurredAt === "string" &&
    typeof event.eventType === "string" &&
    (AGENT_TRACE_EVENT_TYPES as readonly string[]).includes(event.eventType) &&
    typeof event.status === "string" &&
    (AGENT_TRACE_STATUSES as readonly string[]).includes(event.status) &&
    typeof event.label === "string" &&
    (!event.toolName || typeof event.toolName === "string") &&
    (!event.safeSummary || typeof event.safeSummary === "string") &&
    (!event.textDelta || typeof event.textDelta === "string") &&
    (!event.durationMs || (typeof event.durationMs === "number" && event.durationMs >= 0))
  )
}

export function assertTraceSequence(events: readonly AgentTraceEvent[]): void {
  let previous = -1
  for (const event of events) {
    if (!isAgentTraceEvent(event)) throw new Error("invalid Agent Trace event")
    if (event.sequence <= previous) throw new Error("Agent Trace sequence must be strictly increasing")
    previous = event.sequence
  }
}
