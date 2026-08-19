import type {
  AgentActivity,
  AgentActivityKind,
  AgentActivityReporter,
  AgentActivityStatus,
} from "@/lib/agent/contracts"

const MAX_DETAIL_LENGTH = 180

function redactActivityDetail(value: string | undefined) {
  if (!value) return undefined
  const redacted = value
    .replace(/\b(?:api[_ -]?key|access[_ -]?token|secret)\s*[:=]\s*\S+/gi, "[credential redacted]")
    .replace(/\bbearer\s+[a-z0-9._-]{10,}/gi, "[credential redacted]")
    .replace(/https?:\/\/\S+/gi, "[link redacted]")
    .replace(/[\r\n]+/g, " ")
    .trim()
  return redacted ? redacted.slice(0, MAX_DETAIL_LENGTH) : undefined
}

export interface AgentActivityStep {
  activityId: string
  kind: AgentActivityKind
  label: string
  toolName?: string
}

export interface AgentActivityRecorder {
  emit: AgentActivityReporter
  snapshot(): AgentActivity[]
}

export function createAgentActivityRecorder(onActivity?: AgentActivityReporter): AgentActivityRecorder {
  const steps = new Map<string, AgentActivity>()

  const emit: AgentActivityReporter = async (activity) => {
    const previous = steps.get(activity.activityId)
    const next: AgentActivity = {
      ...previous,
      ...activity,
      ...(activity.detail ? { detail: redactActivityDetail(activity.detail) } : {}),
      ...(activity.detail === undefined && previous?.detail ? { detail: previous.detail } : {}),
      startedAt: previous?.startedAt ?? activity.startedAt,
    }
    steps.set(activity.activityId, next)

    // A disconnected browser must not turn an otherwise valid Agent run into
    // a failed business operation just because its activity stream vanished.
    try {
      await onActivity?.(next)
    } catch {
      // The activity projection is best effort; the canonical result remains
      // the persisted thread and the final API payload.
    }
  }

  return {
    emit,
    snapshot: () => [...steps.values()],
  }
}

export async function runAgentActivity<T>(
  reporter: AgentActivityReporter | undefined,
  step: AgentActivityStep,
  operation: () => Promise<T>,
): Promise<T> {
  const startedAt = new Date().toISOString()
  await reporter?.({ ...step, status: "running", startedAt })

  try {
    const result = await operation()
    const finishedAt = new Date().toISOString()
    await reporter?.({
      ...step,
      status: "completed",
      startedAt,
      finishedAt,
      durationMs: Math.max(0, Date.parse(finishedAt) - Date.parse(startedAt)),
    })
    return result
  } catch (error) {
    const finishedAt = new Date().toISOString()
    await reporter?.({
      ...step,
      status: "failed",
      startedAt,
      finishedAt,
      durationMs: Math.max(0, Date.parse(finishedAt) - Date.parse(startedAt)),
      detail: "步骤执行失败",
    })
    throw error
  }
}

export async function markAgentActivity(
  reporter: AgentActivityReporter | undefined,
  step: AgentActivityStep,
  status: Extract<AgentActivityStatus, "blocked" | "failed">,
  detail: string,
) {
  await reporter?.({
    ...step,
    status,
    startedAt: new Date().toISOString(),
    detail,
  })
}
