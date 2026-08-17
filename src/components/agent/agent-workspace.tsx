"use client"

import Image from "next/image"
import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import {
  Bot,
  History,
  LoaderCircle,
  MessageSquarePlus,
  Send,
  Sparkles,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { AssistantText } from "@/components/agent/assistant-text"
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
  memoryId: number | null
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

function mergeThread(current: ThreadSummary[], next: ThreadSummary) {
  return [next, ...current.filter((thread) => thread.threadId !== next.threadId)].sort(
    (left, right) => Date.parse(right.updatedAt) - Date.parse(left.updatedAt)
  )
}

function automaticMemoryCount(candidates: MemoryCandidate[]) {
  return new Set(candidates.flatMap((candidate) => candidate.memoryId === null ? [] : [candidate.memoryId])).size
}

export function AgentWorkspace({ username, initialThreads, initialThread }: AgentWorkspaceProps) {
  const [threads, setThreads] = useState(initialThreads)
  const [activeThreadId, setActiveThreadId] = useState<number | null>(initialThread?.threadId ?? null)
  const [messages, setMessages] = useState<AgentMessage[]>(initialThread?.messages ?? [])
  const [draft, setDraft] = useState("")
  const [loadingThread, setLoadingThread] = useState(false)
  const [sending, setSending] = useState(false)
  const [deletingThreadId, setDeletingThreadId] = useState<number | null>(null)
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

  return (
    <div className="space-y-5">
      <section className="surface-card overflow-hidden border-0">
        <div className="grid min-h-[680px] lg:grid-cols-[minmax(18rem,.72fr)_minmax(0,1.48fr)]">
          <aside className="flex min-h-0 flex-col bg-[var(--brand-plum)] text-white">
            <div className="relative min-h-64 flex-1 lg:min-h-[430px]">
              <Image
                src="/images/nutrition/movement-hero.png"
                alt="在明亮健身房中拉伸的训练者"
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 34vw"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(45,39,53,.96)_0%,rgba(45,39,53,.14)_58%,transparent_100%)]" />
              <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7">
                <p className="text-[11px] font-semibold uppercase text-[var(--brand-mint)]">Your AI coach</p>
                <h1 className="mt-2 break-words text-2xl font-semibold leading-tight sm:text-3xl">你好，{username}。</h1>
                <p className="mt-2 max-w-sm text-sm leading-6 text-white/72">
                  我会结合你的饮食档案、真实记录和长期记忆，陪你做出更轻松的下一步。
                </p>
              </div>
            </div>

            <div className="border-t border-white/10 p-3 sm:p-4">
              <div className="mb-2 flex items-center justify-between gap-3 px-1">
                <span className="flex items-center gap-2 text-xs font-semibold text-white/65">
                  <History className="size-3.5" />最近对话
                </span>
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
              </div>
              {threads.length === 0 ? (
                <p className="px-1 py-3 text-xs text-white/45">还没有历史对话，从右侧开始第一次交流。</p>
              ) : (
                <div className="flex gap-2 overflow-x-auto pb-1 lg:block lg:max-h-44 lg:space-y-1 lg:overflow-y-auto">
                  {threads.map((thread) => {
                    const active = thread.threadId === activeThreadId
                    const busy = deletingThreadId === thread.threadId
                    return (
                      <div
                        key={thread.threadId}
                        className={cn(
                          "flex min-w-56 items-center gap-1 rounded-md border border-white/8 lg:min-w-0",
                          active ? "bg-white text-[var(--brand-plum)]" : "bg-white/5 text-white hover:bg-white/9"
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
          </aside>

          <div className="flex min-h-[620px] min-w-0 flex-col bg-[var(--brand-paper)]">
            <header className="flex items-center justify-between gap-4 border-b border-border/70 px-5 py-4 sm:px-7">
              <div className="min-w-0">
                <p className="page-eyebrow">Tonight&apos;s plan</p>
                <h2 className="mt-1 truncate text-xl font-semibold text-[var(--brand-plum)]">
                  {activeThread?.title ?? "今晚怎么吃，我陪你定。"}
                </h2>
              </div>
              <div className="hidden shrink-0 items-center gap-2 text-xs text-muted-foreground sm:flex">
                <span className="size-2 rounded-full bg-[var(--brand-mint)]" />
                档案与记忆已接入
              </div>
            </header>

            <div ref={messageViewportRef} className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 py-5 sm:px-7 sm:py-7">
              {messages.length === 0 ? (
                <div className="flex min-h-[25rem] flex-col justify-center">
                  <div className="grid size-11 place-items-center rounded-md bg-[var(--brand-plum)] text-[var(--brand-mint)]">
                    <Bot className="size-5" />
                  </div>
                  <h3 className="mt-5 max-w-xl text-3xl font-semibold leading-tight text-[var(--brand-plum)]">
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
                        className="rounded-full border border-border bg-white px-3 py-2 text-xs font-medium text-[var(--brand-plum)] transition-colors hover:border-[var(--brand-mint)] hover:bg-[var(--brand-mint)]/10"
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
                            ? "whitespace-pre-wrap bg-[var(--brand-lavender-soft)] text-[var(--brand-plum)]"
                            : "border border-border/70 bg-white text-foreground"
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
                        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 border-l-2 border-[var(--brand-coral)] bg-[#fff2ee] px-3 py-2 text-xs text-[#713b32]">
                          <Sparkles className="size-3.5" />
                          <span>已自动整理 {automaticMemoryCount(message.memoryCandidates)} 条长期记忆</span>
                          <Link className="font-semibold underline-offset-2 hover:underline" href="/settings/memory">查看与管理</Link>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ))
              )}
              {sending ? (
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <div className="grid size-8 place-items-center rounded-md bg-[var(--brand-plum)] text-[var(--brand-mint)]"><Bot className="size-4" /></div>
                  <LoaderCircle className="size-4 animate-spin" />正在整理你的饮食上下文…
                </div>
              ) : null}
            </div>

            <form className="border-t border-border/70 bg-white p-3 sm:p-4" onSubmit={(event) => { event.preventDefault(); void sendMessage() }}>
              <div className="flex items-end gap-2 rounded-md border bg-white p-2 focus-within:border-[var(--brand-mint)] focus-within:ring-2 focus-within:ring-[var(--brand-mint)]/20">
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

      <TakeoutToolsPanel />
    </div>
  )
}
