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

export function projectTraceEvents(events: readonly AgentTraceEvent[], showTechnical = true) {
  const projected = projectTrace(events).events
  return showTechnical ? projected : projected.filter((event) => event.eventType !== "model.delta")
}
