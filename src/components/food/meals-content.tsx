"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { Camera, Plus, UtensilsCrossed, Beef, Droplet, Wheat, Trash2 } from "lucide-react"
import { MEAL_LABELS, formatCalories, formatGrams } from "@/lib/utils"
import { FoodPhotoUpload } from "@/components/food/photo-upload"

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

interface MealsContentProps {
  today: string
  initialMeals: MealItem[]
}

export function MealsContent({ today, initialMeals }: MealsContentProps) {
  const router = useRouter()
  const [meals, setMeals] = useState<MealItem[]>(initialMeals)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    foodName: "",
    mealType: "breakfast",
    calories: 0,
    proteinG: 0,
    fatG: 0,
    carbsG: 0,
    portionDesc: "",
    notes: "",
  })
  const [saving, setSaving] = useState(false)

  const resetForm = () => {
    setForm({ foodName: "", mealType: "breakfast", calories: 0, proteinG: 0, fatG: 0, carbsG: 0, portionDesc: "", notes: "" })
    setShowForm(false)
  }

  const handleManualSave = async () => {
    if (!form.foodName.trim()) {
      toast.error("请输入食物名称")
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/meals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, recordDate: today }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      const newMeal: MealItem = {
        recordId: json.data.recordId,
        foodName: form.foodName,
        mealType: form.mealType,
        calories: form.calories,
        proteinG: form.proteinG,
        fatG: form.fatG,
        carbsG: form.carbsG,
        portionDesc: form.portionDesc || null,
        recordTime: json.data.recordTime,
      }
      setMeals((prev) => [...prev, newMeal])
      toast.success("已添加饮食记录")
      resetForm()
      router.refresh()
    } catch (e) {
      toast.error("保存失败: " + (e instanceof Error ? e.message : String(e)))
    } finally {
      setSaving(false)
    }
  }

  const handleAIRecord = async (aiData: {
    foodName: string
    mealType: string
    calories: number
    proteinG: number
    fatG: number
    carbsG: number
    portionDesc: string
    imageData?: string
  }) => {
    setSaving(true)
    try {
      const res = await fetch("/api/meals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recordDate: today,
          recognitionRaw: aiData.imageData ? JSON.stringify({ imageDataLength: aiData.imageData.length }) : null,
          ...aiData,
        }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      const newMeal: MealItem = {
        recordId: json.data.recordId,
        foodName: aiData.foodName,
        mealType: aiData.mealType,
        calories: aiData.calories,
        proteinG: aiData.proteinG,
        fatG: aiData.fatG,
        carbsG: aiData.carbsG,
        portionDesc: aiData.portionDesc || null,
        recordTime: json.data.recordTime,
      }
      setMeals((prev) => [...prev, newMeal])
      toast.success("AI 识别并保存成功")
      router.refresh()
    } catch (e) {
      toast.error("保存失败: " + (e instanceof Error ? e.message : String(e)))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (recordId: number) => {
    try {
      const res = await fetch(`/api/meals?id=${recordId}`, { method: "DELETE" })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setMeals((prev) => prev.filter((m) => m.recordId !== recordId))
      toast.success("已删除记录")
      router.refresh()
    } catch (e) {
      toast.error("删除失败: " + (e instanceof Error ? e.message : String(e)))
    }
  }

  const mealsByType = meals.reduce(
    (acc, m) => {
      acc[m.mealType] = acc[m.mealType] || []
      acc[m.mealType].push(m)
      return acc
    },
    {} as Record<string, MealItem[]>
  )

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Camera className="h-4 w-4" />
              拍照识别
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <FoodPhotoUpload onRecord={handleAIRecord} disabled={saving} />
        </CardContent>
      </Card>

      <div className="flex items-center gap-2">
        <Button onClick={() => setShowForm(!showForm)} variant="outline" className="flex-1">
          <Plus className="h-4 w-4 mr-2" />
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
                <Label>食物名称</Label>
                <Input value={form.foodName} onChange={(e) => setForm((f) => ({ ...f, foodName: e.target.value }))} placeholder="如：鸡蛋、米饭" />
              </div>
              <div className="space-y-2">
                <Label>餐别</Label>
                <Select value={form.mealType} onValueChange={(v) => v && setForm((f) => ({ ...f, mealType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(MEAL_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>热量（千卡）</Label>
                <Input type="number" value={form.calories || ""} onChange={(e) => setForm((f) => ({ ...f, calories: Number(e.target.value) }))} />
              </div>
              <div className="space-y-2">
                <Label>份量描述</Label>
                <Input value={form.portionDesc} onChange={(e) => setForm((f) => ({ ...f, portionDesc: e.target.value }))} placeholder="如：1碗约200g" />
              </div>
              <div className="space-y-2">
                <Label>蛋白质（克）</Label>
                <Input type="number" step="0.1" value={form.proteinG || ""} onChange={(e) => setForm((f) => ({ ...f, proteinG: Number(e.target.value) }))} />
              </div>
              <div className="space-y-2">
                <Label>脂肪（克）</Label>
                <Input type="number" step="0.1" value={form.fatG || ""} onChange={(e) => setForm((f) => ({ ...f, fatG: Number(e.target.value) }))} />
              </div>
              <div className="space-y-2">
                <Label>碳水（克）</Label>
                <Input type="number" step="0.1" value={form.carbsG || ""} onChange={(e) => setForm((f) => ({ ...f, carbsG: Number(e.target.value) }))} />
              </div>
            </div>
            <Button onClick={handleManualSave} disabled={saving} className="w-full">
              <UtensilsCrossed className="h-4 w-4 mr-2" />
              {saving ? "保存中..." : "保存"}
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
            <p className="text-sm text-neutral-400 text-center py-6">今日暂无记录</p>
          ) : (
            <div className="space-y-4">
              {(["breakfast", "lunch", "dinner", "snack"] as const).map((type) => {
                const items = mealsByType[type]
                if (!items?.length) return null
                return (
                  <div key={type}>
                    <h4 className="text-sm font-medium text-neutral-600 mb-2">{MEAL_LABELS[type]}</h4>
                    <div className="space-y-2">
                      {items.map((item) => (
                        <div key={item.recordId} className="flex items-center justify-between rounded-lg border bg-white p-3">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-neutral-800">{item.foodName}</p>
                            <div className="flex gap-3 text-xs text-neutral-500 mt-1">
                              <span>{formatCalories(item.calories)} 千卡</span>
                              <span className="flex items-center gap-0.5"><Beef className="h-3 w-3" />{formatGrams(item.proteinG)}</span>
                              <span className="flex items-center gap-0.5"><Droplet className="h-3 w-3" />{formatGrams(item.fatG)}</span>
                              <span className="flex items-center gap-0.5"><Wheat className="h-3 w-3" />{formatGrams(item.carbsG)}</span>
                              {item.portionDesc && <span>{item.portionDesc}</span>}
                            </div>
                          </div>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-neutral-400 hover:text-red-500" onClick={() => handleDelete(item.recordId)}>
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
