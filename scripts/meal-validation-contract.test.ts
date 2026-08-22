import assert from "node:assert/strict"
import test from "node:test"
import {
  parseMealBatchCreateInput,
  parseMealCreateInput,
  parseMealUpdateInput,
  ValidationError,
} from "../src/lib/validation"

const DEFAULTS = { date: "2026-08-22", time: "12:00:00" }
const BASE_MEAL = {
  foodName: "测试餐食",
  mealType: "lunch",
  calories: 500,
  proteinG: 25,
  fatG: 12,
  carbsG: 60,
}
const NUTRITION_FIELDS = ["calories", "proteinG", "fatG", "carbsG"] as const

test("accepts the inclusive nutrition bounds for meal creation", () => {
  const parsed = parseMealCreateInput(
    { ...BASE_MEAL, calories: 0, proteinG: 100000, fatG: 100000, carbsG: 100000 },
    DEFAULTS,
  )
  assert.equal(parsed.calories, 0)
  assert.equal(parsed.proteinG, 100000)
  assert.equal(parsed.fatG, 100000)
  assert.equal(parsed.carbsG, 100000)
})

test("rejects negative and oversized nutrition values on create", () => {
  for (const field of NUTRITION_FIELDS) {
    assert.throws(
      () => parseMealCreateInput({ ...BASE_MEAL, [field]: -1 }, DEFAULTS),
      (error: unknown) => error instanceof ValidationError && /必须在 0 到 100000 之间/.test(error.message),
    )
    assert.throws(
      () => parseMealCreateInput({ ...BASE_MEAL, [field]: 100001 }, DEFAULTS),
      (error: unknown) => error instanceof ValidationError && /必须在 0 到 100000 之间/.test(error.message),
    )
  }
})

test("rejects non-finite and precision-dangerous values instead of coercing them", () => {
  assert.throws(() => parseMealCreateInput({ ...BASE_MEAL, calories: Infinity }, DEFAULTS), /必须是有效数字/)
  assert.throws(() => parseMealCreateInput({ ...BASE_MEAL, calories: 1e999 }, DEFAULTS), /必须是有效数字/)
  assert.throws(() => parseMealCreateInput({ ...BASE_MEAL, calories: "9".repeat(300) }, DEFAULTS), /必须是有效数字/)
})

test("applies the same bounds to batch creation and updates", () => {
  assert.throws(
    () => parseMealBatchCreateInput({ items: [{ ...BASE_MEAL, fatG: 100001 }] }, DEFAULTS),
    /必须在 0 到 100000 之间/,
  )
  assert.throws(() => parseMealUpdateInput({ proteinG: -0.1 }), /必须在 0 到 100000 之间/)
  assert.throws(() => parseMealUpdateInput({ carbsG: 100001 }), /必须在 0 到 100000 之间/)
  assert.equal(parseMealUpdateInput({ calories: 100000 }).calories, 100000)
})
