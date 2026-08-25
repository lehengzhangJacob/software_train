"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Beef,
  Camera,
  Check,
  Droplet,
  Plus,
  Trash2,
  UtensilsCrossed,
  Wheat,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FoodPhotoUpload, type RecognizedFood } from "@/components/food/photo-upload"
import { consumeRecognitionHandoff } from "@/lib/food/recognition-handoff"
import { MEAL_LABELS, formatCalories, formatGrams } from "@/lib/utils"
import {
  MEAL_NUTRITION_LABELS,
  MEAL_NUTRITION_MAX,
  MEAL_NUTRITION_MIN,
  parseMealNutritionInput,
  type MealNutritionInputValue,
  type MealNutritionKey,
} from "@/lib/nutrition"

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

interface MealDraft {
  id: string
  selected: boolean
  foodName: string
  mealType: string
  calories: MealNutritionInputValue
  proteinG: MealNutritionInputValue
  fatG: MealNutritionInputValue
  carbsG: MealNutritionInputValue
  portionDesc: string
  confidence: number
}

interface MealsContentProps {
  recordDate: string
  initialMeals: MealItem[]
}

type ManualMealForm = Omit<MealDraft, "id" | "selected" | "confidence">

const MAX_BATCH_ITEMS = 10

const emptyManualForm: ManualMealForm = {
  foodName: "",
  mealType: "breakfast",
  calories: 0,
  proteinG: 0,
  fatG: 0,
  carbsG: 0,
  portionDesc: "",
}

function createDraftId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function inferMealType(date = new Date()) {
  const hour = date.getHours()
  if (hour < 10) return "breakfast"
  if (hour < 15) return "lunch"
  if (hour < 21) return "dinner"
  return "snack"
}

function errorMessage(value: unknown, fallback: string) {
  return value instanceof Error && value.message ? value.message : fallback
}

const NUTRITION_FIELDS = [
  { key: "calories", label: MEAL_NUTRITION_LABELS.calories },
  { key: "proteinG", label: MEAL_NUTRITION_LABELS.proteinG },
  { key: "fatG", label: MEAL_NUTRITION_LABELS.fatG },
  { key: "carbsG", label: MEAL_NUTRITION_LABELS.carbsG },
] as const satisfies ReadonlyArray<{ key: MealNutritionKey; label: string }>

type ParsedNutritionValues = Pick<MealItem, MealNutritionKey>

type NutritionValidation =
  | { error: string; values: null }
  | { error: null; values: ParsedNutritionValues }

function parseNutritionValues(values: Pick<MealDraft, MealNutritionKey>): NutritionValidation {
  const parsed = {} as ParsedNutritionValues
  for (const { key, label } of NUTRITION_FIELDS) {
    const number = parseMealNutritionInput(values[key])
    if (number === null) {
      return {
        error: `${label}应在 ${MEAL_NUTRITION_MIN} 到 ${MEAL_NUTRITION_MAX} 之间`,
        values: null,
      }
    }
    parsed[key] = number
  }
  return { error: null, values: parsed }
}

function toNutritionInputValue(value: number): MealNutritionInputValue {
  return Number.isFinite(value) ? value : ""
}

export function MealsContent({ recordDate, initialMeals }: MealsContentProps) {
  const router = useRouter()
  const [meals, setMeals] = useState<MealItem[]>(initialMeals)
  const [drafts, setDrafts] = useState<MealDraft[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<ManualMealForm>(emptyManualForm)
  const [savingManual, setSavingManual] = useState(false)
  const [savingDrafts, setSavingDrafts] = useState(false)

  const resetForm = () => {
    setForm(emptyManualForm)
    setShowForm(false)
  }

  const updateDraft = <Key extends keyof MealDraft>(id: string, key: Key, value: MealDraft[Key]) => {
    setDrafts((current) => current.map((draft) => (draft.id === id ? { ...draft, [key]: value } : draft)))
  }

  const handleRecognizedFoods = useCallback((foods: RecognizedFood[]) => {
    const remainingSlots = Math.max(0, MAX_BATCH_ITEMS - drafts.length)
    const acceptedFoods = foods.slice(0, remainingSlots)
    const ignoredCount = foods.length - acceptedFoods.length
    if (ignoredCount > 0) {
      toast.warning(`一次最多审核 ${MAX_BATCH_ITEMS} 项，已忽略 ${ignoredCount} 项`)
    }
    if (acceptedFoods.length === 0) return

    const inferredMealType = inferMealType()
    setDrafts((current) => [
      ...current,
      ...acceptedFoods.map((food) => ({
        id: createDraftId(),
        selected: true,
        foodName: food.name,
        mealType: inferredMealType,
        calories: toNutritionInputValue(Math.round(food.calories)),
        proteinG: toNutritionInputValue(food.protein),
        fatG: toNutritionInputValue(food.fat),
        carbsG: toNutritionInputValue(food.carbs),
        portionDesc: food.portion,
        confidence: food.confidence,
      })),
    ])
  }, [drafts.length])

  useEffect(() => {
    const foods = consumeRecognitionHandoff()
    if (!foods) return
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      handleRecognizedFoods(foods)
      toast.success(`已恢复 ${foods.length} 项待审核识别结果`)
    })
    return () => {
      cancelled = true
    }
  }, [handleRecognizedFoods])

  const handleManualSave = async () => {
    if (!form.foodName.trim()) {
      toast.error("请输入食物名称")
      return
    }

    const nutrition = parseNutritionValues(form)
    if (nutrition.error !== null) {
      toast.error(nutrition.error)
      return
    }

    setSavingManual(true)
    try {
      const response = await fetch("/api/meals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, ...nutrition.values, recordDate }),
      })
      const json: { data?: MealItem | null; error?: string | null } = await response.json()
      if (!response.ok || json.error || !json.data) {
        throw new Error(json.error || "保存失败")
      }

      setMeals((current) => [...current, json.data as MealItem])
      toast.success("已添加饮食记录")
      resetForm()
      router.refresh()
    } catch (error) {
      toast.error(`保存失败：${errorMessage(error, "请稍后重试")}`)
    } finally {
      setSavingManual(false)
    }
  }

  const handleConfirmDrafts = async () => {
    const selectedDrafts = drafts.filter((draft) => draft.selected)
    if (selectedDrafts.length === 0) {
      toast.error("请至少选择一项食物后再确认")
      return
    }
    if (selectedDrafts.length > MAX_BATCH_ITEMS) {
      toast.error(`一次最多保存 ${MAX_BATCH_ITEMS} 项食物`)
      return
    }
    if (selectedDrafts.some((draft) => !draft.foodName.trim())) {
      toast.error("请补全已选择食物的名称")
      return
    }

    const normalizedDrafts: Array<{ draft: MealDraft; nutrition: ParsedNutritionValues }> = []
    for (const [index, draft] of selectedDrafts.entries()) {
      const nutrition = parseNutritionValues(draft)
      if (nutrition.error !== null) {
        toast.error(`第 ${index + 1} 项${nutrition.error}`)
        return
      }
      normalizedDrafts.push({ draft, nutrition: nutrition.values })
    }

    setSavingDrafts(true)
    try {
      const response = await fetch("/api/meals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recordDate,
          items: normalizedDrafts.map(({ draft, nutrition }) => ({
            foodName: draft.foodName,
            mealType: draft.mealType,
            ...nutrition,
            portionDesc: draft.portionDesc,
            recognitionRaw: {
              source: "ai-photo-recognition",
              confidence: draft.confidence,
            },
          })),
        }),
      })
      const json: { data?: MealItem[] | null; error?: string | null } = await response.json()
      if (!response.ok || json.error || !Array.isArray(json.data)) {
        throw new Error(json.error || "保存失败")
      }

      const savedMeals = json.data
      setMeals((current) => [...current, ...savedMeals])
      setDrafts([])
      toast.success(`已保存 ${savedMeals.length} 项饮食记录`)
      router.refresh()
    } catch (error) {
      // Preserve the draft so the user can retry or make a correction.
      toast.error(`保存失败：${errorMessage(error, "请检查后重试")}`)
    } finally {
      setSavingDrafts(false)
    }
  }

  const handleDelete = async (recordId: number) => {
    try {
      const response = await fetch(`/api/meals?id=${recordId}`, { method: "DELETE" })
      const json: { error?: string | null } = await response.json()
      if (!response.ok || json.error) throw new Error(json.error || "删除失败")

      setMeals((current) => current.filter((meal) => meal.recordId !== recordId))
      toast.success("已删除记录")
      router.refresh()
    } catch (error) {
      toast.error(`删除失败：${errorMessage(error, "请稍后重试")}`)
    }
  }

  const mealsByType = meals.reduce(
    (result, meal) => {
      result[meal.mealType] = result[meal.mealType] || []
      result[meal.mealType].push(meal)
      return result
    },
    {} as Record<string, MealItem[]>
  )
  const selectedDraftCount = drafts.filter((draft) => draft.selected).length

  return (
    <div className="grid gap-5 lg:grid-cols-[1.05fr_.95fr]">
      <Card className="surface-card overflow-hidden border-0 lg:col-start-1 lg:row-start-1">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="grid size-8 place-items-center rounded-md bg-[var(--brand-mint)] text-[var(--brand-plum)]"><Camera className="h-4 w-4" /></span>
            拍照识别与审核
          </CardTitle>
        </CardHeader>
        <CardContent className="px-3 pb-3 sm:px-4 sm:pb-4">
          <FoodPhotoUpload
            onRecognized={handleRecognizedFoods}
            onManualEntryRequested={() => setShowForm(true)}
            disabled={savingManual || savingDrafts}
          />
        </CardContent>
      </Card>

      {drafts.length > 0 && (
        <Card className="surface-card border-[var(--brand-mint)]/40 lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center justify-between gap-3 text-base">
              <span>识别结果待审核</span>
              <span className="text-sm font-normal text-neutral-500">{selectedDraftCount} / {drafts.length} 项将保存</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md border-l-2 border-[var(--brand-coral)] bg-[var(--brand-coral-soft)] px-3 py-2 text-sm text-[#874333] dark:text-[#ffb0a0]">
              AI 估算，请核对。确认前可修改食物、餐别、份量和营养数值；图片不会随饮食记录保存。
            </div>
            <div className="space-y-4">
              {drafts.map((draft, index) => (
                <div
                  key={draft.id}
                  data-testid={`recognized-food-card-${index + 1}`}
                  className="rounded-md border bg-[var(--brand-paper)] p-4"
                >
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <label className="flex min-w-0 cursor-pointer items-center gap-3 text-sm font-medium text-neutral-800">
                      <input
                        type="checkbox"
                        className="size-4 accent-primary"
                        checked={draft.selected}
                        disabled={savingDrafts}
                        onChange={(event) => updateDraft(draft.id, "selected", event.target.checked)}
                      />
                      <span
                        aria-hidden="true"
                        className="grid size-8 shrink-0 place-items-center rounded-full bg-[var(--brand-plum)] text-sm font-semibold text-[var(--brand-mint)]"
                      >
                        {index + 1}
                      </span>
                      <span className="truncate">识别项 {index + 1}</span>
                    </label>
      <div className="flex items-center gap-2 lg:col-span-2">
                      <span className="text-xs text-neutral-500">置信度 {Math.round(draft.confidence * 100)}%</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="text-neutral-600 hover:text-red-600"
                        aria-label={`移除 ${draft.foodName || `识别项 ${index + 1}`}`}
                        disabled={savingDrafts}
                        onClick={() => setDrafts((current) => current.filter((item) => item.id !== draft.id))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor={`draft-food-${draft.id}`}>食物名称</Label>
                      <Input
                        id={`draft-food-${draft.id}`}
                        value={draft.foodName}
                        disabled={savingDrafts}
                        onChange={(event) => updateDraft(draft.id, "foodName", event.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`draft-meal-type-${draft.id}`}>餐别</Label>
                      <Select
                        value={draft.mealType}
                        disabled={savingDrafts}
                        onValueChange={(value) => value && updateDraft(draft.id, "mealType", value)}
                      >
                        <SelectTrigger id={`draft-meal-type-${draft.id}`}><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(MEAL_LABELS).map(([value, label]) => (
                            <SelectItem key={value} value={value}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`draft-portion-${draft.id}`}>份量描述</Label>
                      <Input
                        id={`draft-portion-${draft.id}`}
                        value={draft.portionDesc}
                        disabled={savingDrafts}
                        onChange={(event) => updateDraft(draft.id, "portionDesc", event.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`draft-calories-${draft.id}`}>热量（千卡）</Label>
                      <Input
                        id={`draft-calories-${draft.id}`}
                        type="number"
                        min={MEAL_NUTRITION_MIN}
                        max={MEAL_NUTRITION_MAX}
                        inputMode="decimal"
                        maxLength={12}
                        value={draft.calories}
                        disabled={savingDrafts}
                        onChange={(event) => updateDraft(draft.id, "calories", event.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`draft-protein-${draft.id}`}>蛋白质（克）</Label>
                      <Input
                        id={`draft-protein-${draft.id}`}
                        type="number"
                        min={MEAL_NUTRITION_MIN}
                        max={MEAL_NUTRITION_MAX}
                        step="0.1"
                        inputMode="decimal"
                        maxLength={12}
                        value={draft.proteinG}
                        disabled={savingDrafts}
                        onChange={(event) => updateDraft(draft.id, "proteinG", event.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`draft-fat-${draft.id}`}>脂肪（克）</Label>
                      <Input
                        id={`draft-fat-${draft.id}`}
                        type="number"
                        min={MEAL_NUTRITION_MIN}
                        max={MEAL_NUTRITION_MAX}
                        step="0.1"
                        inputMode="decimal"
                        maxLength={12}
                        value={draft.fatG}
                        disabled={savingDrafts}
                        onChange={(event) => updateDraft(draft.id, "fatG", event.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`draft-carbs-${draft.id}`}>碳水（克）</Label>
                      <Input
                        id={`draft-carbs-${draft.id}`}
                        type="number"
                        min={MEAL_NUTRITION_MIN}
                        max={MEAL_NUTRITION_MAX}
                        step="0.1"
                        inputMode="decimal"
                        maxLength={12}
                        value={draft.carbsG}
                        disabled={savingDrafts}
                        onChange={(event) => updateDraft(draft.id, "carbsG", event.target.value)}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="outline"
                disabled={savingDrafts}
                onClick={() => setDrafts([])}
              >
                放弃本次识别
              </Button>
              <Button
                type="button"
                disabled={savingDrafts || selectedDraftCount === 0 || selectedDraftCount > MAX_BATCH_ITEMS}
                onClick={handleConfirmDrafts}
              >
                <Check className="mr-2 h-4 w-4" />
                {savingDrafts ? "保存中..." : `确认并保存 ${selectedDraftCount} 项`}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-2">
        <Button
          type="button"
          onClick={() => setShowForm((visible) => !visible)}
          aria-expanded={showForm}
          aria-controls="manual-meal-form"
          variant="outline"
          className="flex-1 border-[var(--brand-mint)]/55 bg-[var(--brand-paper)] text-[var(--brand-heading)] hover:border-[var(--brand-mint-deep)] hover:bg-[var(--brand-mint-soft)]"
        >
          <Plus className="mr-2 h-4 w-4" />
          手动录入
        </Button>
      </div>

      {showForm && (
        <Card id="manual-meal-form" data-testid="manual-meal-form" className="surface-card overflow-hidden border-[var(--brand-mint)]/45 lg:col-span-2">
          <CardHeader className="border-b border-border/70 bg-[var(--brand-paper)] px-4 py-3 sm:px-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-md bg-[var(--brand-mint)] text-[var(--brand-plum)]">
                  <UtensilsCrossed className="size-4" />
                </span>
                <div className="min-w-0">
                  <CardTitle className="text-base text-[var(--brand-heading)]">手动录入食物</CardTitle>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">补充一餐的基本信息和营养估算</p>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="关闭手动录入"
                title="关闭手动录入"
                className="size-9 shrink-0 rounded-md text-muted-foreground hover:bg-[var(--brand-mint-soft)] hover:text-[var(--brand-heading)]"
                onClick={resetForm}
              >
                <X className="size-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 px-4 py-4 sm:px-5">
            <fieldset className="space-y-3 rounded-lg border border-border/70 bg-white/65 p-3 sm:p-4">
              <legend className="px-1 text-xs font-semibold text-[var(--brand-heading)]">基础信息</legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="manual-food-name">食物名称</Label>
                  <Input className="h-11 rounded-md border-border/80 bg-white/80 px-3" id="manual-food-name" value={form.foodName} enterKeyHint="next" onChange={(event) => setForm((current) => ({ ...current, foodName: event.target.value }))} placeholder="如：鸡蛋、米饭" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="manual-meal-type">餐别</Label>
                  <Select value={form.mealType} onValueChange={(value) => value && setForm((current) => ({ ...current, mealType: value }))}>
                    <SelectTrigger id="manual-meal-type" className="h-11 w-full rounded-md border-border/80 bg-white/80 px-3 data-[size=default]:h-11"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(MEAL_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="manual-portion">份量描述</Label>
                  <Input className="h-11 rounded-md border-border/80 bg-white/80 px-3" id="manual-portion" value={form.portionDesc} enterKeyHint="next" onChange={(event) => setForm((current) => ({ ...current, portionDesc: event.target.value }))} placeholder="如：1 碗约 200g" />
                </div>
              </div>
            </fieldset>
            <fieldset className="space-y-3 rounded-lg border border-border/70 bg-white/65 p-3 sm:p-4">
              <legend className="px-1 text-xs font-semibold text-[var(--brand-heading)]">营养估算</legend>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="manual-calories">热量（千卡）</Label>
                  <Input className="h-11 rounded-md border-border/80 bg-white/80 px-3" id="manual-calories" type="number" min={MEAL_NUTRITION_MIN} max={MEAL_NUTRITION_MAX} inputMode="decimal" enterKeyHint="next" maxLength={12} value={form.calories} onChange={(event) => setForm((current) => ({ ...current, calories: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="manual-protein">蛋白质（克）</Label>
                  <Input className="h-11 rounded-md border-border/80 bg-white/80 px-3" id="manual-protein" type="number" min={MEAL_NUTRITION_MIN} max={MEAL_NUTRITION_MAX} step="0.1" inputMode="decimal" enterKeyHint="next" maxLength={12} value={form.proteinG} onChange={(event) => setForm((current) => ({ ...current, proteinG: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="manual-fat">脂肪（克）</Label>
                  <Input className="h-11 rounded-md border-border/80 bg-white/80 px-3" id="manual-fat" type="number" min={MEAL_NUTRITION_MIN} max={MEAL_NUTRITION_MAX} step="0.1" inputMode="decimal" enterKeyHint="next" maxLength={12} value={form.fatG} onChange={(event) => setForm((current) => ({ ...current, fatG: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="manual-carbs">碳水（克）</Label>
                  <Input className="h-11 rounded-md border-border/80 bg-white/80 px-3" id="manual-carbs" type="number" min={MEAL_NUTRITION_MIN} max={MEAL_NUTRITION_MAX} step="0.1" inputMode="decimal" enterKeyHint="done" maxLength={12} value={form.carbsG} onChange={(event) => setForm((current) => ({ ...current, carbsG: event.target.value }))} />
                </div>
              </div>
            </fieldset>
            <Button type="button" onClick={handleManualSave} disabled={savingManual} className="w-full">
              <UtensilsCrossed className="mr-2 h-4 w-4" />
              {savingManual ? "保存中..." : "保存"}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card className="surface-card border-0 lg:col-start-2 lg:row-start-1">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="page-eyebrow">Daily log</p>
              <CardTitle className="mt-1 text-xl text-[var(--brand-heading)]">当天记录</CardTitle>
            </div>
            <span className="rounded-md bg-[var(--brand-lavender-soft)] px-2.5 py-1 text-xs font-medium text-[#5f51cc] dark:text-[var(--brand-lavender-deep)]">{meals.length} 项</span>
          </div>
        </CardHeader>
        <CardContent>
          {meals.length === 0 ? (
            <div className="grid min-h-[380px] place-items-center rounded-md bg-[var(--brand-paper)] px-6 text-center">
              <div>
                <p className="text-sm font-semibold text-[var(--brand-heading)]">当天还没有保存第一餐</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">拍照识别或手动录入后，食物会按餐别整理在这里。</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {(["breakfast", "lunch", "dinner", "snack"] as const).map((type) => {
                const items = mealsByType[type]
                if (!items?.length) return null

                return (
                  <div key={type}>
                    <h4 className="mb-2 text-sm font-medium text-neutral-600">{MEAL_LABELS[type]}</h4>
                    <div className="space-y-2">
                      {items.map((item) => (
                        <div key={item.recordId} className="flex items-center justify-between gap-3 rounded-md border bg-[var(--brand-paper)] p-3">
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
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-neutral-600 hover:text-red-600"
                            aria-label={`删除 ${item.foodName}`}
                            onClick={() => void handleDelete(item.recordId)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
