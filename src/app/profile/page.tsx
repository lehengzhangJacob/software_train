import { getCurrentUser } from "@/lib/current-user"
import { ProfileForm } from "@/components/profile-form"

export const dynamic = "force-dynamic"

export default async function ProfilePage() {
  const user = await getCurrentUser()

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">个人设置</h1>
        <p className="text-sm text-neutral-500 mt-1">管理你的身体参数和营养目标</p>
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
    </div>
  )
}
