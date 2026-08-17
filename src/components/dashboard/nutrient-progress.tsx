"use client"

import { Progress, ProgressTrack, ProgressIndicator } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

interface NutrientProgressProps {
  value: number
  className?: string
  indicatorClassName?: string
}

export function NutrientProgress({ value, className, indicatorClassName }: NutrientProgressProps) {
  const clamped = Math.min(value, 100)
  const isOver = value > 100

  return (
    <Progress value={clamped} className={cn("mt-2", className)}>
      <ProgressTrack className="h-1.5 bg-[#eeeaf0] dark:bg-white/10">
        <ProgressIndicator
          className={cn(
            "transition-all",
            isOver ? "bg-[var(--brand-coral)]" : indicatorClassName
          )}
          style={{ width: `${clamped}%` }}
        />
      </ProgressTrack>
    </Progress>
  )
}
