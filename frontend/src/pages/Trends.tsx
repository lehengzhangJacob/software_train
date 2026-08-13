import { useEffect, useState } from 'react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { api } from '../api/client'
import type { DailyNutrition } from '../api/client'

export default function Trends() {
  const [days, setDays] = useState(7)
  const [data, setData] = useState<DailyNutrition[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    api
      .rangeNutrition(days)
      .then(setData)
      .catch((e: Error) => setError(e.message))
  }, [days])

  const chartData = data.map((d) => ({
    date: d.record_date.slice(5),
    calories: Math.round(d.total_calories),
    target: d.daily_calorie_target,
    protein: Number(d.total_protein_g.toFixed(1)),
    fat: Number(d.total_fat_g.toFixed(1)),
    carbs: Number(d.total_carbs_g.toFixed(1)),
  }))

  const avgCal =
    data.length > 0
      ? data.reduce((s, d) => s + d.total_calories, 0) / data.length
      : 0
  const avgP =
    data.length > 0
      ? data.reduce((s, d) => s + d.total_protein_g, 0) / data.length
      : 0
  const avgF =
    data.length > 0 ? data.reduce((s, d) => s + d.total_fat_g, 0) / data.length : 0
  const avgC =
    data.length > 0
      ? data.reduce((s, d) => s + d.total_carbs_g, 0) / data.length
      : 0

  return (
    <div>
      <div className="toolbar">
        <div>
          <h2 style={{ margin: 0, fontFamily: 'var(--font-display)' }}>趋势分析</h2>
          <div className="muted">查看近期热量与营养素变化</div>
        </div>
        <div className="chip-row">
          {[7, 30].map((d) => (
            <button
              key={d}
              type="button"
              className={`chip ${days === d ? 'active' : ''}`}
              onClick={() => setDays(d)}
            >
              近 {d} 天
            </button>
          ))}
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="grid-3">
        <div className="stat">
          <div className="label">日均热量</div>
          <div className="value">{Math.round(avgCal)}</div>
        </div>
        <div className="stat">
          <div className="label">日均蛋白</div>
          <div className="value" style={{ fontSize: '1.3rem' }}>
            {avgP.toFixed(1)}g
          </div>
        </div>
        <div className="stat">
          <div className="label">日均脂肪 / 碳水</div>
          <div className="value" style={{ fontSize: '1.05rem' }}>
            {avgF.toFixed(1)}g / {avgC.toFixed(1)}g
          </div>
        </div>
      </div>

      <section className="panel" style={{ marginTop: 16 }}>
        <h3>热量曲线</h3>
        <div style={{ width: '100%', height: 320 }}>
          <ResponsiveContainer>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(28,36,32,0.08)" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line
                type="monotone"
                dataKey="calories"
                name="摄入"
                stroke="#2f6b4f"
                strokeWidth={2.5}
                dot={{ r: 3 }}
              />
              <Line
                type="monotone"
                dataKey="target"
                name="目标"
                stroke="#d9773a"
                strokeDasharray="6 4"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  )
}
