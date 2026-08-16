"use client"

import { type FormEvent, useState } from "react"
import { useRouter } from "next/navigation"
import { Calculator, Info, Save, Sparkles } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface UserData {
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
  { value: "lightly_active", label: "轻度活动（每周 1-3 天）", multiplier: 1.375 },
  { value: "moderately_active", label: "中度活动（每周 3-5 天）", multiplier: 1.55 },
  { value: "very_active", label: "高度活跃（每周 6-7 天）", multiplier: 1.725 },
  { value: "extra_active", label: "极高活跃（高强度体力劳动）", multiplier: 1.9 },
]

function calcBMR(gender: string, weight: number, height: number, age: number): number {
  const bmr = 10 * weight + 6.25 * height - 5 * age
  if (gender === "male") return Math.round((bmr + 5) * 10) / 10
  if (gender === "female") return Math.round((bmr - 161) * 10) / 10
  return Math.round((bmr - 78) * 10) / 10
}

function calcTDEE(bmr: number, activity: string): number {
  const multiplier = ACTIVITY_LEVELS.find((item) => item.value === activity)?.multiplier ?? 1.2
  return Math.round(bmr * multiplier)
}

function createDefaultUserData(): UserData {
  const defaults = {
    username: "",
    gender: "male",
    age: 25,
    heightCm: 170,
    weightKg: 65,
    dailyProteinTarget: 60,
    dailyFatTarget: 60,
    dailyCarbsTarget: 250,
    activityLevel: "sedentary",
  }
  const bmr = calcBMR(defaults.gender, defaults.weightKg, defaults.heightCm, defaults.age)

  return {
    ...defaults,
    dailyCalorieTarget: calcTDEE(bmr, defaults.activityLevel),
    bmr,
  }
}

function profileInitial(name: string) {
  return name.trim().slice(0, 1).toUpperCase() || "我"
}

export function ProfileForm({ user }: ProfileFormProps) {
  const router = useRouter()
  const [form, setForm] = useState<UserData>(() => user ?? createDefaultUserData())
  const [hasProfile, setHasProfile] = useState(Boolean(user))
  const [saving, setSaving] = useState(false)

  const bmr = calcBMR(form.gender, form.weightKg, form.heightCm, form.age)
  const tdee = calcTDEE(bmr, form.activityLevel)

  const update = (key: keyof UserData, value: string | number | null) => {
    if (value === null) return
    setForm((current) => ({ ...current, [key]: value }))
  }

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!form.username.trim()) {
      toast.error("请输入昵称")
      return
    }

    const positiveValues = [form.age, form.heightCm, form.weightKg, form.dailyCalorieTarget]
    const nonNegativeTargets = [form.dailyProteinTarget, form.dailyFatTarget, form.dailyCarbsTarget]
    if (positiveValues.some((value) => !Number.isFinite(value) || value <= 0) || form.age >= 150) {
      toast.error("请填写有效的年龄、身高和体重")
      return
    }
    if (nonNegativeTargets.some((value) => !Number.isFinite(value) || value < 0)) {
      toast.error("营养目标不能为负数")
      return
    }

    setSaving(true)
    try {
      const payload = {
        username: form.username.trim(),
        gender: form.gender,
        age: form.age,
        heightCm: form.heightCm,
        weightKg: form.weightKg,
        dailyCalorieTarget: form.dailyCalorieTarget,
        dailyProteinTarget: form.dailyProteinTarget,
        dailyFatTarget: form.dailyFatTarget,
        dailyCarbsTarget: form.dailyCarbsTarget,
        activityLevel: form.activityLevel,
      }
      const response = await fetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const result = await response.json()
      if (!response.ok || result.error || !result.data) throw new Error(result.error || "保存失败")

      const saved = result.data as UserData
      setForm({
        username: saved.username,
        gender: saved.gender,
        age: saved.age,
        heightCm: saved.heightCm,
        weightKg: saved.weightKg,
        dailyCalorieTarget: saved.dailyCalorieTarget,
        dailyProteinTarget: saved.dailyProteinTarget,
        dailyFatTarget: saved.dailyFatTarget,
        dailyCarbsTarget: saved.dailyCarbsTarget,
        bmr: saved.bmr,
        activityLevel: saved.activityLevel,
      })

      const wasFirstSave = !hasProfile
      setHasProfile(true)
      toast.success(wasFirstSave ? "已创建个人信息" : "已更新个人信息")
      if (wasFirstSave) router.replace("/dashboard")
      else router.refresh()
    } catch (error) {
      toast.error(`保存失败: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="surface-card overflow-hidden border-0" onSubmit={handleSave}>
      <div className="grid lg:grid-cols-[22rem_minmax(0,1fr)]">
        <aside className="bg-[var(--brand-plum)] p-6 text-white sm:p-8 lg:min-h-[680px]">
          <div className="grid size-20 place-items-center rounded-full bg-[var(--brand-lavender)] text-3xl font-semibold">
            {profileInitial(form.username)}
          </div>
          <p className="mt-7 text-[11px] font-semibold uppercase text-[var(--brand-mint)]">Your profile</p>
          <h1 className="mt-2 break-words text-3xl font-semibold">{form.username.trim() || "建立你的个人档案"}</h1>
          <p className="mt-2 text-sm text-white/62">
            {form.age} 岁 · {form.heightCm} cm · {form.weightKg} kg
          </p>

          <div className="mt-8 grid grid-cols-2 gap-3">
            <div className="rounded-md bg-white/8 p-4">
              <p className="text-[10px] text-white/50">基础代谢 BMR</p>
              <strong className="mt-2 block text-2xl">{bmr}</strong>
              <span className="text-[10px] text-white/45">千卡 / 天</span>
            </div>
            <div className="rounded-md bg-white/8 p-4">
              <p className="text-[10px] text-white/50">每日消耗 TDEE</p>
              <strong className="mt-2 block text-2xl">{tdee}</strong>
              <span className="text-[10px] text-white/45">千卡 / 天</span>
            </div>
          </div>

          <div className="mt-5 border-l-2 border-[var(--brand-mint)] bg-white/5 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-[var(--brand-mint)]">
              <Sparkles className="size-3.5" />你的目标由你决定
            </div>
            <p className="mt-2 text-xs leading-5 text-white/62">
              代谢数据只是一般性估算。你可以使用 TDEE，也可以根据真实身体反馈手动调整。
            </p>
          </div>
        </aside>

        <section className="bg-[var(--brand-paper)] p-5 sm:p-7 lg:p-8">
          <p className="page-eyebrow">Personal settings</p>
          <h2 className="mt-2 text-3xl font-semibold leading-tight text-[var(--brand-plum)]">让建议真正适合你。</h2>

          <div className="mt-7">
            <h3 className="text-base font-semibold text-[var(--brand-plum)]">身体参数</h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="username">昵称</Label>
                <Input id="username" className="bg-white" value={form.username} onChange={(event) => update("username", event.target.value)} placeholder="你的名字" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gender">性别</Label>
                <Select value={form.gender} onValueChange={(value) => update("gender", value)}>
                  <SelectTrigger id="gender" type="button" className="w-full bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">男性</SelectItem>
                    <SelectItem value="female">女性</SelectItem>
                    <SelectItem value="other">其他</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="age">年龄</Label>
                <Input id="age" className="bg-white" type="number" value={form.age} onChange={(event) => update("age", Number(event.target.value))} min={1} max={149} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="height">身高（cm）</Label>
                <Input id="height" className="bg-white" type="number" step="0.1" value={form.heightCm} onChange={(event) => update("heightCm", Number(event.target.value))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="weight">体重（kg）</Label>
                <Input id="weight" className="bg-white" type="number" step="0.1" value={form.weightKg} onChange={(event) => update("weightKg", Number(event.target.value))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="activity">活动水平</Label>
                <Select value={form.activityLevel} onValueChange={(value) => update("activityLevel", value)}>
                  <SelectTrigger id="activity" type="button" className="w-full bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ACTIVITY_LEVELS.map((level) => <SelectItem key={level.value} value={level.value}>{level.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="my-7 border-t border-border/80" />

          <div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-[var(--brand-plum)]">每日营养目标</h3>
                <p className="mt-1 text-xs text-muted-foreground">这些目标会直接参与首页、报告和 Agent 建议。</p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={() => update("dailyCalorieTarget", tdee)}>
                <Calculator />使用 TDEE
              </Button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <div className="space-y-2 rounded-md bg-[var(--brand-lavender-soft)] p-3">
                <Label htmlFor="calorie">热量（千卡）</Label>
                <Input id="calorie" className="border-0 bg-white" type="number" value={form.dailyCalorieTarget} onChange={(event) => update("dailyCalorieTarget", Number(event.target.value))} />
              </div>
              <div className="space-y-2 rounded-md bg-[var(--brand-lavender-soft)] p-3">
                <Label htmlFor="protein">蛋白质（克）</Label>
                <Input id="protein" className="border-0 bg-white" type="number" step="0.1" value={form.dailyProteinTarget} onChange={(event) => update("dailyProteinTarget", Number(event.target.value))} />
              </div>
              <div className="space-y-2 rounded-md bg-[var(--brand-lavender-soft)] p-3">
                <Label htmlFor="fat">脂肪（克）</Label>
                <Input id="fat" className="border-0 bg-white" type="number" step="0.1" value={form.dailyFatTarget} onChange={(event) => update("dailyFatTarget", Number(event.target.value))} />
              </div>
              <div className="space-y-2 rounded-md bg-[var(--brand-lavender-soft)] p-3">
                <Label htmlFor="carbs">碳水（克）</Label>
                <Input id="carbs" className="border-0 bg-white" type="number" step="0.1" value={form.dailyCarbsTarget} onChange={(event) => update("dailyCarbsTarget", Number(event.target.value))} />
              </div>
            </div>
          </div>

          <div className="mt-7 flex flex-col gap-4 border-t border-border/80 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex max-w-md items-start gap-2 text-xs leading-5 text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0" />
              BMR 使用 Mifflin-St Jeor 公式估算，TDEE = BMR x 活动系数，不构成医疗建议。
            </p>
            <Button type="submit" disabled={saving} className="w-full sm:w-auto">
              <Save />{saving ? "保存中…" : "保存设置"}
            </Button>
          </div>
        </section>
      </div>
    </form>
  )
}
