import { getPublicAiSettings } from "@/lib/ai/settings"
import { AiSettingsForm } from "@/components/ai-settings-form"

export const dynamic = "force-dynamic"

export default async function SettingsPage() {
  const settings = await getPublicAiSettings()
  return <AiSettingsForm initialSettings={settings} />
}
