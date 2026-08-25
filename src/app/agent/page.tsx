import { redirect } from "next/navigation"
import { AgentWorkspace } from "@/components/agent/agent-workspace"
import { getCurrentUser } from "@/lib/current-user"
import { getAgentThread, listAgentThreads } from "@/lib/agent/repository"

export const dynamic = "force-dynamic"

type AgentPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

export default async function AgentPage({ searchParams }: AgentPageProps) {
  const user = await getCurrentUser()
  if (!user) redirect("/profile?onboarding=1")

  const params = searchParams ? await searchParams : {}
  const exerciseMode = firstParam(params.mode) === "exercise-plan"
  const rawExercisePlanId = firstParam(params.exercisePlanId)
  const parsedExercisePlanId = rawExercisePlanId && /^\d+$/.test(rawExercisePlanId) ? Number(rawExercisePlanId) : null
  const exercisePlanId = parsedExercisePlanId && Number.isSafeInteger(parsedExercisePlanId) && parsedExercisePlanId > 0
    ? parsedExercisePlanId
    : null
  const returnTo = firstParam(params.returnTo)
  const safeReturnTo = returnTo === "/exercise" ? returnTo : "/exercise"
  const initialDraft = firstParam(params.prompt)?.trim().slice(0, 4_000) || null

  const threads = await listAgentThreads(user.userId)
  const initialThread = threads[0] ? await getAgentThread(user.userId, threads[0].threadId) : null

  return (
    <AgentWorkspace
      username={user.username}
      initialThreads={threads}
      initialThread={initialThread}
      exerciseMode={exerciseMode}
      initialExercisePlanId={exercisePlanId}
      returnTo={safeReturnTo}
      initialDraft={initialDraft}
    />
  )
}
