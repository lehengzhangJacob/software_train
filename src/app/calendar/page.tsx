import { prisma } from "@/lib/prisma"
import { getTodayStr } from "@/lib/utils"
import { getCurrentUser } from "@/lib/current-user"
import { CalendarContent } from "@/components/calendar/calendar-content"
import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

export default async function CalendarPage() {
  const user = await getCurrentUser()
  if (!user) redirect("/profile?onboarding=1")

  const today = getTodayStr()

  const dates = await prisma.mealRecord.findMany({
    where: { userId: user.userId },
    select: { recordDate: true },
    distinct: ["recordDate"],
    orderBy: { recordDate: "desc" },
    take: 90,
  })

  const initialMeals = await prisma.mealRecord.findMany({
    where: { userId: user.userId, recordDate: today },
    orderBy: [{ recordTime: "asc" }],
  })

  return (
    <div className="space-y-5">
      <div>
        <p className="page-eyebrow">Your rhythm</p>
        <h1 className="page-title mt-2">这个月，你在认真生活。</h1>
        <p className="page-copy mt-2">记录不是负担，它只是帮你看见自己的节奏。</p>
      </div>
      <CalendarContent
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
