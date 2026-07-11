const GENDERS = new Set(["male", "female", "other"])
const ACTIVITY_LEVELS = new Set([
  "sedentary",
  "lightly_active",
  "moderately_active",
  "very_active",
  "extra_active",
])
const MEAL_TYPES = new Set(["breakfast", "lunch", "dinner", "snack"])
const REPORT_PERIODS = new Set(["weekly", "monthly"])

export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ValidationError"
  }
}

type JsonObject = Record<string, unknown>

export interface UserProfileInput {
  username: string
  gender: string
  age: number
  heightCm: number
  weightKg: number
  dailyCalorieTarget: number
  dailyProteinTarget: number
  dailyFatTarget: number
  dailyCarbsTarget: number
  activityLevel: string
  bmr: number
}

export interface MealCreateInput {
  foodName: string
  mealType: string
  calories: number
  proteinG: number
  fatG: number
  carbsG: number
  portionDesc: string | null
  recognitionRaw: string | null
  recordDate: string
  recordTime: string
  notes: string | null
}

export type MealUpdateInput = Partial<MealCreateInput>

export interface MealBatchCreateInput {
  items: MealCreateInput[]
}

export interface ExerciseAdoptionInput {
  exerciseId: number
  durationMinutes: number
  date: string
}

export interface ExerciseSuggestionStatusInput {
  suggestionId: number
  isAdopted: boolean
}

function asObject(value: unknown): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ValidationError("请求内容必须是对象")
  }
  return value as JsonObject
}

function requiredString(value: unknown, label: string, maxLength: number) {
  if (typeof value !== "string") throw new ValidationError(`${label}格式无效`)
  const result = value.trim()
  if (!result) throw new ValidationError(`请填写${label}`)
  if (result.length > maxLength) throw new ValidationError(`${label}过长`)
  return result
}

function optionalString(value: unknown, label: string, maxLength: number) {
  if (value === undefined || value === null || value === "") return null
  if (typeof value !== "string") throw new ValidationError(`${label}格式无效`)
  const result = value.trim()
  if (result.length > maxLength) throw new ValidationError(`${label}过长`)
  return result || null
}

function finiteNumber(value: unknown, label: string) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new ValidationError(`${label}必须是有效数字`)
  }
  return value
}

function positiveNumber(value: unknown, label: string) {
  const result = finiteNumber(value, label)
  if (result <= 0) throw new ValidationError(`${label}必须大于 0`)
  return result
}

function nonNegativeNumber(value: unknown, label: string) {
  const result = finiteNumber(value, label)
  if (result < 0) throw new ValidationError(`${label}不能为负数`)
  return result
}

function integerInRange(value: unknown, label: string, min: number, max: number) {
  const result = finiteNumber(value, label)
  if (!Number.isInteger(result) || result < min || result > max) {
    throw new ValidationError(`${label}必须在 ${min} 到 ${max} 之间`)
  }
  return result
}

function enumValue(value: unknown, label: string, allowed: Set<string>) {
  if (typeof value !== "string" || !allowed.has(value)) {
    throw new ValidationError(`${label}取值无效`)
  }
  return value
}

export function parsePositiveInteger(value: unknown, label: string) {
  const result = finiteNumber(value, label)
  if (!Number.isInteger(result) || result <= 0) {
    throw new ValidationError(`${label}必须是正整数`)
  }
  return result
}

export function parseDate(value: unknown, label = "日期") {
  if (typeof value !== "string") throw new ValidationError(`${label}格式无效`)
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) throw new ValidationError(`${label}格式必须为 YYYY-MM-DD`)

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const parsed = new Date(Date.UTC(year, month - 1, day))
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new ValidationError(`${label}不是有效日期`)
  }
  return value
}

export function parseTime(value: unknown, label = "时间") {
  if (typeof value !== "string") throw new ValidationError(`${label}格式无效`)
  const match = /^(\d{2}):(\d{2}):(\d{2})$/.exec(value)
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59 || Number(match[3]) > 59) {
    throw new ValidationError(`${label}格式必须为 HH:MM:SS`)
  }
  return value
}

function sanitizeRecognitionRaw(value: unknown) {
  if (value === undefined || value === null || value === "") return null

  let serialized: string
  if (typeof value === "string") {
    serialized = value.trim()
  } else {
    try {
      serialized = JSON.stringify(value)
    } catch {
      throw new ValidationError("AI 识别元数据格式无效")
    }
  }

  if (!serialized) return null
  if (serialized.length > 20_000) throw new ValidationError("AI 识别元数据过大")
  if (/data:image|;base64,/i.test(serialized)) {
    throw new ValidationError("AI 识别元数据不能包含图片内容")
  }
  return serialized
}

export function calculateBmr(gender: string, weightKg: number, heightCm: number, age: number) {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age
  const offset = gender === "male" ? 5 : gender === "female" ? -161 : -78
  return Math.round((base + offset) * 10) / 10
}

export function parseUserProfileInput(value: unknown): UserProfileInput {
  const body = asObject(value)
  const username = requiredString(body.username, "昵称", 80)
  const gender = enumValue(body.gender, "性别", GENDERS)
  const age = integerInRange(body.age, "年龄", 1, 149)
  const heightCm = positiveNumber(body.heightCm, "身高")
  const weightKg = positiveNumber(body.weightKg, "体重")
  const dailyCalorieTarget = integerInRange(body.dailyCalorieTarget, "每日热量目标", 1, 100_000)
  const dailyProteinTarget = nonNegativeNumber(body.dailyProteinTarget, "蛋白质目标")
  const dailyFatTarget = nonNegativeNumber(body.dailyFatTarget, "脂肪目标")
  const dailyCarbsTarget = nonNegativeNumber(body.dailyCarbsTarget, "碳水目标")
  const activityLevel = enumValue(body.activityLevel, "活动水平", ACTIVITY_LEVELS)

  return {
    username,
    gender,
    age,
    heightCm,
    weightKg,
    dailyCalorieTarget,
    dailyProteinTarget,
    dailyFatTarget,
    dailyCarbsTarget,
    activityLevel,
    bmr: calculateBmr(gender, weightKg, heightCm, age),
  }
}

function parseMealType(value: unknown) {
  return enumValue(value, "餐别", MEAL_TYPES)
}

export function parseMealCreateInput(value: unknown, defaults: { date: string; time: string }): MealCreateInput {
  const body = asObject(value)
  return {
    foodName: requiredString(body.foodName, "食物名称", 120),
    mealType: parseMealType(body.mealType),
    calories: nonNegativeNumber(body.calories, "热量"),
    proteinG: body.proteinG === undefined ? 0 : nonNegativeNumber(body.proteinG, "蛋白质"),
    fatG: body.fatG === undefined ? 0 : nonNegativeNumber(body.fatG, "脂肪"),
    carbsG: body.carbsG === undefined ? 0 : nonNegativeNumber(body.carbsG, "碳水"),
    portionDesc: optionalString(body.portionDesc, "份量描述", 200),
    recognitionRaw: sanitizeRecognitionRaw(body.recognitionRaw),
    recordDate: parseDate(body.recordDate ?? defaults.date, "记录日期"),
    recordTime: parseTime(body.recordTime ?? defaults.time, "记录时间"),
    notes: optionalString(body.notes, "备注", 1_000),
  }
}

/**
 * Parse every item before the route starts its database transaction. The
 * returned DTO intentionally contains only persisted meal fields, so caller
 * supplied ownership ids, image data, and other presentation-only values are
 * never passed to Prisma.
 */
export function parseMealBatchCreateInput(
  value: unknown,
  defaults: { date: string; time: string }
): MealBatchCreateInput {
  const body = asObject(value)
  if (!Array.isArray(body.items)) {
    throw new ValidationError("items must be an array")
  }
  if (body.items.length === 0 || body.items.length > 10) {
    throw new ValidationError("items must contain between 1 and 10 meals")
  }

  const itemDefaults = {
    date: body.recordDate === undefined ? defaults.date : parseDate(body.recordDate, "recordDate"),
    time: body.recordTime === undefined ? defaults.time : parseTime(body.recordTime, "recordTime"),
  }

  return {
    items: body.items.map((item) => parseMealCreateInput(item, itemDefaults)),
  }
}

export function parseMealUpdateInput(value: unknown) {
  const body = asObject(value)
  const data: MealUpdateInput = {}

  if (Object.hasOwn(body, "foodName")) data.foodName = requiredString(body.foodName, "食物名称", 120)
  if (Object.hasOwn(body, "mealType")) data.mealType = parseMealType(body.mealType)
  if (Object.hasOwn(body, "calories")) data.calories = nonNegativeNumber(body.calories, "热量")
  if (Object.hasOwn(body, "proteinG")) data.proteinG = nonNegativeNumber(body.proteinG, "蛋白质")
  if (Object.hasOwn(body, "fatG")) data.fatG = nonNegativeNumber(body.fatG, "脂肪")
  if (Object.hasOwn(body, "carbsG")) data.carbsG = nonNegativeNumber(body.carbsG, "碳水")
  if (Object.hasOwn(body, "portionDesc")) data.portionDesc = optionalString(body.portionDesc, "份量描述", 200)
  if (Object.hasOwn(body, "recognitionRaw")) data.recognitionRaw = sanitizeRecognitionRaw(body.recognitionRaw)
  if (Object.hasOwn(body, "recordDate")) data.recordDate = parseDate(body.recordDate, "记录日期")
  if (Object.hasOwn(body, "recordTime")) data.recordTime = parseTime(body.recordTime, "记录时间")
  if (Object.hasOwn(body, "notes")) data.notes = optionalString(body.notes, "备注", 1_000)

  if (Object.keys(data).length === 0) throw new ValidationError("没有可更新的饮食字段")
  return data
}

/**
 * Exercise calories and ownership are always derived on the server. This DTO
 * deliberately reads only the reference id, requested duration, and date.
 */
export function parseExerciseAdoptionInput(value: unknown): ExerciseAdoptionInput {
  const body = asObject(value)
  return {
    exerciseId: parsePositiveInteger(body.exerciseId, "运动参考 ID"),
    durationMinutes: integerInRange(body.durationMinutes, "时长（分钟）", 1, 720),
    date: parseDate(body.date, "计划日期"),
  }
}

export function parseExerciseSuggestionStatusInput(value: unknown): ExerciseSuggestionStatusInput {
  const body = asObject(value)
  if (typeof body.isAdopted !== "boolean") {
    throw new ValidationError("采用状态必须是布尔值")
  }

  return {
    suggestionId: parsePositiveInteger(body.suggestionId, "运动计划 ID"),
    isAdopted: body.isAdopted,
  }
}

export function parseReportPeriod(value: unknown) {
  return enumValue(value, "报告周期", REPORT_PERIODS)
}
