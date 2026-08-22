import "server-only"

import { getAgentContext } from "@/lib/agent/context"
import { prisma } from "@/lib/prisma"
import { getContentDate } from "@/lib/agent/content/time"

function safeText(value: string | null | undefined, maxLength: number) {
  return (value ?? "").replace(/[\r\n]+/g, " ").trim().slice(0, maxLength)
}

function parsePlanJson(value: string | null | undefined) {
  if (!value) return null
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>
    return {
      title: safeText(typeof parsed.title === "string" ? parsed.title : "", 120),
      goal: safeText(typeof parsed.goal === "string" ? parsed.goal : "", 240),
      totalMinutes: typeof parsed.totalMinutes === "number" ? parsed.totalMinutes : null,
      intensity: safeText(typeof parsed.intensity === "string" ? parsed.intensity : "", 40),
    }
  } catch {
    return null
  }
}

export async function getDailyArticleContext(userId: number) {
  const context = await getAgentContext(userId)
  const [exercisePlan, digest] = await Promise.all([
    prisma.agentExercisePlan.findFirst({
      where: { userId, status: "active" },
      select: { planJson: true, planDate: true, revision: true },
      orderBy: [{ planDate: "desc" }, { revision: "desc" }],
    }),
    prisma.agentSessionDigest.findFirst({
      where: { agentThread: { userId } },
      select: { summary: true },
      orderBy: { updatedAt: "desc" },
    }),
  ])

  return {
    contentDate: getContentDate(),
    profile: context.profile
      ? {
          username: safeText(context.profile.username, 80),
          gender: context.profile.gender,
          age: context.profile.age,
          heightCm: context.profile.heightCm,
          weightKg: context.profile.weightKg,
          activityLevel: context.profile.activityLevel,
          dailyTargets: {
            calories: context.profile.dailyCalorieTarget,
            proteinG: context.profile.dailyProteinTarget,
            fatG: context.profile.dailyFatTarget,
            carbsG: context.profile.dailyCarbsTarget,
          },
        }
      : null,
    meals: context.meals.map((meal) => ({
      date: meal.recordDate,
      mealType: meal.mealType,
      food: safeText(meal.foodName, 100),
      portion: safeText(meal.portionDesc, 120),
      calories: meal.calories,
      proteinG: meal.proteinG,
      fatG: meal.fatG,
      carbsG: meal.carbsG,
    })),
    activities: context.activities.map((activity) => ({
      date: activity.activityDate,
      steps: activity.steps,
      activeCalories: activity.activeCalories,
      exerciseMinutes: activity.exerciseMinutes,
      source: activity.sourceKind,
    })),
    memories: context.memories.map((memory) => ({
      category: memory.category,
      content: safeText(memory.content, 260),
      importance: memory.importance,
      userReviewed: memory.isUserConfirmed,
    })),
    exercisePlan: exercisePlan
      ? {
          planDate: exercisePlan.planDate,
          revision: exercisePlan.revision,
          plan: parsePlanJson(exercisePlan.planJson),
        }
      : null,
    sessionDigest: safeText(digest?.summary, 2_000) || null,
  }
}

export type DailyArticleContext = Awaited<ReturnType<typeof getDailyArticleContext>>

export function contextForPrompt(context: DailyArticleContext) {
  return JSON.stringify(context)
}
