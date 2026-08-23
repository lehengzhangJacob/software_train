import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import test from "node:test"
import {
  ExercisePlanValidationError,
  parseExercisePlanPayload,
  parseStoredExercisePlan,
} from "../src/lib/exercise/plan-contracts"
import {
  parseExercisePlanStepProgressInput,
  summarizeExercisePlanProgress,
} from "../src/lib/exercise/progress"

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

test("checklist progress derives completion without changing the plan payload", () => {
  const steps = validPlan().steps
  assert.deepEqual(summarizeExercisePlanProgress(steps, [3, 3, 99, 1]), {
    completedStepOrders: [1, 3],
    completedCount: 2,
    totalSteps: 3,
    planCompleted: false,
  })
  assert.equal(summarizeExercisePlanProgress(steps, [1, 2, 3]).planCompleted, true)
})

test("checklist progress input rejects malformed or non-boolean updates", () => {
  assert.deepEqual(parseExercisePlanStepProgressInput({ planId: 12, stepOrder: 2, completed: true }), {
    planId: 12,
    stepOrder: 2,
    completed: true,
  })
  assert.throws(() => parseExercisePlanStepProgressInput({ planId: 12, stepOrder: 2, completed: "yes" }), /布尔值/)
  assert.throws(() => parseExercisePlanStepProgressInput({ planId: 12, stepOrder: 0, completed: false }), /正整数/)
})

test("checklist migration is additive and does not rewrite plan rows", () => {
  const migration = readFileSync(
    path.join(process.cwd(), "prisma", "migrations", "20260823090000_add_exercise_plan_step_progress", "migration.sql"),
    "utf8",
  )
  assert.match(migration, /CREATE TABLE "agent_exercise_plan_step_progress"/)
  assert.match(migration, /uq_agent_plan_step_progress/)
  assert.doesNotMatch(migration, /DROP TABLE/i)
  assert.doesNotMatch(migration, /INSERT INTO "agent_exercise_plans"/i)
})
