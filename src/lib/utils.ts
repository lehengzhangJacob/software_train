import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { MEAL_NUTRITION_MAX } from "@/lib/nutrition"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCalories(cal: number): string {
  if (!Number.isFinite(cal) || cal < 0) return "—"
  if (cal > MEAL_NUTRITION_MAX) return `${MEAL_NUTRITION_MAX.toLocaleString()}+`
  return Math.round(cal).toLocaleString()
}

export function formatGrams(g: number): string {
  if (!Number.isFinite(g) || g < 0) return "—"
  if (g > MEAL_NUTRITION_MAX) return `${MEAL_NUTRITION_MAX.toLocaleString()}+`
  return g.toFixed(1)
}

export function calcCaloriePercent(current: number, target: number): number {
  if (target === 0) return 0
  return Math.min(Math.round((current / target) * 100), 300)
}

export function getTodayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export const MEAL_ORDER: Record<string, number> = {
  breakfast: 1,
  lunch: 2,
  dinner: 3,
  snack: 4,
}

export const MEAL_LABELS: Record<string, string> = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐',
  snack: '加餐',
}

export const MEAL_ICONS: Record<string, string> = {
  breakfast: '☀',
  lunch: '☀',
  dinner: '☀',
  snack: '☀',
}
