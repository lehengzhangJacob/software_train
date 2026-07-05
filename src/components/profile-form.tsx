"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Save, Calculator, Info } from "lucide-react"

interface UserData {
  userId?: number
  username: string
  gender: string
  age: number
  heightCm: number
  weightKg: number
  dailyCalorieTarget: number
  dailyProteinTarget: number
  dailyFatTarget: number
  dailyCarbsTarget: number
  bmr?: number | null
  activityLevel: string
}

interface ProfileFormProps {
  user?: UserData
}

const ACTIVITY_LEVELS = [
  { value: "sedentary", label: "久坐不动（几乎不运动）", multiplier: 1.2 },
  { value: "lightly_active", label: "轻度活动（每周1-3天）", multiplier: 1.375 },
  { value: "moderately_active", label: "中度活动（每周3-5天）", multiplier: 1.55 },
  { value: "very_active", label: "高度活跃（每周6-7天）", multiplier: 1.725 },
  { value: "extra_active", label: "极高活跃（高强度体力劳动）", multiplier: 1.9 },
]

function calcBMR(gender: string, weight: number, height: number, age: number): number {
  const bmr = 10 * weight + 6.25 * height - 5 * age
  if (gender === "male") return Math.round((bmr + 5) * 10) / 10
  if (gender === "female") return Math.round((bmr - 161) * 10) / 10
  return Math.round((bmr - 78) * 10) / 10
}

function calcTDEE(bmr: number, activity: string): number {
  const mult = ACTIVITY_LEVELS.find((a) => a.value === activity)?.multiplier ?? 1.2
  return Math.round(bmr * mult)
}

export function ProfileForm({ user }: ProfileFormProps) {
  const [form, setForm] = useState<UserData>(
    user ?? {
      username: "",
      gender: "male",
      age: 25,
      heightCm: 170,
      weightKg: 65,
      dailyCalorieTarget: 2000,
      dailyProteinTarget: 60,
      dailyFatTarget: 60,
      dailyCarbsTarget: 250,
      activityLevel: "sedentary",
    }
  )
  const [saving, setSaving] = useState(false)

  const bmr = calcBMR(form.gender, form.weightKg, form.heightCm, form.age)
  const tdee = calcTDEE(bmr, form.activityLevel)

  useEffect(() => {
    if (!user) {
      setForm((prev) => ({ ...prev, dailyCalorieTarget: tdee }))
    }
  }, [tdee, user])

  const update = (key: keyof UserData, value: string | number | null) => {
    if (value === null) return
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, userId: user?.userId }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      toast.success(user ? "已更新个人信息" : "已创建个人信息")
    } catch (e) {
      toast.error("保存失败: " + (e instanceof Error ? e.message : String(e)))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">身体参数</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="username">昵称</Label>
              <Input id="username" value={form.username} onChange={(e) => update("username", e.target.value)} placeholder="你的名字" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gender">性别</Label>
              <Select value={form.gender} onValueChange={(v) => update("gender", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">男性</SelectItem>
                  <SelectItem value="female">女性</SelectItem>
                  <SelectItem value="other">其他</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="age">年龄</Label>
              <Input id="age" type="number" value={form.age} onChange={(e) => update("age", Number(e.target.value))} min={1} max={149} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="weight">体重（kg）</Label>
              <Input id="weight" type="number" step="0.1" value={form.weightKg} onChange={(e) => update("weightKg", Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="height">身高（cm）</Label>
              <Input id="height" type="number" step="0.1" value={form.heightCm} onChange={(e) => update("heightCm", Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="activity">活动水平</Label>
              <Select value={form.activityLevel} onValueChange={(v) => update("activityLevel", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ACTIVITY_LEVELS.map((l) => (
                    <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-emerald-50 border-emerald-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2 text-emerald-800">
            <Calculator className="h-4 w-4" />
            代谢估算
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs text-emerald-600">基础代谢率 (BMR)</p>
              <p className="text-2xl font-bold text-emerald-900">{bmr} <span className="text-sm font-normal text-emerald-700">千卡/天</span></p>
            </div>
            <div>
              <p className="text-xs text-emerald-600">每日总消耗 (TDEE)</p>
              <p className="text-2xl font-bold text-emerald-900">{tdee} <span className="text-sm font-normal text-emerald-700">千卡/天</span></p>
            </div>
          </div>
          <div className="flex items-start gap-2 mt-3 text-xs text-emerald-700">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>BMR 基于 Mifflin-St Jeor 公式计算。TDEE = BMR x 活动系数。建议每日热量目标设定在 TDEE 附近。</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">每日营养目标</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="calorie">热量（千卡）</Label>
              <Input id="calorie" type="number" value={form.dailyCalorieTarget} onChange={(e) => update("dailyCalorieTarget", Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="protein">蛋白质（克）</Label>
              <Input id="protein" type="number" step="0.1" value={form.dailyProteinTarget} onChange={(e) => update("dailyProteinTarget", Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fat">脂肪（克）</Label>
              <Input id="fat" type="number" step="0.1" value={form.dailyFatTarget} onChange={(e) => update("dailyFatTarget", Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="carbs">碳水（克）</Label>
              <Input id="carbs" type="number" step="0.1" value={form.dailyCarbsTarget} onChange={(e) => update("dailyCarbsTarget", Number(e.target.value))} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
        <Save className="h-4 w-4 mr-2" />
        {saving ? "保存中..." : "保存设置"}
      </Button>
    </div>
  )
}
