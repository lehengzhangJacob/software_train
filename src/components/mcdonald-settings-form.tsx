"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import {
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  Save,
  Search,
  ShoppingBag,
  Trash2,
  Wifi,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { CredentialGuide } from "@/components/credential-guide"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { PublicMcDonaldSettings } from "@/lib/mcp/settings"
import { cn } from "@/lib/utils"

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

function toolMeta(actionClass: McpTool["actionClass"]) {
  if (actionClass === "read") return { label: "只读", color: "bg-[var(--brand-mint-soft)] text-[var(--brand-mint-deep)]", icon: Search }
  if (actionClass === "draft") return { label: "只计价", color: "bg-[var(--brand-lavender-soft)] text-[var(--brand-lavender-deep)]", icon: ClipboardList }
  return { label: "未支付订单", color: "bg-[var(--brand-coral-soft)] text-[var(--brand-coral-ink)]", icon: ShoppingBag }
}

export function McDonaldSettingsForm({ initialSettings }: { initialSettings: PublicMcDonaldSettings }) {
  const [settings, setSettings] = useState(initialSettings)
  const [token, setToken] = useState("")
  const [showToken, setShowToken] = useState(false)
  const [tools, setTools] = useState<McpTool[]>([])
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const hasUnsavedToken = Boolean(token.trim())

  const refreshTools = async () => {
    const response = await fetch("/api/mcp/tools", { cache: "no-store" })
    const payload = (await response.json()) as ApiEnvelope<{ tools: McpTool[] }>
    if (!response.ok || !payload.data) throw new Error(payload.error || "读取麦当劳工具状态失败")
    setTools(payload.data.tools)
  }

  useEffect(() => {
    const controller = new AbortController()
    void fetch("/api/mcp/tools", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const payload = (await response.json()) as ApiEnvelope<{ tools: McpTool[] }>
        if (!response.ok || !payload.data) throw new Error(payload.error || "读取麦当劳工具状态失败")
        setTools(payload.data.tools)
      })
      .catch((error) => {
        if (!controller.signal.aborted) toast.error(error instanceof Error ? error.message : "读取麦当劳工具状态失败")
      })
    return () => controller.abort()
  }, [])

  const saveConfiguration = async (clearToken = false) => {
    setSaving(true)
    try {
      const response = await fetch("/api/settings/mcdonalds", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(clearToken ? { clearToken: true } : hasUnsavedToken ? { token: token.trim() } : {}),
      })
      const payload = (await response.json()) as ApiEnvelope<PublicMcDonaldSettings>
      if (!response.ok || !payload.data) throw new Error(payload.error || "保存麦当劳 MCP 设置失败")
      setSettings(payload.data)
      setToken("")
      setShowToken(false)
      await refreshTools()
      toast.success(clearToken ? "麦当劳 MCP Token 已清除" : "麦当劳 MCP 设置已保存")
      return true
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "保存麦当劳 MCP 设置失败")
      return false
    } finally {
      setSaving(false)
    }
  }

  const testConnection = async () => {
    if (hasUnsavedToken && !await saveConfiguration()) return
    setTesting(true)
    try {
      const response = await fetch("/api/settings/mcdonalds/test", { method: "POST" })
      const payload = (await response.json()) as ApiEnvelope<{ latencyMs: number; toolCount: number }>
      if (!response.ok || !payload.data) throw new Error(payload.error || "麦当劳 MCP 连接测试失败")
      toast.success(`麦当劳 MCP 已连接：${payload.data.toolCount} 个工具，${payload.data.latencyMs} ms`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "麦当劳 MCP 连接测试失败")
    } finally {
      setTesting(false)
    }
  }

  return (
    <section className="surface-card mt-6 overflow-hidden border-0">
      <div className="grid lg:grid-cols-[24rem_minmax(0,1fr)]">
        <aside className="bg-[var(--brand-mint)] p-6 text-[var(--brand-plum)] sm:p-8">
          <div className="grid size-16 place-items-center rounded-md bg-[var(--brand-plum)] text-xl font-black text-[var(--brand-mint)]">M</div>
          <p className="mt-6 text-[11px] font-semibold uppercase text-[var(--brand-mint-deep)]">Official McDonald MCP</p>
          <h2 className="mt-3 text-3xl font-semibold leading-tight">从营养建议走到真实订单。</h2>
          <p className="mt-3 text-sm leading-6 text-[var(--brand-heading)]/68">
            Agent 可以读取地址、门店、菜单和价格，并在明确点餐后创建一笔未支付订单。付款永远由你完成。
          </p>
          <a
            className="mt-6 inline-flex items-center gap-2 text-sm font-semibold underline-offset-4 hover:underline"
            href="https://open.mcd.cn/mcp"
            target="_blank"
            rel="noreferrer"
          >
            申请个人 MCP Token <ExternalLink className="size-4" />
          </a>
        </aside>

        <div className="bg-[var(--brand-paper)] p-5 sm:p-7 lg:p-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="page-eyebrow">Local MCP credential</p>
              <h2 className="mt-2 text-3xl font-semibold text-[var(--brand-heading)]">连接麦当劳账号。</h2>
            </div>
            <Link href="/agent" className="text-xs font-semibold text-[var(--brand-mint-deep)]">打开教练</Link>
          </div>

          <div className="mt-5 rounded-md bg-[var(--brand-mint-soft)] px-3 py-2 text-xs leading-5 text-[var(--brand-mint-ink)]">
            Token 只保存在本机服务端，不会发送给 AI、写入对话或显示完整值。官方端点：{settings.endpoint}
          </div>

          <CredentialGuide
            title="如何获取麦当劳 MCP Token"
            description="Token 是你的麦当劳会员凭证；申请和复制只在麦当劳官方 MCP 平台完成。"
            href="https://open.mcd.cn/mcp"
            steps={[
              "打开麦当劳 MCP 开放平台，点击登录或立即体验。",
              "使用麦当劳会员手机号和短信验证码登录，并同意相关协议。",
              "登录后进入右上角控制台，找到 MCP 服务并点击激活。",
              "同意服务协议并复制生成的 Token，回到本页粘贴后保存并测试。",
            ]}
            note="申请入口是 open.mcd.cn/mcp；MCP 服务连接端点仍是 https://mcp.mcd.cn。不要把 Token 发到聊天或提交到代码仓库。"
          />

          <div className="mt-5 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Label htmlFor="mcdonald-token">MCP Token</Label>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {settings.tokenConfigured ? <CheckCircle2 className="size-3.5 text-[var(--brand-mint-deep)]" /> : <KeyRound className="size-3.5 text-[var(--brand-coral)]" />}
                {settings.tokenConfigured && !hasUnsavedToken ? `已配置 ${settings.tokenHint}` : "待配置"}
              </span>
            </div>
            <div className="flex gap-2">
              <Input
                id="mcdonald-token"
                type={showToken ? "text" : "password"}
                value={token}
                onChange={(event) => setToken(event.target.value)}
                autoComplete="off"
                spellCheck={false}
                placeholder={settings.tokenConfigured ? "留空可保留当前 Token" : "输入麦当劳 MCP Token"}
                className="min-w-0 bg-card"
              />
              <Button type="button" variant="outline" size="icon" title={showToken ? "隐藏 Token" : "显示 Token"} aria-label={showToken ? "隐藏 Token" : "显示 Token"} onClick={() => setShowToken((value) => !value)}>
                {showToken ? <EyeOff /> : <Eye />}
              </Button>
              <Button type="button" variant="outline" size="icon" title="清除 Token" aria-label="清除 Token" disabled={saving || (!settings.tokenConfigured && !hasUnsavedToken)} onClick={() => hasUnsavedToken ? setToken("") : void saveConfiguration(true)}>
                <Trash2 />
              </Button>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" disabled={saving || testing || (!settings.tokenConfigured && !hasUnsavedToken)} onClick={() => void testConnection()}>
              {testing ? <LoaderCircle className="animate-spin" /> : <Wifi />}保存并测试
            </Button>
            <Button type="button" disabled={saving || testing || !hasUnsavedToken} onClick={() => void saveConfiguration()}>
              {saving ? <LoaderCircle className="animate-spin" /> : <Save />}保存 Token
            </Button>
          </div>

          <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {tools.map((tool) => {
              const meta = toolMeta(tool.actionClass)
              const Icon = meta.icon
              return (
                <div key={tool.name} className="rounded-md border bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="grid size-9 place-items-center rounded-md bg-[var(--brand-plum)] text-[var(--brand-mint)]"><Icon className="size-4" /></div>
                    <span className={cn("rounded-full px-2 py-1 text-[10px] font-semibold", tool.configured ? meta.color : "bg-muted text-muted-foreground")}>{tool.configured ? meta.label : "待连接"}</span>
                  </div>
                  <h3 className="mt-4 text-sm font-semibold text-[var(--brand-heading)]">{tool.label}</h3>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{tool.description}</p>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
