"use client"

import {
  Activity,
  BrainCircuit,
  ChevronDown,
  CircleAlert,
  Clock3,
  LoaderCircle,
  ShieldCheck,
  Wrench,
} from "lucide-react"
import { useMemo, useState } from "react"
import type { AgentTraceEvent, AgentTraceEventType, AgentTraceStatus } from "@/lib/agent/trace-contract"
import { cn } from "@/lib/utils"

interface AgentTracePanelProps {
  events: AgentTraceEvent[]
  active: boolean
}

type DisplayEvent = AgentTraceEvent & {
  deltaCount?: number
}

const eventLabels: Record<AgentTraceEventType, string> = {
  "run.started": "开始当前回合",
  "step.started": "开始步骤",
  "step.updated": "更新步骤",
  "step.completed": "完成步骤",
  "tool.started": "调用工具",
  "tool.result": "工具结果",
  "model.started": "启动模型",
  "model.delta": "模型增量",
  "answer.delta": "答案增量",
  "run.completed": "回合完成",
  "run.failed": "回合失败",
  "run.cancelled": "回合取消",
}

const statusLabels: Record<AgentTraceStatus, string> = {
  running: "进行中",
  completed: "已完成",
  failed: "失败",
  cancelled: "已取消",
  fallback: "完整响应回退",
}

function formatDuration(value: number | undefined) {
  if (value === undefined) return ""
  if (value < 1_000) return `${value}ms`
  return `${(value / 1_000).toFixed(1)}s`
}

function eventIcon(event: DisplayEvent) {
  if (event.status === "running") return <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" />
  if (event.status === "failed" || event.status === "cancelled") return <CircleAlert className="size-3.5" aria-hidden="true" />
  if (event.eventType.startsWith("tool.")) return <Wrench className="size-3.5" aria-hidden="true" />
  if (event.eventType.startsWith("model.") || event.eventType === "answer.delta") return <BrainCircuit className="size-3.5" aria-hidden="true" />
  if (event.eventType === "run.started" || event.eventType === "run.completed") return <Activity className="size-3.5" aria-hidden="true" />
  return <ShieldCheck className="size-3.5" aria-hidden="true" />
}

function statusClass(status: AgentTraceStatus) {
  if (status === "running") return "text-[var(--brand-lavender-deep)]"
  if (status === "completed") return "text-[var(--brand-mint-deep)]"
  if (status === "fallback") return "text-amber-700 dark:text-amber-300"
  return status === "cancelled" ? "text-muted-foreground" : "text-[var(--brand-coral)]"
}

function nodeClass(status: AgentTraceStatus) {
  if (status === "running") return "bg-[var(--brand-lavender-soft)] text-[var(--brand-lavender-deep)]"
  if (status === "completed") return "bg-[var(--brand-mint)]/20 text-[var(--brand-mint-deep)]"
  if (status === "fallback") return "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
  if (status === "cancelled") return "bg-muted text-muted-foreground"
  return "bg-[var(--brand-coral-soft)] text-[var(--brand-coral)]"
}

function compactDeltas(events: AgentTraceEvent[]): DisplayEvent[] {
  const result: DisplayEvent[] = []
  const deltaIndex = new Map<string, number>()
  for (const event of events) {
    if (event.eventType !== "answer.delta") {
      result.push(event)
      continue
    }
    const key = event.parentId ?? "root"
    const existingIndex = deltaIndex.get(key)
    if (existingIndex === undefined) {
      deltaIndex.set(key, result.length)
      result.push({ ...event, safeSummary: "已接收 1 段答案增量", deltaCount: 1 })
      continue
    }
    const existing = result[existingIndex]
    result[existingIndex] = {
      ...existing,
      sequence: event.sequence,
      occurredAt: event.occurredAt,
      status: event.status,
      durationMs: event.durationMs ?? existing.durationMs,
      safeSummary: `已接收 ${(existing.deltaCount ?? 1) + 1} 段答案增量`,
      deltaCount: (existing.deltaCount ?? 1) + 1,
    }
  }
  return result
}

function buildTree(events: DisplayEvent[]) {
  const knownIds = new Set(events.map((event) => event.eventId))
  const children = new Map<string, DisplayEvent[]>()
  const roots: DisplayEvent[] = []
  for (const event of events) {
    if (event.parentId && knownIds.has(event.parentId)) {
      const list = children.get(event.parentId) ?? []
      list.push(event)
      children.set(event.parentId, list)
    } else {
      roots.push(event)
    }
  }
  return { roots, children }
}

function TraceNode({
  event,
  nestedEvents,
  active,
}: {
  event: DisplayEvent
  nestedEvents: Map<string, DisplayEvent[]>
  active: boolean
}) {
  const nested = nestedEvents.get(event.eventId) ?? []
  const expandable = nested.length > 0
  const defaultOpen = active || event.status === "running" || event.eventType === "run.started"
  const heading = event.eventType === "answer.delta" ? "答案输出" : eventLabels[event.eventType]
  const summary = event.eventType === "answer.delta" ? event.safeSummary : event.safeSummary
  const content = (
    <>
      <span className={cn("grid size-6 shrink-0 place-items-center rounded-full ring-4 ring-[var(--brand-paper)]", nodeClass(event.status))}>
        {eventIcon(event)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-sm font-medium text-foreground">{event.label || heading}</span>
          <span className={cn("inline-flex items-center gap-1 text-[11px]", statusClass(event.status))}>
            {heading} · {statusLabels[event.status]}
          </span>
        </span>
        <span className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1 tabular-nums"><Clock3 className="size-3" />#{String(event.sequence + 1).padStart(2, "0")}</span>
          {event.toolName ? <code className="break-all font-mono text-[10px]">{event.toolName}</code> : null}
          {formatDuration(event.durationMs) ? <span>{formatDuration(event.durationMs)}</span> : null}
        </span>
        {summary ? <span className="mt-1 block break-words text-xs leading-5 text-muted-foreground">{summary}</span> : null}
      </span>
      {expandable ? <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" /> : null}
    </>
  )

  return (
    <li className="relative min-w-0 pb-4 last:pb-0">
      {expandable ? (
        <details open={defaultOpen} className="group/trace">
          <summary className="flex min-w-0 cursor-pointer list-none items-start gap-3 rounded-md py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-mint)] [&::-webkit-details-marker]:hidden">
            {content}
          </summary>
          <ol className="ml-3 mt-3 min-w-0 border-l border-[var(--brand-mint)]/35 pl-5 sm:ml-4 sm:pl-6">
            {nested.map((child) => <TraceNode key={child.eventId} event={child} nestedEvents={nestedEvents} active={active} />)}
          </ol>
        </details>
      ) : (
        <div className="flex min-w-0 items-start gap-3 py-1">{content}</div>
      )}
    </li>
  )
}

export function AgentTracePanel({ events, active }: AgentTracePanelProps) {
  const [expanded, setExpanded] = useState(true)
  const displayEvents = useMemo(() => compactDeltas(events), [events])
  const { roots, children } = useMemo(() => buildTree(displayEvents), [displayEvents])
  const completedCount = displayEvents.filter((event) => event.status === "completed" || event.status === "fallback").length
  const hasFailure = displayEvents.some((event) => event.status === "failed" || event.status === "cancelled")
  const isExpanded = active || expanded

  if (events.length === 0) return null

  return (
    <section className="min-w-0 py-1" aria-label="Agent Trace" data-testid="agent-trace-panel">
      <button
        type="button"
        className="group flex w-full min-w-0 items-center gap-3 border-b border-border/60 pb-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-mint)]"
        aria-expanded={isExpanded}
        aria-controls="agent-trace-timeline"
        onClick={() => setExpanded((current) => !current)}
      >
        <span className={cn("grid size-8 shrink-0 place-items-center rounded-full", hasFailure ? "bg-[var(--brand-coral-soft)] text-[var(--brand-coral)]" : "bg-[var(--brand-lavender-soft)] text-[var(--brand-plum)]")}>
          {hasFailure ? <CircleAlert className="size-4" aria-hidden="true" /> : <Activity className="size-4" aria-hidden="true" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-[var(--brand-heading)]">Agent Trace</span>
          <span className="mt-0.5 block text-[11px] text-muted-foreground">
            {active ? "实时拼装上下文、模型与工具步骤" : `${displayEvents.length} 个事件 · ${completedCount} 个已完成`}
          </span>
        </span>
        <span className={cn("hidden text-[11px] font-medium tabular-nums sm:inline-flex", hasFailure ? "text-[var(--brand-coral)]" : "text-[var(--brand-mint-deep)]")}>
          {completedCount}/{displayEvents.length}
        </span>
        <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform group-hover:text-[var(--brand-plum)]", isExpanded && "rotate-180")} aria-hidden="true" />
      </button>
      {isExpanded ? (
        <div id="agent-trace-timeline" className="min-w-0 pt-4" aria-live={active ? "polite" : undefined}>
          <ol className="ml-3 min-w-0 border-l border-[var(--brand-mint)]/40 pl-6 sm:ml-4 sm:pl-7">
            {roots.map((event) => <TraceNode key={event.eventId} event={event} nestedEvents={children} active={active} />)}
          </ol>
          <p className="mt-4 border-l-2 border-[var(--brand-lavender)]/60 pl-4 text-[11px] leading-5 text-muted-foreground">
            Trace 只展示当前回合的安全摘要；原始参数、结果、Token 和支付入口不会进入这里。
          </p>
        </div>
      ) : null}
    </section>
  )
}
