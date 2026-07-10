"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dumbbell, Flame, Clock, Loader2, Brain } from "lucide-react"
import { formatCalories } from "@/lib/utils"

interface Suggestion {
  exerciseName: string
  caloriesPer30min: number
  category: string
  suggestedMinutes: number
  description: string | null
}

interface ExerciseContentProps {
  today: string
}

export function ExerciseContent({ today }: ExerciseContentProps) {
  const [data, setData] = useState<{
    totalCalories: number
    dailyTarget: number
    surplus: number
    suggestions: Suggestion[]
  } | null>(null)
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null)
  const [loadingAi, setLoadingAi] = useState(false)

  useEffect(() => {
    fetch(`/api/exercise/suggest?date=${today}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => {
        if (j.data) setData(j.data)
      })
  }, [today])

  const getAiSuggestion = async () => {
    if (!data) return
    setLoadingAi(true)
    try {
      const res = await fetch("/api/ai/recognize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: `根据以下信息生成一个简短的个性化运动建议（50字以内）：
          今日摄入 ${data.totalCalories} 千卡，目标 ${data.dailyTarget} 千卡，
          热量盈余 ${data.surplus} 千卡。推荐运动：${data.suggestions.map(s => s.exerciseName).join("、")}。`,
        }),
      })
      const json = await res.json()
      if (json.data?.foods?.length) {
        setAiSuggestion(json.data.foods[0].name)
      } else {
        setAiSuggestion(`建议进行 ${data.suggestions[0]?.exerciseName || "适度运动"} ${data.suggestions[0]?.suggestedMinutes || 30} 分钟，约消耗 ${data.suggestions[0]?.caloriesPer30min || 100} 千卡。`)
      }
    } catch {
      setAiSuggestion(`建议进行 ${data.suggestions[0]?.exerciseName || "有氧运动"} ${data.suggestions[0]?.suggestedMinutes || 30} 分钟。`)
    } finally {
      setLoadingAi(false)
    }
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-neutral-400">加载中...</CardContent>
      </Card>
    )
  }

  const isOver = data.surplus > 0

  return (
    <div className="space-y-6">
      <Card className={isOver ? "bg-orange-50 border-orange-200" : "bg-emerald-50 border-emerald-200"}>
        <CardContent className="py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Flame className={`h-8 w-8 ${isOver ? "text-orange-500" : "text-emerald-500"}`} />
              <div>
                <p className="text-sm text-neutral-600">今日热量</p>
                <p className="text-xl font-bold text-neutral-900">
                  {formatCalories(data.totalCalories)} / {formatCalories(data.dailyTarget)} 千卡
                </p>
              </div>
            </div>
            <Badge variant={isOver ? "destructive" : "secondary"} className="text-sm">
              {isOver ? `超标 ${data.surplus} 千卡` : `剩余 ${Math.abs(data.surplus)} 千卡`}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Dumbbell className="h-4 w-4" />
            推荐运动
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.suggestions.length === 0 ? (
            <p className="text-sm text-neutral-400 text-center py-4">暂无推荐</p>
          ) : (
            data.suggestions.map((s, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg border bg-white p-4">
                <div className="flex-1">
                  <p className="text-sm font-medium text-neutral-800">{s.exerciseName}</p>
                  <div className="flex gap-4 text-xs text-neutral-500 mt-1">
                    <span className="flex items-center gap-1">
                      <Flame className="h-3 w-3" />{formatCalories(s.caloriesPer30min)} 千卡/30分钟
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />推荐 {s.suggestedMinutes} 分钟
                    </span>
                  </div>
                  {s.description && <p className="text-xs text-neutral-400 mt-1">{s.description}</p>}
                </div>
                <Badge variant="outline" className="ml-2">
                  {s.category === "aerobic" ? "有氧" : s.category}
                </Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Brain className="h-4 w-4" />
            AI 个性化建议
          </CardTitle>
        </CardHeader>
        <CardContent>
          {aiSuggestion ? (
            <div className="rounded-lg bg-neutral-50 p-4 text-sm text-neutral-700">
              {aiSuggestion}
            </div>
          ) : (
            <Button onClick={getAiSuggestion} disabled={loadingAi} variant="outline" className="w-full">
              {loadingAi ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />生成中...</>
              ) : (
                <><Brain className="h-4 w-4 mr-2" />获取个性化运动建议</>
              )}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
