export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'

export interface Profile {
  user_id: number
  username: string
  gender: 'male' | 'female' | 'other'
  age: number
  height_cm: number
  weight_kg: number
  daily_calorie_target: number
  daily_protein_target: number
  daily_fat_target: number
  daily_carbs_target: number
  bmr: number | null
  activity_level: string
}

export interface Meal {
  record_id: number
  user_id: number
  food_name: string
  meal_type: MealType
  calories: number
  protein_g: number
  fat_g: number
  carbs_g: number
  portion_desc: string | null
  photo_path: string | null
  recognition_raw: string | null
  record_date: string
  record_time: string
  notes: string | null
}

export interface DailyNutrition {
  user_id: number
  username?: string | null
  record_date: string
  total_calories: number
  total_protein_g: number
  total_fat_g: number
  total_carbs_g: number
  meal_count: number
  daily_calorie_target: number
  daily_protein_target: number
  daily_fat_target: number
  daily_carbs_target: number
  calorie_diff: number
}

export interface FoodItem {
  name: string
  portion: string
  calories: number
  protein: number
  fat: number
  carbs: number
  confidence?: number | null
}

export interface RecognizeResult {
  foods: FoodItem[]
  total_calories: number
  model: string
  raw_text: string
  photo_path: string | null
  parse_ok: boolean
}

export interface ExerciseSuggestion {
  suggestion_id: number
  user_id: number
  suggestion_date: string
  calorie_surplus: number | null
  exercise_type: string
  duration_minutes: number
  calorie_burn_estimate: number
  intensity: 'low' | 'moderate' | 'high' | null
  suggestion_detail: string | null
  is_adopted: number
  created_at?: string | null
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init)
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || res.statusText)
  }
  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export const api = {
  getProfile: () => request<Profile>('/api/profile'),
  updateProfile: (body: Partial<Profile>) =>
    request<Profile>('/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  listMeals: (date: string) => request<Meal[]>(`/api/meals?date=${date}`),
  mealDates: (year: number, month: number) =>
    request<string[]>(`/api/meals/dates?year=${year}&month=${month}`),
  createMeal: (body: Partial<Meal> & { food_name: string; meal_type: MealType; calories: number }) =>
    request<Meal>('/api/meals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  updateMeal: (id: number, body: Partial<Meal>) =>
    request<Meal>(`/api/meals/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }),
  deleteMeal: (id: number) =>
    request<{ ok: boolean }>(`/api/meals/${id}`, { method: 'DELETE' }),
  dailyNutrition: (date: string) =>
    request<DailyNutrition>(`/api/nutrition/daily?date=${date}`),
  rangeNutrition: (days: number) =>
    request<DailyNutrition[]>(`/api/nutrition/range?days=${days}`),
  recognize: async (file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return request<RecognizeResult>('/api/recognize', { method: 'POST', body: fd })
  },
  listSuggestions: (date?: string) =>
    request<ExerciseSuggestion[]>(
      date ? `/api/exercise/suggestions?date=${date}` : '/api/exercise/suggestions',
    ),
  generateSuggestion: (date?: string) =>
    request<ExerciseSuggestion>('/api/exercise/suggest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date }),
    }),
  adoptSuggestion: (id: number, is_adopted: number) =>
    request<ExerciseSuggestion>(`/api/exercise/suggestions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_adopted }),
    }),
}

export const MEAL_LABELS: Record<MealType, string> = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐',
  snack: '加餐',
}

export function todayStr() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
