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
  context: "整理信息",
  model: "生成建议",
  tool: "调用服务",
  policy: "安全校验",
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

function statusNodeClass(status: AgentActivityStatus) {
  if (status === "running") return "bg-[var(--brand-lavender-soft)] text-[var(--brand-lavender-deep)]"
  if (status === "completed") return "bg-[var(--brand-mint)]/20 text-[var(--brand-mint-deep)]"
  if (status === "blocked") return "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
  return "bg-[var(--brand-coral-soft)] text-[var(--brand-coral)]"
}

export function AgentActivityPanel({ activities, active }: AgentActivityPanelProps) {
  const [expanded, setExpanded] = useState(true)
  const isExpanded = active || expanded
  const completedCount = useMemo(
    () => activities.filter((activity) => activity.status === "completed").length,
    [activities],
  )
  const hasFailure = activities.some((activity) => activity.status === "failed" || activity.status === "blocked")

  if (activities.length === 0) return null

  return (
    <section
      className="min-w-0 py-1"
      aria-label="Agent 执行过程"
      data-testid="agent-activity-panel"
    >
      <button
        type="button"
        className="group flex w-full min-w-0 items-center gap-3 border-b border-border/60 pb-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-mint)]"
        aria-expanded={isExpanded}
        aria-controls="agent-activity-timeline"
        onClick={() => setExpanded((current) => !current)}
      >
        <span className={cn("grid size-8 shrink-0 place-items-center rounded-full", hasFailure ? "bg-[var(--brand-coral-soft)] text-[var(--brand-coral)]" : "bg-[var(--brand-lavender-soft)] text-[var(--brand-plum)]")}>
          {hasFailure ? <CircleAlert className="size-4" aria-hidden="true" /> : <Activity className="size-4" aria-hidden="true" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-[var(--brand-heading)]">本回合时间线</span>
          <span className="mt-0.5 block text-[11px] text-muted-foreground">
            {active ? "实时更新中" : `${activities.length} 个步骤 · ${completedCount} 个已完成`}
          </span>
        </span>
        <span className={cn("hidden text-[11px] font-medium tabular-nums sm:inline-flex", hasFailure ? "text-[var(--brand-coral)]" : "text-[var(--brand-mint-deep)]")}>
          {completedCount}/{activities.length}
        </span>
        <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform group-hover:text-[var(--brand-plum)]", isExpanded && "rotate-180")} aria-hidden="true" />
      </button>

      {isExpanded ? (
        <div id="agent-activity-timeline" className="min-w-0 pt-4" aria-live={active ? "polite" : undefined}>
          <ol className="ml-3 min-w-0 border-l border-[var(--brand-mint)]/40 pl-6 sm:ml-4 sm:pl-7">
            {activities.map((activity) => (
              <li key={activity.activityId} className="relative min-w-0 pb-5 last:pb-0">
                <span className={cn("absolute -left-[2.25rem] top-0 grid size-6 place-items-center rounded-full ring-4 ring-[var(--brand-paper)]", statusNodeClass(activity.status))}>
                  {statusIcon(activity.status)}
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-sm font-medium text-foreground">{activity.label}</span>
                    <span className={cn("inline-flex items-center gap-1 text-[11px]", statusClass(activity.status))}>
                      {kindIcon(activity.kind)}
                      {kindLabels[activity.kind]} · {statusLabels[activity.status]}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                    {activity.toolName ? <code className="break-all font-mono text-[10px] text-muted-foreground">{activity.toolName}</code> : null}
                    {formatDuration(activity.durationMs) ? <span>{formatDuration(activity.durationMs)}</span> : null}
                  </div>
                  {activity.detail ? <p className="mt-1 break-words text-xs leading-5 text-muted-foreground">{activity.detail}</p> : null}
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-4 border-l-2 border-[var(--brand-lavender)]/60 pl-4 text-[11px] leading-5 text-muted-foreground">
            这里只展示当前回合的安全摘要，不包含 Token、原始参数或支付凭据。
          </p>
        </div>
      ) : null}
    </section>
  )
}
