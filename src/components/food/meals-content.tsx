"use client"

import { useState } from "react"
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
} from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FoodPhotoUpload, type RecognizedFood } from "@/components/food/photo-upload"
import { MEAL_LABELS, formatCalories, formatGrams } from "@/lib/utils"

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
  calories: number
  proteinG: number
  fatG: number
  carbsG: number
  portionDesc: string
  confidence: number
}

interface MealsContentProps {
  today: string
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

function toNumber(value: string) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function errorMessage(value: unknown, fallback: string) {
  return value instanceof Error && value.message ? value.message : fallback
}

export function MealsContent({ today, initialMeals }: MealsContentProps) {
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

  const handleRecognizedFoods = (foods: RecognizedFood[]) => {
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
        calories: Math.round(food.calories),
        proteinG: food.protein,
        fatG: food.fat,
        carbsG: food.carbs,
        portionDesc: food.portion,
        confidence: food.confidence,
      })),
    ])
  }

  const handleManualSave = async () => {
    if (!form.foodName.trim()) {
      toast.error("请输入食物名称")
      return
    }

    setSavingManual(true)
    try {
      const response = await fetch("/api/meals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, recordDate: today }),
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

    setSavingDrafts(true)
    try {
      const response = await fetch("/api/meals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recordDate: today,
          items: selectedDrafts.map((draft) => ({
            foodName: draft.foodName,
            mealType: draft.mealType,
            calories: draft.calories,
            proteinG: draft.proteinG,
            fatG: draft.fatG,
            carbsG: draft.carbsG,
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
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Camera className="h-4 w-4" />
            拍照识别
          </CardTitle>
        </CardHeader>
        <CardContent>
          <FoodPhotoUpload
            onRecognized={handleRecognizedFoods}
            onManualEntryRequested={() => setShowForm(true)}
            disabled={savingManual || savingDrafts}
          />
        </CardContent>
      </Card>

      {drafts.length > 0 && (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center justify-between gap-3 text-base">
              <span>识别结果待审核</span>
              <span className="text-sm font-normal text-neutral-500">{selectedDraftCount} / {drafts.length} 项将保存</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border-l-2 border-amber-400 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              AI 估算，请核对。确认前可修改食物、餐别、份量和营养数值；图片不会随饮食记录保存。
            </div>
            <div className="space-y-4">
              {drafts.map((draft, index) => (
                <div key={draft.id} className="border bg-neutral-50/60 p-4">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <label className="flex min-w-0 cursor-pointer items-center gap-2 text-sm font-medium text-neutral-800">
                      <input
                        type="checkbox"
                        className="size-4 accent-primary"
                        checked={draft.selected}
                        disabled={savingDrafts}
                        onChange={(event) => updateDraft(draft.id, "selected", event.target.checked)}
                      />
                      <span className="truncate">识别项 {index + 1}</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-neutral-500">置信度 {Math.round(draft.confidence * 100)}%</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="text-neutral-400 hover:text-red-500"
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
                      <Label>餐别</Label>
                      <Select
                        value={draft.mealType}
                        disabled={savingDrafts}
                        onValueChange={(value) => value && updateDraft(draft.id, "mealType", value)}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
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
                        min="0"
                        value={draft.calories}
                        disabled={savingDrafts}
                        onChange={(event) => updateDraft(draft.id, "calories", toNumber(event.target.value))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`draft-protein-${draft.id}`}>蛋白质（克）</Label>
                      <Input
                        id={`draft-protein-${draft.id}`}
                        type="number"
                        min="0"
                        step="0.1"
                        value={draft.proteinG}
                        disabled={savingDrafts}
                        onChange={(event) => updateDraft(draft.id, "proteinG", toNumber(event.target.value))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`draft-fat-${draft.id}`}>脂肪（克）</Label>
                      <Input
                        id={`draft-fat-${draft.id}`}
                        type="number"
                        min="0"
                        step="0.1"
                        value={draft.fatG}
                        disabled={savingDrafts}
                        onChange={(event) => updateDraft(draft.id, "fatG", toNumber(event.target.value))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor={`draft-carbs-${draft.id}`}>碳水（克）</Label>
                      <Input
                        id={`draft-carbs-${draft.id}`}
                        type="number"
                        min="0"
                        step="0.1"
                        value={draft.carbsG}
                        disabled={savingDrafts}
                        onChange={(event) => updateDraft(draft.id, "carbsG", toNumber(event.target.value))}
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
        <Button type="button" onClick={() => setShowForm((visible) => !visible)} variant="outline" className="flex-1">
          <Plus className="mr-2 h-4 w-4" />
          手动录入
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">手动录入食物</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="manual-food-name">食物名称</Label>
                <Input id="manual-food-name" value={form.foodName} onChange={(event) => setForm((current) => ({ ...current, foodName: event.target.value }))} placeholder="如：鸡蛋、米饭" />
              </div>
              <div className="space-y-2">
                <Label>餐别</Label>
                <Select value={form.mealType} onValueChange={(value) => value && setForm((current) => ({ ...current, mealType: value }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(MEAL_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="manual-calories">热量（千卡）</Label>
                <Input id="manual-calories" type="number" min="0" value={form.calories} onChange={(event) => setForm((current) => ({ ...current, calories: toNumber(event.target.value) }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="manual-portion">份量描述</Label>
                <Input id="manual-portion" value={form.portionDesc} onChange={(event) => setForm((current) => ({ ...current, portionDesc: event.target.value }))} placeholder="如：1 碗约 200g" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="manual-protein">蛋白质（克）</Label>
                <Input id="manual-protein" type="number" min="0" step="0.1" value={form.proteinG} onChange={(event) => setForm((current) => ({ ...current, proteinG: toNumber(event.target.value) }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="manual-fat">脂肪（克）</Label>
                <Input id="manual-fat" type="number" min="0" step="0.1" value={form.fatG} onChange={(event) => setForm((current) => ({ ...current, fatG: toNumber(event.target.value) }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="manual-carbs">碳水（克）</Label>
                <Input id="manual-carbs" type="number" min="0" step="0.1" value={form.carbsG} onChange={(event) => setForm((current) => ({ ...current, carbsG: toNumber(event.target.value) }))} />
              </div>
            </div>
            <Button type="button" onClick={handleManualSave} disabled={savingManual} className="w-full">
              <UtensilsCrossed className="mr-2 h-4 w-4" />
              {savingManual ? "保存中..." : "保存"}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">今日记录</CardTitle>
        </CardHeader>
        <CardContent>
          {meals.length === 0 ? (
            <p className="py-6 text-center text-sm text-neutral-400">今日暂无记录</p>
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
                        <div key={item.recordId} className="flex items-center justify-between gap-3 border bg-white p-3">
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
                            className="h-8 w-8 text-neutral-400 hover:text-red-500"
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
