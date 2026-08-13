import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { api } from '../api/client'
import type { Profile } from '../api/client'

const activityOptions = [
  { value: 'sedentary', label: '久坐不动' },
  { value: 'lightly_active', label: '轻度活动' },
  { value: 'moderately_active', label: '中度活动' },
  { value: 'very_active', label: '高度活跃' },
  { value: 'extra_active', label: '极高活跃' },
]

export default function ProfilePage() {
  const [form, setForm] = useState<Profile | null>(null)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    api
      .getProfile()
      .then(setForm)
      .catch((e: Error) => setError(e.message))
  }, [])

  function set<K extends keyof Profile>(key: K, value: Profile[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!form) return
    setSaving(true)
    setError('')
    setMsg('')
    try {
      const updated = await api.updateProfile({
        username: form.username,
        gender: form.gender,
        age: form.age,
        height_cm: form.height_cm,
        weight_kg: form.weight_kg,
        daily_calorie_target: form.daily_calorie_target,
        daily_protein_target: form.daily_protein_target,
        daily_fat_target: form.daily_fat_target,
        daily_carbs_target: form.daily_carbs_target,
        activity_level: form.activity_level,
      })
      setForm(updated)
      setMsg('已保存，BMR 已自动重算')
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  if (!form) {
    return (
      <div className="panel">
        {error ? <div className="error">{error}</div> : <p className="muted">加载中…</p>}
      </div>
    )
  }

  return (
    <div>
      <div className="toolbar">
        <div>
          <h2 style={{ margin: 0, fontFamily: 'var(--font-display)' }}>个人信息</h2>
          <div className="muted">身体参数与每日营养目标</div>
        </div>
        <div className="stat" style={{ minWidth: 160 }}>
          <div className="label">BMR</div>
          <div className="value" style={{ fontSize: '1.4rem' }}>
            {form.bmr != null ? Math.round(form.bmr) : '—'}
          </div>
        </div>
      </div>

      {error && <div className="error">{error}</div>}
      {msg && <div className="success">{msg}</div>}

      <form className="panel" onSubmit={onSubmit}>
        <div className="grid-2">
          <div className="field">
            <label>昵称</label>
            <input
              value={form.username}
              onChange={(e) => set('username', e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label>性别</label>
            <select
              value={form.gender}
              onChange={(e) => set('gender', e.target.value as Profile['gender'])}
            >
              <option value="male">男</option>
              <option value="female">女</option>
              <option value="other">其他</option>
            </select>
          </div>
          <div className="field">
            <label>年龄</label>
            <input
              type="number"
              value={form.age}
              onChange={(e) => set('age', Number(e.target.value))}
              required
            />
          </div>
          <div className="field">
            <label>活动水平</label>
            <select
              value={form.activity_level}
              onChange={(e) => set('activity_level', e.target.value)}
            >
              {activityOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>身高 cm</label>
            <input
              type="number"
              step="0.1"
              value={form.height_cm}
              onChange={(e) => set('height_cm', Number(e.target.value))}
              required
            />
          </div>
          <div className="field">
            <label>体重 kg</label>
            <input
              type="number"
              step="0.1"
              value={form.weight_kg}
              onChange={(e) => set('weight_kg', Number(e.target.value))}
              required
            />
          </div>
          <div className="field">
            <label>每日热量目标 kcal</label>
            <input
              type="number"
              value={form.daily_calorie_target}
              onChange={(e) => set('daily_calorie_target', Number(e.target.value))}
              required
            />
          </div>
          <div className="field">
            <label>蛋白目标 g</label>
            <input
              type="number"
              step="0.1"
              value={form.daily_protein_target}
              onChange={(e) => set('daily_protein_target', Number(e.target.value))}
            />
          </div>
          <div className="field">
            <label>脂肪目标 g</label>
            <input
              type="number"
              step="0.1"
              value={form.daily_fat_target}
              onChange={(e) => set('daily_fat_target', Number(e.target.value))}
            />
          </div>
          <div className="field">
            <label>碳水目标 g</label>
            <input
              type="number"
              step="0.1"
              value={form.daily_carbs_target}
              onChange={(e) => set('daily_carbs_target', Number(e.target.value))}
            />
          </div>
        </div>
        <button className="btn" type="submit" disabled={saving}>
          {saving ? '保存中…' : '保存资料'}
        </button>
      </form>
    </div>
  )
}
