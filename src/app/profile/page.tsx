import { prisma } from "@/lib/prisma"
import { ProfileForm } from "@/components/profile-form"

export default async function ProfilePage() {
  const user = await prisma.userProfile.findFirst({
    orderBy: { userId: "asc" },
  })

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-neutral-900">个人设置</h1>
        <p className="text-sm text-neutral-500 mt-1">管理你的身体参数和营养目标</p>
      </div>
      <ProfileForm user={user ?? undefined} />
    </div>
  )
}
