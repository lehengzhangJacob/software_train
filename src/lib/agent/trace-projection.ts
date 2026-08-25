import type { AgentTraceEvent, AgentTraceEventType, AgentTraceStatus } from "@/lib/agent/trace-contract"

export type AgentTraceProjectionNode = AgentTraceEvent & {
  firstSequence: number
  lastSequence: number
  firstOccurredAt: string
  lastOccurredAt: string
  eventIds: string[]
  sourceEventTypes: AgentTraceEventType[]
  deltaCount?: number
}

export interface AgentTraceProjection {
  traceId?: string
  runId?: string
  status: AgentTraceStatus | "idle"
  terminalEvent?: AgentTraceEvent
  terminalSequence?: number
  events: AgentTraceProjectionNode[]
}

const TERMINAL_EVENT_TYPES = new Set<AgentTraceEventType>([
  "run.completed",
  "run.failed",
  "run.cancelled",
])

const DELTA_EVENT_TYPES = new Set<AgentTraceEventType>([
  "model.delta",
  "answer.delta",
])

type EventBucket = {
  key: string
  events: AgentTraceEvent[]
  start?: AgentTraceEvent
}

function orderedEvents(events: readonly AgentTraceEvent[]) {
  return [...events].sort((left, right) => left.sequence - right.sequence)
}

function bucketKey(event: AgentTraceEvent) {
  if (event.eventType === "run.started" || event.eventType === "run.completed" || event.eventType === "run.failed" || event.eventType === "run.cancelled") {
    return `run:${event.runId}`
  }
  if (DELTA_EVENT_TYPES.has(event.eventType)) {
    return `delta:${event.eventType}:${event.parentId ?? "root"}`
  }
  if (event.eventType === "step.completed" || event.eventType === "tool.result") {
    return event.parentId ? `span:${event.parentId}` : `event:${event.eventId}`
  }
  if (event.eventType === "step.updated") {
    return event.parentId ? `span:${event.parentId}` : `event:${event.eventId}`
  }
  if (event.eventType === "step.started" || event.eventType === "tool.started" || event.eventType === "model.started") {
    return `span:${event.eventId}`
  }
  return `event:${event.eventId}`
}

function statusForTerminal(event: AgentTraceEvent | undefined): AgentTraceStatus | undefined {
  if (!event) return undefined
  return event.status === "running" ? "completed" : event.status
}

function pickSummary(events: AgentTraceEvent[]) {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    if (events[index].safeSummary) return events[index].safeSummary
  }
  return undefined
}

function pickToolName(events: AgentTraceEvent[]) {
  return events.find((event) => event.toolName)?.toolName
}

function buildNode(bucket: EventBucket, terminalStatus: AgentTraceStatus | undefined, bucketByStartId: Map<string, EventBucket>) {
  const events = orderedEvents(bucket.events)
  const first = events[0]
  const last = events[events.length - 1]
  const start = bucket.start ?? first
  const isDelta = DELTA_EVENT_TYPES.has(first.eventType)
  const parentBucket = start.parentId ? bucketByStartId.get(start.parentId) : undefined
  const parentStatus = parentBucket ? parentBucket.events[parentBucket.events.length - 1]?.status : undefined
  const status = isDelta && parentStatus && parentStatus !== "running"
    ? parentStatus
    : terminalStatus && (last.status === "running" || isDelta)
      ? terminalStatus
      : last.status
  const sourceEventTypes = [...new Set(events.map((event) => event.eventType))]
  const firstSequence = first.sequence
  const lastSequence = last.sequence
  const deltaCount = isDelta ? events.length : undefined

  return {
    ...start,
    eventId: start.eventId,
    parentId: start.parentId,
    sequence: firstSequence,
    occurredAt: first.occurredAt,
    status,
    label: start.label,
    ...(pickToolName(events) ? { toolName: pickToolName(events) } : {}),
    ...(pickSummary(events) ? { safeSummary: isDelta ? `已接收 ${events.length} 段${first.eventType === "answer.delta" ? "答案增量" : "模型增量"}` : pickSummary(events) } : {}),
    ...(isDelta && !pickSummary(events) ? { safeSummary: `已接收 ${events.length} 段${first.eventType === "answer.delta" ? "答案增量" : "模型增量"}` } : {}),
    ...(last.durationMs !== undefined ? { durationMs: last.durationMs } : {}),
    firstSequence,
    lastSequence,
    firstOccurredAt: first.occurredAt,
    lastOccurredAt: last.occurredAt,
    eventIds: events.map((event) => event.eventId),
    sourceEventTypes,
    ...(deltaCount !== undefined ? { deltaCount } : {}),
  } satisfies AgentTraceProjectionNode
}

function deriveRunStatus(events: AgentTraceEvent[], terminalEvent: AgentTraceEvent | undefined): AgentTraceProjection["status"] {
  if (terminalEvent) return terminalEvent.status
  if (events.length === 0) return "idle"
  const latest = events[events.length - 1]
  return latest.status
}

export function projectTrace(events: readonly AgentTraceEvent[]): AgentTraceProjection {
  const ordered = orderedEvents(events)
  if (ordered.length === 0) return { status: "idle", events: [] }

  const terminalEvent = ordered.find((event) => TERMINAL_EVENT_TYPES.has(event.eventType))
  const boundedEvents = terminalEvent
    ? ordered.filter((event) => event.sequence <= terminalEvent.sequence)
    : ordered

  const buckets = new Map<string, EventBucket>()
  for (const event of boundedEvents) {
    const key = bucketKey(event)
    const bucket = buckets.get(key) ?? { key, events: [] }
    bucket.events.push(event)
    if (event.eventType === "run.started" || event.eventType === "step.started" || event.eventType === "tool.started" || event.eventType === "model.started") {
      bucket.start ??= event
    }
    buckets.set(key, bucket)
  }

  const runBucket = buckets.get(`run:${ordered[0].runId}`)
  const terminalStatus = statusForTerminal(terminalEvent)
  const bucketByStartId = new Map<string, EventBucket>()
  for (const bucket of buckets.values()) {
    if (bucket.start) bucketByStartId.set(bucket.start.eventId, bucket)
  }

  const projected = [...buckets.values()]
    .filter((bucket) => bucket !== runBucket)
    .map((bucket) => buildNode(bucket, terminalStatus, bucketByStartId))
    .sort((left, right) => left.firstSequence - right.firstSequence)

  return {
    traceId: ordered[0].traceId,
    runId: ordered[0].runId,
    status: deriveRunStatus(boundedEvents, terminalEvent),
    ...(terminalEvent ? { terminalEvent, terminalSequence: terminalEvent.sequence } : {}),
    events: projected,
  }
}

/**
 * A terminal trace event can arrive just before the SSE `done` envelope. Keep
 * the friendly status in-flight until the client has received that envelope,
 * while preserving an already reported failure or cancellation.
 */
export function effectiveTraceStatus(projection: AgentTraceProjection, active: boolean): AgentTraceProjection["status"] {
  if (!active || projection.status === "failed" || projection.status === "cancelled" || projection.status === "idle") {
    return projection.status
  }
  return "running"
}

const FRIENDLY_TOOL_LABELS: Record<string, string> = {
  read_profile: "读取个人档案",
  read_recent_meals: "读取近期饮食记录",
  read_daily_activity: "读取近期活动",
  read_active_memories: "读取长期记忆",
  read_exercise_plan: "读取当前运动计划",
  validate_exercise_plan: "校验运动计划",
  save_exercise_plan: "保存运动计划",
  verify_exercise_plan: "回读并核验运动计划",
  validate_meal_record: "校验餐食记录",
  save_meal_record: "保存餐食记录",
  verify_meal_record: "回读并核验餐食记录",
  web_search: "检索公开资料",
}

function friendlyLabel(event: AgentTraceProjectionNode) {
  if (event.toolName && FRIENDLY_TOOL_LABELS[event.toolName]) return FRIENDLY_TOOL_LABELS[event.toolName]
  if (/判断请求范围|识别.*目标/.test(event.label)) return "确认请求目标"
  if (/定位当前对话线程/.test(event.label)) return "定位当前对话"
  if (/整理饮食档案与对话上下文/.test(event.label)) return "整理个人上下文"
  if (/读取饮食档案与近期记录/.test(event.label)) return "读取近期饮食记录"
  if (/读取会话摘要/.test(event.label)) return "读取会话摘要"
  if (/读取当前线程尾部消息/.test(event.label)) return "读取当前对话"
  if (/更新记忆使用状态/.test(event.label)) return "更新记忆使用状态"
  if (/关联计划来源消息/.test(event.label)) return "关联计划结果"
  if (/保存.*回复/.test(event.label)) return "保存教练回复"
  if (event.eventType === "model.started" || /生成建议/.test(event.label)) return "生成教练建议"
  return event.label
}

function projectFriendlyEvents(projection: AgentTraceProjection): AgentTraceProjectionNode[] {
  const childParentIds = new Set(projection.events.map((event) => event.parentId).filter(Boolean))
  return projection.events
    .filter((event) => !["model.delta", "answer.delta"].includes(event.eventType))
    .filter((event) => !(event.eventType === "step.started" && childParentIds.has(event.eventId) && /整理饮食档案与对话上下文/.test(event.label)))
    .map((event) => ({
      ...event,
      parentId: undefined,
      eventType: event.eventType === "tool.started" || event.eventType === "model.started" ? event.eventType : "step.started",
      label: friendlyLabel(event),
    } satisfies AgentTraceProjectionNode))
    .sort((left, right) => left.firstSequence - right.firstSequence)
}

export function projectTraceEvents(events: readonly AgentTraceEvent[], showTechnical = true) {
  const projection = projectTrace(events)
  return showTechnical ? projection.events : projectFriendlyEvents(projection)
}
