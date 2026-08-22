import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/current-user"
import { getDailyArticleFeed } from "@/lib/agent/content/repository"
import { getContentDate } from "@/lib/agent/content/time"
import { InsightsContent } from "@/components/insights/insights-content"

export const dynamic = "force-dynamic"

export default async function InsightsPage() {
  const user = await getCurrentUser()
  if (!user) redirect("/profile?onboarding=1")
  const date = getContentDate()
  const feed = await getDailyArticleFeed(user.userId, date)
  return <InsightsContent initialFeed={feed} username={user.username} date={date} />
}
