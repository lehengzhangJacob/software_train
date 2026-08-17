"use client"

import { Activity, BrainCircuit, Check, ChevronDown, CircleAlert, LoaderCircle, ShieldCheck, Wrench } from "lucide-react"
import { useMemo, useState } from "react"
import type { AgentActivity, AgentActivityKind, AgentActivityStatus } from "@/lib/agent/contracts"
import { cn } from "@/lib/utils"

interface AgentActivityPanelProps {
  activities: AgentActivity[]
  active: boolean
}

const kindLabels: Record<AgentActivityKind, string> = {
  context: "上下文",
  model: "模型",
  tool: "MCP 工具",
  policy: "策略",
}

const statusLabels: Record<AgentActivityStatus, string> = {
  running: "进行中",
  completed: "已完成",
  failed: "失败",
  blocked: "已阻断",
}

function formatDuration(value: number | undefined) {
  if (value === undefined) return ""
  if (value < 1_000) return `${value}ms`
  return `${(value / 1_000).toFixed(1)}s`
}

function statusIcon(status: AgentActivityStatus) {
  if (status === "running") return <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
  if (status === "completed") return <Check className="size-4" aria-hidden="true" />
  return <CircleAlert className="size-4" aria-hidden="true" />
}

function kindIcon(kind: AgentActivityKind) {
  if (kind === "tool") return <Wrench className="size-3.5" aria-hidden="true" />
  if (kind === "model") return <BrainCircuit className="size-3.5" aria-hidden="true" />
  if (kind === "policy") return <ShieldCheck className="size-3.5" aria-hidden="true" />
  return <Activity className="size-3.5" aria-hidden="true" />
}

function statusClass(status: AgentActivityStatus) {
  if (status === "running") return "text-[var(--brand-lavender-deep)]"
  if (status === "completed") return "text-[var(--brand-mint-deep)]"
  if (status === "blocked") return "text-amber-700 dark:text-amber-300"
  return "text-[var(--brand-coral)]"
}

export function AgentActivityPanel({ activities, active }: AgentActivityPanelProps) {
  const [expanded, setExpanded] = useState(active)
  const completedCount = useMemo(
    () => activities.filter((activity) => activity.status === "completed").length,
    [activities],
  )
  const hasFailure = activities.some((activity) => activity.status === "failed" || activity.status === "blocked")

  if (activities.length === 0) return null

  return (
    <section
      className="rounded-lg border border-border/70 bg-card shadow-sm"
      aria-label="Agent 执行过程"
      data-testid="agent-activity-panel"
    >
      <button
        type="button"
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-mint)]"
        aria-expanded={expanded}
        onClick={() => setExpanded((current) => !current)}
      >
        <span className={cn("grid size-8 shrink-0 place-items-center rounded-md bg-[var(--brand-lavender-soft)]", hasFailure ? "text-[var(--brand-coral)]" : "text-[var(--brand-plum)]")}>
          {hasFailure ? <CircleAlert className="size-4" aria-hidden="true" /> : <Activity className="size-4" aria-hidden="true" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-[var(--brand-heading)]">Agent 执行过程</span>
          <span className="mt-0.5 block text-[11px] text-muted-foreground">
            {active ? "实时更新中" : `${activities.length} 个步骤 · ${completedCount} 个已完成`}
          </span>
        </span>
        <span className={cn("hidden rounded-full px-2 py-1 text-[11px] font-medium sm:inline-flex", hasFailure ? "bg-[var(--brand-coral-soft)] text-[var(--brand-coral)]" : "bg-[var(--brand-mint)]/20 text-[var(--brand-mint-deep)]")}>
          {completedCount}/{activities.length}
        </span>
        <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-180")} aria-hidden="true" />
      </button>

      {expanded ? (
        <div className="border-t border-border/60 px-4 py-3" aria-live={active ? "polite" : undefined}>
          <ol className="space-y-1">
            {activities.map((activity, index) => (
              <li key={activity.activityId} className="relative flex gap-3 pb-3 last:pb-0">
                {index < activities.length - 1 ? <span className="absolute left-3.5 top-7 h-[calc(100%-1.25rem)] w-px bg-border" aria-hidden="true" /> : null}
                <span className={cn("relative z-10 grid size-7 shrink-0 place-items-center rounded-full border bg-card", statusClass(activity.status))}>
                  {statusIcon(activity.status)}
                </span>
                <div className="min-w-0 flex-1 pt-0.5">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-sm font-medium text-foreground">{activity.label}</span>
                    <span className={cn("inline-flex items-center gap-1 text-[11px]", statusClass(activity.status))}>
                      {kindIcon(activity.kind)}
                      {kindLabels[activity.kind]} · {statusLabels[activity.status]}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                    {activity.toolName ? <code className="rounded bg-muted px-1.5 py-0.5 font-mono">{activity.toolName}</code> : null}
                    {formatDuration(activity.durationMs) ? <span>{formatDuration(activity.durationMs)}</span> : null}
                  </div>
                  {activity.detail ? <p className="mt-1 break-words text-xs leading-5 text-muted-foreground">{activity.detail}</p> : null}
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-3 border-t border-border/60 pt-3 text-[11px] leading-5 text-muted-foreground">
            这里只展示当前回合的安全摘要，不包含 Token、原始参数或支付凭据。
          </p>
        </div>
      ) : null}
    </section>
  )
}
