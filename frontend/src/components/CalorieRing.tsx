type Props = {
  current: number
  target: number
  size?: number
}

export default function CalorieRing({ current, target, size = 200 }: Props) {
  const stroke = 14
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const ratio = target > 0 ? Math.min(current / target, 1.15) : 0
  const offset = c * (1 - Math.min(ratio, 1))
  const over = current > target
  const pct = target > 0 ? Math.round((current / target) * 100) : 0

  return (
    <div className="progress-ring-wrap" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(47,107,79,0.12)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={over ? 'var(--accent)' : 'var(--brand)'}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 0.8s ease' }}
        />
      </svg>
      <div className="center-label">
        <strong>{Math.round(current)}</strong>
        <span className="muted">/ {target} kcal</span>
        <div className="muted" style={{ marginTop: 4, fontSize: 13 }}>
          {pct}%
        </div>
      </div>
    </div>
  )
}
