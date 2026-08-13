import { useEffect, useMemo, useState } from 'react'
import { api, MEAL_LABELS, todayStr } from '../api/client'
import type { Meal, MealType } from '../api/client'

function pad(n: number) {
  return String(n).padStart(2, '0')
}

export default function CalendarPage() {
  const today = todayStr()
  const [cursor, setCursor] = useState(() => {
    const d = new Date()
    return { y: d.getFullYear(), m: d.getMonth() + 1 }
  })
  const [selected, setSelected] = useState(today)
  const [datesWithData, setDatesWithData] = useState<Set<string>>(new Set())
  const [meals, setMeals] = useState<Meal[]>([])
  const [error, setError] = useState('')

  const cells = useMemo(() => {
    const first = new Date(cursor.y, cursor.m - 1, 1)
    const startWeekday = first.getDay() // 0 Sun
    const daysInMonth = new Date(cursor.y, cursor.m, 0).getDate()
    const arr: Array<{ day: number | null; date?: string }> = []
    for (let i = 0; i < startWeekday; i++) arr.push({ day: null })
    for (let d = 1; d <= daysInMonth; d++) {
      arr.push({
        day: d,
        date: `${cursor.y}-${pad(cursor.m)}-${pad(d)}`,
      })
    }
    return arr
  }, [cursor])

  useEffect(() => {
    api
      .mealDates(cursor.y, cursor.m)
      .then((ds) => setDatesWithData(new Set(ds)))
      .catch((e: Error) => setError(e.message))
  }, [cursor])

  useEffect(() => {
    api
      .listMeals(selected)
      .then(setMeals)
      .catch((e: Error) => setError(e.message))
  }, [selected])

  async function remove(id: number) {
    await api.deleteMeal(id)
    setMeals((prev) => prev.filter((m) => m.record_id !== id))
    const ds = await api.mealDates(cursor.y, cursor.m)
    setDatesWithData(new Set(ds))
  }

  const grouped = (['breakfast', 'lunch', 'dinner', 'snack'] as MealType[]).map(
    (t) => ({ type: t, items: meals.filter((m) => m.meal_type === t) }),
  )

  return (
    <div>
      <div className="toolbar">
        <div>
          <h2 style={{ margin: 0, fontFamily: 'var(--font-display)' }}>饮食日历</h2>
          <div className="muted">点选日期查看与管理记录</div>
        </div>
        <div className="row-actions">
          <button
            className="btn secondary"
            type="button"
            onClick={() =>
              setCursor((c) => {
                const m = c.m - 1
                return m < 1 ? { y: c.y - 1, m: 12 } : { y: c.y, m }
              })
            }
          >
            上月
          </button>
          <strong>
            {cursor.y}年{cursor.m}月
          </strong>
          <button
            className="btn secondary"
            type="button"
            onClick={() =>
              setCursor((c) => {
                const m = c.m + 1
                return m > 12 ? { y: c.y + 1, m: 1 } : { y: c.y, m }
              })
            }
          >
            下月
          </button>
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      <section className="panel">
        <div className="calendar-grid">
          {['日', '一', '二', '三', '四', '五', '六'].map((w) => (
            <div className="cal-head" key={w}>
              {w}
            </div>
          ))}
          {cells.map((c, i) =>
            c.day == null ? (
              <button key={i} className="cal-cell" disabled type="button" />
            ) : (
              <button
                key={c.date}
                type="button"
                className={[
                  'cal-cell',
                  c.date === selected ? 'active' : '',
                  datesWithData.has(c.date!) ? 'has-data' : '',
                ].join(' ')}
                onClick={() => setSelected(c.date!)}
              >
                <span>{c.day}</span>
                {datesWithData.has(c.date!) && <span className="dot" />}
              </button>
            ),
          )}
        </div>
      </section>

      <section className="panel">
        <h3>{selected} 的记录</h3>
        {meals.length === 0 && <p className="muted">这一天暂无饮食记录。</p>}
        {grouped.map(
          (g) =>
            g.items.length > 0 && (
              <div className="meal-group" key={g.type}>
                <h4>{MEAL_LABELS[g.type]}</h4>
                {g.items.map((m) => (
                  <div className="meal-item" key={m.record_id}>
                    <div>
                      <strong>{m.food_name}</strong>
                      <div className="meta">
                        {Math.round(m.calories)} kcal · 蛋白 {m.protein_g}g · 脂肪{' '}
                        {m.fat_g}g · 碳水 {m.carbs_g}g
                      </div>
                    </div>
                    <button
                      className="btn danger"
                      type="button"
                      onClick={() => remove(m.record_id)}
                    >
                      删除
                    </button>
                  </div>
                ))}
              </div>
            ),
        )}
      </section>
    </div>
  )
}
