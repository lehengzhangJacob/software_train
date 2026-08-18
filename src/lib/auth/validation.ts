export class AuthValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "AuthValidationError"
  }
}

type JsonObject = Record<string, unknown>

export interface RegisterInput {
  login: string
  password: string
  inviteCode: string
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
}

export interface LoginInput {
  login: string
  password: string
}

const GENDERS = new Set(["male", "female", "other"])
const ACTIVITY_LEVELS = new Set([
  "sedentary",
  "lightly_active",
  "moderately_active",
  "very_active",
  "extra_active",
])

function asObject(value: unknown): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AuthValidationError("璇锋眰鍐呭鏍煎紡鏃犳晥")
  }
  return value as JsonObject
}

function requiredString(value: unknown, label: string, min: number, max: number): string {
  if (typeof value !== "string") throw new AuthValidationError(`${label}鏍煎紡鏃犳晥`)
  const trimmed = value.trim()
  if (trimmed.length < min || trimmed.length > max) {
    throw new AuthValidationError(`${label}闀垮害蹇呴』鍦?${min}-${max}涓瓧绗︿箣闂?`)
  }
  return trimmed
}

function optionalFiniteNumber(value: unknown, fallback: number, label: string): number {
  if (value === undefined || value === null || value === "") return fallback
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new AuthValidationError(`${label}蹇呴』鏄湁鏁版暟瀛?`)
  }
  return value
}

function boundedNumber(value: number, label: string, min: number, max: number): number {
  if (value < min || value > max) throw new AuthValidationError(`${label}瓒呭嚭鍚堢悊鑼冨洿`)
  return value
}

export function parseRegisterInput(value: unknown): RegisterInput {
  const body = asObject(value)
  const login = requiredString(body.login, "璐︽埛", 3, 80).toLowerCase()
  const password = requiredString(body.password, "瀵嗙爜", 8, 128)
  const inviteCode = requiredString(body.inviteCode, "娉ㄥ唽閭€璇风爜", 4, 128)
  const username = requiredString(body.username, "鏄电О", 1, 60)
  const gender = typeof body.gender === "string" && GENDERS.has(body.gender) ? body.gender : "other"
  const activityLevel = typeof body.activityLevel === "string" && ACTIVITY_LEVELS.has(body.activityLevel)
    ? body.activityLevel
    : "sedentary"
  const age = boundedNumber(optionalFiniteNumber(body.age, 30, "骞撮緞"), "骞撮緞", 1, 149)
  const heightCm = boundedNumber(optionalFiniteNumber(body.heightCm, 170, "韬珮"), "韬珮", 30, 260)
  const weightKg = boundedNumber(optionalFiniteNumber(body.weightKg, 65, "浣撻噸"), "浣撻噸", 10, 500)
  const dailyCalorieTarget = boundedNumber(optionalFiniteNumber(body.dailyCalorieTarget, 2000, "姣忔棩鐑噺鐩爣"), "姣忔棩鐑噺鐩爣", 1, 10000)
  const dailyProteinTarget = boundedNumber(optionalFiniteNumber(body.dailyProteinTarget, 60, "铔嬬櫧璐ㄧ洰鏍?"), "铔嬬櫧璐ㄧ洰鏍?", 0, 1000)
  const dailyFatTarget = boundedNumber(optionalFiniteNumber(body.dailyFatTarget, 60, "鑴傝偑鐩爣"), "鑴傝偑鐩爣", 0, 1000)
  const dailyCarbsTarget = boundedNumber(optionalFiniteNumber(body.dailyCarbsTarget, 250, "纰虫按鐩爣"), "纰虫按鐩爣", 0, 2000)

  return {
    login,
    password,
    inviteCode,
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
  }
}

export function parseLoginInput(value: unknown): LoginInput {
  const body = asObject(value)
  return {
    login: requiredString(body.login, "璐︽埛", 3, 80).toLowerCase(),
    password: requiredString(body.password, "瀵嗙爜", 1, 128),
  }
}
