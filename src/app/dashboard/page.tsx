import { prisma } from "@/lib/prisma"
import { getTodayStr } from "@/lib/utils"
import { DashboardContent } from "@/components/dashboard/dashboard-content"

export default async function DashboardPage() {
  const today = getTodayStr()
  const user = await prisma.userProfile.findFirst()

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <h2 className="text-xl font-semibold text-neutral-800 mb-2">欢迎使用 Food Tracker</h2>
        <p className="text-neutral-500 mb-6">请先在个人设置中创建你的档案</p>
        <a href="/profile" className="inline-flex items-center rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 transition-colors">
          前往设置
        </a>
      </div>
    )
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
      user={user}
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
