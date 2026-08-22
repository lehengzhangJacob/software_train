export const MEAL_NUTRITION_MIN = 0
export const MEAL_NUTRITION_MAX = 100_000

export const MEAL_NUTRITION_LABELS = {
  calories: "热量",
  proteinG: "蛋白质",
  fatG: "脂肪",
  carbsG: "碳水",
} as const

export type MealNutritionKey = keyof typeof MEAL_NUTRITION_LABELS

export function isValidMealNutritionValue(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= MEAL_NUTRITION_MIN &&
    value <= MEAL_NUTRITION_MAX
  )
}
