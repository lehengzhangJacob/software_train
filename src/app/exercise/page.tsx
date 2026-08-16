import { getTodayStr } from "@/lib/utils"
import { getCurrentUser } from "@/lib/current-user"
import { ExerciseContent } from "@/components/exercise/exercise-content"
import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

export default async function ExercisePage() {
  const user = await getCurrentUser()
  if (!user) redirect("/profile?onboarding=1")

  const today = getTodayStr()

  return <ExerciseContent today={today} />
}
