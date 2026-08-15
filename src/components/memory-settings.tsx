"use client"

import { useMemo, useState } from "react"
import {
  Brain,
  Check,
  LoaderCircle,
  PauseCircle,
  Pencil,
  PlayCircle,
  Plus,
  Save,
  Sparkles,
  Trash2,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
  const [content, setContent] = useState("")
  const [category, setCategory] = useState<MemoryCategory>("preference")
  const [importance, setImportance] = useState("0.6")
  const [expiresAt, setExpiresAt] = useState("")
  const [creating, setCreating] = useState(false)
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

  const createMemory = async () => {
    if (!content.trim()) {
      toast.error("请填写记忆内容")
      return
    }

    setCreating(true)
    try {
      const created = await memoryRequest<MemoryItemView>("/api/memories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          content: content.trim(),
          importance: Number(importance),
          expiresAt: expiryPayload(expiresAt),
        }),
      })
      setMemories((current) => sortMemories([created, ...current]))
      setContent("")
      setCategory("preference")
      setImportance("0.6")
      setExpiresAt("")
      toast.success("长期记忆已添加")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "添加长期记忆失败")
    } finally {
      setCreating(false)
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
    setSavingId(memoryId)
    try {
      const updated = await memoryRequest<MemoryItemView>("/api/memories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memoryId,
          category: editCategory,
          content: editContent.trim(),
          importance: Number(editImportance),
          expiresAt: expiryPayload(editExpiresAt),
        }),
      })
      replaceMemory(updated)
      cancelEdit()
      toast.success("长期记忆已修正")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "更新长期记忆失败")
    } finally {
      setSavingId(null)
    }
  }

  const toggleStatus = async (memory: MemoryItemView) => {
    setSavingId(memory.memoryId)
    try {
      const updated = await memoryRequest<MemoryItemView>("/api/memories", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          memoryId: memory.memoryId,
          status: memory.status === "active" ? "disabled" : "active",
        }),
      })
      replaceMemory(updated)
      toast.success(updated.status === "active" ? "记忆已恢复" : "记忆已停用")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "更新长期记忆失败")
    } finally {
      setSavingId(null)
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
    <Card>
      <CardHeader className="gap-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Brain className="size-4 text-emerald-700" />
              长期记忆
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">启用的记忆会参与后续 Agent 建议</p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
            <Sparkles className="size-3.5 text-emerald-700" />
            <span>{enabledCount} 条启用</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-3 rounded-md border bg-neutral-50 p-3">
          <div className="space-y-2">
            <Label htmlFor="new-memory">新增记忆</Label>
            <Input
              id="new-memory"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder="例如：工作日晚餐希望清淡一些"
              maxLength={1_000}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem_10rem_auto] sm:items-end">
            <div className="space-y-2">
              <Label htmlFor="new-memory-category">分类</Label>
              <Select value={category} onValueChange={(value) => value && setCategory(value as MemoryCategory)}>
                <SelectTrigger id="new-memory-category" type="button" className="w-full"><SelectValue>{categoryLabel(category)}</SelectValue></SelectTrigger>
                <SelectContent>
                  {categories.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-memory-importance">重要度</Label>
              <Select value={importance} onValueChange={(value) => value && setImportance(value)}>
                <SelectTrigger id="new-memory-importance" type="button" className="w-full"><SelectValue>{importanceOptions.find((item) => item.value === importance)?.label}</SelectValue></SelectTrigger>
                <SelectContent>
                  {importanceOptions.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-memory-expiry">有效期（可选）</Label>
              <Input id="new-memory-expiry" type="date" min={todayLocal()} value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} />
            </div>
            <Button type="button" disabled={creating} onClick={createMemory}>
              {creating ? <LoaderCircle className="animate-spin" /> : <Plus />}
              添加
            </Button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium">记忆列表</p>
          <div className="inline-flex rounded-md border bg-background p-0.5">
            {([
              ["all", "全部"],
              ["active", "启用"],
              ["disabled", "停用"],
            ] as const).map(([value, label]) => (
              <Button
                key={value}
                type="button"
                variant="ghost"
                size="sm"
                className={cn("h-7 px-2", filter === value && "bg-emerald-50 text-emerald-800 hover:bg-emerald-50")}
                aria-pressed={filter === value}
                onClick={() => setFilter(value)}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>

        {visibleMemories.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">当前筛选下还没有长期记忆</div>
        ) : (
          <div className="divide-y">
            {visibleMemories.map((memory) => {
              const expired = Boolean(memory.expiresAt && Date.parse(memory.expiresAt) <= referenceTimestamp)
              const busy = savingId === memory.memoryId

              return (
                <div key={memory.memoryId} className={cn("py-4 first:pt-0 last:pb-0", memory.status === "disabled" && "opacity-60")}>
                  {editingId === memory.memoryId ? (
                    <div className="space-y-3">
                      <Input value={editContent} onChange={(event) => setEditContent(event.target.value)} maxLength={1_000} />
                      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem_10rem_auto] sm:items-end">
                        <div className="space-y-2">
                          <Label htmlFor={`edit-category-${memory.memoryId}`}>分类</Label>
                          <Select value={editCategory} onValueChange={(value) => value && setEditCategory(value as MemoryCategory)}>
                            <SelectTrigger id={`edit-category-${memory.memoryId}`} type="button" className="w-full"><SelectValue>{categoryLabel(editCategory)}</SelectValue></SelectTrigger>
                            <SelectContent>
                              {categories.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`edit-importance-${memory.memoryId}`}>重要度</Label>
                          <Select value={editImportance} onValueChange={(value) => value && setEditImportance(value)}>
                            <SelectTrigger id={`edit-importance-${memory.memoryId}`} type="button" className="w-full"><SelectValue>{importanceOptions.find((item) => item.value === editImportance)?.label}</SelectValue></SelectTrigger>
                            <SelectContent>
                              {importanceOptions.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`edit-expiry-${memory.memoryId}`}>有效期</Label>
                          <Input id={`edit-expiry-${memory.memoryId}`} type="date" min={todayLocal()} value={editExpiresAt} onChange={(event) => setEditExpiresAt(event.target.value)} />
                        </div>
                        <div className="flex gap-2 sm:justify-end">
                          <Button type="button" variant="outline" size="icon" aria-label="取消编辑" title="取消编辑" onClick={cancelEdit}><X /></Button>
                          <Button type="button" size="icon" aria-label="保存记忆" title="保存记忆" disabled={busy} onClick={() => saveEdit(memory.memoryId)}>
                            {busy ? <LoaderCircle className="animate-spin" /> : <Save />}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800">{categoryLabel(memory.category)}</span>
                          {memory.isUserConfirmed ? (
                            <span className="inline-flex items-center gap-1 text-xs text-emerald-700"><Check className="size-3" />用户确认</span>
                          ) : (
                            <span className="text-xs text-amber-700">待确认推断</span>
                          )}
                          {memory.status === "disabled" ? <span className="text-xs text-muted-foreground">已停用</span> : null}
                          {expired ? <span className="text-xs text-amber-700">已过期</span> : null}
                        </div>
                        <p className="break-words text-sm text-neutral-900">{memory.content}</p>
                        <p className="text-xs text-muted-foreground">
                          {sourceLabels[memory.sourceKind] ?? memory.sourceKind} · 重要度 {importanceLabel(memory.importance)}
                          {memory.expiresAt ? ` · 有效至 ${formatDate(memory.expiresAt)}` : " · 长期有效"}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <Button type="button" variant="ghost" size="icon-sm" aria-label="编辑记忆" title="编辑记忆" disabled={busy} onClick={() => beginEdit(memory)}><Pencil /></Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={memory.status === "active" ? "停用记忆" : "恢复记忆"}
                          title={memory.status === "active" ? "停用记忆" : "恢复记忆"}
                          disabled={busy}
                          onClick={() => toggleStatus(memory)}
                        >
                          {memory.status === "active" ? <PauseCircle /> : <PlayCircle />}
                        </Button>
                        <Button type="button" variant="ghost" size="icon-sm" aria-label="删除记忆" title="删除记忆" disabled={busy} onClick={() => setPendingDeleteId(memory.memoryId)}><Trash2 /></Button>
                      </div>
                    </div>
                  )}

                  {pendingDeleteId === memory.memoryId ? (
                    <div className="mt-3 flex flex-wrap items-center justify-end gap-2 border-t pt-3 text-sm">
                      <span className="mr-auto text-muted-foreground">永久删除这条记忆？</span>
                      <Button type="button" variant="ghost" size="sm" onClick={() => setPendingDeleteId(null)}>取消</Button>
                      <Button type="button" variant="destructive" size="sm" disabled={busy} onClick={() => deleteMemory(memory.memoryId)}>
                        {busy ? <LoaderCircle className="animate-spin" /> : <Trash2 />}
                        删除
                      </Button>
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
