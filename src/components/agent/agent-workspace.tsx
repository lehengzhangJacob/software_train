"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  Bot,
  Check,
  CheckCircle2,
  LoaderCircle,
  MessageSquarePlus,
  Send,
  Sparkles,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import { TakeoutToolsPanel } from "@/components/agent/takeout-tools-panel"

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
  confirmedMemoryId: number | null
}

interface AgentMessage {
  messageId: number
  threadId: number
  role: "user" | "assistant"
  content: string
  createdAt: string
  memoryCandidates: MemoryCandidate[]
}

interface AgentThread extends ThreadSummary {
  messages: AgentMessage[]
}

interface AgentWorkspaceProps {
  username: string
  initialThreads: ThreadSummary[]
  initialThread: AgentThread | null
}

interface ApiEnvelope<T> {
  data: T | null
  error: string | null
}

interface ChatResult {
  thread: AgentThread
  userMessage: AgentMessage
  assistantMessage: AgentMessage
}

const categoryLabels: Record<string, string> = {
  preference: "偏好",
  constraint: "约束",
  goal: "目标",
  habit: "习惯",
  context: "情境",
  insight: "洞察",
}

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

function mergeThread(current: ThreadSummary[], next: ThreadSummary) {
  return [next, ...current.filter((thread) => thread.threadId !== next.threadId)].sort(
    (left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt)
  )
}

export function AgentWorkspace({ username, initialThreads, initialThread }: AgentWorkspaceProps) {
  const [threads, setThreads] = useState(initialThreads)
  const [activeThreadId, setActiveThreadId] = useState<number | null>(initialThread?.threadId ?? null)
  const [messages, setMessages] = useState<AgentMessage[]>(initialThread?.messages ?? [])
  const [draft, setDraft] = useState("")
  const [loadingThread, setLoadingThread] = useState(false)
  const [sending, setSending] = useState(false)
  const [deletingThreadId, setDeletingThreadId] = useState<number | null>(null)
  const [confirmingCandidate, setConfirmingCandidate] = useState<string | null>(null)
  const messageViewportRef = useRef<HTMLDivElement>(null)

  const activeThread = useMemo(
    () => threads.find((thread) => thread.threadId === activeThreadId) ?? null,
    [activeThreadId, threads]
  )

  useEffect(() => {
    const viewport = messageViewportRef.current
    if (viewport) viewport.scrollTop = viewport.scrollHeight
  }, [messages, sending])

  const openThread = async (threadId: number) => {
    if (threadId === activeThreadId || loadingThread) return
    setLoadingThread(true)
    try {
      const thread = await requestJson<AgentThread>(`/api/agent/threads?id=${threadId}`)
      setActiveThreadId(thread.threadId)
      setMessages(thread.messages)
      setThreads((current) => mergeThread(current, thread))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "读取对话失败")
    } finally {
      setLoadingThread(false)
    }
  }

  const startNewThread = () => {
    setActiveThreadId(null)
    setMessages([])
    setDraft("")
  }

  const deleteThread = async (threadId: number) => {
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

    setSending(true)
    try {
      const result = await requestJson<ChatResult>("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ threadId: activeThreadId, message }),
      })
      setActiveThreadId(result.thread.threadId)
      setMessages(result.thread.messages)
      setThreads((current) => mergeThread(current, result.thread))
      setDraft("")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Agent 对话失败")
    } finally {
      setSending(false)
    }
  }

  const confirmCandidate = async (messageId: number, candidateIndex: number) => {
    const requestKey = `${messageId}:${candidateIndex}`
    setConfirmingCandidate(requestKey)
    try {
      await requestJson("/api/agent/memory-candidates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId, candidateIndex }),
      })
      setMessages((current) => current.map((message) => {
        if (message.messageId !== messageId) return message
        return {
          ...message,
          memoryCandidates: message.memoryCandidates.map((candidate, index) =>
            index === candidateIndex ? { ...candidate, confirmedMemoryId: candidate.confirmedMemoryId ?? -1 } : candidate
          ),
        }
      }))
      toast.success("已写入长期记忆")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "确认记忆候选失败")
    } finally {
      setConfirmingCandidate(null)
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-emerald-700">你好，{username}</p>
          <h1 className="mt-1 text-2xl font-semibold text-neutral-900">营养 Agent</h1>
          <p className="mt-1 text-sm text-neutral-500">把今天的饮食、目标和困扰放在同一个对话里。</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-neutral-500">
          <Sparkles className="size-3.5 text-emerald-700" />
          <span>本机档案与启用记忆已接入</span>
        </div>
      </div>

      <div className="grid min-h-[calc(100vh-12rem)] gap-4 lg:grid-cols-[17rem_minmax(0,1fr)]">
        <Card className="min-h-0">
          <CardHeader className="flex flex-row items-center justify-between gap-2 border-b">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Bot className="size-4 text-emerald-700" />
              对话
            </CardTitle>
            <Button type="button" variant="outline" size="icon-sm" aria-label="新建对话" title="新建对话" onClick={startNewThread}>
              <MessageSquarePlus />
            </Button>
          </CardHeader>
          <CardContent className="p-2">
            {threads.length === 0 ? (
              <p className="px-2 py-6 text-center text-xs text-neutral-500">还没有历史对话</p>
            ) : (
              <div className="space-y-1">
                {threads.map((thread) => {
                  const active = thread.threadId === activeThreadId
                  const busy = deletingThreadId === thread.threadId
                  return (
                    <div key={thread.threadId} className={cn("flex items-center gap-1 rounded-md", active && "bg-emerald-50")}>
                      <button
                        type="button"
                        className={cn("min-w-0 flex-1 px-2.5 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500", active ? "text-emerald-900" : "text-neutral-700 hover:bg-neutral-50")}
                        onClick={() => void openThread(thread.threadId)}
                      >
                        <span className="block truncate text-sm font-medium">{thread.title}</span>
                        <span className="mt-0.5 block text-xs text-neutral-500">{formatThreadDate(thread.updatedAt)} · {thread.messageCount} 条消息</span>
                      </button>
                      <Button type="button" variant="ghost" size="icon-xs" aria-label={`删除 ${thread.title}`} title="删除对话" disabled={busy} onClick={() => void deleteThread(thread.threadId)}>
                        {busy ? <LoaderCircle className="animate-spin" /> : <Trash2 />}
                      </Button>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="min-h-0 overflow-hidden">
          <CardHeader className="border-b">
            <CardTitle className="flex items-center gap-2 text-sm">
              <span className="size-2 rounded-full bg-emerald-500" />
              {activeThread?.title ?? "新对话"}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex min-h-[32rem] flex-col p-0">
            <div ref={messageViewportRef} className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 sm:p-6">
              {messages.length === 0 ? (
                <div className="flex min-h-[24rem] flex-col items-center justify-center px-4 text-center">
                  <div className="flex size-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                    <Bot className="size-6" />
                  </div>
                  <h2 className="mt-4 text-lg font-semibold text-neutral-900">今天想先聊哪一餐？</h2>
                  <p className="mt-2 max-w-md text-sm leading-6 text-neutral-500">可以问我怎么调整今天的摄入、如何安排下一餐，或者直接告诉我你刚刚吃了什么。</p>
                </div>
              ) : (
                messages.map((message) => (
                  <div key={message.messageId} className={cn("flex gap-3", message.role === "user" ? "justify-end" : "justify-start")}>
                    {message.role === "assistant" ? (
                      <div className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700"><Bot className="size-4" /></div>
                    ) : null}
                    <div className={cn("max-w-[min(42rem,88%)]", message.role === "user" ? "items-end" : "items-start")}>
                      <div className={cn("whitespace-pre-wrap break-words rounded-xl px-3.5 py-3 text-sm leading-6", message.role === "user" ? "bg-emerald-700 text-white" : "bg-neutral-100 text-neutral-800")}>
                        {message.content}
                      </div>
                      <p className={cn("mt-1 text-[11px] text-neutral-400", message.role === "user" ? "text-right" : "text-left")}>{formatMessageTime(message.createdAt)}</p>
                      {message.role === "assistant" && message.memoryCandidates.length > 0 ? (
                        <div className="mt-3 space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                          <div className="flex items-center gap-2 text-xs font-medium text-amber-900"><Sparkles className="size-3.5" />可能值得记住</div>
                          {message.memoryCandidates.map((candidate, index) => {
                            const key = `${message.messageId}:${index}`
                            const confirmed = candidate.confirmedMemoryId !== null
                            return (
                              <div key={key} className="flex items-start gap-2 rounded-md bg-white/70 p-2 text-xs text-amber-950">
                                <div className="min-w-0 flex-1">
                                  <span className="mr-1 rounded bg-amber-100 px-1.5 py-0.5 font-medium">{categoryLabels[candidate.category] ?? candidate.category}</span>
                                  <span className="break-words">{candidate.content}</span>
                                </div>
                                <Button type="button" variant={confirmed ? "ghost" : "outline"} size="xs" disabled={confirmed || confirmingCandidate === key} onClick={() => void confirmCandidate(message.messageId, index)}>
                                  {confirmingCandidate === key ? <LoaderCircle className="animate-spin" /> : confirmed ? <CheckCircle2 /> : <Check />}
                                  {confirmed ? "已记住" : "确认"}
                                </Button>
                              </div>
                            )
                          })}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
              {sending ? (
                <div className="flex items-center gap-3 text-sm text-neutral-500"><div className="flex size-7 items-center justify-center rounded-full bg-emerald-50 text-emerald-700"><Bot className="size-4" /></div><LoaderCircle className="size-4 animate-spin" />正在整理你的饮食上下文…</div>
              ) : null}
            </div>
            <form className="border-t bg-neutral-50/60 p-3 sm:p-4" onSubmit={(event) => { event.preventDefault(); void sendMessage() }}>
              <div className="flex items-end gap-2 rounded-lg border bg-white p-2 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20">
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
                  placeholder="例如：我今天晚餐怎么吃更合适？"
                  className="min-h-12 min-w-0 flex-1 resize-none border-0 bg-transparent px-1 py-1.5 text-sm leading-6 outline-none placeholder:text-neutral-400"
                />
                <Button type="submit" size="icon" aria-label="发送消息" title="发送消息" disabled={sending || loadingThread || !draft.trim()}>
                  {sending ? <LoaderCircle className="animate-spin" /> : <Send />}
                </Button>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3 text-[11px] text-neutral-400">
                <span>消息保存在本机对话记录中</span>
                <span>{draft.length}/4,000</span>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
      <TakeoutToolsPanel />
    </div>
  )
}
