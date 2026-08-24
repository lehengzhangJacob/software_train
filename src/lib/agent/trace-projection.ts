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

type FriendlyPhaseKey = "scope" | "prepare" | "research" | "generate" | "save"

function friendlyPhaseFor(event: AgentTraceProjectionNode): FriendlyPhaseKey {
  const label = event.label || ""
  if (event.eventType === "model.started" || event.eventType === "model.delta" || event.eventType === "answer.delta" || /生成|答案/.test(label)) {
    return "generate"
  }
  if (event.toolName === "web_search" || /搜索|检索|公开资料/.test(label)) return "research"
  if (/保存|更新记忆/.test(label)) return "save"
  if (event.eventType === "step.started" && /范围|意图/.test(label)) return "scope"
  return "prepare"
}

function friendlyPhaseLabel(key: FriendlyPhaseKey, events: AgentTraceProjectionNode[]) {
  if (key === "scope") return "确认请求范围"
  if (key === "prepare") return "准备相关信息"
  if (key === "research") return events.some((event) => event.toolName === "web_search") ? "检索公开资料" : "读取相关信息"
  if (key === "generate") return "生成个性化建议"
  return "保存本回合结果"
}

function friendlyPhaseStatus(events: AgentTraceProjectionNode[], runStatus: AgentTraceProjection["status"]): AgentTraceStatus {
  if (events.some((event) => event.status === "failed")) return "failed"
  if (events.some((event) => event.status === "cancelled")) return "cancelled"
  if (events.some((event) => event.status === "running")) return runStatus === "running" ? "running" : runStatus === "idle" ? "completed" : runStatus
  if (events.every((event) => event.status === "fallback")) return "fallback"
  return "completed"
}

function projectFriendlyEvents(projection: AgentTraceProjection): AgentTraceProjectionNode[] {
  const groups = new Map<FriendlyPhaseKey, AgentTraceProjectionNode[]>()
  for (const event of projection.events) {
    const key = friendlyPhaseFor(event)
    const group = groups.get(key) ?? []
    group.push(event)
    groups.set(key, group)
  }

  return [...groups.entries()]
    .map(([key, events]) => {
      const ordered = [...events].sort((left, right) => left.firstSequence - right.firstSequence)
      const first = ordered[0]
      const last = ordered[ordered.length - 1]
      const toolNames = [...new Set(ordered.map((event) => event.toolName).filter(Boolean))]
      const sourceEventTypes = [...new Set(ordered.flatMap((event) => event.sourceEventTypes))]
      const deltaCount = ordered.reduce((total, event) => total + (event.deltaCount ?? 0), 0)
      const summary = pickSummary(ordered)
      return {
        ...first,
        eventId: first.eventId,
        parentId: undefined,
        sequence: first.firstSequence,
        occurredAt: first.firstOccurredAt,
        eventType: "step.started",
        status: friendlyPhaseStatus(ordered, projection.status),
        label: friendlyPhaseLabel(key, ordered),
        ...(toolNames.length === 1 ? { toolName: toolNames[0] } : {}),
        ...(summary ? { safeSummary: summary } : {}),
        firstSequence: first.firstSequence,
        lastSequence: last.lastSequence,
        firstOccurredAt: first.firstOccurredAt,
        lastOccurredAt: last.lastOccurredAt,
        eventIds: ordered.flatMap((event) => event.eventIds),
        sourceEventTypes,
        ...(deltaCount ? { deltaCount } : {}),
      } satisfies AgentTraceProjectionNode
    })
    .sort((left, right) => left.firstSequence - right.firstSequence)
}

export function projectTraceEvents(events: readonly AgentTraceEvent[], showTechnical = true) {
  const projection = projectTrace(events)
  return showTechnical ? projection.events : projectFriendlyEvents(projection)
}
