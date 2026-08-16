"use client"

import Image from "next/image"
import Link from "next/link"
import { useEffect, useRef, useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import {
  Beef,
  ChevronLeft,
  ChevronRight,
  Droplet,
  Loader2,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  Wheat,
} from "lucide-react"
import { addLocalDays, parseLocalDate, toLocalDateString } from "@/lib/date"
import { MEAL_LABELS, formatCalories, formatGrams, cn } from "@/lib/utils"

interface MealItem {
  recordId: number
  foodName: string
  mealType: string
  calories: number
  proteinG: number
  fatG: number
  carbsG: number
  portionDesc: string | null
  recordTime: string
}

interface ApiEnvelope<T> {
  data: T | null
  error: string | null
}

interface CalendarContentProps {
  today: string
  availableDates: string[]
  initialMeals: MealItem[]
}

interface EditForm {
  foodName: string
  calories: number
  proteinG: number
  fatG: number
  carbsG: number
  portionDesc: string
}

type DialogState =
  | { kind: "edit"; meal: MealItem }
  | { kind: "delete"; meal: MealItem }
  | null

const mealTypes = ["breakfast", "lunch", "dinner", "snack"] as const

async function readApiEnvelope<T>(response: Response): Promise<ApiEnvelope<T>> {
  try {
    return (await response.json()) as ApiEnvelope<T>
  } catch {
    return { data: null, error: "服务器返回了无效响应" }
  }
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback
}

function numberFromInput(value: string) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function createMonthGrid(dateKey: string) {
  const selected = parseLocalDate(dateKey)
  const firstDay = new Date(selected.getFullYear(), selected.getMonth(), 1)
  const mondayOffset = (firstDay.getDay() + 6) % 7
  const gridStart = addLocalDays(firstDay, -mondayOffset)

  return Array.from({ length: 42 }, (_, index) => {
    const date = addLocalDays(gridStart, index)
    return {
      dateKey: toLocalDateString(date),
      dayOfMonth: date.getDate(),
      inCurrentMonth: date.getMonth() === selected.getMonth(),
    }
  })
}

function formatMonthTitle(dateKey: string) {
  const date = parseLocalDate(dateKey)
  return `${date.getFullYear()} 年 ${date.getMonth() + 1} 月`
}

export function CalendarContent({ today, availableDates, initialMeals }: CalendarContentProps) {
  const router = useRouter()
  const [currentDate, setCurrentDate] = useState(today)
  const [meals, setMeals] = useState<MealItem[]>(initialMeals)
  const [mealsDate, setMealsDate] = useState(today)
  const [loadAttempt, setLoadAttempt] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [dialogState, setDialogState] = useState<DialogState>(null)
  const [editForm, setEditForm] = useState<EditForm>({
    foodName: "",
    calories: 0,
    proteinG: 0,
    fatG: 0,
    carbsG: 0,
    portionDesc: "",
  })
  const [savingEdit, setSavingEdit] = useState(false)
  const [deletingMealId, setDeletingMealId] = useState<number | null>(null)
  const latestRequestId = useRef(0)

  useEffect(() => {
    const controller = new AbortController()
    let isCurrentRequest = true
    const requestId = latestRequestId.current + 1
    latestRequestId.current = requestId

    const loadMeals = async () => {
      setIsLoading(true)
      setLoadError(null)

      try {
        const response = await fetch("/api/meals?date=" + encodeURIComponent(currentDate), {
          cache: "no-store",
          signal: controller.signal,
        })
        const result = await readApiEnvelope<MealItem[]>(response)

        if (!response.ok || !Array.isArray(result.data)) {
          throw new Error(result.error || "暂时无法读取饮食记录")
        }
        if (!isCurrentRequest || controller.signal.aborted || latestRequestId.current !== requestId) return

        setMeals(result.data)
        setMealsDate(currentDate)
      } catch (error) {
        if (!isCurrentRequest || controller.signal.aborted || latestRequestId.current !== requestId) return
        setLoadError(errorMessage(error, "暂时无法读取饮食记录，请稍后重试"))
      } finally {
        if (isCurrentRequest && !controller.signal.aborted && latestRequestId.current === requestId) {
          setIsLoading(false)
        }
      }
    }

    void loadMeals()

    return () => {
      isCurrentRequest = false
      controller.abort()
    }
  }, [currentDate, loadAttempt])

  const dateSet = new Set(availableDates)
  const monthCells = createMonthGrid(currentDate)
  const currentMonth = currentDate.slice(0, 7)
  const todayMonth = today.slice(0, 7)
  const selectedDate = parseLocalDate(currentDate)
  const daysInMonth = new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 0).getDate()
  const elapsedDays = currentMonth === todayMonth ? parseLocalDate(today).getDate() : daysInMonth
  const monthRecordCount = availableDates.filter((date) => date.startsWith(currentMonth)).length
  const recordRate = elapsedDays > 0 ? Math.min(100, Math.round((monthRecordCount / elapsedDays) * 100)) : 0
  const hasMealsForCurrentDate = mealsDate === currentDate
  const loadingCurrentDate = isLoading || (!hasMealsForCurrentDate && !loadError)
  const currentMeals = hasMealsForCurrentDate ? meals : []
  const dialogMeal = dialogState?.meal ?? null
  const isMutating = savingEdit || deletingMealId !== null
  const isCalendarLocked = isMutating || dialogState !== null

  const changeDate = (delta: number) => {
    setLoadError(null)
    setCurrentDate((date) => toLocalDateString(addLocalDays(parseLocalDate(date), delta)))
  }

  const changeMonth = (delta: number) => {
    const selected = parseLocalDate(currentDate)
    const target = new Date(selected.getFullYear(), selected.getMonth() + delta, 1)
    const targetKey = toLocalDateString(target)
    if (targetKey.slice(0, 7) > todayMonth) return
    setLoadError(null)
    setCurrentDate(targetKey)
  }

  const retryLoad = () => {
    setLoadError(null)
    setLoadAttempt((attempt) => attempt + 1)
  }

  const reloadAfterMutation = () => {
    latestRequestId.current += 1
    setLoadError(null)
    setLoadAttempt((attempt) => attempt + 1)
  }

  const selectDate = (date: string) => {
    setLoadError(null)
    setCurrentDate(date)
  }

  const closeDialog = () => {
    if (isMutating) return
    setDialogState(null)
  }

  const openEdit = (meal: MealItem) => {
    setEditForm({
      foodName: meal.foodName,
      calories: meal.calories,
      proteinG: meal.proteinG,
      fatG: meal.fatG,
      carbsG: meal.carbsG,
      portionDesc: meal.portionDesc ?? "",
    })
    setDialogState({ kind: "edit", meal })
  }

  const handleEditSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!dialogState || dialogState.kind !== "edit" || savingEdit) return

    const meal = dialogState.meal
    setSavingEdit(true)

    try {
      const response = await fetch("/api/meals", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordId: meal.recordId, ...editForm }),
      })
      const result = await readApiEnvelope<MealItem>(response)
      if (!response.ok || !result.data) {
        throw new Error(result.error || "更新饮食记录失败")
      }

      setMeals((current) =>
        current.map((item) => (item.recordId === meal.recordId ? result.data as MealItem : item))
      )
      setDialogState(null)
      reloadAfterMutation()
      toast.success("饮食记录已更新")
      router.refresh()
    } catch (error) {
      toast.error("更新失败：" + errorMessage(error, "请稍后重试"))
    } finally {
      setSavingEdit(false)
    }
  }

  const handleDelete = async () => {
    if (!dialogState || dialogState.kind !== "delete" || deletingMealId !== null) return

    const meal = dialogState.meal
    setDeletingMealId(meal.recordId)

    try {
      const response = await fetch("/api/meals?id=" + meal.recordId, { method: "DELETE" })
      const result = await readApiEnvelope<{ deleted: boolean }>(response)
      if (!response.ok || !result.data?.deleted) {
        throw new Error(result.error || "删除饮食记录失败")
      }

      setMeals((current) => current.filter((item) => item.recordId !== meal.recordId))
      setDialogState(null)
      reloadAfterMutation()
      toast.success("饮食记录已删除")
      router.refresh()
    } catch (error) {
      toast.error("删除失败：" + errorMessage(error, "请稍后重试"))
    } finally {
      setDeletingMealId(null)
    }
  }

  const mealsByType = currentMeals.reduce(
    (result, meal) => {
      result[meal.mealType] = result[meal.mealType] || []
      result[meal.mealType].push(meal)
      return result
    },
    {} as Record<string, MealItem[]>
  )
  const totalCals = currentMeals.reduce((sum, meal) => sum + meal.calories, 0)

  return (
    <div className="space-y-5">
      <section className="brand-panel flex flex-wrap items-end justify-between gap-6 p-5 sm:p-7">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase text-[var(--brand-mint)]">
            <Sparkles className="size-3.5" />
            {currentMonth}
          </div>
          <h2 className="mt-3 text-2xl font-semibold sm:text-3xl">认真生活的第 {monthRecordCount} 天</h2>
          <p className="mt-2 text-sm text-white/60">每一次记录都在帮你看见更稳定的节奏。</p>
        </div>
        <div className="text-right">
          <strong className="text-5xl font-semibold text-[var(--brand-lavender)]">{recordRate}%</strong>
          <p className="mt-1 text-xs text-white/55">本月记录率</p>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[1.24fr_.76fr]">
        <section className="surface-card p-4 sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="page-eyebrow">Monthly view</p>
              <h2 className="mt-1 text-xl font-semibold text-[var(--brand-plum)]">{formatMonthTitle(currentDate)}</h2>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="查看上个月"
                disabled={isCalendarLocked}
                onClick={() => changeMonth(-1)}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="查看下个月"
                disabled={isCalendarLocked || currentMonth >= todayMonth}
                onClick={() => changeMonth(1)}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-7 text-center text-[11px] font-medium text-muted-foreground">
            {["一", "二", "三", "四", "五", "六", "日"].map((day) => (
              <span key={day} className="py-2">{day}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {monthCells.map(({ dateKey, dayOfMonth, inCurrentMonth }) => {
              const hasData = dateSet.has(dateKey)
              const isSelected = dateKey === currentDate
              const isFuture = dateKey > today

              return (
                <button
                  key={dateKey}
                  type="button"
                  aria-label={"查看 " + dateKey}
                  aria-pressed={isSelected}
                  disabled={isCalendarLocked || isFuture}
                  onClick={() => selectDate(dateKey)}
                  className={cn(
                    "relative aspect-square min-h-9 rounded-md text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-mint)]",
                    !inCurrentMonth && "text-muted-foreground/35",
                    inCurrentMonth && !isSelected && "text-[var(--brand-plum)] hover:bg-[var(--brand-paper)]",
                    hasData && !isSelected && "bg-[#def8ee] text-[var(--brand-mint-deep)]",
                    isSelected && "bg-[var(--brand-lavender-soft)] text-[#51469d] ring-1 ring-[var(--brand-lavender)]",
                    isFuture && "cursor-not-allowed opacity-25"
                  )}
                >
                  {dayOfMonth}
                  {hasData && (
                    <span className={cn(
                      "absolute bottom-1 left-1/2 size-1 -translate-x-1/2 rounded-full bg-[var(--brand-mint)]",
                      isSelected && "bg-[var(--brand-lavender)]"
                    )} />
                  )}
                </button>
              )
            })}
          </div>
        </section>

        <aside className="surface-card overflow-hidden">
          <div className="relative h-44">
            <Image
              src="/images/nutrition/meal-hero.webp"
              alt="健康餐食"
              fill
              sizes="(max-width: 1024px) 100vw, 36vw"
              className="object-cover"
            />
            <div className="absolute inset-x-3 bottom-3 rounded-md bg-[var(--brand-plum)]/94 p-3 text-white backdrop-blur">
              <div className="flex items-center justify-between gap-3">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/10 hover:text-white"
                  aria-label="查看前一天"
                  disabled={isCalendarLocked}
                  onClick={() => changeDate(-1)}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <div className="text-center">
                  <p className="text-sm font-semibold">{currentDate}</p>
                  <p className="mt-0.5 text-[10px] text-white/55">
                    {currentDate === today ? "今天" : "历史记录"} · {currentMeals.length} 项食物
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/10 hover:text-white"
                  aria-label="查看后一天"
                  disabled={currentDate === today || isCalendarLocked}
                  onClick={() => changeDate(1)}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          </div>

          <div className="p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="page-eyebrow">Daily detail</p>
                <h3 className="mt-1 text-lg font-semibold text-[var(--brand-plum)]">当天吃了什么</h3>
              </div>
              <span className="text-xs font-medium text-muted-foreground">{formatCalories(totalCals)} 千卡</span>
            </div>

            {loadingCurrentDate && (
              <p className="flex min-h-32 items-center justify-center gap-2 text-xs text-muted-foreground" role="status">
                <Loader2 className="size-4 animate-spin" />
                正在加载当天记录
              </p>
            )}

            {loadError && (
              <div className="mt-4 rounded-md bg-[#fff3ef] p-3">
                <p className="text-sm text-destructive" role="alert">{loadError}</p>
                <Button type="button" variant="outline" size="sm" className="mt-3" disabled={isLoading} onClick={retryLoad}>
                  重试
                </Button>
              </div>
            )}

            {!loadingCurrentDate && !loadError && (
              <div className="mt-4 divide-y divide-border/70">
                {mealTypes.map((type) => {
                  const items = mealsByType[type]
                  if (!items?.length) return null

                  return items.map((item) => (
                    <div key={item.recordId} className="flex items-center justify-between gap-3 py-3 first:pt-0">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="rounded-md bg-[var(--brand-lavender-soft)] px-2 py-1 text-[10px] font-semibold text-[#5f51cc]">
                            {MEAL_LABELS[type]}
                          </span>
                          <p className="truncate text-sm font-semibold text-[var(--brand-plum)]">{item.foodName}</p>
                        </div>
                        <div className="mt-1.5 flex flex-wrap gap-x-2 text-[11px] text-muted-foreground">
                          <span>{formatCalories(item.calories)} 千卡</span>
                          <span className="flex items-center gap-0.5"><Beef className="size-3" />{formatGrams(item.proteinG)}</span>
                          <span className="flex items-center gap-0.5"><Droplet className="size-3" />{formatGrams(item.fatG)}</span>
                          <span className="flex items-center gap-0.5"><Wheat className="size-3" />{formatGrams(item.carbsG)}</span>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          aria-label={"编辑 " + item.foodName}
                          disabled={isMutating}
                          onClick={() => openEdit(item)}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8 hover:text-destructive"
                          aria-label={"删除 " + item.foodName}
                          disabled={isMutating}
                          onClick={() => setDialogState({ kind: "delete", meal: item })}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))
                })}

                {currentMeals.length === 0 && (
                  <div className="grid min-h-32 place-items-center text-center">
                    <div>
                      <p className="text-sm font-medium text-[var(--brand-plum)]">当天还没有记录</p>
                      <p className="mt-1 text-xs text-muted-foreground">可以补记这一餐，连续记录会更完整。</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            <Link
              href="/meals"
              className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[var(--brand-plum)] text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-mint)]"
            >
              <Plus className="size-4" />
              添加饮食记录
            </Link>
          </div>
        </aside>
      </div>

      <Dialog
        open={dialogState !== null}
        onOpenChange={(open) => {
          if (!open) closeDialog()
        }}
      >
        <DialogContent>
          {dialogState?.kind === "edit" && dialogMeal && (
            <form className="space-y-4" onSubmit={handleEditSave}>
              <DialogHeader>
                <DialogTitle>编辑食物</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-neutral-700" htmlFor="calendar-food-name">食物名称</label>
                  <Input
                    id="calendar-food-name"
                    value={editForm.foodName}
                    disabled={savingEdit}
                    onChange={(event) => setEditForm((form) => ({ ...form, foodName: event.target.value }))}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-neutral-700" htmlFor="calendar-calories">热量</label>
                    <Input
                      id="calendar-calories"
                      type="number"
                      min="0"
                      value={editForm.calories}
                      disabled={savingEdit}
                      onChange={(event) => setEditForm((form) => ({ ...form, calories: numberFromInput(event.target.value) }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-neutral-700" htmlFor="calendar-protein">蛋白质</label>
                    <Input
                      id="calendar-protein"
                      type="number"
                      min="0"
                      step="0.1"
                      value={editForm.proteinG}
                      disabled={savingEdit}
                      onChange={(event) => setEditForm((form) => ({ ...form, proteinG: numberFromInput(event.target.value) }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-neutral-700" htmlFor="calendar-fat">脂肪</label>
                    <Input
                      id="calendar-fat"
                      type="number"
                      min="0"
                      step="0.1"
                      value={editForm.fatG}
                      disabled={savingEdit}
                      onChange={(event) => setEditForm((form) => ({ ...form, fatG: numberFromInput(event.target.value) }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-neutral-700" htmlFor="calendar-carbs">碳水</label>
                    <Input
                      id="calendar-carbs"
                      type="number"
                      min="0"
                      step="0.1"
                      value={editForm.carbsG}
                      disabled={savingEdit}
                      onChange={(event) => setEditForm((form) => ({ ...form, carbsG: numberFromInput(event.target.value) }))}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-neutral-700" htmlFor="calendar-portion">份量描述</label>
                  <Input
                    id="calendar-portion"
                    value={editForm.portionDesc}
                    disabled={savingEdit}
                    onChange={(event) => setEditForm((form) => ({ ...form, portionDesc: event.target.value }))}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" disabled={savingEdit} onClick={closeDialog}>
                  取消
                </Button>
                <Button type="submit" disabled={savingEdit}>
                  {savingEdit && <Loader2 className="animate-spin" />}
                  保存修改
                </Button>
              </DialogFooter>
            </form>
          )}

          {dialogState?.kind === "delete" && dialogMeal && (
            <>
              <DialogHeader>
                <DialogTitle>确认删除记录</DialogTitle>
                <DialogDescription>
                  将删除“{dialogMeal.foodName}”及其营养数据，此操作无法撤销。
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button type="button" variant="outline" disabled={deletingMealId !== null} onClick={closeDialog}>
                  取消
                </Button>
                <Button type="button" variant="destructive" disabled={deletingMealId !== null} onClick={() => void handleDelete()}>
                  {deletingMealId !== null && <Loader2 className="animate-spin" />}
                  确认删除
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
