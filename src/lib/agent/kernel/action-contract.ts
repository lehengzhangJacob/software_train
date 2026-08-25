export const EXERCISE_PLAN_ACTION_SEQUENCE = [
  "validate_exercise_plan",
  "save_exercise_plan",
  "verify_exercise_plan",
] as const

export type ExercisePlanActionName = (typeof EXERCISE_PLAN_ACTION_SEQUENCE)[number]

export const MEAL_RECORD_ACTION_SEQUENCE = [
  "validate_meal_record",
  "save_meal_record",
  "verify_meal_record",
] as const

export type MealRecordActionName = (typeof MEAL_RECORD_ACTION_SEQUENCE)[number]
