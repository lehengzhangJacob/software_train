"use client"

import Image from "next/image"
import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Activity, Check, Clock, Dumbbell, Flame, HeartPulse, Loader2, RotateCcw, Sparkles, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn, formatCalories } from "@/lib/utils"

interface Candidate {
  exerciseId: number
  exerciseName: string
  caloriesPer30min: number
  category: string | null
  suggestedMinutes: number
  calorieBurnEstimate: number
  description: string | null
}

interface AdoptedPlan {
  suggestionId: number
  exerciseType: string
  durationMinutes: number
  calorieBurnEstimate: number
  intensity: string | null
  suggestionDetail: string | null
  isAdopted: number
}

interface ExerciseData {
  totalCalories: number
  dailyTarget: number
  surplus: number
  candidates: Candidate[]
  adopted: AdoptedPlan[]
}

interface ApiEnvelope<T> {
  data?: T
  error?: string
}

interface ExerciseContentProps {
  today: string
}

function categoryLabel(category: string | null) {
  if (category === "aerobic") return "有氧"
  if (category === "strength") return "力量"
  return category || "日常活动"
}

async function readApiEnvelope<T>(response: Response): Promise<ApiEnvelope<T>> {
  try {
    return (await response.json()) as ApiEnvelope<T>
  } catch {
    return { error: "请求失败，请稍后重试" }
  }
}

function MovementMedia() {
  return (
    <div className="relative min-h-[300px] lg:min-h-[680px]">
      <Image
        src="/images/nutrition/movement-hero.png"
        alt="在健身房进行下肢拉伸的训练者"
        fill
        priority
        sizes="(max-width: 1024px) 100vw, 46vw"
        className="object-cover"
      />
      <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(45,39,53,.82)_0%,transparent_52%)]" />
      <div className="absolute inset-x-5 bottom-5 rounded-md bg-[var(--brand-plum)]/94 p-5 text-white sm:inset-x-7 sm:bottom-7">
        <p className="text-[11px] font-semibold uppercase text-[var(--brand-mint)]">Today&apos;s movement</p>
        <p className="mt-2 text-2xl font-semibold">动一动，身体会记得。</p>
        <p className="mt-2 text-xs leading-5 text-white/65">不需要追求极限，完成今天适合你的那一小步。</p>
      </div>
    </div>
  )
}

export function ExerciseContent({ today }: ExerciseContentProps) {
  const router = useRouter()
  const [data, setData] = useState<ExerciseData | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loadedDate, setLoadedDate] = useState<string | null>(null)
  const [errorDate, setErrorDate] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [savingCandidates, setSavingCandidates] = useState<Set<number>>(new Set())
  const [savingPlans, setSavingPlans] = useState<Set<number>>(new Set())
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({})

  const reloadSuggestions = useCallback(() => {
    setLoading(true)
    setData(null)
    setLoadedDate(null)
    setLoadError(null)
    setErrorDate(null)
    setReloadKey((current) => current + 1)
  }, [])

  useEffect(() => {
    const controller = new AbortController()

    const loadSuggestions = async () => {
      setLoading(true)
      setData(null)
      setLoadedDate(null)
      setLoadError(null)
      setErrorDate(null)

      try {
        const response = await fetch(`/api/exercise/suggest?date=${today}`, {
          cache: "no-store",
          signal: controller.signal,
        })
        const result = await readApiEnvelope<ExerciseData>(response)

        if (controller.signal.aborted) return

        if (!response.ok || !result.data) {
          setLoadError(result.error || "暂时无法读取活动建议，请稍后重试")
          setErrorDate(today)
          return
        }

        setData(result.data)
        setLoadedDate(today)
      } catch {
        if (!controller.signal.aborted) {
          setLoadError("暂时无法读取活动建议，请稍后重试")
          setErrorDate(today)
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }

    void loadSuggestions()
    return () => controller.abort()
  }, [reloadKey, today])

  const adoptCandidate = async (candidate: Candidate) => {
    const errorKey = `candidate-${candidate.exerciseId}`
    setSavingCandidates((current) => new Set(current).add(candidate.exerciseId))
    setRowErrors((current) => {
      const next = { ...current }
      delete next[errorKey]
      return next
    })

    try {
      const response = await fetch("/api/exercise/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exerciseId: candidate.exerciseId,
          durationMinutes: candidate.suggestedMinutes,
          date: today,
        }),
      })
      const result = await readApiEnvelope<AdoptedPlan>(response)
      if (!response.ok || !result.data) throw new Error(result.error || "采用计划失败")

      reloadSuggestions()
      router.refresh()
    } catch (error) {
      setRowErrors((current) => ({
        ...current,
        [errorKey]: error instanceof Error ? error.message : "采用计划失败，请重试",
      }))
    } finally {
      setSavingCandidates((current) => {
        const next = new Set(current)
        next.delete(candidate.exerciseId)
        return next
      })
    }
  }

  const cancelPlan = async (plan: AdoptedPlan) => {
    const errorKey = `plan-${plan.suggestionId}`
    setSavingPlans((current) => new Set(current).add(plan.suggestionId))
    setRowErrors((current) => {
      const next = { ...current }
      delete next[errorKey]
      return next
    })

    try {
      const response = await fetch("/api/exercise/suggest", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suggestionId: plan.suggestionId, isAdopted: false }),
      })
      const result = await readApiEnvelope<AdoptedPlan>(response)
      if (!response.ok || !result.data) throw new Error(result.error || "取消采用失败")

      reloadSuggestions()
      router.refresh()
    } catch (error) {
      setRowErrors((current) => ({
        ...current,
        [errorKey]: error instanceof Error ? error.message : "取消采用失败，请重试",
      }))
    } finally {
      setSavingPlans((current) => {
        const next = new Set(current)
        next.delete(plan.suggestionId)
        return next
      })
    }
  }

  const hasCurrentData = data !== null && loadedDate === today
  const hasCurrentError = loadError !== null && errorDate === today

  if (loading || (!hasCurrentData && !hasCurrentError)) {
    return (
      <section className="surface-card grid overflow-hidden border-0 lg:grid-cols-[.92fr_1.08fr]">
        <MovementMedia />
        <div className="flex min-h-[440px] items-center justify-center p-6">
          <div className="text-center">
            <Loader2 className="mx-auto size-7 animate-spin text-[var(--brand-mint-deep)]" />
            <p className="mt-4 text-sm text-muted-foreground">正在结合今天的记录安排活动…</p>
          </div>
        </div>
      </section>
    )
  }

  if (!hasCurrentData) {
    return (
      <section className="surface-card grid overflow-hidden border-0 lg:grid-cols-[.92fr_1.08fr]">
        <MovementMedia />
        <div className="flex min-h-[440px] items-center justify-center p-6">
          <div className="max-w-sm text-center">
            <HeartPulse className="mx-auto size-8 text-[var(--brand-coral)]" />
            <h1 className="mt-4 text-2xl font-semibold text-[var(--brand-heading)]">今天的建议暂时没准备好</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground" role="alert">{loadError || "暂时无法读取活动建议"}</p>
            <Button type="button" variant="outline" className="mt-5" onClick={reloadSuggestions}>
              <RotateCcw />重试
            </Button>
          </div>
        </div>
      </section>
    )
  }

  const adoptedPlans = data.adopted.filter((plan) => plan.isAdopted === 1)
  const isAboveTarget = data.surplus > 0
  const movementMessage = isAboveTarget
    ? "今天吃得更充足，适合用轻松活动找回身体节奏。"
    : "摄入仍在目标内，今天不必补偿，保持适度活动就很好。"

  return (
    <div className="space-y-4">
      <section className="surface-card grid overflow-hidden border-0 lg:grid-cols-[.92fr_1.08fr]">
        <MovementMedia />

        <div className="min-w-0 bg-[var(--brand-paper)] p-5 sm:p-7 lg:p-8">
          <p className="page-eyebrow">为你安排</p>
          <h1 className="mt-2 text-3xl font-semibold leading-tight text-[var(--brand-heading)] sm:text-4xl">今天适合轻一点。</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">{movementMessage}</p>

          <div className="mt-6 grid grid-cols-3 gap-2">
            <div className="rounded-md bg-[var(--brand-lavender-soft)] p-3">
              <span className="text-[10px] text-muted-foreground">今日摄入</span>
              <strong className="mt-1 block text-lg text-[var(--brand-heading)]">{formatCalories(data.totalCalories)}</strong>
            </div>
            <div className="rounded-md bg-[var(--brand-lavender-soft)] p-3">
              <span className="text-[10px] text-muted-foreground">目标</span>
              <strong className="mt-1 block text-lg text-[var(--brand-heading)]">{formatCalories(data.dailyTarget)}</strong>
            </div>
            <div className="rounded-md bg-[var(--brand-lavender-soft)] p-3">
              <span className="text-[10px] text-muted-foreground">摄入状态</span>
              <strong className={cn("mt-1 block text-sm", isAboveTarget ? "text-[var(--brand-coral)]" : "text-[var(--brand-mint-deep)]")}>
                {isAboveTarget ? `高 ${formatCalories(data.surplus)}` : `余 ${formatCalories(Math.abs(data.surplus))}`}
              </strong>
            </div>
          </div>

          {adoptedPlans.length > 0 ? (
            <div className="mt-6 border-l-2 border-[var(--brand-mint)] bg-card p-4">
              <div className="flex items-center gap-2 text-xs font-semibold text-[var(--brand-mint-deep)]">
                <Check className="size-3.5" />今天已加入
              </div>
              <div className="mt-3 space-y-3">
                {adoptedPlans.map((plan) => {
                  const saving = savingPlans.has(plan.suggestionId)
                  const errorKey = `plan-${plan.suggestionId}`
                  return (
                    <div key={plan.suggestionId} className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-[var(--brand-heading)]">{plan.exerciseType} · {plan.durationMinutes} 分钟</p>
                        <p className="mt-1 text-xs text-muted-foreground">预计消耗 {formatCalories(plan.calorieBurnEstimate)} 千卡</p>
                        {rowErrors[errorKey] ? <p className="mt-1 text-xs text-destructive" role="alert">{rowErrors[errorKey]}</p> : null}
                      </div>
                      <Button type="button" variant="ghost" size="icon-sm" aria-label={`取消 ${plan.exerciseType}`} title="取消采用" disabled={saving} onClick={() => void cancelPlan(plan)}>
                        {saving ? <Loader2 className="animate-spin" /> : <X />}
                      </Button>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : null}

          <div className="mt-7">
            <div className="mb-2 flex items-end justify-between gap-3">
              <div>
                <p className="page-eyebrow">Movement options</p>
                <h2 className="mt-1 text-xl font-semibold text-[var(--brand-heading)]">选择今天做得到的</h2>
              </div>
              <Dumbbell className="size-5 text-[var(--brand-lavender)]" />
            </div>

            {data.candidates.length === 0 ? (
              <div className="mt-4 border border-dashed border-border p-5 text-center text-sm text-muted-foreground">暂无可选活动建议</div>
            ) : (
              <div className="divide-y divide-border/80">
                {data.candidates.map((candidate, index) => {
                  const saving = savingCandidates.has(candidate.exerciseId)
                  const errorKey = `candidate-${candidate.exerciseId}`
                  const alreadyAdopted = adoptedPlans.some((plan) => plan.exerciseType === candidate.exerciseName)
                  return (
                    <article key={candidate.exerciseId} className="grid gap-3 py-4 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
                      <div className={cn(
                        "grid size-10 place-items-center rounded-full text-sm font-semibold",
                        index === 0 ? "bg-[var(--brand-mint-soft)] text-[var(--brand-mint-deep)]" : index === 1 ? "bg-[var(--brand-lavender-soft)] text-[var(--brand-lavender-deep)]" : "bg-[var(--brand-coral-soft)] text-[#a94f3e] dark:text-[#ffab9a]"
                      )}>
                        {index === 0 ? <Activity className="size-4" /> : index === 1 ? <Dumbbell className="size-4" /> : <Sparkles className="size-4" />}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-[var(--brand-heading)]">{candidate.exerciseName} · {candidate.suggestedMinutes} 分钟</h3>
                          <span className="rounded-full bg-card px-2 py-0.5 text-[10px] text-muted-foreground">{categoryLabel(candidate.category)}</span>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1"><Clock className="size-3" />{candidate.suggestedMinutes} 分钟</span>
                          <span className="flex items-center gap-1"><Flame className="size-3" />约 {formatCalories(candidate.calorieBurnEstimate)} 千卡</span>
                        </div>
                        {candidate.description ? <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{candidate.description}</p> : null}
                        {rowErrors[errorKey] ? <p className="mt-1 text-xs text-destructive" role="alert">{rowErrors[errorKey]}</p> : null}
                      </div>
                      <Button
                        type="button"
                        variant={index === 0 ? "default" : "outline"}
                        className="w-full sm:w-auto"
                        disabled={saving || alreadyAdopted}
                        onClick={() => void adoptCandidate(candidate)}
                      >
                        {alreadyAdopted ? <><Check />已采用</> : saving ? <><Loader2 className="animate-spin" />保存中</> : "加入今天"}
                      </Button>
                    </article>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </section>

      <p className="px-1 text-xs leading-5 text-muted-foreground">
        活动建议用于支持日常体能与习惯，不需要也不建议用运动抵消饮食。以上内容不是医疗建议；如有不适或基础疾病，请咨询专业人士。
      </p>
    </div>
  )
}
