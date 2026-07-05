import { prisma } from "@/lib/prisma"
import { getTodayStr } from "@/lib/utils"
import { CalendarContent } from "@/components/calendar/calendar-content"

export default async function CalendarPage() {
  const user = await prisma.userProfile.findFirst({ orderBy: { userId: "asc" } })
  const today = getTodayStr()

  const dates = user
    ? await prisma.mealRecord.findMany({
        where: { userId: user.userId },
        select: { recordDate: true },
        distinct: ["recordDate"],
        orderBy: { recordDate: "desc" },
        take: 90,
      })
    : []

  const initialMeals = user
    ? await prisma.mealRecord.findMany({
        where: { userId: user.userId, recordDate: today },
        orderBy: [{ recordTime: "asc" }],
      })
    : []

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">饮食日历</h1>
        <p className="text-sm text-neutral-500 mt-1">浏览历史饮食记录</p>
      </div>
      <CalendarContent
        userId={user?.userId ?? 1}
        today={today}
        availableDates={dates.map((d) => d.recordDate)}
        initialMeals={initialMeals.map((m) => ({
          recordId: m.recordId,
          foodName: m.foodName,
          mealType: m.mealType,
          calories: m.calories,
          proteinG: m.proteinG,
          fatG: m.fatG,
          carbsG: m.carbsG,
          portionDesc: m.portionDesc,
          recordTime: m.recordTime,
        }))}
      />
    </div>
  )
}
