import type { McDonaldMcpSession } from "@/lib/mcp/mcdonalds-client"
import { McpToolError, McpUnavailableError } from "@/lib/mcp/contracts"

// ADR-0004 orchestration: explicit intent (checked in ordering-intent.ts plus
// an action.policy grant) drives a deterministic server-side pipeline. The
// model only picks items from a menu the server fetched and re-validated;
// every tool call runs in its own MCP session so the 8s session budget of
// mcdonalds-client is never shared with the model call.

export interface MenuOption {
  code: string
  name: string
  priceCents: number | null
}

export interface SelectedItem {
  code: string
  name: string
  quantity: number
}

export interface OrderSelection {
  items: Array<{ code: string; quantity: number }>
  note: string
}

export interface OrderingPlan {
  addressLabel: string
  storeName: string
  items: SelectedItem[]
  note: string
  itemsTotalCents: number | null
  priceSummary: Record<string, unknown>
}

export type OrderingOutcome =
  | { status: "blocked"; reason: string }
  | { status: "planned"; plan: OrderingPlan }

export class OrderPlanError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "OrderPlanError"
  }
}

export interface OrderingDeps {
  openSession<T>(run: (session: McDonaldMcpSession) => Promise<T>): Promise<T>
  selectItems(input: { message: string; menu: MenuOption[]; remainingCalories: number | null }): Promise<OrderSelection>
  verifyPrice?(itemsTotalCents: number | null, priceSummary: Record<string, unknown>): boolean
}

const MAX_MENU_OPTIONS = 60
const MAX_SELECTION_ITEMS = 8
const MAX_ITEM_QUANTITY = 9

function asArray(value: unknown, keys: string[]): unknown[] {
  if (Array.isArray(value)) return value
  if (value && typeof value === "object") {
    for (const key of keys) {
      const candidate = (value as Record<string, unknown>)[key]
      if (Array.isArray(candidate)) return candidate
    }
  }
  return []
}

function text(value: unknown, maxLength = 200): string {
  return typeof value === "string" ? value.replace(/[\r\n]+/g, " ").trim().slice(0, maxLength) : ""
}

function firstText(record: Record<string, unknown>, keys: string[], maxLength?: number): string | null {
  for (const key of keys) {
    const value = text(record[key], maxLength)
    if (value) return value
  }
  return null
}

function firstId(record: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === "string" && value.trim()) return value.trim().slice(0, 120)
    if (typeof value === "number" && Number.isInteger(value)) return String(value)
  }
  return null
}

function firstPrice(record: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) return value
  }
  return null
}

export function parseAddressResult(value: unknown): { id: string; label: string } | null {
  const first = asArray(value, ["addresses", "list", "data"])[0]
  if (!first || typeof first !== "object") return null
  const record = first as Record<string, unknown>
  const id = firstId(record, ["addressId", "address_id", "addrId", "id"])
  const label = firstText(record, ["address", "addr", "detail", "fullAddress", "name"], 200)
  if (!id || !label) return null
  return { id, label }
}

export function parseStoreResult(value: unknown): { id: string; name: string } | null {
  const first = asArray(value, ["stores", "list", "data"])[0]
  if (!first || typeof first !== "object") return null
  const record = first as Record<string, unknown>
  const id = firstId(record, ["storeId", "store_id", "shopId", "id"])
  const name = firstText(record, ["storeName", "store_name", "name", "title"], 120)
  if (!id || !name) return null
  return { id, name }
}

export function parseMenuResult(value: unknown): MenuOption[] {
  return asArray(value, ["meals", "products", "items", "list", "data"])
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .slice(0, MAX_MENU_OPTIONS)
    .flatMap((record) => {
      const code = firstId(record, ["code", "productCode", "product_code", "mealCode", "itemId", "id"])
      const name = firstText(record, ["name", "productName", "product_name", "title"], 120)
      if (!code || !name) return []
      return [{ code, name, priceCents: firstPrice(record, ["priceCents", "price_cents", "priceFen", "price", "salePrice"]) }]
    })
}

export function extractOrderSelection(raw: string): OrderSelection {
  const marker = /<order-selection>\s*([\s\S]*?)\s*<\/order-selection>/i.exec(raw)
  const payload = marker ? marker[1] : raw.trim()
  let parsed: unknown
  try {
    parsed = JSON.parse(payload)
  } catch {
    throw new OrderPlanError("模型未能返回有效的选餐结果")
  }
  if (!parsed || typeof parsed !== "object" || !Array.isArray((parsed as Record<string, unknown>).items)) {
    throw new OrderPlanError("模型选餐结果缺少商品列表")
  }
  const items = (parsed as { items: unknown[]; note?: unknown }).items.map((item) => {
    if (!item || typeof item !== "object") throw new OrderPlanError("模型选餐结果包含无效商品")
    const record = item as Record<string, unknown>
    const code = text(record.code, 120)
    const quantity = record.quantity
    if (!code || typeof quantity !== "number" || !Number.isInteger(quantity)) {
      throw new OrderPlanError("模型选餐结果包含无效商品")
    }
    return { code, quantity }
  })
  const note = text((parsed as Record<string, unknown>).note, 200)
  return { items, note }
}

export function validateSelection(selection: OrderSelection, menu: MenuOption[]): SelectedItem[] {
  if (selection.items.length < 1 || selection.items.length > MAX_SELECTION_ITEMS) {
    throw new OrderPlanError("选餐数量必须在 1 到 8 项之间")
  }
  const menuByCode = new Map(menu.map((option) => [option.code, option]))
  return selection.items.map((item) => {
    const option = menuByCode.get(item.code)
    if (!option) throw new OrderPlanError("选餐结果包含菜单外的商品，已停止下单")
    if (item.quantity < 1 || item.quantity > MAX_ITEM_QUANTITY) {
      throw new OrderPlanError("单个商品数量必须在 1 到 9 之间")
    }
    return { code: option.code, name: option.name, quantity: item.quantity }
  })
}

function normalizePriceResult(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  return Object.keys(record).length ? record : null
}

function blockedReason(error: unknown): string {
  if (error instanceof McpUnavailableError) return error.message
  if (error instanceof McpToolError) return error.message
  if (error instanceof OrderPlanError) return error.message
  return "点餐编排暂时不可用"
}

export function itemsTotalCentsOf(items: SelectedItem[], menu: MenuOption[]): number | null {
  const prices = new Map(menu.map((option) => [option.code, option.priceCents]))
  let total = 0
  for (const item of items) {
    const price = prices.get(item.code)
    if (price === null || price === undefined) return null
    total += price * item.quantity
  }
  return total
}

export async function planMcDonaldOrder(
  deps: OrderingDeps,
  message: string,
  remainingCalories: number | null,
): Promise<OrderingOutcome> {
  try {
    const address = await deps.openSession(async (session) =>
      parseAddressResult(await session.callTool("delivery-query-addresses")),
    )
    if (!address) return { status: "blocked", reason: "麦当劳账号中没有可用的配送地址" }

    const store = await deps.openSession(async (session) =>
      parseStoreResult(await session.callTool("delivery-query-stores", { addressId: address.id })),
    )
    if (!store) return { status: "blocked", reason: "当前地址没有可配送的麦当劳门店" }

    const menu = await deps.openSession(async (session) =>
      parseMenuResult(await session.callTool("query-meals", { storeId: store.id })),
    )
    if (!menu.length) return { status: "blocked", reason: "门店菜单暂时不可用" }

    const selection = await deps.selectItems({ message, menu, remainingCalories })
    const items = validateSelection(selection, menu)

    const priceSummary = await deps.openSession(async (session) =>
      normalizePriceResult(
        await session.callTool("calculate-price", {
          addressId: address.id,
          storeId: store.id,
          items: items.map((item) => ({ code: item.code, quantity: item.quantity })),
        }),
      ),
    )
    if (!priceSummary) return { status: "blocked", reason: "订单计价失败，暂不能继续下单" }

    const itemsTotalCents = itemsTotalCentsOf(items, menu)
    if (deps.verifyPrice && !deps.verifyPrice(itemsTotalCents, priceSummary)) {
      return { status: "blocked", reason: "计价结果与选餐合计不一致，已停止下单" }
    }

    return {
      status: "planned",
      plan: {
        addressLabel: address.label,
        storeName: store.name,
        items,
        note: selection.note,
        itemsTotalCents,
        priceSummary,
      },
    }
  } catch (error) {
    return { status: "blocked", reason: blockedReason(error) }
  }
}

export function composeOrderingReply(outcome: OrderingOutcome): string {
  if (outcome.status === "blocked") {
    return `这次没能自动点餐：${outcome.reason}。你可以补充信息后再试，或直接在麦当劳 App 下单。`
  }
  const lines = outcome.plan.items.map((item) => `- ${item.name} × ${item.quantity}`)
  const note = outcome.plan.note ? `\n${outcome.plan.note}` : ""
  return `已为你选好这一单（还未下单）：\n${lines.join("\n")}\n配送至 ${outcome.plan.addressLabel}，门店 ${outcome.plan.storeName}。${note}`
}
