"use client"

import { useMemo, useState } from "react"
import {
  Brain,
  LoaderCircle,
  PauseCircle,
  Pencil,
  PlayCircle,
  Save,
  Trash2,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { MemoryCategory, MemoryStatus } from "@/lib/memory/contracts"
import { cn } from "@/lib/utils"

export interface MemoryItemView {
  memoryId: number
  sourceMessageId: number | null
  category: MemoryCategory
  content: string
  sourceKind: string
  sourceRef: string | null
  confidence: number
  importance: number
  status: MemoryStatus
  isUserConfirmed: boolean
  userEditedAt: string | null
  lastUsedAt: string | null
  expiresAt: string | null
  createdAt: string
  updatedAt: string
}

interface MemorySettingsProps {
  initialMemories: MemoryItemView[]
  referenceNow: string
}

interface ApiEnvelope<T> {
  data: T | null
  error: string | null
}

const categories: Array<{ value: MemoryCategory; label: string }> = [
  { value: "preference", label: "偏好" },
  { value: "constraint", label: "约束" },
  { value: "goal", label: "目标" },
  { value: "habit", label: "习惯" },
  { value: "context", label: "情境" },
  { value: "insight", label: "洞察" },
]

const importanceOptions = [
  { value: "0.3", label: "低" },
  { value: "0.6", label: "中" },
  { value: "0.9", label: "高" },
]

const sourceLabels: Record<string, string> = {
  user: "用户添加",
  profile: "个人档案",
  meal_history: "饮食记录",
  agent_inference: "Agent 推断",
}

function todayLocal() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const day = String(now.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function expiryPayload(value: string) {
  return value ? new Date(`${value}T23:59:59`).toISOString() : null
}

function dateInputValue(value: string | null) {
  return value ? value.slice(0, 10) : ""
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "short", day: "numeric" }).format(new Date(value))
}

function categoryLabel(value: MemoryCategory) {
  return categories.find((item) => item.value === value)?.label ?? value
}

function importanceLabel(value: number) {
  if (value >= 0.8) return "高"
  if (value >= 0.5) return "中"
  return "低"
}

function importanceOptionValue(value: number) {
  if (value >= 0.8) return "0.9"
  if (value >= 0.5) return "0.6"
  return "0.3"
}

function sortMemories(items: MemoryItemView[]) {
  return [...items].sort((left, right) => {
    if (left.status !== right.status) return left.status === "active" ? -1 : 1
    if (left.isUserConfirmed !== right.isUserConfirmed) return left.isUserConfirmed ? -1 : 1
    if (left.importance !== right.importance) return right.importance - left.importance
    return Date.parse(right.updatedAt) - Date.parse(left.updatedAt)
  })
}

async function memoryRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init)
  const payload = (await response.json()) as ApiEnvelope<T>
  if (!response.ok || payload.data === null) throw new Error(payload.error || "长期记忆操作失败")
  return payload.data
}

export function MemorySettings({ initialMemories, referenceNow }: MemorySettingsProps) {
  const [memories, setMemories] = useState(() => sortMemories(initialMemories))
  const [filter, setFilter] = useState<"all" | MemoryStatus>("all")
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editContent, setEditContent] = useState("")
  const [editCategory, setEditCategory] = useState<MemoryCategory>("preference")
  const [editImportance, setEditImportance] = useState("0.6")
  const [editExpiresAt, setEditExpiresAt] = useState("")
  const [savingId, setSavingId] = useState<number | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null)

  const visibleMemories = useMemo(
    () => memories.filter((memory) => filter === "all" || memory.status === filter),
    [filter, memories]
  )
  const referenceTimestamp = Date.parse(referenceNow)
  const enabledCount = memories.filter(
    (memory) => memory.status === "active" && (!memory.expiresAt || Date.parse(memory.expiresAt) > referenceTimestamp)
  ).length

  const replaceMemory = (memory: MemoryItemView) => {
    setMemories((current) => sortMemories(current.map((item) => item.memoryId === memory.memoryId ? memory : item)))
  }

  const updateMemory = async (memoryId: number, body: Record<string, unknown>) => {
    setSavingId(memoryId)
    try {
      const updated = await memoryRequest<MemoryItemView>("/api/memories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memoryId, ...body }),
      })
      replaceMemory(updated)
      return updated
    } finally {
      setSavingId(null)
    }
  }

  const beginEdit = (memory: MemoryItemView) => {
    setEditingId(memory.memoryId)
    setEditContent(memory.content)
    setEditCategory(memory.category)
    setEditImportance(importanceOptionValue(memory.importance))
    setEditExpiresAt(dateInputValue(memory.expiresAt))
    setPendingDeleteId(null)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditContent("")
  }

  const saveEdit = async (memoryId: number) => {
    if (!editContent.trim()) {
      toast.error("记忆内容不能为空")
      return
    }
    try {
      await updateMemory(memoryId, {
        category: editCategory,
        content: editContent.trim(),
        importance: Number(editImportance),
        expiresAt: expiryPayload(editExpiresAt),
      })
      cancelEdit()
      toast.success("长期记忆已修正")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "更新长期记忆失败")
    }
  }

  const toggleStatus = async (memory: MemoryItemView) => {
    try {
      const updated = await updateMemory(memory.memoryId, { status: memory.status === "active" ? "disabled" : "active" })
      toast.success(updated.status === "active" ? "记忆已恢复" : "记忆已停用")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "更新长期记忆失败")
    }
  }

  const deleteMemory = async (memoryId: number) => {
    setSavingId(memoryId)
    try {
      await memoryRequest<{ deleted: true }>(`/api/memories?id=${memoryId}`, { method: "DELETE" })
      setMemories((current) => current.filter((memory) => memory.memoryId !== memoryId))
      setPendingDeleteId(null)
      toast.success("长期记忆已删除")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "删除长期记忆失败")
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-lg bg-[var(--brand-plum)] p-6 text-white sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-[11px] font-semibold uppercase text-[var(--brand-mint)]">What I remember</p>
            <h1 className="mt-2 text-3xl font-semibold sm:text-4xl">我正在更懂你的生活。</h1>
            <p className="mt-2 text-sm leading-6 text-white/62">Agent 会在后台整理稳定信息；启用且未过期的记忆会参与后续建议。</p>
          </div>
          <div className="text-right">
            <strong className="text-5xl font-semibold">{enabledCount}</strong>
            <p className="mt-1 text-xs text-white/55">条启用的长期记忆</p>
          </div>
        </div>
      </section>

      <section className="surface-card p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 pb-4">
            <div>
              <p className="page-eyebrow">Memory library</p>
              <h2 className="mt-1 text-xl font-semibold text-[var(--brand-heading)]">你的长期记忆</h2>
            </div>
            <div className="inline-flex rounded-md border bg-[var(--brand-paper)] p-0.5">
              {([ ["all", "全部"], ["active", "启用"], ["disabled", "停用"] ] as const).map(([value, label]) => (
                <Button
                  key={value}
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={cn("h-7 px-2", filter === value && "bg-card text-[var(--brand-mint-deep)] shadow-sm hover:bg-card")}
                  aria-pressed={filter === value}
                  onClick={() => setFilter(value)}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>

          {visibleMemories.length === 0 ? (
            <div className="grid min-h-56 place-items-center text-center">
              <div>
                <Brain className="mx-auto size-8 text-[var(--brand-lavender)]" />
                <p className="mt-3 text-sm text-muted-foreground">当前筛选下还没有长期记忆</p>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-border/80">
              {visibleMemories.map((memory) => {
                const expired = Boolean(memory.expiresAt && Date.parse(memory.expiresAt) <= referenceTimestamp)
                const busy = savingId === memory.memoryId

                return (
                  <article key={memory.memoryId} className={cn("py-5", memory.status === "disabled" && "opacity-55")}>
                    {editingId === memory.memoryId ? (
                      <div className="space-y-3 rounded-md bg-[var(--brand-paper)] p-4">
                        <Input value={editContent} onChange={(event) => setEditContent(event.target.value)} maxLength={1_000} />
                        <div className="grid gap-3 sm:grid-cols-3">
                          <div className="space-y-2">
                            <Label htmlFor={`edit-category-${memory.memoryId}`}>分类</Label>
                            <Select value={editCategory} onValueChange={(value) => value && setEditCategory(value as MemoryCategory)}>
                              <SelectTrigger id={`edit-category-${memory.memoryId}`} type="button" className="w-full bg-card"><SelectValue>{categoryLabel(editCategory)}</SelectValue></SelectTrigger>
                              <SelectContent>{categories.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`edit-importance-${memory.memoryId}`}>重要度</Label>
                            <Select value={editImportance} onValueChange={(value) => value && setEditImportance(value)}>
                              <SelectTrigger id={`edit-importance-${memory.memoryId}`} type="button" className="w-full bg-card"><SelectValue>{importanceOptions.find((item) => item.value === editImportance)?.label}</SelectValue></SelectTrigger>
                              <SelectContent>{importanceOptions.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`edit-expiry-${memory.memoryId}`}>有效期</Label>
                            <Input id={`edit-expiry-${memory.memoryId}`} className="bg-card" type="date" min={todayLocal()} value={editExpiresAt} onChange={(event) => setEditExpiresAt(event.target.value)} />
                          </div>
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button type="button" variant="outline" size="sm" onClick={cancelEdit}><X />取消</Button>
                          <Button type="button" size="sm" disabled={busy} onClick={() => saveEdit(memory.memoryId)}>
                            {busy ? <LoaderCircle className="animate-spin" /> : <Save />}保存
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="rounded-full bg-[var(--brand-lavender-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--brand-lavender-deep)]">{categoryLabel(memory.category)}</span>
                              <span className="text-[10px] font-semibold text-[var(--brand-mint-deep)]">
                                {memory.sourceKind === "agent_inference"
                                  ? memory.isUserConfirmed ? "已由你修正" : "Agent 整理"
                                  : sourceLabels[memory.sourceKind] ?? memory.sourceKind}
                              </span>
                              {memory.status === "disabled" ? <span className="text-[10px] text-muted-foreground">已停用</span> : null}
                              {expired ? <span className="text-[10px] text-[var(--brand-coral-ink)]">已过期</span> : null}
                            </div>
                            <p className="mt-2 break-words text-sm font-medium leading-6 text-[var(--brand-heading)]">{memory.content}</p>
                            <p className="mt-2 text-[11px] text-muted-foreground">
                              {sourceLabels[memory.sourceKind] ?? memory.sourceKind} · 重要度 {importanceLabel(memory.importance)}
                              {memory.expiresAt ? ` · 有效至 ${formatDate(memory.expiresAt)}` : " · 长期有效"}
                            </p>
                          </div>
                          <div className="flex shrink-0 gap-1">
                            <Button type="button" variant="ghost" size="icon-sm" aria-label="编辑记忆" title="编辑记忆" disabled={busy} onClick={() => beginEdit(memory)}><Pencil /></Button>
                            <Button type="button" variant="ghost" size="icon-sm" aria-label={memory.status === "active" ? "停用记忆" : "恢复记忆"} title={memory.status === "active" ? "停用记忆" : "恢复记忆"} disabled={busy} onClick={() => toggleStatus(memory)}>
                              {memory.status === "active" ? <PauseCircle /> : <PlayCircle />}
                            </Button>
                            <Button type="button" variant="ghost" size="icon-sm" aria-label="删除记忆" title="删除记忆" disabled={busy} onClick={() => setPendingDeleteId(memory.memoryId)}><Trash2 /></Button>
                          </div>
                        </div>
                      </div>
                    )}

                    {pendingDeleteId === memory.memoryId ? (
                      <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t pt-3 text-sm">
                        <span className="mr-auto text-muted-foreground">永久删除这条记忆？</span>
                        <Button type="button" variant="ghost" size="sm" onClick={() => setPendingDeleteId(null)}>取消</Button>
                        <Button type="button" variant="destructive" size="sm" disabled={busy} onClick={() => deleteMemory(memory.memoryId)}>
                          {busy ? <LoaderCircle className="animate-spin" /> : <Trash2 />}删除
                        </Button>
                      </div>
                    ) : null}
                  </article>
                )
              })}
            </div>
          )}
      </section>
    </div>
  )
}
