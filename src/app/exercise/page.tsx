import { prisma } from "@/lib/prisma"
import { getTodayStr } from "@/lib/utils"
import { ExerciseContent } from "@/components/exercise/exercise-content"

export default async function ExercisePage() {
  const user = await prisma.userProfile.findFirst({ orderBy: { userId: "asc" } })
  const today = getTodayStr()

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">运动建议</h1>
        <p className="text-sm text-neutral-500 mt-1">根据饮食情况获取个性化运动推荐</p>
      </div>
      <ExerciseContent userId={user?.userId ?? 1} today={today} />
    </div>
  )
}
