import assert from "node:assert/strict"
import test from "node:test"
import { classifyAgentGoal } from "../src/lib/agent/policy/goal"
import { EXERCISE_PLAN_ACTION_SEQUENCE } from "../src/lib/agent/kernel/action-contract"
import { parseExercisePlanPayload } from "../src/lib/exercise/plan-contracts"

const validPlan = {
  planDate: "2026-08-25",
  title: "下班后轻训练",
  goal: "恢复活动量",
  totalMinutes: 30,
  intensity: "moderate" as const,
  steps: [
    { order: 1, kind: "warmup" as const, name: "动态热身", minutes: 5, instructions: "轻松活动关节" },
    { order: 2, kind: "strength" as const, name: "自重训练", minutes: 20, instructions: "保持动作可控", sets: 3, reps: 10 },
    { order: 3, kind: "cooldown" as const, name: "放松拉伸", minutes: 5, instructions: "缓慢呼吸放松" },
  ],
  safetyNote: "出现疼痛或头晕立即停止",
  equipment: [],
}

test("goal router activates only for an explicit plan action", () => {
  assert.equal(classifyAgentGoal({ message: "帮我安排今天的训练计划" }), "exercise-plan")
  assert.equal(classifyAgentGoal({ message: "我今天做了力量训练" }), "none")
  assert.equal(classifyAgentGoal({ message: "调整当前计划", exercisePlanId: 12 }), "exercise-plan")
})

test("exercise action tools have an explicit validate-save-verify order", () => {
  assert.deepEqual(EXERCISE_PLAN_ACTION_SEQUENCE, ["validate_exercise_plan", "save_exercise_plan", "verify_exercise_plan"])
  assert.deepEqual(parseExercisePlanPayload(validPlan).steps.map((step) => step.order), [1, 2, 3])
  assert.throws(() => parseExercisePlanPayload({ ...validPlan, totalMinutes: 2 }), /总时长/)
})
