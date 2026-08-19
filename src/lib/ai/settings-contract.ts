import { getAiProviderPreset, isAiProviderId, type AiProviderId } from "@/lib/ai/providers"

export const AI_SETTINGS_VERSION = 1 as const

export interface StoredAiProviderSettings {
  baseUrl: string
  model: string
  visionModel?: string
  apiKey?: string | null
  updatedAt: string
}

export interface StoredAiSettings {
  version: typeof AI_SETTINGS_VERSION
  activeProvider: AiProviderId
  providers: Partial<Record<AiProviderId, StoredAiProviderSettings>>
}

export interface AiSettingsUpdate {
  providerId: AiProviderId
  baseUrl: string
  model: string
  visionModel?: string
  apiKey?: string
  clearApiKey: boolean
}

export class AiSettingsValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "AiSettingsValidationError"
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function assertString(value: unknown, label: string): string {
  if (typeof value !== "string") throw new AiSettingsValidationError(`${label} 必须是字符串`)
  return value.trim()
}

function isLoopbackHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "::1" || /^127(?:\.\d{1,3}){3}$/.test(hostname)
}

export function normalizeBaseUrl(value: string): string {
  const input = value.trim()
  if (!input || input.length > 2_048) throw new AiSettingsValidationError("Base URL 无效")

  let url: URL
  try {
    url = new URL(input)
  } catch {
    throw new AiSettingsValidationError("Base URL 无效")
  }

  if (url.username || url.password || url.search || url.hash) {
    throw new AiSettingsValidationError("Base URL 不能包含账号、查询参数或片段")
  }
  if (url.protocol !== "https:" && !(url.protocol === "http:" && isLoopbackHost(url.hostname))) {
    throw new AiSettingsValidationError("Base URL 仅支持 HTTPS 或本机 HTTP 地址")
  }

  const pathname = url.pathname.replace(/\/+$/, "").replace(/\/chat\/completions$/, "")
  url.pathname = pathname || "/"
  return url.toString().replace(/\/$/, "")
}

export function normalizeModel(value: string, label = "模型名称"): string {
  const model = value.trim()
  if (!model || model.length > 200 || !/^[A-Za-z0-9._:/~+-]+$/.test(model)) {
    throw new AiSettingsValidationError(`${label}无效`)
  }
  return model
}

function normalizeApiKey(value: string): string {
  const key = value.trim()
  if (key.length > 4_096 || /[\r\n\u0000]/.test(key)) {
    throw new AiSettingsValidationError("API Key 格式无效")
  }
  return key
}

export function createDefaultAiSettings(): StoredAiSettings {
  return {
    version: AI_SETTINGS_VERSION,
    activeProvider: "stepfun",
    providers: {},
  }
}

export function parseAiSettingsUpdate(value: unknown): AiSettingsUpdate {
  if (!isRecord(value)) throw new AiSettingsValidationError("设置内容无效")
  if (!isAiProviderId(value.providerId)) throw new AiSettingsValidationError("不支持的 AI 提供商")

  const clearApiKey = value.clearApiKey === true
  if (value.clearApiKey !== undefined && typeof value.clearApiKey !== "boolean") {
    throw new AiSettingsValidationError("清除密钥标记无效")
  }

  const apiKey = value.apiKey === undefined ? undefined : normalizeApiKey(assertString(value.apiKey, "API Key"))
  if (clearApiKey && apiKey) throw new AiSettingsValidationError("不能同时保存和清除 API Key")

  return {
    providerId: value.providerId,
    baseUrl: normalizeBaseUrl(assertString(value.baseUrl, "Base URL")),
    model: normalizeModel(assertString(value.model, "模型名称")),
    visionModel: value.visionModel === undefined || value.visionModel === "" ? undefined : normalizeModel(assertString(value.visionModel, "识图模型名称"), "识图模型名称"),
    apiKey: apiKey || undefined,
    clearApiKey,
  }
}

function parseStoredProvider(value: unknown): StoredAiProviderSettings {
  if (!isRecord(value)) throw new AiSettingsValidationError("本地 AI 设置已损坏")
  const apiKeyValue = value.apiKey
  if (apiKeyValue !== undefined && apiKeyValue !== null && typeof apiKeyValue !== "string") {
    throw new AiSettingsValidationError("本地 API Key 设置已损坏")
  }

  const updatedAt = assertString(value.updatedAt, "更新时间")
  if (Number.isNaN(Date.parse(updatedAt))) throw new AiSettingsValidationError("本地更新时间无效")

  return {
    baseUrl: normalizeBaseUrl(assertString(value.baseUrl, "Base URL")),
    model: normalizeModel(assertString(value.model, "模型名称")),
    ...(value.visionModel === undefined ? {} : { visionModel: normalizeModel(assertString(value.visionModel, "识图模型名称"), "识图模型名称") }),
    apiKey: typeof apiKeyValue === "string" ? normalizeApiKey(apiKeyValue) : apiKeyValue,
    updatedAt,
  }
}

export function parseStoredAiSettings(value: unknown): StoredAiSettings {
  if (!isRecord(value) || value.version !== AI_SETTINGS_VERSION || !isAiProviderId(value.activeProvider) || !isRecord(value.providers)) {
    throw new AiSettingsValidationError("本地 AI 设置已损坏")
  }

  const providers: StoredAiSettings["providers"] = {}
  for (const [providerId, provider] of Object.entries(value.providers)) {
    if (!isAiProviderId(providerId)) throw new AiSettingsValidationError("本地 AI 提供商设置无效")
    providers[providerId] = parseStoredProvider(provider)
  }

  return {
    version: AI_SETTINGS_VERSION,
    activeProvider: value.activeProvider,
    providers,
  }
}

export function applyAiSettingsUpdate(
  settings: StoredAiSettings,
  update: AiSettingsUpdate,
  now = new Date().toISOString()
): StoredAiSettings {
  const preset = getAiProviderPreset(update.providerId)
  const existing = settings.providers[update.providerId]
  const nextKey = update.clearApiKey ? null : update.apiKey ?? existing?.apiKey

  return {
    version: AI_SETTINGS_VERSION,
    activeProvider: update.providerId,
    providers: {
      ...settings.providers,
      [preset.id]: {
        baseUrl: update.baseUrl,
        model: update.model,
        ...(update.visionModel ? { visionModel: update.visionModel } : {}),
        ...(nextKey === undefined ? {} : { apiKey: nextKey }),
        updatedAt: now,
      },
    },
  }
}

export function maskApiKey(apiKey: string): string {
  return apiKey.length <= 4 ? "••••" : `••••${apiKey.slice(-4)}`
}
