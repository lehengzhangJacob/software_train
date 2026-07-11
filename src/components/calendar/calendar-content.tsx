"use client"

import { useEffect, useRef, useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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

function createDateWindow(today: string) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = addLocalDays(parseLocalDate(today), index - 6)
    return {
      dateKey: toLocalDateString(date),
      dayOfMonth: date.getDate(),
    }
  })
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
  const dateWindow = createDateWindow(today)
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
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="查看前一天"
              onClick={() => changeDate(-1)}
              disabled={isCalendarLocked}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-center">
              <p className="text-sm font-medium text-neutral-800">{currentDate}</p>
              {currentDate === today && <p className="text-xs text-emerald-600">今天</p>}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="查看后一天"
              onClick={() => changeDate(1)}
              disabled={currentDate === today || isCalendarLocked}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="mt-2 flex justify-center gap-1">
            {dateWindow.map(({ dateKey, dayOfMonth }) => {
              const hasData = dateSet.has(dateKey)
              const isSelected = dateKey === currentDate

              return (
                <button
                  key={dateKey}
                  type="button"
                  aria-label={"查看 " + dateKey}
                  aria-pressed={isSelected}
                  disabled={isCalendarLocked}
                  onClick={() => selectDate(dateKey)}
                  className={cn(
                    "h-8 w-8 rounded-full text-xs transition-colors",
                    isSelected
                      ? "bg-emerald-600 text-white"
                      : hasData
                        ? "bg-emerald-100 text-emerald-700"
                        : "text-neutral-400 hover:bg-neutral-100"
                  )}
                >
                  {dayOfMonth}
                </button>
              )
            })}
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-center text-sm text-neutral-500">
            共 {currentMeals.length} 项食物 · 合计 {formatCalories(totalCals)} 千卡
          </p>
          {loadingCurrentDate && (
            <p className="flex items-center justify-center gap-2 text-xs text-neutral-500" role="status">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              正在加载当天记录
            </p>
          )}
        </CardContent>
      </Card>

      {loadError && (
        <Card className="border-destructive/30">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
            <p className="text-sm text-destructive" role="alert">{loadError}</p>
            <Button type="button" variant="outline" size="sm" disabled={isLoading} onClick={retryLoad}>
              重试
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {mealTypes.map((type) => {
          const items = mealsByType[type]
          if (!items?.length) return null

          return (
            <Card key={type}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-neutral-600">
                  {MEAL_LABELS[type]} ({items.length} 项)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {items.map((item) => (
                  <div key={item.recordId} className="flex items-center justify-between gap-3 rounded-lg border bg-white p-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-neutral-800">{item.foodName}</p>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-neutral-500">
                        <span>{formatCalories(item.calories)} 千卡</span>
                        <span className="flex items-center gap-0.5"><Beef className="h-3 w-3" />{formatGrams(item.proteinG)}</span>
                        <span className="flex items-center gap-0.5"><Droplet className="h-3 w-3" />{formatGrams(item.fatG)}</span>
                        <span className="flex items-center gap-0.5"><Wheat className="h-3 w-3" />{formatGrams(item.carbsG)}</span>
                        {item.portionDesc && <span>{item.portionDesc}</span>}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-neutral-400"
                        aria-label={"编辑 " + item.foodName}
                        disabled={isMutating}
                        onClick={() => openEdit(item)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-neutral-400 hover:text-red-500"
                        aria-label={"删除 " + item.foodName}
                        disabled={isMutating}
                        onClick={() => setDialogState({ kind: "delete", meal: item })}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )
        })}

        {!loadingCurrentDate && !loadError && currentMeals.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-sm text-neutral-400">
              当天暂无饮食记录
            </CardContent>
          </Card>
        )}
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
