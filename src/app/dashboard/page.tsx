import { prisma } from "@/lib/prisma"
import { getCurrentUser } from "@/lib/current-user"
import { getLocalDateRange, toLocalDateString } from "@/lib/date"
import { DashboardContent } from "@/components/dashboard/dashboard-content"
import { getDailyArticleSummary } from "@/lib/agent/content/repository"
import { getContentDate } from "@/lib/agent/content/time"
import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

export default async function DashboardPage() {
  const today = toLocalDateString()
  const user = await getCurrentUser()

  if (!user) {
    redirect("/profile?onboarding=1")
  }

  const dailySummary = await prisma.mealRecord.groupBy({
    by: ["mealType"],
    where: { userId: user.userId, recordDate: today },
    _sum: { calories: true, proteinG: true, fatG: true, carbsG: true },
    _count: true,
  })

  const totalCalories = dailySummary.reduce((s, r) => s + (r._sum.calories ?? 0), 0)
  const totalProtein = dailySummary.reduce((s, r) => s + (r._sum.proteinG ?? 0), 0)
  const totalFat = dailySummary.reduce((s, r) => s + (r._sum.fatG ?? 0), 0)
  const totalCarbs = dailySummary.reduce((s, r) => s + (r._sum.carbsG ?? 0), 0)

  const dailyArticles = await getDailyArticleSummary(user.userId, getContentDate())

  const recentDateRange = getLocalDateRange(7)
  const recentDays = await prisma.mealRecord.findMany({
    where: {
      userId: user.userId,
      recordDate: { gte: recentDateRange[0], lte: recentDateRange[recentDateRange.length - 1] },
    },
    select: { recordDate: true, calories: true },
    orderBy: { recordDate: "asc" },
  })

  const trendMap = new Map<string, number>()
  for (const r of recentDays) {
    trendMap.set(r.recordDate, (trendMap.get(r.recordDate) ?? 0) + r.calories)
  }
  const trends = recentDateRange.map((date) => ({
    date,
    calories: trendMap.get(date) ?? null,
  }))

  return (
    <DashboardContent
      user={{
        username: user.username,
        dailyCalorieTarget: user.dailyCalorieTarget,
        dailyProteinTarget: user.dailyProteinTarget,
        dailyFatTarget: user.dailyFatTarget,
        dailyCarbsTarget: user.dailyCarbsTarget,
      }}
      totalCalories={totalCalories}
      totalProtein={totalProtein}
      totalFat={totalFat}
      totalCarbs={totalCarbs}
      trends={trends}
      dailySummary={dailySummary.map((r) => ({
        mealType: r.mealType,
        calories: r._sum.calories ?? 0,
        proteinG: r._sum.proteinG ?? 0,
        fatG: r._sum.fatG ?? 0,
        carbsG: r._sum.carbsG ?? 0,
        count: r._count,
      }))}
      dailyArticles={dailyArticles}
    />
  )
}
