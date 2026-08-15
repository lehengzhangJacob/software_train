"use client"

import { formatCalories } from "@/lib/utils"

interface CalorieTrendChartProps {
  data: { date: string; calories: number | null }[]
  target: number
}

export function CalorieTrendChart({ data, target }: CalorieTrendChartProps) {
  if (data.every((day) => day.calories === null)) {
    return <p className="py-8 text-center text-sm text-neutral-400">暂无数据</p>
  }

  const values = data.flatMap((day) => (day.calories === null ? [] : [day.calories]))
  const observedMax = Math.max(target, ...values)
  const chartMax = Math.max(500, Math.ceil((observedMax * 1.1) / 500) * 500)
  const points = data.map((day, index) => ({
    ...day,
    label: day.date.slice(5),
    x: data.length === 1 ? 50 : (index / (data.length - 1)) * 100,
    y: day.calories === null ? null : 100 - (day.calories / chartMax) * 100,
  }))

  const path = points.reduce(
    (result, point) => {
      if (point.y === null) {
        return { path: result.path, segmentOpen: false }
      }

      const command = result.segmentOpen ? "L" : "M"
      return {
        path: `${result.path} ${command} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`,
        segmentOpen: true,
      }
    },
    { path: "", segmentOpen: false },
  ).path
  const targetY = Math.max(0, 100 - (target / chartMax) * 100)
  const yTicks = [chartMax, chartMax / 2, 0]

  return (
    <div className="h-64 w-full" role="img" aria-label="近 7 天热量摄入趋势">
      <div className="flex h-full">
        <div className="relative mb-7 w-12 shrink-0 text-[11px] text-neutral-400">
          {yTicks.map((value, index) => (
            <span
              key={value}
              className="absolute right-2 -translate-y-1/2"
              style={{ top: `${index * 50}%` }}
            >
              {formatCalories(value)}
            </span>
          ))}
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="relative min-h-0 flex-1 border-b border-l border-neutral-200">
            {[0, 50].map((top) => (
              <div key={top} className="absolute inset-x-0 border-t border-dashed border-neutral-200" style={{ top: `${top}%` }} />
            ))}
            <div className="absolute inset-x-0 border-t border-dashed border-orange-400" style={{ top: `${targetY}%` }}>
              <span className="absolute right-1 -top-5 rounded bg-white px-1 text-[10px] font-medium text-orange-600">目标</span>
            </div>

            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
              <path d={path} fill="none" stroke="#059669" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
            </svg>

            {points.map((point) => point.y !== null && (
              <span
                key={point.date}
                className="absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-emerald-600 shadow-sm"
                style={{ left: `${point.x}%`, top: `${point.y}%` }}
                title={`${point.date}: ${formatCalories(point.calories ?? 0)} 千卡`}
              />
            ))}
          </div>

          <div
            className="grid h-7 items-end pt-2 text-center text-[10px] text-neutral-400"
            style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` }}
          >
            {points.map((point) => <span key={point.date}>{point.label}</span>)}
          </div>
        </div>
      </div>
    </div>
  )
}
