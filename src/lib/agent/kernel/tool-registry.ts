import "server-only"

import { tool, type RunContext, type Tool } from "@openai/agents"
import { z } from "zod"
import type { ExercisePlanPayload } from "@/lib/exercise/plan-contracts"
import type { getAgentContext } from "@/lib/agent/context"

type AgentContextSnapshot = Awaited<ReturnType<typeof getAgentContext>>

export type AgentToolContext = {
  context: AgentContextSnapshot
  currentExercisePlan: ExercisePlanPayload | null
}

function safeText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.replace(/[\r\n]+/g, " ").trim().slice(0, maxLength) : ""
}

function safeJson(value: unknown, maxLength = 6_000) {
  const serialized = JSON.stringify(value)
  return serialized.length > maxLength ? `${serialized.slice(0, maxLength - 1)}…` : serialized
}

function toolContext(runContext?: RunContext<unknown>): AgentToolContext {
  if (!runContext?.context || typeof runContext.context !== "object") {
    throw new Error("Agent tool context is unavailable")
  }
  return runContext.context as AgentToolContext
}

function profileTool() {
  return tool({
    name: "read_profile",
    description: "读取当前账号已授权的营养档案和每日目标。需要解释个人目标或估算差距时使用。",
    parameters: z.object({}),
    execute: async (_args, runContext) => {
      const { context } = toolContext(runContext)
      const { profile } = context
      return safeJson(profile ? {
        name: safeText(profile.username, 80),
        gender: profile.gender,
        age: profile.age,
        heightCm: profile.heightCm,
        weightKg: profile.weightKg,
        activityLevel: profile.activityLevel,
        dailyTargets: {
          calories: profile.dailyCalorieTarget,
          proteinG: profile.dailyProteinTarget,
          fatG: profile.dailyFatTarget,
          carbsG: profile.dailyCarbsTarget,
        },
      } : null)
    },
  })
}

function recentMealsTool() {
  return tool({
    name: "read_recent_meals",
    description: "读取当前账号最近的饮食记录。用户询问最近吃了什么、营养趋势或今天摄入时使用。",
    parameters: z.object({
      limit: z.number().int().min(1).max(20).optional(),
    }),
    execute: async ({ limit }, runContext) => {
      const { context } = toolContext(runContext)
      const { meals } = context
      return safeJson(meals.slice(0, limit ?? 10).map((meal) => ({
        date: meal.recordDate,
        time: meal.recordTime,
        mealType: meal.mealType,
        food: safeText(meal.foodName, 100),
        portion: safeText(meal.portionDesc, 120),
        calories: meal.calories,
        proteinG: meal.proteinG,
        fatG: meal.fatG,
        carbsG: meal.carbsG,
      })))
    },
  })
}

function activityTool() {
  return tool({
    name: "read_daily_activity",
    description: "读取最近的步数、活动消耗和运动分钟数。用户询问运动量、活动趋势或运动建议时使用。",
    parameters: z.object({
      days: z.number().int().min(1).max(7).optional(),
    }),
    execute: async ({ days }, runContext) => {
      const { context } = toolContext(runContext)
      const { activities } = context
      const rows = days ? activities.slice(-days) : activities
      return safeJson(rows.map((activity) => ({
        date: activity.activityDate,
        steps: activity.steps,
        activeCalories: activity.activeCalories,
        exerciseMinutes: activity.exerciseMinutes,
        source: activity.sourceKind,
      })))
    },
  })
}

function memoriesTool() {
  return tool({
    name: "read_active_memories",
    description: "读取当前账号已启用且未过期的长期记忆。只有需要个性化偏好或目标时使用。",
    parameters: z.object({}),
    execute: async (_args, runContext) => {
      const { context } = toolContext(runContext)
      const { memories } = context
      return safeJson(memories.map((memory) => ({
        category: memory.category,
        content: safeText(memory.content, 300),
        importance: memory.importance,
        reviewedByUser: memory.isUserConfirmed,
      })))
    },
  })
}

function exercisePlanTool() {
  return tool({
    name: "read_exercise_plan",
    description: "读取当前回合传入的运动计划。调整或解释现有计划时使用；没有计划时返回 null。",
    parameters: z.object({}),
    execute: async (_args, runContext) => safeJson(toolContext(runContext).currentExercisePlan),
  })
}

export const AGENT_TOOL_USAGE_INSTRUCTIONS = `
你拥有受控的只读工具。只有当问题需要真实档案、餐食、活动量、长期记忆或运动计划时，才选择对应工具；不要为了填充步骤而调用工具。工具返回后再结合结果回答。工具只能读取当前账号已经授权的数据，不能写入数据、下单、支付或修改账户。`

export function createAgentToolRegistry(): Tool[] {
  return [profileTool(), recentMealsTool(), activityTool(), memoriesTool(), exercisePlanTool()]
}
