export const EXERCISE_PLAN_ACTION_SEQUENCE = [
  "validate_exercise_plan",
  "save_exercise_plan",
  "verify_exercise_plan",
] as const

export type ExercisePlanActionName = (typeof EXERCISE_PLAN_ACTION_SEQUENCE)[number]
