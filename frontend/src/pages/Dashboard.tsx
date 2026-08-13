import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import { api, MEAL_LABELS, todayStr } from '../api/client'
import type { DailyNutrition, Meal, MealType } from '../api/client'
import CalorieRing from '../components/CalorieRing'

const COLORS = ['#2f6b4f', '#d9773a', '#7aa889']

export default function Dashboard() {
  const date = todayStr()
  const [nutrition, setNutrition] = useState<DailyNutrition | null>(null)
  const [meals, setMeals] = useState<Meal[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([api.dailyNutrition(date), api.listMeals(date)])
      .then(([n, m]) => {
        setNutrition(n)
        setMeals(m)
      })
      .catch((e: Error) => setError(e.message))
  }, [date])

  const pieData = nutrition
    ? [
        { name: '蛋白质', value: Math.max(nutrition.total_protein_g * 4, 0) },
        { name: '脂肪', value: Math.max(nutrition.total_fat_g * 9, 0) },
        { name: '碳水', value: Math.max(nutrition.total_carbs_g * 4, 0) },
      ]
    : []

  const grouped = (['breakfast', 'lunch', 'dinner', 'snack'] as MealType[]).map(
    (t) => ({
      type: t,
      items: meals.filter((m) => m.meal_type === t),
    }),
  )

  return (
    <div>
      <div className="toolbar">
        <div>
          <h2 style={{ margin: 0, fontFamily: 'var(--font-display)' }}>今日摄入</h2>
          <div className="muted">{date}</div>
        </div>
        <Link className="btn" to="/recognize">
          拍照记一餐
        </Link>
      </div>

      {error && <div className="error">{error}</div>}

      <div className="grid-2">
        <section className="panel">
          <h3>热量进度</h3>
          {nutrition && (
            <>
              <div style={{ display: 'grid', placeItems: 'center', padding: 8 }}>
                <CalorieRing
                  current={nutrition.total_calories}
                  target={nutrition.daily_calorie_target}
                />
              </div>
              <div className="grid-3" style={{ marginTop: 8 }}>
                <div className="stat">
                  <div className="label">与目标差值</div>
                  <div className="value" style={{ fontSize: '1.2rem' }}>
                    {nutrition.calorie_diff > 0 ? '+' : ''}
                    {Math.round(nutrition.calorie_diff)}
                  </div>
                </div>
                <div className="stat">
                  <div className="label">餐次</div>
                  <div className="value" style={{ fontSize: '1.2rem' }}>
                    {nutrition.meal_count}
                  </div>
                </div>
                <div className="stat">
                  <div className="label">状态</div>
                  <div className="value" style={{ fontSize: '1.05rem' }}>
                    {nutrition.calorie_diff > 50
                      ? '偏高'
                      : nutrition.calorie_diff < -200
                        ? '不足'
                        : '良好'}
                  </div>
                </div>
              </div>
            </>
          )}
        </section>

        <section className="panel">
          <h3>三大营养素供能</h3>
          <div style={{ width: '100%', height: 240 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={3}
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => `${Math.round(Number(v))} kcal`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          {nutrition && (
            <div className="grid-3">
              <div className="stat">
                <div className="label">蛋白质</div>
                <div className="value" style={{ fontSize: '1.1rem' }}>
                  {nutrition.total_protein_g.toFixed(1)}g
                </div>
                <div className="muted">目标 {nutrition.daily_protein_target}g</div>
              </div>
              <div className="stat">
                <div className="label">脂肪</div>
                <div className="value" style={{ fontSize: '1.1rem' }}>
                  {nutrition.total_fat_g.toFixed(1)}g
                </div>
                <div className="muted">目标 {nutrition.daily_fat_target}g</div>
              </div>
              <div className="stat">
                <div className="label">碳水</div>
                <div className="value" style={{ fontSize: '1.1rem' }}>
                  {nutrition.total_carbs_g.toFixed(1)}g
                </div>
                <div className="muted">目标 {nutrition.daily_carbs_target}g</div>
              </div>
            </div>
          )}
        </section>
      </div>

      <section className="panel">
        <h3>今日饮食</h3>
        {meals.length === 0 && <p className="muted">今天还没有记录，去拍一张吧。</p>}
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
                        {m.portion_desc || '—'} · {m.record_time}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right', fontWeight: 700 }}>
                      {Math.round(m.calories)} kcal
                    </div>
                  </div>
                ))}
              </div>
            ),
        )}
      </section>
    </div>
  )
}
