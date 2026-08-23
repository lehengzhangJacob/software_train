export type ExercisePlanProgress = {
  completedStepOrders: number[]
  completedCount: number
  totalSteps: number
  planCompleted: boolean
}

export class ExercisePlanProgressValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ExercisePlanProgressValidationError"
  }
}

export function summarizeExercisePlanProgress(
  steps: readonly { order: number }[],
  completedStepOrders: readonly number[],
): ExercisePlanProgress {
  const validOrders = new Set(steps.map((step) => step.order))
  const completed = [...new Set(completedStepOrders)]
    .filter((order) => validOrders.has(order))
    .sort((left, right) => left - right)

  return {
    completedStepOrders: completed,
    completedCount: completed.length,
    totalSteps: steps.length,
    planCompleted: steps.length > 0 && completed.length === steps.length,
  }
}

function positiveInteger(value: unknown, label: string) {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
    throw new ExercisePlanProgressValidationError(`${label}必须是正整数`)
  }
  return value
}

export function parseExercisePlanStepProgressInput(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ExercisePlanProgressValidationError("请求内容必须是对象")
  }
  const body = value as Record<string, unknown>
  if (typeof body.completed !== "boolean") {
    throw new ExercisePlanProgressValidationError("完成状态必须是布尔值")
  }
  return {
    planId: positiveInteger(body.planId, "运动计划 ID"),
    stepOrder: positiveInteger(body.stepOrder, "步骤序号"),
    completed: body.completed,
  }
}
