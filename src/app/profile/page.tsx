import { getCurrentUser } from "@/lib/current-user"
import { getPublicAiSettings } from "@/lib/ai/settings"
import { AiSettingsForm } from "@/components/ai-settings-form"
import { MemorySettings, type MemoryItemView } from "@/components/memory-settings"
import { ProfileForm } from "@/components/profile-form"
import { listMemoryItems } from "@/lib/memory/repository"

export const dynamic = "force-dynamic"

export default async function ProfilePage() {
  const [user, aiSettings] = await Promise.all([getCurrentUser(), getPublicAiSettings()])
  const memories = user ? await listMemoryItems(user.userId, "all") : []
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

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">个人设置</h1>
        <p className="mt-1 text-sm text-neutral-500">身体目标、本机 AI 和长期记忆都在这里管理</p>
      </div>
      <ProfileForm
        user={user ? {
          username: user.username,
          gender: user.gender,
          age: user.age,
          heightCm: user.heightCm,
          weightKg: user.weightKg,
          dailyCalorieTarget: user.dailyCalorieTarget,
          dailyProteinTarget: user.dailyProteinTarget,
          dailyFatTarget: user.dailyFatTarget,
          dailyCarbsTarget: user.dailyCarbsTarget,
          bmr: user.bmr,
          activityLevel: user.activityLevel,
        } : undefined}
      />
      <AiSettingsForm initialSettings={aiSettings} />
      {user ? <MemorySettings initialMemories={initialMemories} referenceNow={new Date().toISOString()} /> : null}
    </div>
  )
}
