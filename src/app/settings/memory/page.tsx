import { redirect } from "next/navigation"
import { getCurrentUser } from "@/lib/current-user"
import { listMemoryItems } from "@/lib/memory/repository"
import { MemorySettings, type MemoryItemView } from "@/components/memory-settings"

export const dynamic = "force-dynamic"

export default async function MemorySettingsPage() {
  const user = await getCurrentUser()
  if (!user) redirect("/profile?onboarding=1")

  const memories = await listMemoryItems(user.userId, "all")
  const initialMemories: MemoryItemView[] = memories.map((memory) => ({
    ...memory,
    category: memory.category as MemoryItemView["category"],
    status: memory.status as MemoryItemView["status"],
    userEditedAt: memory.userEditedAt?.toISOString() ?? null,
    lastUsedAt: memory.lastUsedAt?.toISOString() ?? null,
    expiresAt: memory.expiresAt?.toISOString() ?? null,
    createdAt: memory.createdAt.toISOString(),
    updatedAt: memory.updatedAt.toISOString(),
  }))

  return <MemorySettings initialMemories={initialMemories} referenceNow={new Date().toISOString()} />
}
