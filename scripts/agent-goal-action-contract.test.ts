import assert from "node:assert/strict"
import test from "node:test"
import { classifyAgentGoal, isMealRecordGoal } from "../src/lib/agent/policy/goal"
import { EXERCISE_PLAN_ACTION_SEQUENCE, MEAL_RECORD_ACTION_SEQUENCE } from "../src/lib/agent/kernel/action-contract"
import { parseExercisePlanPayload } from "../src/lib/exercise/plan-contracts"
import { parseMealCreateInput } from "../src/lib/validation"

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

test("meal record goal requires an explicit recording request", () => {
  assert.equal(isMealRecordGoal({ message: "帮我记录午餐：鸡胸肉、米饭，热量 520，蛋白质 42，脂肪 12，碳水 58" }), true)
  assert.equal(isMealRecordGoal({ message: "我午餐吃了鸡胸肉和米饭" }), false)
  assert.equal(isMealRecordGoal({ message: "晚餐怎么安排更合适？" }), false)
  assert.equal(isMealRecordGoal({ message: "帮我记录这顿饭", mode: "exercise-plan" }), false)
})

test("meal record action tools keep the validate-save-verify contract and shared bounds", () => {
  assert.deepEqual(MEAL_RECORD_ACTION_SEQUENCE, ["validate_meal_record", "save_meal_record", "verify_meal_record"])
  const record = parseMealCreateInput({
    foodName: "鸡胸肉沙拉",
    mealType: "lunch",
    calories: 520,
    proteinG: 42,
    fatG: 12,
    carbsG: 58,
    recordDate: "2026-08-25",
    recordTime: "12:30:00",
  }, { date: "2026-08-25", time: "12:30:00" })
  assert.equal(record.recognitionRaw, null)
  assert.throws(() => parseMealCreateInput({
    foodName: "异常餐食",
    mealType: "lunch",
    calories: 100001,
    proteinG: 0,
    fatG: 0,
    carbsG: 0,
  }, { date: "2026-08-25", time: "12:30:00" }), /热量必须在/)
})
