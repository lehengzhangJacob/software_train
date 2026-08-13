import { useEffect, useState } from 'react'
import { api, todayStr } from '../api/client'
import type { ExerciseSuggestion } from '../api/client'

const intensityLabel: Record<string, string> = {
  low: '低强度',
  moderate: '中等',
  high: '高强度',
}

export default function ExercisePage() {
  const date = todayStr()
  const [items, setItems] = useState<ExerciseSuggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    try {
      const list = await api.listSuggestions(date)
      setItems(list)
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败')
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function generate() {
    setLoading(true)
    setError('')
    try {
      const s = await api.generateSuggestion(date)
      setItems((prev) => [s, ...prev])
    } catch (e) {
      setError(e instanceof Error ? e.message : '生成失败')
    } finally {
      setLoading(false)
    }
  }

  async function toggleAdopt(s: ExerciseSuggestion) {
    const next = s.is_adopted ? 0 : 1
    const updated = await api.adoptSuggestion(s.suggestion_id, next)
    setItems((prev) =>
      prev.map((x) => (x.suggestion_id === updated.suggestion_id ? updated : x)),
    )
  }

  return (
    <div>
      <div className="toolbar">
        <div>
          <h2 style={{ margin: 0, fontFamily: 'var(--font-display)' }}>运动建议</h2>
          <div className="muted">结合今日摄入与个人数据，由 GLM 生成建议</div>
        </div>
        <button className="btn" type="button" disabled={loading} onClick={generate}>
          {loading ? '生成中…' : '生成今日建议'}
        </button>
      </div>

      {error && <div className="error">{error}</div>}

      {items.length === 0 && (
        <section className="panel">
          <p className="muted">还没有建议，点击右上角生成一条。</p>
        </section>
      )}

      {items.map((s) => (
        <section className="panel" key={s.suggestion_id}>
          <div className="toolbar">
            <h3 style={{ margin: 0 }}>{s.exercise_type}</h3>
            <span className={`chip ${s.is_adopted ? 'active' : ''}`}>
              {s.is_adopted ? '已采纳' : '未采纳'}
            </span>
          </div>
          <div className="grid-3">
            <div className="stat">
              <div className="label">建议时长</div>
              <div className="value" style={{ fontSize: '1.3rem' }}>
                {s.duration_minutes} 分
              </div>
            </div>
            <div className="stat">
              <div className="label">预估消耗</div>
              <div className="value" style={{ fontSize: '1.3rem' }}>
                {Math.round(s.calorie_burn_estimate)} kcal
              </div>
            </div>
            <div className="stat">
              <div className="label">强度 / 盈余</div>
              <div className="value" style={{ fontSize: '1.05rem' }}>
                {s.intensity ? intensityLabel[s.intensity] : '—'} /{' '}
                {s.calorie_surplus != null ? Math.round(s.calorie_surplus) : '—'}
              </div>
            </div>
          </div>
          <p style={{ marginTop: 14, lineHeight: 1.6 }}>{s.suggestion_detail}</p>
          <button className="btn secondary" type="button" onClick={() => toggleAdopt(s)}>
            {s.is_adopted ? '取消采纳' : '采纳建议'}
          </button>
        </section>
      ))}
    </div>
  )
}
