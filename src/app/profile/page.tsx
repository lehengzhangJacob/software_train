import { getCurrentUser } from "@/lib/current-user"
import { getPublicAiSettings } from "@/lib/ai/settings"
import { AiSettingsForm } from "@/components/ai-settings-form"
import { ProfileForm } from "@/components/profile-form"

export const dynamic = "force-dynamic"

export default async function ProfilePage() {
  const [user, aiSettings] = await Promise.all([getCurrentUser(), getPublicAiSettings()])

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">个人设置</h1>
        <p className="mt-1 text-sm text-neutral-500">身体目标和本机 AI 服务都在这里管理</p>
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
    </div>
  )
}
