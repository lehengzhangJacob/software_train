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
import { projectTrace, projectTraceEvents, type AgentTraceProjectionNode } from "@/lib/agent/trace-projection"
import { cn } from "@/lib/utils"

interface AgentTracePanelProps {
  events: AgentTraceEvent[]
  active: boolean
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
  "接收用户消息": "已收到你的消息",
  "定位当前对话线程": "确认当前对话",
  "整理饮食档案与对话上下文": "整理饮食档案",
  "读取饮食档案与近期记录": "读取近期记录",
  "读取会话摘要": "回顾之前的对话",
  "读取当前线程尾部消息": "查看当前对话",
  "健康 Agent 生成建议": "生成个性化建议",
  "答案增量": "生成回答",
  "保存 Agent 回复": "保存回答",
  "保存运动计划与 Agent 回复": "保存运动计划与回答",
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

const friendlyToolLabels: Record<string, string> = {
  read_profile: "查看营养档案",
  read_recent_meals: "读取近期饮食记录",
  read_daily_activity: "读取近期活动",
  read_active_memories: "结合长期偏好",
  read_exercise_plan: "查看运动计划",
}

function friendlyLabel(event: AgentTraceProjectionNode, heading: string) {
  if (event.eventType === "answer.delta") return "生成回答"
  if (event.eventType === "model.delta") return "处理回答"
  if (event.toolName) return friendlyToolLabels[event.toolName] ?? "读取相关信息"
  return friendlyLabels[event.label] ?? (event.label || heading)
}

function friendlySummary(value: string | undefined, status: AgentTraceStatus) {
  if (!value) return undefined
  if (/^已接收 \d+ 段(?:答案|模型)增量$/.test(value)) return status === "completed" ? "回答输出完成" : "回答正在生成"
  if (value === "AgentKernel 以 SSE 增量返回") return "回答输出完成"
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
  if (value === "模型返回了一段可见内容") return "回答正在生成"
  if (value === "模型选择了一个已注册的只读工具") return "已根据问题读取相关信息"
  if (value === "只读工具返回已隔离的安全摘要") return "相关信息已返回"
  if (value === "只读工具执行失败") return "读取相关信息时遇到问题"
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

function formatSequence(event: AgentTraceProjectionNode) {
  const first = String(event.firstSequence + 1).padStart(2, "0")
  const last = String(event.lastSequence + 1).padStart(2, "0")
  return first === last ? `#${first}` : `#${first}–#${last}`
}

function eventIcon(event: AgentTraceProjectionNode) {
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

function buildTimeline(events: AgentTraceProjectionNode[]) {
  const knownParents = new Set(events.map((event) => event.eventId))
  const byId = new Map(events.map((event) => [event.eventId, event]))
  const depthCache = new Map<string, number>()
  const depthFor = (event: AgentTraceProjectionNode, visited = new Set<string>()): number => {
    if (!event.parentId || !knownParents.has(event.parentId) || visited.has(event.eventId)) return 0
    const cached = depthCache.get(event.eventId)
    if (cached !== undefined) return cached
    visited.add(event.eventId)
    const parent = byId.get(event.parentId)
    const depth = parent ? Math.min(3, depthFor(parent, visited) + 1) : 0
    depthCache.set(event.eventId, depth)
    return depth
  }
  return events.map((event) => ({ event, depth: depthFor(event) }))
}

function TraceNode({ event, depth, showTechnical }: { event: AgentTraceProjectionNode; depth: number; showTechnical: boolean }) {
  const heading = event.eventType === "answer.delta" ? "答案输出" : eventLabels[event.eventType]
  const label = friendlyLabel(event, heading)
  const summary = showTechnical ? event.safeSummary : friendlySummary(event.safeSummary, event.status)
  return (
    <li className="relative min-w-0 pb-4 last:pb-0" style={{ marginLeft: depth ? `${Math.min(depth, 3) * 1.25}rem` : undefined }}>
      <div className="flex min-w-0 items-start gap-3 py-1">
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
              <span className="inline-flex items-center gap-1 tabular-nums"><Clock3 className="size-3" />{formatSequence(event)}</span>
              {event.toolName ? <code className="break-all font-mono text-[10px]">{event.toolName}</code> : null}
              {event.deltaCount ? <span>{event.deltaCount} 段增量</span> : null}
              {formatDuration(event.durationMs) ? <span>{formatDuration(event.durationMs)}</span> : null}
            </span>
          ) : null}
          {summary ? <span className="mt-1 block break-words text-xs leading-5 text-muted-foreground">{summary}</span> : null}
        </span>
      </div>
    </li>
  )
}

export function AgentTracePanel({ events, active }: AgentTracePanelProps) {
  const [expanded, setExpanded] = useState(false)
  const [showTechnical, setShowTechnical] = useState(false)
  const projection = useMemo(() => projectTrace(events), [events])
  const displayEvents = useMemo(() => projectTraceEvents(events, showTechnical), [events, showTechnical])
  const timeline = useMemo(() => buildTimeline(displayEvents), [displayEvents])
  const completedCount = displayEvents.filter((event) => event.status === "completed" || event.status === "fallback").length
  const hasFailure = projection.status === "failed" || projection.status === "cancelled" || displayEvents.some((event) => event.status === "failed" || event.status === "cancelled")
  const isRunning = projection.status === "running"
  const isExpanded = (active && isRunning) || expanded
  const progressLabel = isRunning ? "进行中" : hasFailure ? "需要处理" : projection.status === "cancelled" ? "已暂停" : "已完成"
  const progressSummary = isRunning
    ? active ? "正在整理信息并生成建议" : "等待回合终态"
    : hasFailure ? "这次回答没有完成，请查看上方提示" : "本回合已完成"

  if (events.length === 0) return null

  return (
    <section className="min-w-0 py-1" aria-label="本回合进度" data-testid="agent-trace-panel" data-run-id={projection.runId}>
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
        <span className={cn("text-[11px] font-medium", hasFailure ? "text-[var(--brand-coral)]" : isRunning ? "text-[var(--brand-lavender-deep)]" : "text-[var(--brand-mint-deep)]")}>
          {progressLabel}
        </span>
        <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform group-hover:text-[var(--brand-plum)]", isExpanded && "rotate-180")} aria-hidden="true" />
      </button>
      {isExpanded ? (
        <div id="agent-trace-timeline" className="min-w-0 pt-4" aria-live={active && isRunning ? "polite" : undefined}>
          <div className="mb-4 flex min-w-0 items-center justify-between gap-3">
            <p className="min-w-0 text-[11px] text-muted-foreground">
              {showTechnical
                ? `${completedCount}/${displayEvents.length} 个逻辑节点已完成${projection.terminalSequence !== undefined ? ` · 终态 #${String(projection.terminalSequence + 1).padStart(2, "0")}` : ""}`
                : "这里展示这次回答实际走过的步骤"}
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
            {timeline.map(({ event, depth }) => <TraceNode key={event.eventId} event={event} depth={depth} showTechnical={showTechnical} />)}
          </ol>
          <p className="mt-4 border-l-2 border-[var(--brand-lavender)]/60 pl-4 text-[11px] leading-5 text-muted-foreground">
            {showTechnical ? "技术详情只展示真实事件的安全摘要；原始参数、结果、Token 和支付入口不会进入这里。" : "这里只显示当前回答的进度摘要。"}
          </p>
        </div>
      ) : null}
    </section>
  )
}

export { projectTraceEvents }
