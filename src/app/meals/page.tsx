import { prisma } from "@/lib/prisma"
import { getTodayStr } from "@/lib/utils"
import { MealsContent } from "@/components/food/meals-content"

export default async function MealsPage() {
  const today = getTodayStr()
  const user = await prisma.userProfile.findFirst({ orderBy: { userId: "asc" } })
  const meals = user
    ? await prisma.mealRecord.findMany({
        where: { userId: user.userId, recordDate: today },
        orderBy: [{ recordTime: "asc" }],
      })
    : []

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">饮食记录</h1>
        <p className="text-sm text-neutral-500 mt-1">拍照或手动输入你吃了什么</p>
      </div>
      <MealsContent
        userId={user?.userId ?? 1}
        today={today}
        initialMeals={meals.map((m) => ({
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
