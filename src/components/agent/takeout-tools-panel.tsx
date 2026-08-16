"use client"

import { useEffect, useState } from "react"
import { CheckCircle2, ClipboardList, LoaderCircle, MapPin, Search, Store } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface ApiEnvelope<T> {
  data: T | null
  error: string | null
}

interface SearchResult {
  id: string
  name: string
  cuisine: string | null
  distanceKm: number | null
  estimatedMinutes: number | null
  deliveryFeeCents: number | null
  priceRange: string | null
  description: string | null
  url: string | null
}

interface OrderDraft {
  draftId: string
  restaurantId: string
  restaurantName: string
  items: Array<{ name: string; quantity: number; unitPriceCents: number }>
  deliveryAddress: string
  note: string
  currency: string
  totalCents: number
  confirmation: { token: string; expiresAt: string }
}

async function requestJson<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, init)
  const payload = (await response.json()) as ApiEnvelope<T>
  if (!response.ok || payload.data === null) throw new Error(payload.error || "工具请求失败")
  return payload.data
}

export function TakeoutToolsPanel() {
  const [connectorReady, setConnectorReady] = useState<boolean | null>(null)
  const [location, setLocation] = useState("")
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [restaurant, setRestaurant] = useState<SearchResult | null>(null)
  const [itemName, setItemName] = useState("")
  const [unitPrice, setUnitPrice] = useState("")
  const [deliveryAddress, setDeliveryAddress] = useState("")
  const [note, setNote] = useState("")
  const [draft, setDraft] = useState<OrderDraft | null>(null)
  const [drafting, setDrafting] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [submitted, setSubmitted] = useState<string | null>(null)

  useEffect(() => {
    void requestJson<{ tools: Array<{ name: string; configured: boolean }> }>("/api/mcp/tools")
      .then((payload) => setConnectorReady(payload.tools.some((tool) => tool.name === "nearby_takeout_search" && tool.configured)))
      .catch(() => setConnectorReady(false))
  }, [])

  const search = async () => {
    if (!location.trim()) {
      toast.error("请填写搜索位置")
      return
    }
    setSearching(true)
    setSubmitted(null)
    try {
      const payload = await requestJson<{ results: SearchResult[] }>("/api/mcp/takeout/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location: location.trim(), query: query.trim() }),
      })
      setResults(payload.results)
      if (payload.results.length === 0) toast.info("连接器没有返回候选餐厅")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "附近外卖搜索失败")
    } finally {
      setSearching(false)
    }
  }

  const chooseRestaurant = (result: SearchResult) => {
    setRestaurant(result)
    setDraft(null)
    setSubmitted(null)
  }

  const createDraft = async () => {
    if (!restaurant) {
      toast.error("请先选择餐厅")
      return
    }
    const price = Number(unitPrice)
    if (!itemName.trim() || !Number.isFinite(price) || price < 0) {
      toast.error("请填写商品名称和有效价格")
      return
    }
    if (!deliveryAddress.trim()) {
      toast.error("请填写配送地址")
      return
    }
    setDrafting(true)
    try {
      const created = await requestJson<OrderDraft>("/api/mcp/takeout/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId: restaurant.id,
          restaurantName: restaurant.name,
          deliveryAddress: deliveryAddress.trim(),
          note: note.trim(),
          items: [{ name: itemName.trim(), quantity: 1, unitPriceCents: Math.round(price * 100) }],
        }),
      })
      setDraft(created)
      toast.success("订单草案已生成，尚未提交")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "生成订单草案失败")
    } finally {
      setDrafting(false)
    }
  }

  const confirmOrder = async () => {
    if (!draft || confirming) return
    setConfirming(true)
    try {
      const result = await requestJson<{ status: string; orderId: string | null; message: string }>("/api/mcp/takeout/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmationToken: draft.confirmation.token, draft }),
      })
      setSubmitted(result.orderId ? `订单已交给连接器：${result.orderId}` : result.message)
      toast.success("连接器已返回订单状态")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "提交订单失败")
    } finally {
      setConfirming(false)
    }
  }

  return (
    <Card className="surface-card overflow-hidden border-0">
      <CardHeader className="flex flex-row items-start justify-between gap-3 border-0 bg-[var(--brand-plum)] text-white">
        <div>
          <p className="text-[10px] font-semibold uppercase text-[var(--brand-mint)]">Local MCP tools</p>
          <CardTitle className="mt-1 flex items-center gap-2 text-lg"><Store className="size-4 text-[var(--brand-mint)]" />附近外卖工具台</CardTitle>
          <p className="mt-1 text-sm text-white/60">搜索可以直接执行；下单只会先生成草案，最终提交仍由你确认。</p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs ${connectorReady ? "bg-[var(--brand-mint)] text-[var(--brand-plum)]" : "bg-white/10 text-white/60"}`}>
          {connectorReady === null ? "检查中" : connectorReady ? "已连接" : "未配置"}
        </span>
      </CardHeader>
      <CardContent className="space-y-5 bg-[var(--brand-paper)] pt-5">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
          <div className="space-y-2">
            <Label htmlFor="takeout-location">位置</Label>
            <div className="relative"><MapPin className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-[var(--brand-mint-deep)]" /><Input id="takeout-location" className="bg-white pl-8" value={location} onChange={(event) => setLocation(event.target.value)} placeholder="如：徐汇区" /></div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="takeout-query">想吃什么（可选）</Label>
            <Input id="takeout-query" className="bg-white" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="如：低脂、沙拉、面" />
          </div>
          <Button type="button" disabled={searching} onClick={() => void search()}>
            {searching ? <LoaderCircle className="animate-spin" /> : <Search />}
            搜索
          </Button>
        </div>

        {results.length > 0 ? (
          <div className="grid gap-2 md:grid-cols-2">
            {results.map((result) => (
              <button key={result.id} type="button" className={`rounded-md border p-3 text-left transition-colors hover:border-[var(--brand-mint)] ${restaurant?.id === result.id ? "border-[var(--brand-mint)] bg-[#dcfaee]" : "bg-white"}`} onClick={() => chooseRestaurant(result)}>
                <div className="flex items-start justify-between gap-3"><span className="min-w-0 truncate text-sm font-medium text-neutral-900">{result.name}</span><span className="shrink-0 text-xs text-neutral-500">{result.distanceKm === null ? "距离未知" : `${result.distanceKm.toFixed(1)} km`}</span></div>
                <p className="mt-1 text-xs text-neutral-500">{[result.cuisine, result.priceRange, result.estimatedMinutes === null ? null : `${Math.round(result.estimatedMinutes)} 分钟`].filter(Boolean).join(" · ") || "连接器未提供详情"}</p>
                {result.description ? <p className="mt-2 line-clamp-2 text-xs leading-5 text-neutral-600">{result.description}</p> : null}
              </button>
            ))}
          </div>
        ) : null}

        {restaurant ? (
          <div className="space-y-3 rounded-md border bg-white p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-[var(--brand-plum)]"><ClipboardList className="size-4 text-[var(--brand-lavender)]" />为「{restaurant.name}」生成草案</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="takeout-item">商品</Label><Input id="takeout-item" value={itemName} onChange={(event) => setItemName(event.target.value)} placeholder="如：鸡胸沙拉" /></div>
              <div className="space-y-2"><Label htmlFor="takeout-price">价格（元）</Label><Input id="takeout-price" inputMode="decimal" type="number" min="0" step="0.01" value={unitPrice} onChange={(event) => setUnitPrice(event.target.value)} placeholder="0.00" /></div>
              <div className="space-y-2 sm:col-span-2"><Label htmlFor="takeout-address">配送地址</Label><Input id="takeout-address" value={deliveryAddress} onChange={(event) => setDeliveryAddress(event.target.value)} placeholder="只在本次确认请求中使用，不会保存" /></div>
              <div className="space-y-2 sm:col-span-2"><Label htmlFor="takeout-note">备注（可选）</Label><Input id="takeout-note" value={note} onChange={(event) => setNote(event.target.value)} placeholder="如：少油少盐" /></div>
            </div>
            <Button type="button" disabled={drafting} onClick={() => void createDraft()}>{drafting ? <LoaderCircle className="animate-spin" /> : <ClipboardList />}生成订单草案</Button>
          </div>
        ) : null}

        {draft ? (
          <div className="border-l-2 border-[var(--brand-coral)] bg-[#fff0ec] px-4 py-3 text-sm text-[#653b34]">
            <div className="flex flex-wrap items-center justify-between gap-2"><strong>草案：{draft.restaurantName}</strong><span>{draft.currency} {(draft.totalCents / 100).toFixed(2)}</span></div>
            <p className="mt-1 text-xs">{draft.items.map((item) => `${item.name} × ${item.quantity}`).join("、")} · {draft.deliveryAddress}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2"><Button type="button" size="sm" disabled={confirming} onClick={() => void confirmOrder()}>{confirming ? <LoaderCircle className="animate-spin" /> : <CheckCircle2 />}确认并提交</Button><span className="text-xs text-[#8b594f]">确认令牌 10 分钟内有效</span></div>
          </div>
        ) : null}

        {submitted ? <p className="flex items-center gap-2 text-sm text-[var(--brand-mint-deep)]"><CheckCircle2 className="size-4" />{submitted}</p> : null}
      </CardContent>
    </Card>
  )
}
