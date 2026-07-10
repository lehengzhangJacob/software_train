"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { toast } from "sonner"
import { ChevronLeft, ChevronRight, Beef, Droplet, Wheat, Trash2, Pencil } from "lucide-react"
import { MEAL_LABELS, formatCalories, formatGrams } from "@/lib/utils"
import { cn } from "@/lib/utils"

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

interface CalendarContentProps {
  today: string
  availableDates: string[]
  initialMeals: MealItem[]
}

export function CalendarContent({ today, availableDates, initialMeals }: CalendarContentProps) {
  const router = useRouter()
  const [currentDate, setCurrentDate] = useState(today)
  const [meals, setMeals] = useState<MealItem[]>(initialMeals)
  const [editingMeal, setEditingMeal] = useState<MealItem | null>(null)
  const [editForm, setEditForm] = useState({ foodName: "", calories: 0, proteinG: 0, fatG: 0, carbsG: 0, portionDesc: "" })

  const dateSet = new Set(availableDates)

  useEffect(() => {
    const fetchMeals = async () => {
      const res = await fetch(`/api/meals?date=${currentDate}`, { cache: "no-store" })
      const json = await res.json()
      if (json.data) setMeals(json.data)
    }

    void fetchMeals()
  }, [currentDate])

  const changeDate = (delta: number) => {
    const d = new Date(currentDate)
    d.setDate(d.getDate() + delta)
    setCurrentDate(d.toISOString().slice(0, 10))
  }

  const isToday = currentDate === today

  const mealsByType = meals.reduce(
    (acc, m) => {
      acc[m.mealType] = acc[m.mealType] || []
      acc[m.mealType].push(m)
      return acc
    },
    {} as Record<string, MealItem[]>
  )

  const totalCals = meals.reduce((s, m) => s + m.calories, 0)

  const handleDelete = async (recordId: number) => {
    const res = await fetch(`/api/meals?id=${recordId}`, { method: "DELETE" })
    const json = await res.json()
    if (json.error) { toast.error("删除失败"); return }
    setMeals((prev) => prev.filter((m) => m.recordId !== recordId))
    toast.success("已删除")
    router.refresh()
  }

  const openEdit = (meal: MealItem) => {
    setEditingMeal(meal)
    setEditForm({ foodName: meal.foodName, calories: meal.calories, proteinG: meal.proteinG, fatG: meal.fatG, carbsG: meal.carbsG, portionDesc: meal.portionDesc ?? "" })
  }

  const handleEditSave = async () => {
    if (!editingMeal) return
    const res = await fetch("/api/meals", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recordId: editingMeal.recordId, ...editForm }),
    })
    const json = await res.json()
    if (json.error) { toast.error("更新失败"); return }
    setMeals((prev) => prev.map((m) => m.recordId === editingMeal.recordId ? { ...m, ...editForm } : m))
    setEditingMeal(null)
    toast.success("已更新")
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={() => changeDate(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="text-center">
              <p className="text-sm font-medium text-neutral-800">{currentDate}</p>
              {isToday && <p className="text-xs text-emerald-600">今天</p>}
            </div>
            <Button variant="ghost" size="icon" onClick={() => changeDate(1)} disabled={isToday}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex gap-1 justify-center mt-2">
            {Array.from({ length: 7 }, (_, i) => {
              const d = new Date(today)
              d.setDate(d.getDate() - (6 - i))
              const dateStr = d.toISOString().slice(0, 10)
              const hasData = dateSet.has(dateStr)
              const isSelected = dateStr === currentDate
              return (
                <button
                  key={dateStr}
                  onClick={() => setCurrentDate(dateStr)}
                  className={cn(
                    "h-8 w-8 rounded-full text-xs transition-colors",
                    isSelected ? "bg-emerald-600 text-white" : hasData ? "bg-emerald-100 text-emerald-700" : "text-neutral-400 hover:bg-neutral-100"
                  )}
                >
                  {d.getDate()}
                </button>
              )
            })}
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-neutral-500 text-center">
            共 {meals.length} 项食物 · 合计 {formatCalories(totalCals)} 千卡
          </p>
        </CardContent>
      </Card>

      <div className="space-y-3">
        {(["breakfast", "lunch", "dinner", "snack"] as const).map((type) => {
          const items = mealsByType[type]
          if (!items?.length) return null
          return (
            <Card key={type}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-neutral-600">{MEAL_LABELS[type]} ({items.length} 项)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {items.map((item) => (
                  <div key={item.recordId} className="flex items-center justify-between rounded-lg border bg-white p-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-neutral-800 truncate">{item.foodName}</p>
                      <div className="flex gap-3 text-xs text-neutral-500 mt-1 flex-wrap">
                        <span>{formatCalories(item.calories)} 千卡</span>
                        <span className="flex items-center gap-0.5"><Beef className="h-3 w-3" />{formatGrams(item.proteinG)}</span>
                        <span className="flex items-center gap-0.5"><Droplet className="h-3 w-3" />{formatGrams(item.fatG)}</span>
                        <span className="flex items-center gap-0.5"><Wheat className="h-3 w-3" />{formatGrams(item.carbsG)}</span>
                        {item.portionDesc && <span>{item.portionDesc}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 ml-2">
                      <Dialog>
                        <DialogTrigger onClick={() => openEdit(item)}>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-neutral-400">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader><DialogTitle>编辑食物</DialogTitle></DialogHeader>
                          <div className="space-y-3">
                            <Input value={editForm.foodName} onChange={(e) => setEditForm((f) => ({ ...f, foodName: e.target.value }))} placeholder="食物名称" />
                            <div className="grid grid-cols-2 gap-3">
                              <Input type="number" value={editForm.calories || ""} onChange={(e) => setEditForm((f) => ({ ...f, calories: Number(e.target.value) }))} placeholder="热量" />
                              <Input type="number" step="0.1" value={editForm.proteinG || ""} onChange={(e) => setEditForm((f) => ({ ...f, proteinG: Number(e.target.value) }))} placeholder="蛋白质" />
                              <Input type="number" step="0.1" value={editForm.fatG || ""} onChange={(e) => setEditForm((f) => ({ ...f, fatG: Number(e.target.value) }))} placeholder="脂肪" />
                              <Input type="number" step="0.1" value={editForm.carbsG || ""} onChange={(e) => setEditForm((f) => ({ ...f, carbsG: Number(e.target.value) }))} placeholder="碳水" />
                            </div>
                            <Button onClick={handleEditSave} className="w-full">保存修改</Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-neutral-400 hover:text-red-500" onClick={() => handleDelete(item.recordId)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )
        })}
        {meals.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-sm text-neutral-400">当天暂无饮食记录</CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
