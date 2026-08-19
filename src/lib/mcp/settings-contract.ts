import { normalizeBaseUrl } from "@/lib/ai/settings-contract"

export const MCDONALDS_SETTINGS_VERSION = 1 as const
export const MCDONALDS_MCP_ENDPOINT = "https://mcp.mcd.cn"

export interface StoredMcDonaldSettings {
  version: typeof MCDONALDS_SETTINGS_VERSION
  token?: string | null
  updatedAt: string | null
}

export interface McDonaldSettingsUpdate {
  token?: string
  clearToken: boolean
}

export class McDonaldSettingsValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "McDonaldSettingsValidationError"
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function normalizeToken(value: unknown) {
  if (typeof value !== "string") throw new McDonaldSettingsValidationError("MCP Token 必须是字符串")
  const token = value.trim()
  if (token.length > 4_096 || /[\r\n\u0000]/.test(token)) {
    throw new McDonaldSettingsValidationError("MCP Token 格式无效")
  }
  return token
}

export function normalizeMcDonaldEndpoint(value: string) {
  try {
    return normalizeBaseUrl(value)
  } catch {
    throw new McDonaldSettingsValidationError("麦当劳 MCP 地址必须是 HTTPS 或本机 HTTP 地址")
  }
}

export function createDefaultMcDonaldSettings(): StoredMcDonaldSettings {
  return {
    version: MCDONALDS_SETTINGS_VERSION,
    updatedAt: null,
  }
}

export function parseMcDonaldSettingsUpdate(value: unknown): McDonaldSettingsUpdate {
  if (!isRecord(value)) throw new McDonaldSettingsValidationError("麦当劳 MCP 设置内容无效")
  if (value.clearToken !== undefined && typeof value.clearToken !== "boolean") {
    throw new McDonaldSettingsValidationError("清除 Token 标记无效")
  }
  const clearToken = value.clearToken === true
  const token = value.token === undefined ? undefined : normalizeToken(value.token)
  if (clearToken && token) throw new McDonaldSettingsValidationError("不能同时保存和清除 MCP Token")
  return { token: token || undefined, clearToken }
}

export function parseStoredMcDonaldSettings(value: unknown): StoredMcDonaldSettings {
  if (!isRecord(value) || value.version !== MCDONALDS_SETTINGS_VERSION) {
    throw new McDonaldSettingsValidationError("本机麦当劳 MCP 设置已损坏")
  }
  if (value.token !== undefined && value.token !== null && typeof value.token !== "string") {
    throw new McDonaldSettingsValidationError("本机麦当劳 MCP Token 已损坏")
  }
  const updatedAt = value.updatedAt
  if (updatedAt !== null && (typeof updatedAt !== "string" || Number.isNaN(Date.parse(updatedAt)))) {
    throw new McDonaldSettingsValidationError("麦当劳 MCP 设置更新时间无效")
  }
  return {
    version: MCDONALDS_SETTINGS_VERSION,
    token: typeof value.token === "string" ? normalizeToken(value.token) : value.token,
    updatedAt,
  }
}

export function applyMcDonaldSettingsUpdate(
  settings: StoredMcDonaldSettings,
  update: McDonaldSettingsUpdate,
  now = new Date().toISOString()
): StoredMcDonaldSettings {
  const token = update.clearToken ? null : update.token ?? settings.token
  return {
    version: MCDONALDS_SETTINGS_VERSION,
    ...(token === undefined ? {} : { token }),
    updatedAt: now,
  }
}

export function maskMcDonaldToken(token: string) {
  return token.length <= 4 ? "••••" : `••••${token.slice(-4)}`
}
