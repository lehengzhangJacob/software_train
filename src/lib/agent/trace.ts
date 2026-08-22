import { randomUUID } from "node:crypto"

import {
  sanitizeTraceSummary,
  sanitizeTraceText,
  type AgentTraceEvent,
  type AgentTraceEventInput,
  type AgentTraceStatus,
} from "@/lib/agent/trace-contract"

export type AgentTraceReporter = (event: AgentTraceEventInput) => void | Promise<void | AgentTraceEvent>

export interface AgentTraceRecorder {
  traceId: string
  runId: string
  emit: (event: AgentTraceEventInput) => Promise<AgentTraceEvent>
  snapshot(): AgentTraceEvent[]
}

export function createAgentTraceRecorder(onTrace?: (event: AgentTraceEvent) => void | Promise<void>): AgentTraceRecorder {
  const traceId = randomUUID()
  const runId = randomUUID()
  const events: AgentTraceEvent[] = []
  let sequence = 0

  const emit = async (input: AgentTraceEventInput): Promise<AgentTraceEvent> => {
    const event: AgentTraceEvent = {
      version: 1,
      traceId,
      runId,
      eventId: input.eventId ?? randomUUID(),
      ...(input.parentId ? { parentId: input.parentId } : {}),
      sequence: input.sequence ?? sequence,
      occurredAt: input.occurredAt ?? new Date().toISOString(),
      eventType: input.eventType,
      status: input.status,
      label: input.label.replace(/[\r\n\t]+/g, " ").trim().slice(0, 120),
      ...(input.toolName ? { toolName: input.toolName } : {}),
      ...(sanitizeTraceSummary(input.safeSummary) ? { safeSummary: sanitizeTraceSummary(input.safeSummary) } : {}),
      ...(sanitizeTraceText(input.textDelta) ? { textDelta: sanitizeTraceText(input.textDelta) } : {}),
      ...(input.durationMs !== undefined ? { durationMs: Math.max(0, Math.round(input.durationMs)) } : {}),
      ...(input.retryOf ? { retryOf: input.retryOf } : {}),
    }
    sequence = Math.max(sequence + 1, event.sequence + 1)
    events.push(event)
    try {
      await onTrace?.(event)
    } catch {
      // Trace delivery is best effort; it must never fail the business run.
    }
    return event
  }

  return { traceId, runId, emit, snapshot: () => [...events] }
}

export interface AgentTraceStep {
  kind: "context" | "model" | "tool" | "policy" | "step"
  label: string
  toolName?: string
  parentId?: string
  safeSummary?: string
}

function eventTypesFor(kind: AgentTraceStep["kind"]) {
  if (kind === "tool") return { started: "tool.started" as const, completed: "tool.result" as const }
  if (kind === "model") return { started: "model.started" as const, completed: "step.completed" as const }
  return { started: "step.started" as const, completed: "step.completed" as const }
}

export async function runAgentTraceStep<T>(
  trace: AgentTraceRecorder | undefined,
  step: AgentTraceStep,
  operation: () => Promise<T>,
  options?: { completedStatus?: Extract<AgentTraceStatus, "completed" | "fallback">; completedSummary?: string },
): Promise<T> {
  if (!trace) return operation()
  const types = eventTypesFor(step.kind)
  const startedAt = Date.now()
  const started = await trace.emit({
    eventType: types.started,
    status: "running",
    label: step.label,
    ...(step.toolName ? { toolName: step.toolName } : {}),
    ...(step.parentId ? { parentId: step.parentId } : {}),
    ...(step.safeSummary ? { safeSummary: step.safeSummary } : {}),
  })
  try {
    const result = await operation()
    await trace.emit({
      eventType: types.completed,
      status: options?.completedStatus ?? "completed",
      label: step.label,
      ...(step.toolName ? { toolName: step.toolName } : {}),
      parentId: started.eventId,
      durationMs: Date.now() - startedAt,
      ...(options?.completedSummary ? { safeSummary: options.completedSummary } : {}),
    })
    return result
  } catch (error) {
    await trace.emit({
      eventType: types.completed,
      status: "failed",
      label: step.label,
      ...(step.toolName ? { toolName: step.toolName } : {}),
      parentId: started.eventId,
      durationMs: Date.now() - startedAt,
      safeSummary: "步骤执行失败",
    })
    throw error
  }
}
