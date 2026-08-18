import { getPublicAiSettings } from "@/lib/ai/settings"
import { AiSettingsForm } from "@/components/ai-settings-form"
import { McDonaldSettingsForm } from "@/components/mcdonald-settings-form"
import { HealthSyncCard } from "@/components/health-sync-card"
import { ThemeSettingsCard } from "@/components/theme-settings-card"
import { getPublicMcDonaldSettings } from "@/lib/mcp/settings"
import { authRequired } from "@/lib/access/gate"
import { getCurrentAccountId } from "@/lib/current-user"
import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

export default async function SettingsPage() {
  const accountId = await getCurrentAccountId()
  if (authRequired() && accountId === null) redirect("/access")

  const [settings, mcDonaldSettings] = await Promise.all([
    getPublicAiSettings(accountId ?? undefined),
    getPublicMcDonaldSettings(accountId ?? undefined),
  ])
  return (
    <>
      <ThemeSettingsCard />
      <AiSettingsForm initialSettings={settings} />
      <McDonaldSettingsForm initialSettings={mcDonaldSettings} />
      <HealthSyncCard />
    </>
  )
}
