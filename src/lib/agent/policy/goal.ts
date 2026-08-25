import type { AgentChatMode } from "@/lib/agent/contracts"

export const AGENT_GOALS = ["exercise-plan", "meal-record", "none"] as const
export type AgentGoal = (typeof AGENT_GOALS)[number]

const PLAN_PHRASES = [
  "运动计划",
  "训练计划",
  "锻炼计划",
  "训练安排",
  "运动安排",
  "训练规划",
]

const PLAN_ACTIONS = [
  "安排",
  "制定",
  "生成",
  "规划",
  "调整",
  "修改",
  "更新",
  "重排",
  "重新",
  "设计",
]

const MEAL_RECORD_PHRASES = [
  "饮食记录",
  "餐饮记录",
  "餐食记录",
  "记一餐",
  "记录早餐",
  "记录午餐",
  "记录晚餐",
  "记录加餐",
  "补记",
  "录入",
]

const MEAL_RECORD_ACTIONS = ["记录", "记下", "补记", "录入", "保存", "添加", "写入"]

function normalizeMessage(message: string) {
  return message.toLocaleLowerCase().replace(/[\s\p{P}\p{S}]+/gu, " ").trim()
}

/**
 * Routes an intent to the smallest durable domain workflow. This is kept
 * deterministic and cheap; the Agent still decides the concrete steps.
 */
export function classifyAgentGoal(input: {
  message: string
  mode?: AgentChatMode
  exercisePlanId?: number | null
}): AgentGoal {
  if (input.mode === "exercise-plan" || input.exercisePlanId !== null && input.exercisePlanId !== undefined) {
    return "exercise-plan"
  }

  const normalized = normalizeMessage(input.message)
  const hasPlanPhrase = PLAN_PHRASES.some((phrase) => normalized.includes(phrase))
  const hasPlanAction = PLAN_ACTIONS.some((action) => normalized.includes(action))
  return hasPlanPhrase && hasPlanAction ? "exercise-plan" : "none"
}

export function isMealRecordGoal(input: { message: string; mode?: AgentChatMode; exercisePlanId?: number | null }) {
  if (input.mode === "exercise-plan" || input.exercisePlanId !== null && input.exercisePlanId !== undefined) return false
  const normalized = normalizeMessage(input.message)
  const hasRecordPhrase = MEAL_RECORD_PHRASES.some((phrase) => normalized.includes(phrase))
  const hasRecordAction = MEAL_RECORD_ACTIONS.some((action) => normalized.includes(action))
  return hasRecordPhrase && hasRecordAction
}

export function isExercisePlanGoal(input: {
  message: string
  mode?: AgentChatMode
  exercisePlanId?: number | null
}) {
  return classifyAgentGoal(input) === "exercise-plan"
}
