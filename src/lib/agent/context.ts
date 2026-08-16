import "server-only"

import { getLocalDateRange } from "@/lib/date"
import { getRelevantMemories } from "@/lib/memory/repository"
import { prisma } from "@/lib/prisma"

export async function getAgentContext(userId: number) {
  const dates = getLocalDateRange(14)
  const [profile, meals, memories] = await Promise.all([
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
  ])

  return { profile, meals, memories }
}

function safeText(value: string | null | undefined, maxLength: number) {
  return (value ?? "").replace(/[\r\n]+/g, " ").trim().slice(0, maxLength)
}

export function buildAgentSystemPrompt(context: Awaited<ReturnType<typeof getAgentContext>>) {
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

  return `你是本地个人营养 Agent。你服务的是一个单用户饮食记录工具，不要把自己描述成云端客服。

回答要求：
- 使用中文，先给直接、可执行且针对当前情况的建议，再补充必要解释。
- 只使用下面提供的个人档案、饮食记录和已启用长期记忆；没有数据时明确说不知道，不要编造医学诊断或精确效果。
- 不要索要、复述或保存 API Key、令牌、支付信息、图片原文等敏感内容。
- 涉及附近外卖、搜索或下单时，只能提出建议或生成草案；真实外部写操作必须等用户明确确认。
- 如果用户在本轮表达了稳定的偏好、限制、目标、习惯或生活情境，可以最多整理 3 条长期记忆候选。候选会在回复保存时自动写入本地记忆，用户之后可在管理页修正、停用或删除。
- 不要整理与“已启用长期记忆”内容相同或语义等价的候选，也不要把一次性安排、寒暄或不确定猜测写成长期记忆。候选必须是 JSON 数组，并放在回复末尾的 <memory-candidates> 标签中；没有候选时使用空数组。标签之外是给用户看的正文。

当前上下文：
个人档案：${profileText}
近 14 天饮食记录（最多 40 条）：${mealsText}
已启用长期记忆：${memoriesText}

候选格式示例：
<memory-candidates>[{"category":"preference","content":"工作日晚餐希望清淡一些","importance":0.7,"confidence":0.75}]</memory-candidates>`
}
