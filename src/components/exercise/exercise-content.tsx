"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Clock, Dumbbell, Flame, Loader2, X } from "lucide-react"
import { formatCalories } from "@/lib/utils"

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

export function ExerciseContent({ today }: ExerciseContentProps) {
  const router = useRouter()
  const [data, setData] = useState<ExerciseData | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [savingCandidates, setSavingCandidates] = useState<Set<number>>(new Set())
  const [savingPlans, setSavingPlans] = useState<Set<number>>(new Set())
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({})

  const loadSuggestions = useCallback(async () => {
    setLoading(true)
    setLoadError(null)

    try {
      const response = await fetch(`/api/exercise/suggest?date=${today}`, {
        cache: "no-store",
      })
      const result = await readApiEnvelope<ExerciseData>(response)

      if (!response.ok || !result.data) {
        setLoadError(result.error || "暂时无法读取活动建议")
        return
      }

      setData(result.data)
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "暂时无法读取活动建议")
    } finally {
      setLoading(false)
    }
  }, [today])

  useEffect(() => {
    void loadSuggestions()
  }, [loadSuggestions])

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
      if (!response.ok || !result.data) {
        throw new Error(result.error || "采用计划失败")
      }

      await loadSuggestions()
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
      if (!response.ok || !result.data) {
        throw new Error(result.error || "取消采用失败")
      }

      await loadSuggestions()
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

  if (loading && !data) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-neutral-500">加载中...</CardContent>
      </Card>
    )
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="space-y-3 py-12 text-center">
          <p className="text-sm text-neutral-600">{loadError || "暂时无法读取活动建议"}</p>
          <Button type="button" variant="outline" onClick={() => void loadSuggestions()}>
            重试
          </Button>
        </CardContent>
      </Card>
    )
  }

  const adoptedPlans = data.adopted.filter((plan) => plan.isAdopted === 1)
  const isAboveTarget = data.surplus > 0

  return (
    <div className="space-y-6">
      <Card className={isAboveTarget ? "border-orange-200 bg-orange-50" : "border-emerald-200 bg-emerald-50"}>
        <CardContent className="py-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Flame className={`h-8 w-8 ${isAboveTarget ? "text-orange-500" : "text-emerald-500"}`} />
              <div>
                <p className="text-sm text-neutral-600">今日饮食记录</p>
                <p className="text-xl font-bold text-neutral-900">
                  {formatCalories(data.totalCalories)} / {formatCalories(data.dailyTarget)} 千卡
                </p>
              </div>
            </div>
            <Badge variant={isAboveTarget ? "destructive" : "secondary"} className="shrink-0 text-sm">
              {isAboveTarget ? `较目标多 ${formatCalories(data.surplus)} 千卡` : `较目标少 ${formatCalories(Math.abs(data.surplus))} 千卡`}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Dumbbell className="h-4 w-4" />
            已采用计划
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {adoptedPlans.length === 0 ? (
            <p className="py-2 text-center text-sm text-neutral-500">尚未采用活动计划</p>
          ) : (
            adoptedPlans.map((plan) => {
              const saving = savingPlans.has(plan.suggestionId)
              const errorKey = `plan-${plan.suggestionId}`

              return (
                <div key={plan.suggestionId} className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-neutral-800">{plan.exerciseType}</p>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-600">
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{plan.durationMinutes} 分钟</span>
                        <span className="flex items-center gap-1"><Flame className="h-3 w-3" />约 {formatCalories(plan.calorieBurnEstimate)} 千卡</span>
                      </div>
                      {plan.suggestionDetail && <p className="mt-1 text-xs text-neutral-500">{plan.suggestionDetail}</p>}
                      {rowErrors[errorKey] && <p className="mt-2 text-xs text-destructive" role="alert">{rowErrors[errorKey]}</p>}
                    </div>
                    <Button type="button" variant="outline" size="sm" disabled={saving} onClick={() => void cancelPlan(plan)}>
                      {saving ? <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />保存中</> : <><X className="mr-1 h-3.5 w-3.5" />取消采用</>}
                    </Button>
                  </div>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Dumbbell className="h-4 w-4" />
            可选活动建议
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.candidates.length === 0 ? (
            <p className="py-4 text-center text-sm text-neutral-500">暂无可选活动建议</p>
          ) : (
            data.candidates.map((candidate) => {
              const saving = savingCandidates.has(candidate.exerciseId)
              const errorKey = `candidate-${candidate.exerciseId}`
              const alreadyAdopted = adoptedPlans.some((plan) => plan.exerciseType === candidate.exerciseName)

              return (
                <div key={candidate.exerciseId} className="rounded-lg border bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium text-neutral-800">{candidate.exerciseName}</p>
                        <Badge variant="outline">{categoryLabel(candidate.category)}</Badge>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-600">
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />建议 {candidate.suggestedMinutes} 分钟</span>
                        <span className="flex items-center gap-1"><Flame className="h-3 w-3" />约 {formatCalories(candidate.calorieBurnEstimate)} 千卡</span>
                        <span>{formatCalories(candidate.caloriesPer30min)} 千卡 / 30 分钟</span>
                      </div>
                      {candidate.description && <p className="mt-1 text-xs text-neutral-500">{candidate.description}</p>}
                      {rowErrors[errorKey] && <p className="mt-2 text-xs text-destructive" role="alert">{rowErrors[errorKey]}</p>}
                    </div>
                    <Button type="button" size="sm" disabled={saving || alreadyAdopted} onClick={() => void adoptCandidate(candidate)}>
                      {alreadyAdopted ? "已采用" : saving ? <><Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />保存中</> : "采用计划"}
                    </Button>
                  </div>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>

      <p className="px-1 text-xs leading-5 text-neutral-500">
        活动建议用于支持日常体能与习惯，不需要也不建议用运动抵消饮食。以上内容不是医疗建议；如有不适或基础疾病，请咨询专业人士。
      </p>
    </div>
  )
}
