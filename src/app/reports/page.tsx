import { ReportsContent } from "@/components/reports/reports-content"
import { prisma } from "@/lib/prisma"

export default async function ReportsPage() {
  const user = await prisma.userProfile.findFirst({ orderBy: { userId: "asc" } })
  return <ReportsContent userId={user?.userId ?? 1} />
}
