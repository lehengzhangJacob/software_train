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
  running: "处理中",
  completed: "已完成",
  failed: "未完成",
  cancelled: "已暂停",
  fallback: "已准备好",
}

const friendlyLabels: Record<string, string> = {
  "开始 Agent 回合": "准备这次回答",
  "Agent 回合完成": "回答已完成",
  "Agent 回合失败": "这次回答没有完成",
  "接收用户消息": "已收到你的消息",
  "定位当前对话线程": "确认当前对话",
  "整理饮食档案与对话上下文": "结合你的饮食记录",
  "读取饮食档案与近期记录": "读取你的近期记录",
  "读取会话摘要": "回顾之前的对话",
  "读取当前线程尾部消息": "查看当前对话",
  "健康 Agent 生成建议": "生成个性化建议",
  "答案增量": "生成回答",
  "保存 Agent 回复": "保存回答",
  "更新记忆使用状态": "更新记忆",
  "校验点餐意图与一次性建单权限": "确认点餐请求",
  "读取麦当劳工具配置": "准备点餐服务",
  "查询配送地址": "查询配送信息",
  "查询可配送门店": "查找可用门店",
  "读取门店菜单": "查看可选菜单",
  "按营养目标选择餐品": "按目标选择餐品",
  "计算订单价格": "核对价格",
  "创建未支付订单": "准备订单",
}

function friendlyLabel(event: DisplayEvent, heading: string) {
  if (event.eventType === "answer.delta") return "生成回答"
  return friendlyLabels[event.label] ?? (event.label || heading)
}

function friendlySummary(value: string | undefined, status: AgentTraceStatus) {
  if (!value) return undefined
  if (/^已接收 \d+ 段答案增量$/.test(value)) return "回答正在生成"
  if (value === "模型以 SSE 增量返回") return "回答正在持续生成"
  if (value === "提供商未提供 SSE，已按完整响应回退") return "回答已准备好"
  if (value === "已建立当前回合 Trace") return "已开始整理信息"
  if (value === "消息已写入当前线程") return "消息已收到"
  if (value === "并行读取当前回合所需的安全上下文") return "正在准备你的信息"
  if (value === "档案、摘要和尾部消息已就绪") return "已结合你的记录"
  if (value === "最终回复和合法记忆候选写入消息历史") return "回答已保存"
  if (value === "点餐阻塞原因已写入消息历史") return "已记录当前结果"
  if (value === "仅更新本回合实际命中的记忆") return "已更新相关记忆"
  if (value === "服务端读取连接器，凭据不进入 Trace") return "已准备相关服务"
  if (value === "模型仅接收脱敏后的营养上下文与线程尾部") return "已准备安全的个人信息"
  if (value === "模型只接收已校验菜单编码") return "已准备可选菜单"
  if (value === "已确认账户拥有该线程") return "已确认当前对话"
  if (value.startsWith("最终消息已保存")) return "回答已保存"
  if (value === "模型调用失败") return "生成建议时遇到问题"
  if (value === "工具调用失败") return "查询信息时遇到问题"
  if (value === "工具返回已解析，原始结果已隔离") return "信息查询完成"
  if (value === "已通过工具白名单，开始调用") return "正在查询相关信息"
  if (value === "上下文读取失败") return "读取记录时遇到问题"
  if (value.includes("当前消息命中明确点餐意图")) return "正在按你的点餐请求处理"
  if (/(模型|SSE|Trace|Token|凭据|原始结果|支付)/i.test(value)) {
    return status === "failed" ? "这一步没有完成" : "这一步已处理完成"
  }
  return value
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
  showTechnical,
}: {
  event: DisplayEvent
  nestedEvents: Map<string, DisplayEvent[]>
  active: boolean
  showTechnical: boolean
}) {
  const nested = nestedEvents.get(event.eventId) ?? []
  const expandable = nested.length > 0
  const defaultOpen = active || event.status === "running" || event.eventType === "run.started"
  const heading = event.eventType === "answer.delta" ? "答案输出" : eventLabels[event.eventType]
  const label = friendlyLabel(event, heading)
  const summary = showTechnical ? event.safeSummary : friendlySummary(event.safeSummary, event.status)
  const content = (
    <>
      <span className={cn("grid size-6 shrink-0 place-items-center rounded-full ring-4 ring-[var(--brand-paper)]", nodeClass(event.status))}>
        {eventIcon(event)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="text-sm font-medium text-foreground">{showTechnical ? event.label || heading : label}</span>
          <span className={cn("inline-flex items-center gap-1 text-[11px]", statusClass(event.status))}>
            {showTechnical ? `${heading} · ` : ""}{statusLabels[event.status]}
          </span>
        </span>
        {showTechnical ? (
          <span className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1 tabular-nums"><Clock3 className="size-3" />#{String(event.sequence + 1).padStart(2, "0")}</span>
            {event.toolName ? <code className="break-all font-mono text-[10px]">{event.toolName}</code> : null}
            {formatDuration(event.durationMs) ? <span>{formatDuration(event.durationMs)}</span> : null}
          </span>
        ) : null}
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
            {nested.map((child) => <TraceNode key={child.eventId} event={child} nestedEvents={nestedEvents} active={active} showTechnical={showTechnical} />)}
          </ol>
        </details>
      ) : (
        <div className="flex min-w-0 items-start gap-3 py-1">{content}</div>
      )}
    </li>
  )
}

export function AgentTracePanel({ events, active }: AgentTracePanelProps) {
  const [expanded, setExpanded] = useState(false)
  const [showTechnical, setShowTechnical] = useState(false)
  const displayEvents = useMemo(() => compactDeltas(events), [events])
  const { roots, children } = useMemo(() => buildTree(displayEvents), [displayEvents])
  const completedCount = displayEvents.filter((event) => event.status === "completed" || event.status === "fallback").length
  const hasFailure = displayEvents.some((event) => event.status === "failed" || event.status === "cancelled")
  const isExpanded = active || expanded
  const progressLabel = active ? "进行中" : hasFailure ? "需要处理" : "已完成"
  const progressSummary = active ? "正在整理信息并生成建议" : hasFailure ? "这次回答没有完成，请查看上方提示" : "本回合已完成"

  if (events.length === 0) return null

  return (
    <section className="min-w-0 py-1" aria-label="本回合进度" data-testid="agent-trace-panel">
      <button
        type="button"
        className="group flex w-full min-w-0 items-center gap-3 border-b border-border/60 pb-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-mint)]"
        aria-expanded={isExpanded}
        aria-controls="agent-trace-timeline"
        aria-label={isExpanded ? "收起本回合进度" : "查看本回合进度"}
        onClick={() => setExpanded((current) => !current)}
      >
        <span className={cn("grid size-8 shrink-0 place-items-center rounded-full", hasFailure ? "bg-[var(--brand-coral-soft)] text-[var(--brand-coral)]" : "bg-[var(--brand-lavender-soft)] text-[var(--brand-plum)]")}>
          {hasFailure ? <CircleAlert className="size-4" aria-hidden="true" /> : <Activity className="size-4" aria-hidden="true" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-[var(--brand-heading)]">本回合进度</span>
          <span className="mt-0.5 block text-[11px] text-muted-foreground">{progressSummary}</span>
        </span>
        <span className={cn("text-[11px] font-medium", hasFailure ? "text-[var(--brand-coral)]" : active ? "text-[var(--brand-lavender-deep)]" : "text-[var(--brand-mint-deep)]")}>
          {progressLabel}
        </span>
        <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform group-hover:text-[var(--brand-plum)]", isExpanded && "rotate-180")} aria-hidden="true" />
      </button>
      {isExpanded ? (
        <div id="agent-trace-timeline" className="min-w-0 pt-4" aria-live={active ? "polite" : undefined}>
          <div className="mb-4 flex min-w-0 items-center justify-between gap-3">
            <p className="min-w-0 text-[11px] text-muted-foreground">
              {showTechnical ? `${completedCount}/${displayEvents.length} 个步骤已完成` : "这里会简要展示这次回答的准备过程"}
            </p>
            <button
              type="button"
              className="shrink-0 text-[11px] font-medium text-[var(--brand-plum)] underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-mint)]"
              onClick={() => setShowTechnical((current) => !current)}
            >
              {showTechnical ? "隐藏技术详情" : "查看技术详情"}
            </button>
          </div>
          <ol className="ml-3 min-w-0 border-l border-[var(--brand-mint)]/40 pl-6 sm:ml-4 sm:pl-7">
            {roots.map((event) => <TraceNode key={event.eventId} event={event} nestedEvents={children} active={active} showTechnical={showTechnical} />)}
          </ol>
          <p className="mt-4 border-l-2 border-[var(--brand-lavender)]/60 pl-4 text-[11px] leading-5 text-muted-foreground">
            {showTechnical ? "完整过程仅展示安全摘要；原始参数、结果、Token 和支付入口不会进入这里。" : "这里只显示当前回答的进度摘要。"}
          </p>
        </div>
      ) : null}
    </section>
  )
}
