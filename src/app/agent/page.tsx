import { redirect } from "next/navigation"
import { AgentWorkspace } from "@/components/agent/agent-workspace"
import { getCurrentUser } from "@/lib/current-user"
import { getAgentThread, listAgentThreads } from "@/lib/agent/repository"

export const dynamic = "force-dynamic"

export default async function AgentPage() {
  const user = await getCurrentUser()
  if (!user) redirect("/profile?onboarding=1")

  const threads = await listAgentThreads(user.userId)
  const initialThread = threads[0] ? await getAgentThread(user.userId, threads[0].threadId) : null

  return (
    <AgentWorkspace
      username={user.username}
      initialThreads={threads}
      initialThread={initialThread}
    />
  )
}
