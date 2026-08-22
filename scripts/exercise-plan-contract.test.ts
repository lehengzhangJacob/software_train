import assert from "node:assert/strict"
import test from "node:test"
import {
  ExercisePlanValidationError,
  parseExercisePlanPayload,
  parseStoredExercisePlan,
} from "../src/lib/exercise/plan-contracts"

function validPlan() {
  return {
    planDate: "2026-08-22",
    title: "晚间轻量活动",
    goal: "恢复身体节奏",
    totalMinutes: 30,
    intensity: "low",
    steps: [
      { order: 1, kind: "warmup", name: "关节热身", minutes: 5, instructions: "缓慢活动肩颈和髋部" },
      { order: 2, kind: "cardio", name: "轻松快走", minutes: 20, instructions: "保持可以交谈的速度" },
      { order: 3, kind: "cooldown", name: "放松拉伸", minutes: 5, instructions: "以不疼痛为边界完成拉伸" },
    ],
    safetyNote: "出现不适立即停止",
    equipment: [],
  }
}

test("parses bounded structured exercise plan", () => {
  const parsed = parseExercisePlanPayload(validPlan())
  assert.equal(parsed.steps.length, 3)
  assert.equal(parsed.totalMinutes, 30)
  assert.equal(parsed.intensity, "low")
})

test("rejects unknown fields and invalid step duration", () => {
  assert.throws(
    () => parseExercisePlanPayload({ ...validPlan(), unexpected: true }),
    (error: unknown) => error instanceof ExercisePlanValidationError,
  )
  assert.throws(
    () => parseExercisePlanPayload({ ...validPlan(), steps: [{ ...validPlan().steps[0], minutes: 40 }] }),
    (error: unknown) => error instanceof ExercisePlanValidationError,
  )
})

test("legacy mirror payload remains readable without becoming an Agent payload", () => {
  assert.throws(
    () => parseExercisePlanPayload({ ...validPlan(), legacy: { durationMinutes: 30, calorieSurplus: 100, calorieBurnEstimate: 120, isAdopted: 1 } }),
    (error: unknown) => error instanceof ExercisePlanValidationError,
  )
  const parsed = parseStoredExercisePlan(JSON.stringify({
    ...validPlan(),
    legacy: { durationMinutes: 30, calorieSurplus: 100, calorieBurnEstimate: 120, isAdopted: 1 },
  }))
  assert.equal(parsed.legacy?.isAdopted, 1)
  assert.equal(parsed.legacy?.calorieBurnEstimate, 120)
})
