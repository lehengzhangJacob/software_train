import { getCurrentUser } from "@/lib/current-user"
import { ProfileForm } from "@/components/profile-form"

export const dynamic = "force-dynamic"

export default async function ProfilePage() {
  const user = await getCurrentUser()

  return (
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
  )
}
