"use client"

import { cn } from "@/lib/utils"
import type { ArticleVisual } from "@/lib/agent/content/contracts"

export function ArticleVisualBlock({ visual, compact = false }: { visual: ArticleVisual; compact?: boolean }) {
  const maxValue = Math.max(...visual.values, 1)
  return (
    <div className={cn("relative overflow-hidden rounded-md bg-[var(--brand-plum)] p-4 text-white", compact ? "min-h-36" : "min-h-48")}>
      <div className="relative">
        <p className="text-[10px] font-semibold uppercase tracking-[.12em] text-[var(--brand-mint)]">今日视觉</p>
        <h3 className="mt-1 max-w-[80%] text-sm font-semibold">{visual.title}</h3>
        {visual.kind === "bars" ? (
          <div className="mt-5 flex h-20 items-end gap-3">
            {visual.values.map((value, index) => (
              <div key={`${visual.labels[index]}-${index}`} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                <div className="flex h-14 w-full items-end rounded-sm bg-white/10 px-1">
                  <div className="w-full rounded-sm bg-[var(--brand-mint)]" style={{ height: `${Math.max(12, (value / maxValue) * 100)}%` }} />
                </div>
                <span className="max-w-full truncate text-[10px] text-white/65">{visual.labels[index]}</span>
              </div>
            ))}
          </div>
        ) : visual.kind === "donut" ? (
          <div className="mt-4 flex items-center gap-5">
            <div
              className="grid size-20 shrink-0 place-items-center rounded-full"
              style={{ background: `conic-gradient(var(--brand-mint) ${Math.min(100, visual.values[0] ?? 0)}%, rgba(255,255,255,.12) 0)` }}
            >
              <div className="grid size-12 place-items-center rounded-full bg-[var(--brand-plum)] text-xs font-semibold">{Math.round(visual.values[0] ?? 0)}%</div>
            </div>
            <div className="min-w-0 space-y-1.5">
              {visual.labels.map((label, index) => <p key={`${label}-${index}`} className="truncate text-xs text-white/70"><span className="mr-2 inline-block size-1.5 rounded-full bg-[var(--brand-mint)]" />{label} {Math.round(visual.values[index] ?? 0)}</p>)}
            </div>
          </div>
        ) : (
          <div className="mt-5 grid grid-cols-3 gap-2">
            {visual.labels.map((label, index) => (
              <div key={`${label}-${index}`} className="rounded-md border border-white/10 bg-white/8 p-2">
                <span className="grid size-6 place-items-center rounded-full bg-[var(--brand-mint)] text-xs font-bold text-[var(--brand-plum)]">{index + 1}</span>
                <p className="mt-3 text-[11px] leading-4 text-white/75">{label}</p>
              </div>
            ))}
          </div>
        )}
        <p className="mt-4 line-clamp-2 text-[11px] leading-4 text-white/55">{visual.caption}</p>
      </div>
    </div>
  )
}
