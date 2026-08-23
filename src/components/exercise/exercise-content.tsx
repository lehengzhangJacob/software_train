"use client"

import Image from "next/image"
import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Activity, ArrowRight, Check, Clock, Dumbbell, Flame, HeartPulse, Loader2, MessageCircle, RotateCcw, Sparkles, X } from "lucide-react"
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

interface ExercisePlanStep {
  order: number
  kind: "warmup" | "cardio" | "strength" | "mobility" | "cooldown"
  name: string
  minutes: number
  instructions: string
  sets?: number
  reps?: number
  restSeconds?: number
}

interface ExercisePlanView {
  planId: number
  planDate: string
  revision: number
  sourceKind: string
  status: string
  title: string
  goal: string
  totalMinutes: number
  intensity: "low" | "moderate" | "high"
  plan: {
    steps: ExercisePlanStep[]
    safetyNote: string
    equipment: string[]
  }
  progress: {
    completedStepOrders: number[]
    completedCount: number
    totalSteps: number
    planCompleted: boolean
  }
  createdAt: string
  updatedAt: string
}

interface ExercisePlanProjection {
  date: string
  current: ExercisePlanView | null
  history: ExercisePlanView[]
  legacy: ExercisePlanView[]
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

function intensityLabel(intensity: ExercisePlanView["intensity"]) {
  if (intensity === "low") return "轻松"
  if (intensity === "high") return "较高"
  return "适中"
}

function stepKindLabel(kind: ExercisePlanStep["kind"]) {
  if (kind === "warmup") return "热身"
  if (kind === "cardio") return "有氧"
  if (kind === "strength") return "力量"
  if (kind === "mobility") return "活动度"
  return "放松"
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

function AgentPlanSection({ projection }: { projection: ExercisePlanProjection }) {
  const current = projection.current
  const [progress, setProgress] = useState(current?.progress ?? null)
  const [savingStepOrder, setSavingStepOrder] = useState<number | null>(null)
  const [progressError, setProgressError] = useState<string | null>(null)
  const coachHref = current
    ? `/agent?mode=exercise-plan&exercisePlanId=${current.planId}&returnTo=${encodeURIComponent("/exercise")}`
    : `/agent?mode=exercise-plan&returnTo=${encodeURIComponent("/exercise")}`

  const toggleStep = async (stepOrder: number, completed: boolean) => {
    if (!current || !progress || savingStepOrder !== null) return
    const previous = progress
    const nextOrders = completed
      ? [...new Set([...progress.completedStepOrders, stepOrder])]
      : progress.completedStepOrders.filter((order) => order !== stepOrder)
    const nextProgress = {
      ...progress,
      completedStepOrders: nextOrders,
      completedCount: nextOrders.length,
      planCompleted: nextOrders.length === progress.totalSteps,
    }
    setProgress(nextProgress)
    setProgressError(null)
    setSavingStepOrder(stepOrder)

    try {
      const response = await fetch("/api/exercise/plans", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: current.planId, stepOrder, completed }),
      })
      const result = await readApiEnvelope<{ plan: ExercisePlanView }>(response)
      if (!response.ok || !result.data?.plan) throw new Error(result.error || "更新完成状态失败")
      setProgress(result.data.plan.progress)
    } catch (error) {
      setProgress(previous)
      setProgressError(error instanceof Error ? error.message : "更新完成状态失败，请重试")
    } finally {
      setSavingStepOrder(null)
    }
  }

  return (
    <section className="border border-[var(--brand-plum)]/15 bg-[var(--brand-paper)] p-5 sm:p-7" aria-labelledby="agent-exercise-plan-title">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="page-eyebrow">Agent movement plan</p>
          <h2 id="agent-exercise-plan-title" className="mt-2 text-2xl font-semibold leading-tight text-[var(--brand-heading)]">
            {current ? current.title : "让教练先替你安排一版"}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            {current ? current.goal : "教练会结合今天的饮食、活动量和你的要求，生成一份可以直接照做的训练。"}
          </p>
        </div>
        <Link
          href={coachHref}
          className="inline-flex shrink-0 items-center gap-2 rounded-md bg-[var(--brand-plum)] px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-mint-deep)]"
        >
          <MessageCircle className="size-4" />
          {current ? "让教练调整" : "让教练生成"}
          <ArrowRight className="size-4" />
        </Link>
      </div>

      {current ? (
        <>
          <div className="mt-5 flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span className="rounded-full bg-[var(--brand-lavender-soft)] px-3 py-1.5">{current.totalMinutes} 分钟</span>
            <span className="rounded-full bg-[var(--brand-lavender-soft)] px-3 py-1.5">强度 {intensityLabel(current.intensity)}</span>
            <span className="rounded-full bg-[var(--brand-lavender-soft)] px-3 py-1.5">第 {current.revision} 版</span>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-semibold",
                progress?.planCompleted
                  ? "bg-[var(--brand-mint)]/25 text-[var(--brand-mint-deep)]"
                  : "bg-[var(--brand-lavender-soft)] text-[var(--brand-heading)]",
              )}
              role="status"
              aria-live="polite"
            >
              {progress?.planCompleted ? <Check className="size-3.5" aria-hidden="true" /> : null}
              {progress ? (progress.planCompleted ? "计划已完成" : `完成 ${progress.completedCount}/${progress.totalSteps}`) : "完成状态读取中"}
            </span>
          </div>
          {progressError ? <p className="mt-3 text-xs text-destructive" role="alert">{progressError}</p> : null}
          <ol className="mt-6 grid gap-3 md:grid-cols-3" aria-label="训练步骤">
            {current.plan.steps.map((step) => {
              const completed = progress?.completedStepOrders.includes(step.order) ?? false
              const saving = savingStepOrder === step.order
              return (
                <li key={`${current.planId}-${step.order}`} className={cn("relative border-l-2 border-[var(--brand-mint)] bg-card px-4 py-3 transition-colors", completed && "bg-[var(--brand-mint)]/10")}>
                  <label className="block cursor-pointer">
                    <span className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        className="peer sr-only"
                        checked={completed}
                        disabled={savingStepOrder !== null}
                        onChange={(event) => void toggleStep(step.order, event.target.checked)}
                        aria-label={`完成 ${step.name}`}
                      />
                      <span
                        aria-hidden="true"
                        className={cn(
                          "mt-0.5 grid size-5 shrink-0 place-items-center rounded border-2 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--brand-mint-deep)] peer-focus-visible:ring-offset-2",
                          completed ? "border-[var(--brand-mint-deep)] bg-[var(--brand-mint-deep)] text-white" : "border-[var(--brand-plum)]/30 bg-background",
                        )}
                      >
                        {saving ? <Loader2 className="size-3.5 animate-spin" /> : completed ? <Check className="size-3.5" /> : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--brand-mint-deep)]">
                          <span>{stepKindLabel(step.kind)}</span>
                          <span>{step.minutes} 分钟</span>
                        </span>
                        <span className={cn("mt-1 block font-semibold text-[var(--brand-heading)]", completed && "line-through decoration-[var(--brand-mint-deep)]/60")}>{step.name}</span>
                        <span className="mt-1 block text-xs leading-5 text-muted-foreground">{step.instructions}</span>
                        {step.sets || step.reps ? (
                          <span className="mt-2 block text-[11px] text-muted-foreground">
                            {step.sets ? `${step.sets} 组` : ""}{step.sets && step.reps ? " · " : ""}{step.reps ? `${step.reps} 次` : ""}
                          </span>
                        ) : null}
                      </span>
                    </span>
                  </label>
                </li>
              )
            })}
          </ol>
          <p className="mt-3 text-xs text-muted-foreground" role="status">
            {progress?.planCompleted ? "今天的训练已经全部打卡，做得很好。" : "完成一项就勾选一项，所有步骤完成后计划会标记为已完成。"}
          </p>
          <p className="mt-4 text-xs leading-5 text-muted-foreground">
            {current.plan.safetyNote}{current.plan.equipment.length > 0 ? ` · 需要：${current.plan.equipment.join("、")}` : " · 无需器械"}
          </p>
        </>
      ) : null}

      {projection.history.length > 0 || projection.legacy.length > 0 ? (
        <details className="mt-5 border-t border-border/70 pt-4">
          <summary className="cursor-pointer text-xs font-semibold text-muted-foreground">
            查看保留的历史建议（{projection.history.length + projection.legacy.length}）
          </summary>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {[...projection.history, ...projection.legacy].slice(0, 6).map((plan) => (
              <div key={`${plan.sourceKind}-${plan.planId}`} className="border border-border/70 bg-card px-3 py-2.5 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-[var(--brand-heading)]">{plan.title}</span>
                  <span className="text-muted-foreground">{plan.totalMinutes} 分钟</span>
                </div>
                <p className="mt-1 text-muted-foreground">{plan.sourceKind === "legacy_suggestion" ? "原有运动建议，已保留" : `第 ${plan.revision} 版`}</p>
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </section>
  )
}

export function ExerciseContent({ today }: ExerciseContentProps) {
  const router = useRouter()
  const [data, setData] = useState<ExerciseData | null>(null)
  const [planProjection, setPlanProjection] = useState<ExercisePlanProjection | null>(null)
  const [planError, setPlanError] = useState<string | null>(null)
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
    setPlanProjection(null)
    setPlanError(null)
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
      setPlanProjection(null)
      setPlanError(null)
      setLoadedDate(null)
      setLoadError(null)
      setErrorDate(null)

      try {
        const [response, planResponse] = await Promise.all([
          fetch(`/api/exercise/suggest?date=${today}`, {
            cache: "no-store",
            signal: controller.signal,
          }),
          fetch(`/api/exercise/plans?date=${today}`, {
            cache: "no-store",
            signal: controller.signal,
          }),
        ])
        const result = await readApiEnvelope<ExerciseData>(response)
        const planResult = await readApiEnvelope<ExercisePlanProjection>(planResponse)

        if (controller.signal.aborted) return

        if (!response.ok || !result.data) {
          setLoadError(result.error || "暂时无法读取活动建议，请稍后重试")
          setErrorDate(today)
          return
        }

        setData(result.data)
        setLoadedDate(today)
        if (planResponse.ok && planResult.data) {
          setPlanProjection(planResult.data)
        } else {
          setPlanError(planResult.error || "暂时无法读取教练计划")
        }
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
      {planProjection ? <AgentPlanSection projection={planProjection} /> : planError ? (
        <p className="px-1 text-xs text-muted-foreground" role="status">教练计划暂时无法读取：{planError}</p>
      ) : null}
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
