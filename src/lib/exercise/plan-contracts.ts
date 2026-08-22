export const EXERCISE_PLAN_INTENSITIES = ["low", "moderate", "high"] as const
export type ExercisePlanIntensity = (typeof EXERCISE_PLAN_INTENSITIES)[number]

export const EXERCISE_PLAN_STEP_KINDS = ["warmup", "cardio", "strength", "mobility", "cooldown"] as const
export type ExercisePlanStepKind = (typeof EXERCISE_PLAN_STEP_KINDS)[number]

const ROOT_KEYS = new Set([
  "planDate",
  "title",
  "goal",
  "totalMinutes",
  "intensity",
  "steps",
  "safetyNote",
  "equipment",
  "legacy",
])
const STEP_KEYS = new Set(["order", "kind", "name", "minutes", "instructions", "sets", "reps", "restSeconds"])

export type ExercisePlanStep = {
  order: number
  kind: ExercisePlanStepKind
  name: string
  minutes: number
  instructions: string
  sets?: number
  reps?: number
  restSeconds?: number
}

export type LegacyExercisePlanData = {
  durationMinutes: number
  calorieSurplus: number | null
  calorieBurnEstimate: number
  isAdopted: number
}

export type ExercisePlanPayload = {
  planDate: string
  title: string
  goal: string
  totalMinutes: number
  intensity: ExercisePlanIntensity
  steps: ExercisePlanStep[]
  safetyNote: string
  equipment: string[]
  legacy?: LegacyExercisePlanData
}

export class ExercisePlanValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ExercisePlanValidationError"
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function assertRecord(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (!isRecord(value)) throw new ExercisePlanValidationError(`${label}必须是对象`)
}

function boundedString(value: unknown, label: string, maxLength: number, allowEmpty = false) {
  if (typeof value !== "string") throw new ExercisePlanValidationError(`${label}格式无效`)
  const result = value.trim()
  if (!allowEmpty && result.length === 0) throw new ExercisePlanValidationError(`${label}不能为空`)
  if (result.length > maxLength) throw new ExercisePlanValidationError(`${label}过长`)
  return result
}

function integerInRange(value: unknown, label: string, min: number, max: number) {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    throw new ExercisePlanValidationError(`${label}必须在 ${min} 到 ${max} 之间`)
  }
  return value
}

function optionalInteger(value: unknown, label: string, min: number, max: number) {
  if (value === undefined || value === null) return undefined
  return integerInRange(value, label, min, max)
}

function enumValue<T extends string>(value: unknown, label: string, values: readonly T[]): T {
  if (typeof value !== "string" || !values.includes(value as T)) {
    throw new ExercisePlanValidationError(`${label}取值无效`)
  }
  return value as T
}

function assertKnownKeys(value: Record<string, unknown>, allowed: Set<string>, label: string) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new ExercisePlanValidationError(`${label}包含未知字段`)
  }
}

function parsePlanDate(value: unknown) {
  const date = boundedString(value, "计划日期", 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new ExercisePlanValidationError("计划日期格式无效")
  const parsed = new Date(`${date}T00:00:00.000Z`)
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new ExercisePlanValidationError("计划日期无效")
  }
  return date
}

function parseLegacy(value: unknown): LegacyExercisePlanData | undefined {
  if (value === undefined || value === null) return undefined
  assertRecord(value, "legacy")
  assertKnownKeys(value, new Set(["durationMinutes", "calorieSurplus", "calorieBurnEstimate", "isAdopted"]), "legacy")
  return {
    durationMinutes: integerInRange(value.durationMinutes, "历史时长", 0, 24 * 60),
    calorieSurplus:
      value.calorieSurplus === null || value.calorieSurplus === undefined
        ? null
        : typeof value.calorieSurplus === "number" && Number.isFinite(value.calorieSurplus)
          ? value.calorieSurplus
          : (() => { throw new ExercisePlanValidationError("历史热量差格式无效") })(),
    calorieBurnEstimate:
      typeof value.calorieBurnEstimate === "number" && Number.isFinite(value.calorieBurnEstimate) && value.calorieBurnEstimate >= 0
        ? value.calorieBurnEstimate
        : (() => { throw new ExercisePlanValidationError("历史消耗估算格式无效") })(),
    isAdopted: integerInRange(value.isAdopted, "历史采纳状态", 0, 1),
  }
}

function parseStep(value: unknown, index: number): ExercisePlanStep {
  assertRecord(value, `第 ${index + 1} 个步骤`)
  assertKnownKeys(value, STEP_KEYS, `第 ${index + 1} 个步骤`)
  const order = integerInRange(value.order, "步骤序号", index + 1, index + 1)
  const kind = enumValue(value.kind, "步骤类型", EXERCISE_PLAN_STEP_KINDS)
  const name = boundedString(value.name, "步骤名称", 160)
  const minutes = integerInRange(value.minutes, "步骤时长", 1, 180)
  const instructions = boundedString(value.instructions, "步骤说明", 500)
  const sets = optionalInteger(value.sets, "组数", 1, 30)
  const reps = optionalInteger(value.reps, "次数", 1, 500)
  const restSeconds = optionalInteger(value.restSeconds, "休息秒数", 0, 600)
  return { order, kind, name, minutes, instructions, ...(sets === undefined ? {} : { sets }), ...(reps === undefined ? {} : { reps }), ...(restSeconds === undefined ? {} : { restSeconds }) }
}

export function parseExercisePlanPayload(value: unknown, options: { allowLegacy?: boolean } = {}): ExercisePlanPayload {
  assertRecord(value, "运动计划")
  assertKnownKeys(value, ROOT_KEYS, "运动计划")
  if (!options.allowLegacy && Object.hasOwn(value, "legacy")) {
    throw new ExercisePlanValidationError("Agent 计划不能携带 legacy 字段")
  }
  const planDate = parsePlanDate(value.planDate)
  const title = boundedString(value.title, "计划标题", 160)
  const goal = boundedString(value.goal, "计划目标", 500)
  const totalMinutes = integerInRange(value.totalMinutes, "总时长", 5, 180)
  const intensity = enumValue(value.intensity, "计划强度", EXERCISE_PLAN_INTENSITIES)
  if (!Array.isArray(value.steps) || value.steps.length < 1 || value.steps.length > 8) {
    throw new ExercisePlanValidationError("运动步骤必须为 1 到 8 项")
  }
  const steps = value.steps.map(parseStep)
  const stepMinutes = steps.reduce((sum, step) => sum + step.minutes, 0)
  if (stepMinutes > totalMinutes) throw new ExercisePlanValidationError("步骤总时长不能超过计划总时长")
  const safetyNote = boundedString(value.safetyNote ?? "出现不适立即停止", "安全提示", 500)
  const equipment = value.equipment === undefined
    ? []
    : Array.isArray(value.equipment)
      ? value.equipment.map((item, index) => boundedString(item, `器材 ${index + 1}`, 80)).slice(0, 8)
      : (() => { throw new ExercisePlanValidationError("器材列表格式无效") })()
  const legacy = options.allowLegacy ? parseLegacy(value.legacy) : undefined
  return { planDate, title, goal, totalMinutes, intensity, steps, safetyNote, equipment, ...(legacy ? { legacy } : {}) }
}

export function parseStoredExercisePlan(value: string) {
  try {
    return parseExercisePlanPayload(JSON.parse(value), { allowLegacy: true })
  } catch (error) {
    if (error instanceof ExercisePlanValidationError) throw error
    throw new ExercisePlanValidationError("已保存的运动计划格式无效")
  }
}

export function serializeExercisePlan(payload: ExercisePlanPayload) {
  return JSON.stringify(payload)
}
