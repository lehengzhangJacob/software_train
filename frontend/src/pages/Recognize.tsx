import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, MEAL_LABELS, todayStr } from '../api/client'
import type { FoodItem, MealType, RecognizeResult } from '../api/client'

const emptyFood = (): FoodItem => ({
  name: '',
  portion: '',
  calories: 0,
  protein: 0,
  fat: 0,
  carbs: 0,
})

export default function Recognize() {
  const nav = useNavigate()
  const [preview, setPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<RecognizeResult | null>(null)
  const [foods, setFoods] = useState<FoodItem[]>([])
  const [mealType, setMealType] = useState<MealType>('lunch')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  async function onFile(file: File | null) {
    if (!file) return
    setError('')
    setMsg('')
    setPreview(URL.createObjectURL(file))
    setLoading(true)
    try {
      const res = await api.recognize(file)
      setResult(res)
      setFoods(res.foods.length ? res.foods : [emptyFood()])
      if (!res.parse_ok) {
        setError('识别结果需人工校对，可直接编辑下方数值后保存。')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '识别失败')
      setFoods([emptyFood()])
    } finally {
      setLoading(false)
    }
  }

  function updateFood(i: number, patch: Partial<FoodItem>) {
    setFoods((prev) => prev.map((f, idx) => (idx === i ? { ...f, ...patch } : f)))
  }

  async function saveAll() {
    const valid = foods.filter((f) => f.name.trim())
    if (!valid.length) {
      setError('请至少填写一种食物')
      return
    }
    setSaving(true)
    setError('')
    try {
      for (const f of valid) {
        await api.createMeal({
          food_name: f.name,
          meal_type: mealType,
          calories: Number(f.calories) || 0,
          protein_g: Number(f.protein) || 0,
          fat_g: Number(f.fat) || 0,
          carbs_g: Number(f.carbs) || 0,
          portion_desc: f.portion || null,
          photo_path: result?.photo_path || null,
          recognition_raw: result
            ? JSON.stringify({
                model: result.model,
                foods: valid,
                raw_text: result.raw_text,
              })
            : null,
          record_date: todayStr(),
        })
      }
      setMsg(`已保存 ${valid.length} 条记录`)
      setTimeout(() => nav('/'), 700)
    } catch (e) {
      setError(e instanceof Error ? e.message : '保存失败')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="toolbar">
        <div>
          <h2 style={{ margin: 0, fontFamily: 'var(--font-display)' }}>拍照识别</h2>
          <div className="muted">上传或拍摄食物，GLM 估算热量与营养素</div>
        </div>
      </div>

      {error && <div className="error">{error}</div>}
      {msg && <div className="success">{msg}</div>}

      <section className="panel">
        <label className="upload-zone" style={{ display: 'block', cursor: 'pointer' }}>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(e) => onFile(e.target.files?.[0] || null)}
          />
          {preview ? (
            <img
              src={preview}
              alt="预览"
              style={{ maxWidth: '100%', maxHeight: 280, borderRadius: 16 }}
            />
          ) : (
            <>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.3rem' }}>
                点击上传或拍照
              </div>
              <p className="muted">支持 JPG / PNG，最大 5MB</p>
            </>
          )}
        </label>
        {loading && <p className="muted" style={{ marginTop: 12 }}>正在识别，请稍候…</p>}
        {result && (
          <p className="muted" style={{ marginTop: 12 }}>
            模型：{result.model}
            {result.photo_path ? ` · 已保存 ${result.photo_path}` : ''}
          </p>
        )}
      </section>

      {(foods.length > 0 || result) && (
        <section className="panel">
          <div className="toolbar">
            <h3 style={{ margin: 0 }}>识别结果（可编辑）</h3>
            <div className="field" style={{ margin: 0, minWidth: 160 }}>
              <label>餐别</label>
              <select
                value={mealType}
                onChange={(e) => setMealType(e.target.value as MealType)}
              >
                {(Object.keys(MEAL_LABELS) as MealType[]).map((k) => (
                  <option key={k} value={k}>
                    {MEAL_LABELS[k]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {foods.map((f, i) => (
            <div className="food-card" key={i}>
              <div className="grid-2">
                <div className="field">
                  <label>食物名称</label>
                  <input
                    value={f.name}
                    onChange={(e) => updateFood(i, { name: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>份量</label>
                  <input
                    value={f.portion}
                    onChange={(e) => updateFood(i, { portion: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid-3">
                <div className="field">
                  <label>热量 kcal</label>
                  <input
                    type="number"
                    value={f.calories}
                    onChange={(e) =>
                      updateFood(i, { calories: Number(e.target.value) })
                    }
                  />
                </div>
                <div className="field">
                  <label>蛋白 g</label>
                  <input
                    type="number"
                    value={f.protein}
                    onChange={(e) =>
                      updateFood(i, { protein: Number(e.target.value) })
                    }
                  />
                </div>
                <div className="field">
                  <label>脂肪 g</label>
                  <input
                    type="number"
                    value={f.fat}
                    onChange={(e) => updateFood(i, { fat: Number(e.target.value) })}
                  />
                </div>
              </div>
              <div className="field">
                <label>碳水 g</label>
                <input
                  type="number"
                  value={f.carbs}
                  onChange={(e) => updateFood(i, { carbs: Number(e.target.value) })}
                />
              </div>
              <button
                className="btn ghost"
                type="button"
                onClick={() => setFoods((prev) => prev.filter((_, idx) => idx !== i))}
              >
                删除此项
              </button>
            </div>
          ))}

          <div className="row-actions" style={{ marginTop: 8 }}>
            <button className="btn secondary" type="button" onClick={() => setFoods((p) => [...p, emptyFood()])}>
              添加食物
            </button>
            <button className="btn" type="button" disabled={saving} onClick={saveAll}>
              {saving ? '保存中…' : '确认入库'}
            </button>
          </div>
        </section>
      )}
    </div>
  )
}
