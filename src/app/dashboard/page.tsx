import { prisma } from "@/lib/prisma"
import { getTodayStr } from "@/lib/utils"
import { getCurrentUser } from "@/lib/current-user"
import { DashboardContent } from "@/components/dashboard/dashboard-content"
import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

export default async function DashboardPage() {
  const today = getTodayStr()
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

  const recentDays = await prisma.mealRecord.findMany({
    where: { userId: user.userId },
    select: { recordDate: true, calories: true },
    orderBy: { recordDate: "desc" },
  })

  const trendMap = new Map<string, number>()
  for (const r of recentDays) {
    trendMap.set(r.recordDate, (trendMap.get(r.recordDate) ?? 0) + r.calories)
  }
  const trends = Array.from(trendMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-7)

  return (
    <DashboardContent
      user={{
        username: user.username,
        dailyCalorieTarget: user.dailyCalorieTarget,
        dailyProteinTarget: user.dailyProteinTarget,
        dailyFatTarget: user.dailyFatTarget,
        dailyCarbsTarget: user.dailyCarbsTarget,
      }}
      today={today}
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
    />
  )
}
