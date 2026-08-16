"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import {
  CheckCircle2,
  ClipboardList,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  Save,
  Search,
  ShieldCheck,
  ShoppingBag,
  Trash2,
  Wifi,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { AiProviderId } from "@/lib/ai/providers"
import type { PublicAiProviderSettings, PublicAiSettings } from "@/lib/ai/settings"
import { cn } from "@/lib/utils"

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

interface McpTool {
  name: string
  label: string
  description: string
  actionClass: "read" | "draft" | "external_write"
  configured: boolean
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

function toolMeta(actionClass: McpTool["actionClass"]) {
  if (actionClass === "read") return { label: "只读", color: "bg-[#dcfaee] text-[var(--brand-mint-deep)]", icon: Search }
  if (actionClass === "draft") return { label: "生成草案", color: "bg-[var(--brand-lavender-soft)] text-[#6658c8]", icon: ClipboardList }
  return { label: "最终确认", color: "bg-[#fff0ec] text-[#a34e3e]", icon: ShoppingBag }
}

function McpToolsOverview() {
  const [tools, setTools] = useState<McpTool[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    void fetch("/api/mcp/tools", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = (await response.json()) as ApiEnvelope<{ tools: McpTool[] }>
        if (!response.ok || !payload.data) throw new Error(payload.error || "读取 MCP 工具状态失败")
        setTools(payload.data.tools)
      })
      .catch((reason) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "读取 MCP 工具状态失败")
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [])

  return (
    <section className="border-t border-border/80 pt-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="page-eyebrow">External tools & MCP</p>
          <h3 className="mt-1 text-xl font-semibold text-[var(--brand-plum)]">外部工具与动作边界</h3>
        </div>
        <Link href="/agent" className="text-xs font-semibold text-[var(--brand-mint-deep)]">打开教练工具台</Link>
      </div>

      {loading ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" />正在读取本机工具状态…</div>
      ) : error ? (
        <p className="mt-4 text-sm text-destructive" role="alert">{error}</p>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {tools.map((tool) => {
            const meta = toolMeta(tool.actionClass)
            const Icon = meta.icon
            return (
              <div key={tool.name} className="rounded-md border bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="grid size-9 place-items-center rounded-md bg-[var(--brand-plum)] text-[var(--brand-mint)]"><Icon className="size-4" /></div>
                  <span className={cn("rounded-full px-2 py-1 text-[10px] font-semibold", tool.configured ? meta.color : "bg-muted text-muted-foreground")}>
                    {tool.configured ? meta.label : "待连接"}
                  </span>
                </div>
                <h4 className="mt-4 text-sm font-semibold text-[var(--brand-plum)]">{tool.label}</h4>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{tool.description}</p>
              </div>
            )
          })}
        </div>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-md bg-[#dcfaee] p-3 text-xs leading-5 text-[#285f4e]">
          <b className="block text-[var(--brand-mint-deep)]">可以自动执行</b>
          只读搜索和订单草案不会产生外部订单。
        </div>
        <div className="rounded-md bg-[#fff0ec] p-3 text-xs leading-5 text-[#77483f]">
          <b className="block text-[#a34e3e]">必须最终确认</b>
          提交订单会校验绑定最终参数的一次性确认令牌。
        </div>
      </div>
    </section>
  )
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
    <section className="surface-card overflow-hidden border-0">
      <div className="grid lg:grid-cols-[24rem_minmax(0,1fr)]">
        <aside className="bg-[var(--brand-plum)] p-6 text-white sm:p-8 lg:min-h-[760px]">
          <div className="grid size-16 place-items-center rounded-md bg-[var(--brand-mint)] text-2xl font-black text-[var(--brand-plum)]">AI</div>
          <p className="mt-6 text-[11px] font-semibold uppercase text-[var(--brand-mint)]">
            {provider.ready ? "Connected locally" : "Local setup"}
          </p>
          <h1 className="mt-3 text-3xl font-semibold leading-tight">
            {provider.ready ? "你的本机 AI 已经准备好了。" : "连接你的智能服务。"}
          </h1>
          <p className="mt-3 text-sm leading-6 text-white/62">
            用于食物图片识别、营养对话和后续 Agent 能力。完整密钥不会在界面回显。
          </p>

          <div className="mt-8 grid grid-cols-2 gap-2">
            {settings.providers.map((item) => (
              <button
                key={item.id}
                type="button"
                className={cn(
                  "min-h-14 rounded-md p-3 text-left text-xs transition-colors",
                  item.id === draft.providerId
                    ? "bg-[var(--brand-mint)] text-[var(--brand-plum)]"
                    : "bg-white/8 text-white hover:bg-white/12"
                )}
                onClick={() => selectProvider(item.id)}
              >
                <b className="block truncate">
                  {item.id === "custom" ? "OpenAI 兼容接口" : item.label}
                </b>
                <span className={cn("mt-1 block text-[10px]", item.id === draft.providerId ? "text-[var(--brand-plum)]/65" : "text-white/45")}>
                  {item.ready ? "已配置" : item.visionCapability === "unsupported" ? "文本模型" : "待配置"}
                </span>
              </button>
            ))}
          </div>
        </aside>

        <div className="bg-[var(--brand-paper)] p-5 sm:p-7 lg:p-8">
          <p className="page-eyebrow">AI & tools</p>
          <h2 className="mt-2 text-3xl font-semibold leading-tight text-[var(--brand-plum)]">连接你的智能服务。</h2>

          <div className="mt-7 flex items-center gap-2 rounded-md bg-[#dcfaee] px-3 py-2 text-xs text-[#285f4e]">
            <ShieldCheck className="size-3.5 shrink-0 text-[var(--brand-mint-deep)]" />
            保存后完整密钥只由本机服务端持有，浏览器只能读取掩码状态。
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="ai-provider">提供商</Label>
              <Select value={draft.providerId} onValueChange={selectProvider}>
                <SelectTrigger id="ai-provider" type="button" className="w-full bg-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {settings.providers.map((item) => <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ai-model">默认模型</Label>
              <Input id="ai-model" className="bg-white" value={draft.model} onChange={(event) => setDraft((current) => ({ ...current, model: event.target.value }))} />
            </div>
            <div className="space-y-2 sm:col-span-2 lg:col-span-1">
              <Label htmlFor="ai-base-url">API Base URL</Label>
              <Input id="ai-base-url" className="bg-white" value={draft.baseUrl} onChange={(event) => setDraft((current) => ({ ...current, baseUrl: event.target.value }))} spellCheck={false} />
            </div>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{provider.description}</p>

          <div className="mt-5 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="ai-api-key">API Key{provider.requiresApiKey ? "" : "（可选）"}</Label>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {provider.ready ? <CheckCircle2 className="size-3.5 text-[var(--brand-mint-deep)]" /> : <KeyRound className="size-3.5 text-[var(--brand-coral)]" />}
                {provider.keyConfigured && !hasUnsavedKey ? `已配置 ${provider.keyHint}` : provider.ready ? "不需要密钥" : "待配置"}
              </span>
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
                className="min-w-0 bg-white"
              />
              <Button type="button" variant="outline" size="icon" aria-label={showKey ? "隐藏 API Key" : "显示 API Key"} title={showKey ? "隐藏 API Key" : "显示 API Key"} onClick={() => setShowKey((value) => !value)}>
                {showKey ? <EyeOff /> : <Eye />}
              </Button>
              <Button type="button" variant="outline" size="icon" aria-label="清除 API Key" title="清除 API Key" disabled={saving || (!provider.keyConfigured && !hasUnsavedKey)} onClick={clearApiKey}>
                <Trash2 />
              </Button>
            </div>
            {provider.visionCapability === "unsupported" ? <p className="text-xs text-[#a34e3e]">该预设为文本模型，不能用于食物图片识别。</p> : null}
          </div>

          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" disabled={saving || testing} onClick={testConnection}>
              {testing ? <LoaderCircle className="animate-spin" /> : <Wifi />}保存并测试
            </Button>
            <Button type="button" disabled={saving || testing} onClick={() => void saveConfiguration()}>
              {saving ? <LoaderCircle className="animate-spin" /> : <Save />}保存设置
            </Button>
          </div>

          <div className="mt-7"><McpToolsOverview /></div>
        </div>
      </div>
    </section>
  )
}
