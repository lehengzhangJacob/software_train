"use client"

import Image from "next/image"
import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import {
  Bot,
  ArrowLeft,
  Dumbbell,
  ExternalLink,
  History,
  LoaderCircle,
  MessageSquarePlus,
  PanelLeft,
  Send,
  Sparkles,
  Trash2,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { AssistantText } from "@/components/agent/assistant-text"
import { AgentTracePanel } from "@/components/agent/agent-trace-panel"
import type { AgentActivity } from "@/lib/agent/contracts"
import { getRunningActivityLabel } from "@/lib/agent/activity"
import type { AgentTraceEvent } from "@/lib/agent/trace-contract"

interface ThreadSummary {
  threadId: number
  title: string
  status: string
  messageCount: number
  createdAt: string
  updatedAt: string
}

interface MemoryCandidate {
  category: string
  content: string
  importance: number
  confidence: number
  memoryId: number | null
}

interface AgentMessage {
  messageId: number
  threadId: number
  role: "user" | "assistant"
  content: string
  createdAt: string
  memoryCandidates: MemoryCandidate[]
  exercisePlanId: number | null
}

interface AgentThread extends ThreadSummary {
  messages: AgentMessage[]
}

interface AgentWorkspaceProps {
  username: string
  initialThreads: ThreadSummary[]
  initialThread: AgentThread | null
  exerciseMode?: boolean
  initialExercisePlanId?: number | null
  returnTo?: string
}

interface ApiEnvelope<T> {
  data: T | null
  error: string | null
}

interface OrderResult {
  orderId: string | null
  paymentLink: string | null
  itemsTotalCents: number | null
}

interface ExercisePlanResult {
  planId: number
  planDate: string
  revision: number
  title: string
  goal: string
  totalMinutes: number
  intensity: string
}

interface ChatResult {
  thread: AgentThread
  userMessage: AgentMessage
  assistantMessage: AgentMessage
  exercisePlan: ExercisePlanResult | null
  orderResult?: OrderResult | null
  activity: AgentActivity[]
  trace: AgentTraceEvent[]
}

const starterPrompts = ["晚餐怎么安排更合适？", "帮我复盘今天的蛋白质", "给我一个附近外卖思路"]

function formatThreadDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric" }).format(new Date(value))
}

function formatMessageTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit" }).format(new Date(value))
}

async function requestJson<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, init)
  const payload = (await response.json()) as ApiEnvelope<T>
  if (!response.ok || payload.data === null) throw new Error(payload.error || "请求失败")
  return payload.data
}

function mergeActivity(current: AgentActivity[], next: AgentActivity) {
  const index = current.findIndex((activity) => activity.activityId === next.activityId)
  if (index === -1) return [...current, next]
  const updated = current.slice()
  updated[index] = { ...updated[index], ...next }
  return updated
}

function mergeTrace(current: AgentTraceEvent[], next: AgentTraceEvent) {
  if (current.length > 0 && current[0].traceId !== next.traceId) return [next]
  if (current.some((event) => event.eventId === next.eventId)) return current
  return [...current, next].sort((left, right) => left.sequence - right.sequence)
}

type StreamPayload = {
  activity?: AgentActivity
  data?: ChatResult
  error?: string
  textDelta?: string
}

function parseActivityEvent(block: string) {
  const event = block.match(/^event:\s*(.+)$/m)?.[1]
  const data = block.match(/^data:\s*(.+)$/m)?.[1]
  if (!event || !data) return null
  return { event, payload: JSON.parse(data) as StreamPayload }
}

async function streamAgentChat(
  threadId: number | null,
  message: string,
  mode: "general" | "exercise-plan",
  exercisePlanId: number | null,
  onActivity: (activity: AgentActivity) => void,
  onTrace: (event: AgentTraceEvent) => void,
  onAnswerDelta: (delta: string) => void,
) {
  const response = await fetch("/api/agent/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify({ threadId, message, mode, exercisePlanId }),
  })
  if (!response.ok) {
    const payload = (await response.json()) as ApiEnvelope<never>
    throw new Error(payload.error || "Agent 对话失败")
  }

  const reader = response.body?.getReader()
  if (!reader) throw new Error("Agent 没有返回可读取的活动流")

  const decoder = new TextDecoder()
  let buffer = ""
  let result: ChatResult | null = null

  const consume = (block: string) => {
    const parsed = parseActivityEvent(block)
    if (!parsed) return
    if (parsed.event === "activity" && parsed.payload.activity) {
      onActivity(parsed.payload.activity)
      return
    }
    if (parsed.event === "trace") {
      onTrace(parsed.payload as unknown as AgentTraceEvent)
      return
    }
    if (parsed.event === "delta" && parsed.payload.textDelta) {
      onAnswerDelta(parsed.payload.textDelta)
      return
    }
    if (parsed.event === "error") throw new Error(parsed.payload.error || "Agent 对话失败")
    if (parsed.event === "done" && parsed.payload.data) result = parsed.payload.data
  }

  try {
    while (true) {
      const { done, value } = await reader.read()
      buffer += decoder.decode(value, { stream: !done })
      const blocks = buffer.split(/\r?\n\r?\n/)
      buffer = blocks.pop() ?? ""
      blocks.filter(Boolean).forEach(consume)
      if (done) break
    }
    if (buffer.trim()) consume(buffer)
  } finally {
    reader.releaseLock()
  }

  if (!result) throw new Error("Agent 活动流未返回最终结果")
  return result as ChatResult
}

function mergeThread(current: ThreadSummary[], next: ThreadSummary) {
  return [next, ...current.filter((thread) => thread.threadId !== next.threadId)].sort(
    (left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt)
  )
}

function automaticMemoryCount(candidates: MemoryCandidate[]) {
  return new Set(candidates.flatMap((candidate) => candidate.memoryId === null ? [] : [candidate.memoryId])).size
}

function friendlyActivityLabel(label: string) {
  const labels: Record<string, string> = {
    "健康 Agent 生成建议": "生成个性化建议",
    "整理饮食档案与对话上下文": "整理你的饮食记录",
    "校验点餐意图与一次性建单权限": "确认点餐请求",
    "读取麦当劳工具配置": "准备点餐服务",
    "保存 Agent 回复": "保存回答",
    "更新记忆使用状态": "更新记忆",
  }
  return labels[label] ?? label.replace(/\bAgent\b/g, "").replace(/\s{2,}/g, " ").trim()
}

export function AgentWorkspace({
  username,
  initialThreads,
  initialThread,
  exerciseMode = false,
  initialExercisePlanId = null,
  returnTo = "/exercise",
}: AgentWorkspaceProps) {
  const [threads, setThreads] = useState(initialThreads)
  const [activeThreadId, setActiveThreadId] = useState<number | null>(initialThread?.threadId ?? null)
  const [messages, setMessages] = useState<AgentMessage[]>(initialThread?.messages ?? [])
  const [exercisePlanId, setExercisePlanId] = useState<number | null>(initialExercisePlanId)
  const [draft, setDraft] = useState("")
  const [loadingThread, setLoadingThread] = useState(false)
  const [sending, setSending] = useState(false)
  const [deletingThreadId, setDeletingThreadId] = useState<number | null>(null)
  const [mobileHistoryOpen, setMobileHistoryOpen] = useState(false)
  // Ephemeral by design (ADR-0004): the payment link lives only in this
  // component state for the current reply and disappears on reload.
  const [lastOrder, setLastOrder] = useState<OrderResult | null>(null)
  const [turnActivity, setTurnActivity] = useState<AgentActivity[]>([])
  const [turnTrace, setTurnTrace] = useState<AgentTraceEvent[]>([])
  const [streamingAnswer, setStreamingAnswer] = useState("")
  const [turnError, setTurnError] = useState<string | null>(null)
  const messageViewportRef = useRef<HTMLDivElement>(null)
  const followViewportRef = useRef(true)

  const activeThread = useMemo(
    () => threads.find((thread) => thread.threadId === activeThreadId) ?? null,
    [activeThreadId, threads]
  )

  useEffect(() => {
    const viewport = messageViewportRef.current
    if (viewport && followViewportRef.current) viewport.scrollTop = viewport.scrollHeight
  }, [messages, sending, turnActivity, turnTrace, streamingAnswer, turnError])

  const handleViewportScroll = () => {
    const viewport = messageViewportRef.current
    if (!viewport) return
    followViewportRef.current = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 96
  }

  const openThread = async (threadId: number) => {
    if (threadId === activeThreadId || loadingThread || sending) return
    setLoadingThread(true)
    try {
      const thread = await requestJson<AgentThread>(`/api/agent/threads?id=${threadId}`)
      setActiveThreadId(thread.threadId)
      setMessages(thread.messages)
      setLastOrder(null)
      setTurnActivity([])
      setTurnTrace([])
      setStreamingAnswer("")
      setTurnError(null)
      setThreads((current) => mergeThread(current, thread))
      setMobileHistoryOpen(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "读取对话失败")
    } finally {
      setLoadingThread(false)
    }
  }

  const startNewThread = () => {
    if (sending) return
    setActiveThreadId(null)
    setMessages([])
    if (exerciseMode) setExercisePlanId(null)
    setDraft("")
    setLastOrder(null)
    setTurnActivity([])
    setTurnTrace([])
    setStreamingAnswer("")
    setTurnError(null)
    setMobileHistoryOpen(false)
  }

  const deleteThread = async (threadId: number) => {
    if (sending) return
    setDeletingThreadId(threadId)
    try {
      await requestJson<{ deleted: true }>(`/api/agent/threads?id=${threadId}`, { method: "DELETE" })
      setThreads((current) => current.filter((thread) => thread.threadId !== threadId))
      if (activeThreadId === threadId) startNewThread()
      toast.success("对话已删除")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除对话失败")
    } finally {
      setDeletingThreadId(null)
    }
  }

  const sendMessage = async () => {
    const message = draft.trim()
    if (!message || sending) return

    const optimisticMessage: AgentMessage = {
      messageId: -Date.now(),
      threadId: activeThreadId ?? -1,
      role: "user",
      content: message,
      createdAt: new Date().toISOString(),
      memoryCandidates: [],
      exercisePlanId: null,
    }
    followViewportRef.current = true
    setMessages((current) => [...current, optimisticMessage])
    setDraft("")
    setSending(true)
    setLastOrder(null)
    setTurnActivity([])
    setTurnTrace([])
    setStreamingAnswer("")
    setTurnError(null)
    try {
      const result = await streamAgentChat(
        activeThreadId,
        message,
        exerciseMode ? "exercise-plan" : "general",
        exercisePlanId,
        (activity) => setTurnActivity((current) => mergeActivity(current, activity)),
        (event) => setTurnTrace((current) => mergeTrace(current, event)),
        (delta) => setStreamingAnswer((current) => current + delta),
      )
      setActiveThreadId(result.thread.threadId)
      setMessages(result.thread.messages)
      setThreads((current) => mergeThread(current, result.thread))
      if (result.exercisePlan) setExercisePlanId(result.exercisePlan.planId)
      setLastOrder(result.orderResult ?? null)
      setTurnActivity(result.activity)
      setTurnTrace(result.trace ?? [])
      setStreamingAnswer("")
    } catch (error) {
      const messageText = error instanceof Error ? error.message : "Agent 对话失败"
      setDraft(message)
      setTurnError(messageText)
      toast.error(messageText)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-5">
      {exerciseMode ? (
        <section className="flex flex-wrap items-center justify-between gap-4 border border-[var(--brand-plum)]/15 bg-[var(--brand-paper)] px-4 py-3 sm:px-5" aria-label="运动计划调整模式">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-md bg-[var(--brand-mint-soft)] text-[var(--brand-mint-deep)]">
              <Dumbbell className="size-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[var(--brand-heading)]">正在和教练调整运动计划</p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {exercisePlanId ? "当前对话会在这份计划上继续调整" : "这次对话会生成一份新的训练计划"}
              </p>
            </div>
          </div>
          <Link
            href={returnTo}
            className="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold text-[var(--brand-plum)] underline-offset-4 hover:underline"
          >
            <ArrowLeft className="size-3.5" />返回计划页
          </Link>
        </section>
      ) : null}
      {mobileHistoryOpen ? (
        <button
          type="button"
          aria-label="关闭会话面板"
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setMobileHistoryOpen(false)}
        />
      ) : null}
      <section className="surface-card overflow-hidden border-0">
        <div className="grid grid-cols-[minmax(0,1fr)] lg:h-[680px] lg:grid-cols-[minmax(18rem,.72fr)_minmax(0,1.48fr)]">
          <aside className={cn(
            "order-2 min-h-0 flex-col overflow-hidden bg-[var(--brand-plum)] text-white lg:order-1 lg:flex lg:h-full",
            mobileHistoryOpen ? "fixed inset-y-0 left-0 z-50 flex w-[min(22rem,88vw)] shadow-2xl lg:static lg:z-auto lg:w-auto lg:shadow-none" : "hidden",
          )}>
            <div className="shrink-0 border-b border-white/10 p-3 sm:p-4">
              <div className="mb-2 flex items-center justify-between gap-3 px-1">
                <span className="flex items-center gap-2 text-xs font-semibold text-white/65">
                  <History className="size-3.5" />最近对话
                </span>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="text-white hover:bg-white/10 hover:text-white"
                    aria-label="新建对话"
                    title="新建对话"
                    onClick={startNewThread}
                  >
                    <MessageSquarePlus />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="text-white hover:bg-white/10 hover:text-white lg:hidden"
                    aria-label="关闭会话面板"
                    title="关闭会话面板"
                    onClick={() => setMobileHistoryOpen(false)}
                  >
                    <X />
                  </Button>
                </div>
              </div>
              {threads.length === 0 ? (
                <p className="px-1 py-3 text-xs text-white/45">还没有历史对话，从右侧开始第一次交流。</p>
              ) : (
                <div className="max-h-64 space-y-1 overflow-y-auto pb-1">
                  {threads.map((thread) => {
                    const active = thread.threadId === activeThreadId
                    const busy = deletingThreadId === thread.threadId
                    return (
                      <div
                        key={thread.threadId}
                        className={cn(
                          "flex min-w-0 items-center gap-1 rounded-md border border-white/8",
                          active ? "bg-card text-[var(--brand-heading)]" : "bg-white/5 text-white hover:bg-white/9"
                        )}
                      >
                        <button
                          type="button"
                          className="min-w-0 flex-1 px-3 py-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-mint)]"
                          onClick={() => void openThread(thread.threadId)}
                        >
                          <span className="block truncate text-sm font-medium">{thread.title}</span>
                          <span className={cn("mt-0.5 block text-[11px]", active ? "text-muted-foreground" : "text-white/48")}>
                            {formatThreadDate(thread.updatedAt)} · {thread.messageCount} 条
                          </span>
                        </button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          className={cn(active ? "text-muted-foreground" : "text-white/55 hover:bg-white/10 hover:text-white")}
                          aria-label={`删除 ${thread.title}`}
                          title="删除对话"
                          disabled={busy}
                          onClick={() => void deleteThread(thread.threadId)}
                        >
                          {busy ? <LoaderCircle className="animate-spin" /> : <Trash2 />}
                        </Button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="relative min-h-0 flex-1 lg:min-h-[430px]">
              <div className="absolute inset-0 hidden lg:block">
                <Image
                  src="/images/nutrition/movement-hero.png"
                  alt="在明亮健身房中拉伸的训练者"
                  fill
                  priority
                  sizes="34vw"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(45,39,53,.96)_0%,rgba(45,39,53,.14)_58%,transparent_100%)]" />
              </div>
              <div className="relative p-5 sm:p-7 lg:absolute lg:inset-x-0 lg:bottom-0">
                <p className="text-[11px] font-semibold uppercase text-[var(--brand-mint)]">Your AI coach</p>
                <h1 className="mt-2 break-words text-2xl font-semibold leading-tight sm:text-3xl">你好，{username}。</h1>
                <p className="mt-2 max-w-sm text-sm leading-6 text-white/72">
                  我会结合你的饮食档案、真实记录和长期记忆，陪你做出更轻松的下一步。
                </p>
              </div>
            </div>
          </aside>

          <div className="order-1 flex min-h-0 min-w-0 flex-col overflow-hidden bg-[var(--brand-paper)] lg:order-2 lg:h-full">
            <header className="flex items-center justify-between gap-4 border-b border-border/70 px-5 py-4 sm:px-7">
              <div className="min-w-0">
                <p className="page-eyebrow">Tonight&apos;s plan</p>
                <h2 className="mt-1 truncate text-xl font-semibold text-[var(--brand-heading)]">
                  {activeThread?.title ?? "今晚怎么吃，我陪你定。"}
                </h2>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  className="lg:hidden"
                  aria-label="打开会话面板"
                  title="打开会话面板"
                  onClick={() => setMobileHistoryOpen(true)}
                >
                  <PanelLeft />
                </Button>
                <div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
                  <span className="size-2 rounded-full bg-[var(--brand-mint)]" />
                  档案与记忆已接入
                </div>
              </div>
            </header>

            <div
              ref={messageViewportRef}
              onScroll={handleViewportScroll}
              className="min-h-0 space-y-5 px-4 py-5 sm:px-7 sm:py-7 lg:flex-1 lg:overflow-y-auto"
            >
              {messages.length === 0 ? (
                <div className="flex min-h-[25rem] flex-col justify-center">
                  <div className="grid size-11 place-items-center rounded-md bg-[var(--brand-plum)] text-[var(--brand-mint)]">
                    <Bot className="size-5" />
                  </div>
                  <h3 className="mt-5 max-w-xl text-3xl font-semibold leading-tight text-[var(--brand-heading)]">
                    先不用焦虑，今天还有调整空间。
                  </h3>
                  <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
                    告诉我今天吃过什么、接下来有什么安排，或者直接从一个具体问题开始。
                  </p>
                  <div className="mt-6 flex flex-wrap gap-2">
                    {starterPrompts.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        className="rounded-full border border-border bg-card px-3 py-2 text-xs font-medium text-[var(--brand-plum)] transition-colors hover:border-[var(--brand-mint)] hover:bg-[var(--brand-mint)]/10"
                        onClick={() => setDraft(prompt)}
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                messages.map((message) => (
                  <div key={message.messageId} className={cn("flex gap-3", message.role === "user" ? "justify-end" : "justify-start")}>
                    {message.role === "assistant" ? (
                      <div className="mt-1 grid size-8 shrink-0 place-items-center rounded-md bg-[var(--brand-plum)] text-[var(--brand-mint)]">
                        <Bot className="size-4" />
                      </div>
                    ) : null}
                    <div className="max-w-[min(43rem,88%)]">
                      <div
                        className={cn(
                          "break-words rounded-lg px-4 py-3 text-sm leading-6 shadow-sm",
                          message.role === "user"
                            ? "whitespace-pre-wrap bg-[var(--brand-lavender-soft)] text-[var(--brand-heading)]"
                            : "border border-border/70 bg-card text-foreground"
                        )}
                      >
                        {message.role === "assistant" ? (
                          <AssistantText content={message.content} />
                        ) : (
                          message.content
                        )}
                      </div>
                      <p className={cn("mt-1 text-[11px] text-muted-foreground", message.role === "user" ? "text-right" : "text-left")}>
                        {formatMessageTime(message.createdAt)}
                      </p>
                      {message.role === "assistant" && automaticMemoryCount(message.memoryCandidates) > 0 ? (
                        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 border-l-2 border-[var(--brand-coral)] bg-[var(--brand-coral-soft)] px-3 py-2 text-xs text-[#713b32] dark:text-[#ffb0a0]">
                          <Sparkles className="size-3.5" />
                          <span>已自动整理 {automaticMemoryCount(message.memoryCandidates)} 条长期记忆</span>
                          <Link className="font-semibold underline-offset-2 hover:underline" href="/settings/memory">查看与管理</Link>
                        </div>
                      ) : null}
                      {message.role === "assistant" && message.exercisePlanId !== null ? (
                        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 border-l-2 border-[var(--brand-mint)] bg-[var(--brand-mint-soft)] px-3 py-2 text-xs text-[var(--brand-heading)]">
                          <Dumbbell className="size-3.5 text-[var(--brand-mint-deep)]" />
                          <span>Agent 已核验更新运动计划</span>
                          <Link className="font-semibold underline-offset-2 hover:underline" href={returnTo}>返回计划页查看</Link>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
              <AgentTracePanel key={turnTrace[0]?.traceId ?? "empty"} events={turnTrace} active={sending} />
              {streamingAnswer ? (
                <div className="flex gap-3" data-testid="agent-streaming-answer">
                  <div className="mt-1 grid size-8 shrink-0 place-items-center rounded-md bg-[var(--brand-plum)] text-[var(--brand-mint)]">
                    <Bot className="size-4" />
                  </div>
                  <div className="max-w-[min(43rem,88%)]">
                    <div className="break-words rounded-lg border border-[var(--brand-mint)]/40 bg-card px-4 py-3 text-sm leading-6 text-foreground shadow-sm">
                      <AssistantText content={streamingAnswer} />
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">实时生成中</p>
                  </div>
                </div>
              ) : null}
              {turnError ? (
                <div role="alert" className="border-l-2 border-[var(--brand-coral)] bg-[var(--brand-coral-soft)] px-3 py-2 text-xs leading-5 text-[var(--brand-heading)]">
                  本回合没有完成：{turnError}。你的消息已保留在当前对话中。
                </div>
              ) : null}
              {lastOrder ? (
                <div className="rounded-lg border border-[var(--brand-mint)]/50 bg-card p-4 shadow-sm">
                  <p className="text-sm font-semibold text-[var(--brand-heading)]">
                    {lastOrder.orderId ? `未支付订单 ${lastOrder.orderId} 已创建` : "未支付订单已创建"}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    支付由你本人完成；支付链接只在本次回复中出现，不会保存到对话记录。
                  </p>
                  {lastOrder.paymentLink ? (
                    <a
                      href={lastOrder.paymentLink}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-flex items-center gap-2 rounded-md bg-[var(--brand-plum)] px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
                    >
                      <ExternalLink className="size-4" />
                      打开支付入口
                    </a>
                  ) : (
                    <p className="mt-3 text-xs text-muted-foreground">本次回复没有携带支付链接，请在麦当劳 App 内完成支付。</p>
                  )}
                </div>
              ) : null}
              {sending ? (
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <div className="grid size-8 place-items-center rounded-md bg-[var(--brand-plum)] text-[var(--brand-mint)]"><Bot className="size-4" /></div>
                  <LoaderCircle className="size-4 animate-spin" />正在{friendlyActivityLabel(getRunningActivityLabel(turnActivity))}…
                </div>
              ) : null}
            </div>

            <form className="border-t border-border/70 bg-card p-3 sm:p-4" onSubmit={(event) => { event.preventDefault(); void sendMessage() }}>
              <div className="flex items-end gap-2 rounded-md border bg-card p-2 focus-within:border-[var(--brand-mint)] focus-within:ring-2 focus-within:ring-[var(--brand-mint)]/20">
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault()
                      void sendMessage()
                    }
                  }}
                  disabled={sending || loadingThread}
                  maxLength={4_000}
                  rows={2}
                  placeholder="告诉我你现在最想解决什么"
                  className="min-h-12 min-w-0 flex-1 resize-none border-0 bg-transparent px-1 py-1.5 text-sm leading-6 outline-none placeholder:text-muted-foreground"
                />
                <Button type="submit" size="icon" aria-label="发送消息" title="发送消息" disabled={sending || loadingThread || !draft.trim()}>
                  {sending ? <LoaderCircle className="animate-spin" /> : <Send />}
                </Button>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
                <span>消息仅保存在本机</span>
                <span>{draft.length}/4,000</span>
              </div>
            </form>
          </div>
        </div>
      </section>
    </div>
  )
}
