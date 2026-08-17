import { normalizeBaseUrl } from "@/lib/ai/settings-contract"

export const MCP_MAX_INPUT_BYTES = 16 * 1024
export const MCP_MAX_OUTPUT_BYTES = 64 * 1024
export const MCP_TIMEOUT_MS = 8_000

export type McDonaldToolName =
  | "list-nutrition-foods"
  | "delivery-query-addresses"
  | "delivery-query-stores"
  | "query-store-coupons"
  | "query-meals"
  | "query-meal-detail"
  | "calculate-price"
  | "create-order"
  | "query-order"

export const MCDONALD_TOOL_DEFINITIONS: Array<{
  name: McDonaldToolName
  label: string
  description: string
  actionClass: "read" | "draft" | "external_write"
}> = [
  { name: "list-nutrition-foods", label: "麦当劳营养表", description: "读取常见麦当劳餐品的能量和宏量营养数据", actionClass: "read" },
  { name: "delivery-query-addresses", label: "配送地址", description: "读取麦当劳账号中已有的配送地址", actionClass: "read" },
  { name: "delivery-query-stores", label: "可配送门店", description: "按选定地址查询可配送的麦当劳门店", actionClass: "read" },
  { name: "query-store-coupons", label: "可用优惠券", description: "读取当前门店和配送方式可用的优惠券", actionClass: "read" },
  { name: "query-meals", label: "门店菜单", description: "读取门店当前可售餐品、套餐编码和价格", actionClass: "read" },
  { name: "query-meal-detail", label: "餐品详情", description: "读取套餐组成和默认选择", actionClass: "read" },
  { name: "calculate-price", label: "订单计价", description: "计算商品、配送费、优惠和应付总额，不创建订单", actionClass: "draft" },
  { name: "create-order", label: "创建未支付订单", description: "在明确点餐意图内创建一笔未支付订单并返回支付入口", actionClass: "external_write" },
  { name: "query-order", label: "订单状态", description: "读取已有订单的状态、商品和配送信息", actionClass: "read" },
]

export type McpToolName = "nearby_takeout_search" | "takeout_order_draft" | "takeout_order_submit"

export interface McpToolDefinition {
  name: McpToolName
  label: string
  description: string
  actionClass: "read" | "draft" | "external_write"
  requiresConfiguredConnector: boolean
}

export const MCP_TOOL_DEFINITIONS: McpToolDefinition[] = [
  {
    name: "nearby_takeout_search",
    label: "附近外卖搜索",
    description: "只读搜索用户指定位置附近的外卖或餐厅候选",
    actionClass: "read",
    requiresConfiguredConnector: true,
  },
  {
    name: "takeout_order_draft",
    label: "外卖订单草案",
    description: "根据用户选定的餐厅、商品和配送信息生成草案，不会提交订单",
    actionClass: "draft",
    requiresConfiguredConnector: false,
  },
  {
    name: "takeout_order_submit",
    label: "提交外卖订单",
    description: "向已授权的外卖连接器提交最终订单参数",
    actionClass: "external_write",
    requiresConfiguredConnector: true,
  },
]

export interface NearbyTakeoutSearchInput {
  location: string
  query: string
  latitude: number | null
  longitude: number | null
  radiusMeters: number
}

export interface TakeoutOrderItem {
  name: string
  quantity: number
  unitPriceCents: number
}

export interface TakeoutOrderDraftInput {
  restaurantId: string
  restaurantName: string
  items: TakeoutOrderItem[]
  deliveryAddress: string
  note: string
  currency: string
}

export interface TakeoutOrderSubmission extends TakeoutOrderDraftInput {
  totalCents: number
}

export interface TakeoutSearchResult {
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

export class McpValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "McpValidationError"
  }
}

export class McpUnavailableError extends Error {
  constructor(message = "附近外卖 MCP 连接器尚未配置") {
    super(message)
    this.name = "McpUnavailableError"
  }
}

export class McpToolError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "McpToolError"
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function requiredString(value: unknown, label: string, maxLength: number) {
  if (typeof value !== "string") throw new McpValidationError(`${label}格式无效`)
  const result = value.trim()
  if (!result) throw new McpValidationError(`请填写${label}`)
  if (result.length > maxLength) throw new McpValidationError(`${label}过长`)
  return result
}

function optionalString(value: unknown, label: string, maxLength: number) {
  if (value === undefined || value === null) return ""
  if (typeof value !== "string") throw new McpValidationError(`${label}格式无效`)
  const result = value.trim()
  if (result.length > maxLength) throw new McpValidationError(`${label}过长`)
  return result
}

function boundedNumber(value: unknown, label: string, min: number, max: number) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    throw new McpValidationError(`${label}必须在 ${min} 到 ${max} 之间`)
  }
  return value
}

function optionalCoordinate(value: unknown, label: string, min: number, max: number) {
  if (value === undefined || value === null || value === "") return null
  return boundedNumber(value, label, min, max)
}

export function parseNearbyTakeoutSearchInput(value: unknown): NearbyTakeoutSearchInput {
  if (!isRecord(value)) throw new McpValidationError("请求内容必须是对象")
  return {
    location: requiredString(value.location, "搜索位置", 200),
    query: optionalString(value.query, "搜索关键词", 80),
    latitude: optionalCoordinate(value.latitude, "纬度", -90, 90),
    longitude: optionalCoordinate(value.longitude, "经度", -180, 180),
    radiusMeters: value.radiusMeters === undefined ? 3_000 : boundedNumber(value.radiusMeters, "搜索半径", 100, 20_000),
  }
}

function parseOrderItem(value: unknown): TakeoutOrderItem {
  if (!isRecord(value)) throw new McpValidationError("商品格式无效")
  const quantity = value.quantity === undefined ? 1 : boundedNumber(value.quantity, "商品数量", 1, 99)
  const unitPriceCents = boundedNumber(value.unitPriceCents, "商品单价", 0, 10_000_000)
  return {
    name: requiredString(value.name, "商品名称", 120),
    quantity,
    unitPriceCents: Math.round(unitPriceCents),
  }
}

export function parseTakeoutOrderDraftInput(value: unknown): TakeoutOrderDraftInput {
  if (!isRecord(value)) throw new McpValidationError("请求内容必须是对象")
  if (!Array.isArray(value.items) || value.items.length < 1 || value.items.length > 20) {
    throw new McpValidationError("订单至少需要 1 项商品，最多 20 项")
  }
  const currency = optionalString(value.currency, "货币", 8).toUpperCase() || "CNY"
  if (!/^[A-Z]{3}$/.test(currency)) throw new McpValidationError("货币格式无效")
  return {
    restaurantId: requiredString(value.restaurantId, "餐厅 ID", 120),
    restaurantName: requiredString(value.restaurantName, "餐厅名称", 160),
    items: value.items.map(parseOrderItem),
    deliveryAddress: requiredString(value.deliveryAddress, "配送地址", 300),
    note: optionalString(value.note, "备注", 300),
    currency,
  }
}

export function configuredMcpEndpoint() {
  const raw = process.env.TAKEOUT_MCP_URL?.trim()
  if (!raw) return null
  try {
    return normalizeBaseUrl(raw)
  } catch {
    throw new McpValidationError("TAKEOUT_MCP_URL 必须是 HTTPS 或本机 HTTP 地址")
  }
}
