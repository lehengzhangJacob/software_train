import { getPublicAiSettings } from "@/lib/ai/settings"
import { AiSettingsForm } from "@/components/ai-settings-form"
import { McDonaldSettingsForm } from "@/components/mcdonald-settings-form"
import { getPublicMcDonaldSettings } from "@/lib/mcp/settings"

export const dynamic = "force-dynamic"

export default async function SettingsPage() {
  const [settings, mcDonaldSettings] = await Promise.all([
    getPublicAiSettings(),
    getPublicMcDonaldSettings(),
  ])
  return (
    <>
      <AiSettingsForm initialSettings={settings} />
      <McDonaldSettingsForm initialSettings={mcDonaldSettings} />
    </>
  )
}
