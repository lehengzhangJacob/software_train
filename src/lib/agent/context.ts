import "server-only"

import { getLocalDateRange, toLocalDateString } from "@/lib/date"
import { getDisabledMemoryContents, getRelevantMemories } from "@/lib/memory/repository"
import type { ExercisePlanPayload } from "@/lib/exercise/plan-contracts"
import {
  buildAgentDateInstruction,
  filterEligibleMemories,
  redactSuppressedMemoryContent,
} from "@/lib/agent/context-safety"
import { prisma } from "@/lib/prisma"

export async function getAgentContext(userId: number) {
  const now = new Date()
  const today = toLocalDateString(now)
  const dates = getLocalDateRange(14, now)
  const activityDates = getLocalDateRange(7, now)
  const [profile, meals, memories, suppressedMemoryContents, activities] = await Promise.all([
    prisma.userProfile.findUnique({
      where: { userId },
      select: {
        username: true,
        gender: true,
        age: true,
        heightCm: true,
        weightKg: true,
        dailyCalorieTarget: true,
        dailyProteinTarget: true,
        dailyFatTarget: true,
        dailyCarbsTarget: true,
        activityLevel: true,
      },
    }),
    prisma.mealRecord.findMany({
      where: { userId, recordDate: { gte: dates[0], lte: dates[dates.length - 1] } },
      select: {
        foodName: true,
        mealType: true,
        calories: true,
        proteinG: true,
        fatG: true,
        carbsG: true,
        portionDesc: true,
        recordDate: true,
        recordTime: true,
      },
      orderBy: [{ recordDate: "desc" }, { recordTime: "desc" }],
      take: 40,
    }),
    getRelevantMemories(userId, 20),
    getDisabledMemoryContents(userId),
    prisma.dailyActivity.findMany({
      where: { userId, activityDate: { gte: activityDates[0], lte: activityDates[activityDates.length - 1] } },
      select: {
        activityDate: true,
        steps: true,
        activeCalories: true,
        exerciseMinutes: true,
        sourceKind: true,
      },
      orderBy: { activityDate: "asc" },
    }),
  ])

  return {
    profile,
    meals,
    memories: filterEligibleMemories(memories, now),
    suppressedMemoryContents,
    activities,
    today,
  }
}

function safeText(value: string | null | undefined, maxLength: number) {
  return (value ?? "").replace(/[\r\n]+/g, " ").trim().slice(0, maxLength)
}

export type AgentSystemPromptOptions = {
  exerciseMode?: boolean
  exercisePlan?: ExercisePlanPayload | null
}

function exercisePlanForPrompt(plan: ExercisePlanPayload | null | undefined) {
  if (!plan) return null
  return {
    planDate: plan.planDate,
    title: safeText(plan.title, 160),
    goal: safeText(plan.goal, 500),
    totalMinutes: plan.totalMinutes,
    intensity: plan.intensity,
    steps: plan.steps.map((step) => ({
      order: step.order,
      kind: step.kind,
      name: safeText(step.name, 160),
      minutes: step.minutes,
      instructions: safeText(step.instructions, 500),
      ...(step.sets === undefined ? {} : { sets: step.sets }),
      ...(step.reps === undefined ? {} : { reps: step.reps }),
      ...(step.restSeconds === undefined ? {} : { restSeconds: step.restSeconds }),
    })),
    safetyNote: safeText(plan.safetyNote, 500),
    equipment: plan.equipment.map((item) => safeText(item, 80)),
  }
}

export function buildAgentSystemPrompt(
  context: Awaited<ReturnType<typeof getAgentContext>>,
  sessionDigest?: string | null,
  options: AgentSystemPromptOptions = {},
) {
  const profile = context.profile
  const profileText = profile
    ? JSON.stringify({
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
      })
    : "null"

  const mealsText = JSON.stringify(context.meals.map((meal) => ({
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

  const memoriesText = JSON.stringify(context.memories.map((memory) => ({
    category: memory.category,
    content: safeText(memory.content, 300),
    importance: memory.importance,
    reviewedByUser: memory.isUserConfirmed,
  })))

  const activitiesText = JSON.stringify(context.activities.map((activity) => ({
    date: activity.activityDate,
    steps: activity.steps,
    activeCalories: activity.activeCalories,
    exerciseMinutes: activity.exerciseMinutes,
    source: activity.sourceKind,
  })))
  const digestText = sessionDigest?.trim()
    ? JSON.stringify(redactSuppressedMemoryContent(
        safeText(sessionDigest, 4_000),
        context.suppressedMemoryContents,
      ))
    : ""
  const currentExercisePlanText = JSON.stringify(exercisePlanForPrompt(options.exercisePlan))
  const exercisePlanInstructions = options.exerciseMode
    ? `
本回合是“运动计划”模式：
- 请根据个人档案、饮食、活动量和用户这次要求，生成或调整一份可执行的结构化运动计划。
- 计划日期默认使用当前本地日期；只有用户明确指定日期时才改用指定日期。
- 必须在回复末尾输出一个 <exercise-plan> 标签，标签内只能放合法 JSON，不要使用 Markdown 代码围栏。
- JSON 必须包含 planDate、title、goal、totalMinutes、intensity、steps、safetyNote、equipment；intensity 只能是 low、moderate、high；steps 为 1 到 8 项，每项包含 order、kind、name、minutes、instructions，kind 只能是 warmup、cardio、strength、mobility、cooldown，步骤序号从 1 连续递增，步骤总时长不能超过 totalMinutes，总时长为 5 到 180 分钟。
- 运动建议要考虑循序渐进和安全边界；不编造用户没有提供的伤病或器械条件。没有器械时使用 equipment=[]，并提供替代动作。
- 如果提供了当前计划，输出一份完整的替换计划，而不是局部补丁。当前计划如下：${currentExercisePlanText}
<exercise-plan>{"planDate":"${context.today}","title":"今天的训练","goal":"改善活动量","totalMinutes":30,"intensity":"moderate","steps":[{"order":1,"kind":"warmup","name":"动态热身","minutes":5,"instructions":"轻松活动关节并逐步提高心率"},{"order":2,"kind":"strength","name":"自重训练","minutes":20,"instructions":"保持动作可控，按舒适强度完成"},{"order":3,"kind":"cooldown","name":"放松拉伸","minutes":5,"instructions":"缓慢呼吸并放松主要肌群"}],"safetyNote":"出现疼痛、头晕或呼吸异常立即停止","equipment":[]}</exercise-plan>`
    : "\n当前为普通咨询模式，不要输出 <exercise-plan> 标签；如果用户只是询问运动，请用普通中文建议回答。"

  return `你是本地个人营养 Agent。你服务的是一个单用户饮食记录工具，不要把自己描述成云端客服。

回答要求：
- 使用中文，先给直接、可执行且针对当前情况的建议，再补充必要解释。
- 只使用下面提供的个人档案、饮食记录、活动量和已启用长期记忆；没有数据时明确说不知道，不要编造医学诊断或精确效果。
- 不要索要、复述或保存 API Key、令牌、支付信息、图片原文等敏感内容。
- 涉及附近外卖、搜索或下单时，只能提出建议或生成草案；真实外部写操作必须等用户明确确认。
- 如果用户在本轮表达了稳定的偏好、限制、目标、习惯或生活情境，可以最多整理 3 条长期记忆候选。候选会在回复保存时自动写入本地记忆，用户之后可在管理页修正、停用或删除。
- 不要整理与“已启用长期记忆”内容相同或语义等价的候选，也不要把一次性安排、寒暄或不确定猜测写成长期记忆。候选必须是 JSON 数组，并放在回复末尾的 <memory-candidates> 标签中；没有候选时使用空数组。标签之外是给用户看的正文。
- 当上下文里有活动量数据时，可以在核算热量缺口、给出加餐或运动建议时参考当天步数与活动消耗，但不要虚构未提供的数据。
${exercisePlanInstructions}

当前上下文：
${buildAgentDateInstruction(context.today)}
个人档案：${profileText}
近 14 天饮食记录（最多 40 条）：${mealsText}
近 7 天活动量（来源 health_connect 为手机 Health Connect 自动同步，manual 为手动填写）：${activitiesText}
已启用长期记忆：${memoriesText}
${digestText ? `更早会话摘要（只作为参考，不替代当前数据）：${digestText}` : ""}

候选格式示例：
<memory-candidates>[{"category":"preference","content":"工作日晚餐希望清淡一些","importance":0.7,"confidence":0.75}]</memory-candidates>`
}
