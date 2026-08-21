export interface RecognizedFood {
  name: string
  calories: number
  protein: number
  fat: number
  carbs: number
  portion: string
  confidence: number
}

export const RECOGNITION_HANDOFF_KEY = "foodmoment:recognition-handoff"
export const RECOGNITION_HANDOFF_TTL_MS = 10 * 60 * 1_000
export const MAX_RECOGNITION_HANDOFF_ITEMS = 10

type HandoffStatus = "pending" | "ready"

interface RecognitionHandoffPayload {
  version: 1
  requestId: string
  status: HandoffStatus
  createdAt: number
  foods?: RecognizedFood[]
}

export interface RecognitionHandoffStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

function getSessionStorage() {
  if (typeof window === "undefined") return null
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

function resolveStorage(storage: RecognitionHandoffStorage | null | undefined) {
  return storage === undefined ? getSessionStorage() : storage
}

function validRequestId(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= 120
}

function validFiniteNumber(value: unknown, max: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= max
}

function containsSensitiveText(value: string) {
  return /data:image\/|(?:api[_ -]?key|access[_ -]?token|secret)\s*[:=]|bearer\s+/i.test(value)
}

function normalizeFood(value: unknown): RecognizedFood | null {
  if (!value || typeof value !== "object") return null
  const food = value as Partial<RecognizedFood>
  if (
    typeof food.name !== "string" ||
    food.name.trim().length === 0 ||
    food.name.length > 100 ||
    typeof food.portion !== "string" ||
    food.portion.trim().length === 0 ||
    food.portion.length > 200 ||
    containsSensitiveText(food.name) ||
    containsSensitiveText(food.portion) ||
    !validFiniteNumber(food.calories, 100_000) ||
    !validFiniteNumber(food.protein, 100_000) ||
    !validFiniteNumber(food.fat, 100_000) ||
    !validFiniteNumber(food.carbs, 100_000) ||
    !validFiniteNumber(food.confidence, 1)
  ) {
    return null
  }

  return {
    name: food.name.trim(),
    calories: food.calories,
    protein: food.protein,
    fat: food.fat,
    carbs: food.carbs,
    portion: food.portion.trim(),
    confidence: food.confidence,
  }
}

function normalizeFoods(value: unknown) {
  if (!Array.isArray(value)) return []
  return value
    .slice(0, MAX_RECOGNITION_HANDOFF_ITEMS)
    .map(normalizeFood)
    .filter((food): food is RecognizedFood => food !== null)
}

function parsePayload(raw: string | null, now: number): RecognitionHandoffPayload | null {
  if (!raw) return null

  try {
    const value = JSON.parse(raw) as Partial<RecognitionHandoffPayload>
    if (
      value.version !== 1 ||
      !validRequestId(value.requestId) ||
      (value.status !== "pending" && value.status !== "ready") ||
      typeof value.createdAt !== "number" ||
      !Number.isFinite(value.createdAt) ||
      now - value.createdAt > RECOGNITION_HANDOFF_TTL_MS
    ) {
      return null
    }
    if (value.status === "ready") {
      const foods = normalizeFoods(value.foods)
      if (foods.length === 0) return null
      return { version: 1, requestId: value.requestId, status: "ready", createdAt: value.createdAt, foods }
    }
    return { version: 1, requestId: value.requestId, status: "pending", createdAt: value.createdAt }
  } catch {
    return null
  }
}

function readPayload(storage: RecognitionHandoffStorage, now: number) {
  const payload = parsePayload(storage.getItem(RECOGNITION_HANDOFF_KEY), now)
  if (!payload) {
    try {
      storage.removeItem(RECOGNITION_HANDOFF_KEY)
    } catch {
      // Storage failures are non-fatal; the in-page recognition flow still works.
    }
  }
  return payload
}

export function createRecognitionRequestId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function beginRecognitionHandoff(
  requestId: string,
  storage?: RecognitionHandoffStorage | null,
  now = Date.now(),
) {
  const target = resolveStorage(storage)
  if (!target || !validRequestId(requestId)) return false
  try {
    target.setItem(RECOGNITION_HANDOFF_KEY, JSON.stringify({
      version: 1,
      requestId,
      status: "pending",
      createdAt: now,
    } satisfies RecognitionHandoffPayload))
    return true
  } catch {
    return false
  }
}

export function publishRecognitionHandoff(
  requestId: string,
  foods: readonly RecognizedFood[],
  storage?: RecognitionHandoffStorage | null,
  now = Date.now(),
) {
  const target = resolveStorage(storage)
  if (!target) return true
  if (!validRequestId(requestId)) return false

  const current = readPayload(target, now)
  if (current && current.requestId !== requestId) return false
  const normalizedFoods = normalizeFoods(foods)
  if (normalizedFoods.length === 0) return false

  try {
    target.setItem(RECOGNITION_HANDOFF_KEY, JSON.stringify({
      version: 1,
      requestId,
      status: "ready",
      createdAt: now,
      foods: normalizedFoods,
    } satisfies RecognitionHandoffPayload))
    return true
  } catch {
    return true
  }
}

export function clearRecognitionHandoff(requestId: string, storage?: RecognitionHandoffStorage | null, now = Date.now()) {
  const target = resolveStorage(storage)
  if (!target) return
  const current = readPayload(target, now)
  if (current?.requestId !== requestId) return
  try {
    target.removeItem(RECOGNITION_HANDOFF_KEY)
  } catch {
    // A stale session payload will be removed on the next read.
  }
}

export function consumeRecognitionHandoff(storage?: RecognitionHandoffStorage | null, now = Date.now()) {
  const target = resolveStorage(storage)
  if (!target) return null
  const payload = readPayload(target, now)
  if (!payload || payload.status !== "ready" || !payload.foods) return null
  try {
    target.removeItem(RECOGNITION_HANDOFF_KEY)
  } catch {
    // Consume is still one-shot for the current render even if cleanup fails.
  }
  return payload.foods
}
