import { ReportsContent } from "@/components/reports/reports-content"
import { getCurrentUser } from "@/lib/current-user"
import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

export default async function ReportsPage() {
  const user = await getCurrentUser()
  if (!user) redirect("/profile?onboarding=1")

  return <ReportsContent />
}
