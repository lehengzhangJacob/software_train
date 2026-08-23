import { prisma } from "@/lib/prisma"
import { getTodayStr } from "@/lib/utils"
import { getCurrentUser } from "@/lib/current-user"
import { MealsContent } from "@/components/food/meals-content"
import { parseDate } from "@/lib/validation"
import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

type MealsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

function resolveRecordDate(value: string | undefined, fallback: string) {
  if (!value) return fallback
  try {
    return parseDate(value, "记录日期")
  } catch {
    return fallback
  }
}

export default async function MealsPage({ searchParams }: MealsPageProps) {
  const today = getTodayStr()
  const params = searchParams ? await searchParams : {}
  const recordDate = resolveRecordDate(firstParam(params.date), today)
  const user = await getCurrentUser()
  if (!user) redirect("/profile?onboarding=1")

  const meals = await prisma.mealRecord.findMany({
    where: { userId: user.userId, recordDate },
    orderBy: [{ recordTime: "asc" }],
  })

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="page-eyebrow">Photo log</p>
          <h1 className="page-title mt-2">拍下这一餐，再认真确认。</h1>
          <p className="page-copy mt-2">AI 会拆分多项食物；保存前由你决定名称、餐别、份量和营养数值。</p>
        </div>
        <div className="rounded-md bg-[var(--brand-lavender-soft)] px-3 py-2 text-xs font-medium text-[#5f51cc] dark:text-[var(--brand-lavender-deep)]">
          {recordDate} · 图片不会写入数据库
        </div>
      </div>
      <MealsContent
        recordDate={recordDate}
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
