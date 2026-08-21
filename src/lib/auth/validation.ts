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
    throw new AuthValidationError("请求内容格式无效")
  }
  return value as JsonObject
}

function requiredString(value: unknown, label: string, min: number, max: number): string {
  if (typeof value !== "string") throw new AuthValidationError(`${label}格式无效`)
  const trimmed = value.trim()
  if (trimmed.length < min || trimmed.length > max) {
    throw new AuthValidationError(`${label}长度必须在 ${min}-${max} 个字符之间`)
  }
  return trimmed
}

function optionalFiniteNumber(value: unknown, fallback: number, label: string): number {
  if (value === undefined || value === null || value === "") return fallback
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new AuthValidationError(`${label}必须是有效数字`)
  }
  return value
}

function boundedNumber(value: number, label: string, min: number, max: number): number {
  if (value < min || value > max) throw new AuthValidationError(`${label}超出合理范围`)
  return value
}

export function parseRegisterInput(value: unknown): RegisterInput {
  const body = asObject(value)
  const login = requiredString(body.login, "账号", 3, 80).toLowerCase()
  const password = requiredString(body.password, "密码", 8, 128)
  const inviteCode = requiredString(body.inviteCode, "注册邀请码", 4, 128)
  const username = requiredString(body.username, "显示名称", 1, 60)
  const gender = typeof body.gender === "string" && GENDERS.has(body.gender) ? body.gender : "other"
  const activityLevel = typeof body.activityLevel === "string" && ACTIVITY_LEVELS.has(body.activityLevel)
    ? body.activityLevel
    : "sedentary"
  const age = boundedNumber(optionalFiniteNumber(body.age, 30, "年龄"), "年龄", 1, 149)
  const heightCm = boundedNumber(optionalFiniteNumber(body.heightCm, 170, "身高"), "身高", 30, 260)
  const weightKg = boundedNumber(optionalFiniteNumber(body.weightKg, 65, "体重"), "体重", 10, 500)
  const dailyCalorieTarget = boundedNumber(optionalFiniteNumber(body.dailyCalorieTarget, 2000, "每日热量目标"), "每日热量目标", 1, 10000)
  const dailyProteinTarget = boundedNumber(optionalFiniteNumber(body.dailyProteinTarget, 60, "蛋白质目标"), "蛋白质目标", 0, 1000)
  const dailyFatTarget = boundedNumber(optionalFiniteNumber(body.dailyFatTarget, 60, "脂肪目标"), "脂肪目标", 0, 1000)
  const dailyCarbsTarget = boundedNumber(optionalFiniteNumber(body.dailyCarbsTarget, 250, "碳水目标"), "碳水目标", 0, 2000)

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
    login: requiredString(body.login, "账号", 3, 80).toLowerCase(),
    password: requiredString(body.password, "密码", 1, 128),
  }
}
