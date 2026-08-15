"use client"

import { useState } from "react"
import { Bot, CheckCircle2, Eye, EyeOff, KeyRound, LoaderCircle, Save, ShieldCheck, Trash2, Wifi } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { AiProviderId } from "@/lib/ai/providers"
import type { PublicAiProviderSettings, PublicAiSettings } from "@/lib/ai/settings"

interface AiSettingsFormProps {
  initialSettings: PublicAiSettings
}

interface AiSettingsDraft {
  providerId: AiProviderId
  baseUrl: string
  model: string
}

interface ApiEnvelope<T> {
  data: T | null
  error: string | null
}

function draftFromProvider(provider: PublicAiProviderSettings): AiSettingsDraft {
  return {
    providerId: provider.id,
    baseUrl: provider.baseUrl,
    model: provider.model,
  }
}

function getProvider(settings: PublicAiSettings, providerId: AiProviderId): PublicAiProviderSettings {
  const provider = settings.providers.find((item) => item.id === providerId)
  if (!provider) throw new Error("未找到 AI 提供商")
  return provider
}

export function AiSettingsForm({ initialSettings }: AiSettingsFormProps) {
  const [settings, setSettings] = useState(initialSettings)
  const [draft, setDraft] = useState<AiSettingsDraft>(() => draftFromProvider(getProvider(initialSettings, initialSettings.activeProvider)))
  const [apiKey, setApiKey] = useState("")
  const [showKey, setShowKey] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)

  const provider = getProvider(settings, draft.providerId)
  const hasUnsavedKey = Boolean(apiKey.trim())

  const selectProvider = (providerId: string | null) => {
    if (!providerId) return
    const nextProvider = getProvider(settings, providerId as AiProviderId)
    setDraft(draftFromProvider(nextProvider))
    setApiKey("")
    setShowKey(false)
  }

  const saveConfiguration = async (showSuccess = true): Promise<PublicAiSettings | null> => {
    setSaving(true)
    try {
      const response = await fetch("/api/settings/ai", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...draft,
          ...(hasUnsavedKey ? { apiKey: apiKey.trim() } : {}),
        }),
      })
      const payload = (await response.json()) as ApiEnvelope<PublicAiSettings>
      if (!response.ok || !payload.data) throw new Error(payload.error || "保存 AI 设置失败")

      setSettings(payload.data)
      setDraft(draftFromProvider(getProvider(payload.data, payload.data.activeProvider)))
      setApiKey("")
      setShowKey(false)
      if (showSuccess) toast.success("AI 设置已保存")
      return payload.data
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存 AI 设置失败")
      return null
    } finally {
      setSaving(false)
    }
  }

  const testConnection = async () => {
    const saved = await saveConfiguration(false)
    if (!saved) return

    setTesting(true)
    try {
      const response = await fetch("/api/settings/ai/test", { method: "POST" })
      const payload = (await response.json()) as ApiEnvelope<{ latencyMs: number }>
      if (!response.ok || !payload.data) throw new Error(payload.error || "AI 连接测试失败")
      toast.success(`连接正常，${payload.data.latencyMs} ms`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "AI 连接测试失败")
    } finally {
      setTesting(false)
    }
  }

  const clearApiKey = async () => {
    if (hasUnsavedKey) {
      setApiKey("")
      setShowKey(false)
      return
    }
    if (!provider.keyConfigured) return

    setSaving(true)
    try {
      const response = await fetch("/api/settings/ai", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, clearApiKey: true }),
      })
      const payload = (await response.json()) as ApiEnvelope<PublicAiSettings>
      if (!response.ok || !payload.data) throw new Error(payload.error || "清除 API Key 失败")

      setSettings(payload.data)
      setDraft(draftFromProvider(getProvider(payload.data, payload.data.activeProvider)))
      toast.success("API Key 已清除")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "清除 API Key 失败")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <CardTitle className="flex items-center gap-2 text-base">
              <Bot className="size-4 text-emerald-700" />
              AI 服务
            </CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">选择用于图片识别和后续 Agent 对话的默认模型</p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
            {provider.ready ? <CheckCircle2 className="size-3.5 text-emerald-700" /> : <KeyRound className="size-3.5 text-amber-700" />}
            <span>{provider.ready ? "配置完整" : "待配置"}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
          <ShieldCheck className="size-3.5 shrink-0" />
          <span>保存后完整密钥仅由本机服务端持有，界面不会回显。</span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="ai-provider">提供商</Label>
            <Select value={draft.providerId} onValueChange={selectProvider}>
              <SelectTrigger id="ai-provider" type="button" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {settings.providers.map((item) => (
                  <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ai-model">模型</Label>
            <Input id="ai-model" value={draft.model} onChange={(event) => setDraft((current) => ({ ...current, model: event.target.value }))} />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="ai-base-url">Base URL</Label>
          <Input id="ai-base-url" value={draft.baseUrl} onChange={(event) => setDraft((current) => ({ ...current, baseUrl: event.target.value }))} spellCheck={false} />
          <p className="text-xs text-muted-foreground">{provider.description}</p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <Label htmlFor="ai-api-key">API Key{provider.requiresApiKey ? "" : "（可选）"}</Label>
            {provider.keyConfigured && !hasUnsavedKey ? <span className="text-xs text-muted-foreground">已配置 {provider.keyHint}</span> : null}
          </div>
          <div className="flex gap-2">
            <Input
              id="ai-api-key"
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              autoComplete="off"
              spellCheck={false}
              placeholder={provider.keyConfigured ? "留空可保留当前密钥" : "输入 API Key"}
              className="min-w-0"
            />
            <Button type="button" variant="outline" size="icon" aria-label={showKey ? "隐藏 API Key" : "显示 API Key"} title={showKey ? "隐藏 API Key" : "显示 API Key"} onClick={() => setShowKey((value) => !value)}>
              {showKey ? <EyeOff /> : <Eye />}
            </Button>
            <Button type="button" variant="outline" size="icon" aria-label="清除 API Key" title="清除 API Key" disabled={saving || (!provider.keyConfigured && !hasUnsavedKey)} onClick={clearApiKey}>
              <Trash2 />
            </Button>
          </div>
          {provider.visionCapability === "unsupported" ? <p className="text-xs text-amber-700">该预设为文本模型，不能用于食物图片识别。</p> : null}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" disabled={saving || testing} onClick={testConnection}>
            {testing ? <LoaderCircle className="animate-spin" /> : <Wifi />}
            保存并测试
          </Button>
          <Button type="button" disabled={saving || testing} onClick={() => void saveConfiguration()}>
            {saving ? <LoaderCircle className="animate-spin" /> : <Save />}
            保存设置
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
