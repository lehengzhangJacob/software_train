"use client"

import { Progress, ProgressTrack, ProgressIndicator } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

interface NutrientProgressProps {
  value: number
  className?: string
}

export function NutrientProgress({ value, className }: NutrientProgressProps) {
  const clamped = Math.min(value, 100)
  const isOver = value > 100

  return (
    <Progress value={clamped} className={cn("mt-2", className)}>
      <ProgressTrack className="h-1.5">
        <ProgressIndicator
          className={cn(
            "transition-all",
            isOver ? "bg-orange-500" : undefined
          )}
          style={{ width: `${clamped}%` }}
        />
      </ProgressTrack>
    </Progress>
  )
}
