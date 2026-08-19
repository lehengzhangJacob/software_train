import assert from "node:assert/strict"
import test from "node:test"
import { parseActivitySyncInput, ValidationError } from "../src/lib/validation"

const TODAY = "2026-08-17"

test("empty payload carries no syncable field and is rejected", () => {
  assert.throws(() => parseActivitySyncInput({}, { activityDate: TODAY }), /没有可同步的活动量字段/)
})

test("full payload is parsed with defaults and rounding", () => {
  const input = parseActivitySyncInput(
    {
      activityDate: "2026-08-15",
      steps: 8642,
      activeCalories: 320.55,
      exerciseMinutes: 45,
      sourceKind: "health_connect",
    },
    { activityDate: TODAY }
  )
  assert.equal(input.activityDate, "2026-08-15")
  assert.equal(input.steps, 8642)
  assert.equal(input.activeCalories, 320.6)
  assert.equal(input.exerciseMinutes, 45)
  assert.equal(input.sourceKind, "health_connect")
})

test("partial payload keeps absent fields undefined (upsert update semantics)", () => {
  const input = parseActivitySyncInput({ steps: 5000 }, { activityDate: TODAY })
  assert.equal(input.activityDate, TODAY)
  assert.equal(input.steps, 5000)
  assert.equal(input.activeCalories, undefined)
  assert.equal(input.exerciseMinutes, undefined)
  assert.equal(input.sourceKind, undefined)
})

test("missing date falls back to the server-provided default", () => {
  const input = parseActivitySyncInput({ steps: 100 }, { activityDate: TODAY })
  assert.equal(input.activityDate, TODAY)
})

test("rejects negative steps", () => {
  assert.throws(() => parseActivitySyncInput({ steps: -1 }, { activityDate: TODAY }), /步数必须在 0 到 200000 之间/)
})

test("rejects absurd step counts beyond the sanity cap", () => {
  assert.throws(() => parseActivitySyncInput({ steps: 200001 }, { activityDate: TODAY }), /步数必须/)
})

test("rejects negative activity calories", () => {
  assert.throws(
    () => parseActivitySyncInput({ activeCalories: -10 }, { activityDate: TODAY }),
    /活动消耗不能为负数/
  )
})

test("rejects minutes beyond a 24h day", () => {
  assert.throws(
    () => parseActivitySyncInput({ exerciseMinutes: 24 * 60 + 1 }, { activityDate: TODAY }),
    /运动分钟数必须在 0 到 1440 之间/
  )
})

test("rejects unknown source kinds", () => {
  assert.throws(
    () => parseActivitySyncInput({ sourceKind: "fitbit" }, { activityDate: TODAY }),
    /数据来源取值无效/
  )
})

test("rejects malformed activity dates", () => {
  assert.throws(() => parseActivitySyncInput({ steps: 1, activityDate: "2026-13-40" }, { activityDate: TODAY }), /活动日期/)
})

test("rejects non-object input", () => {
  assert.throws(() => parseActivitySyncInput("nope", { activityDate: TODAY }), /请求内容必须是对象/)
  assert.throws(() => parseActivitySyncInput(null, { activityDate: TODAY }), /请求内容必须是对象/)
})

test("accepts manual source kind explicitly", () => {
  const input = parseActivitySyncInput(
    { steps: 200, sourceKind: "manual" },
    { activityDate: TODAY }
  )
  assert.equal(input.sourceKind, "manual")
})

test("ValidationError carries a stable name for route mapping", () => {
  try {
    parseActivitySyncInput({ steps: -5 }, { activityDate: TODAY })
    assert.fail("should have thrown")
  } catch (error) {
    assert.ok(error instanceof ValidationError)
    assert.equal(error.name, "ValidationError")
    assert.equal(typeof error.message, "string")
  }
})