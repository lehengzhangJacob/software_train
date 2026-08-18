import "@/lib/ai/server-only"

import { chmod, mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises"
import path from "node:path"
import { ensureAccountSettings, parseAccountAiSettings, saveAccountAiSettings } from "@/lib/account/settings"
import { AiSettingsStoreError, MissingAiCredentialError } from "@/lib/ai/errors"
import {
  AI_PROVIDER_PRESETS,
  getAiProviderPreset,
  type AiProviderId,
  type AiProviderPreset,
} from "@/lib/ai/providers"
import {
  AiSettingsValidationError,
  applyAiSettingsUpdate,
  createDefaultAiSettings,
  maskApiKey,
  normalizeBaseUrl,
  normalizeModel,
  parseAiSettingsUpdate,
  parseStoredAiSettings,
  type StoredAiProviderSettings,
  type StoredAiSettings,
} from "@/lib/ai/settings-contract"

const CREDENTIALS_PATH = path.join(process.cwd(), "data", "credentials.json")

const environmentKeys: Partial<Record<AiProviderId, { key?: string; baseUrl?: string; model?: string }>> = {
  stepfun: { key: "STEP_API_KEY", baseUrl: "STEP_API_BASE_URL", model: "STEP_API_MODEL" },
  openai: { key: "OPENAI_API_KEY", baseUrl: "OPENAI_BASE_URL", model: "OPENAI_MODEL" },
  deepseek: { key: "DEEPSEEK_API_KEY", baseUrl: "DEEPSEEK_BASE_URL", model: "DEEPSEEK_MODEL" },
  qwen: { key: "DASHSCOPE_API_KEY", baseUrl: "DASHSCOPE_BASE_URL", model: "DASHSCOPE_MODEL" },
  moonshot: { key: "MOONSHOT_API_KEY", baseUrl: "MOONSHOT_BASE_URL", model: "MOONSHOT_MODEL" },
  zhipu: { key: "ZHIPU_API_KEY", baseUrl: "ZHIPU_BASE_URL", model: "ZHIPU_MODEL" },
  siliconflow: { key: "SILICONFLOW_API_KEY", baseUrl: "SILICONFLOW_BASE_URL", model: "SILICONFLOW_MODEL" },
  openrouter: { key: "OPENROUTER_API_KEY", baseUrl: "OPENROUTER_BASE_URL", model: "OPENROUTER_MODEL" },
  ollama: { baseUrl: "OLLAMA_BASE_URL", model: "OLLAMA_MODEL" },
}

export interface PublicAiProviderSettings extends AiProviderPreset {
  baseUrl: string
  model: string
  visionModel: string
  keyConfigured: boolean
  keyHint: string | null
  credentialSource: "account" | "local-file" | "environment" | null
  ready: boolean
  updatedAt: string | null
}

export interface PublicAiSettings {
  activeProvider: AiProviderId
  providers: PublicAiProviderSettings[]
}

export interface ResolvedAiProviderConfig {
  providerId: AiProviderId
  baseUrl: string
  model: string
  visionModel: string
  apiKey?: string
  visionCapability: AiProviderPreset["visionCapability"]
}

interface CredentialResolution {
  apiKey: string | undefined
  source: "account" | "local-file" | "environment" | null
}

let writeQueue: Promise<void> = Promise.resolve()

function environmentValue(name?: string): string | undefined {
  const value = name ? process.env[name]?.trim() : undefined
  return value || undefined
}

function resolveEndpointValue(
  record: StoredAiProviderSettings | undefined,
  provider: AiProviderPreset
): { baseUrl: string; model: string; visionModel: string } {
  const env = environmentKeys[provider.id]
  const baseCandidate = record?.baseUrl ?? environmentValue(env?.baseUrl) ?? provider.defaultBaseUrl
  const modelCandidate = record?.model ?? environmentValue(env?.model) ?? provider.defaultModel
  const visionModelCandidate = record?.visionModel ?? modelCandidate

  try {
    return {
      baseUrl: normalizeBaseUrl(baseCandidate),
      model: normalizeModel(modelCandidate),
      visionModel: normalizeModel(visionModelCandidate),
    }
  } catch (error) {
    if (error instanceof AiSettingsValidationError) throw new AiSettingsStoreError()
    throw error
  }
}

function resolveCredential(
  record: StoredAiProviderSettings | undefined,
  providerId: AiProviderId,
  accountScoped = false,
): CredentialResolution {
  if (record?.apiKey === null) return { apiKey: undefined, source: null }
  if (record?.apiKey) return { apiKey: record.apiKey, source: accountScoped ? "account" : "local-file" }
  if (accountScoped) return { apiKey: undefined, source: null }

  const apiKey = environmentValue(environmentKeys[providerId]?.key)
  return apiKey
    ? { apiKey, source: "environment" }
    : { apiKey: undefined, source: null }
}

async function readLegacyAiSettings(): Promise<StoredAiSettings> {
  let raw: string
  try {
    raw = await readFile(CREDENTIALS_PATH, "utf8")
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return createDefaultAiSettings()
    }
    throw new AiSettingsStoreError()
  }

  try {
    return parseStoredAiSettings(JSON.parse(raw))
  } catch {
    throw new AiSettingsStoreError()
  }
}

async function writeLegacyAiSettings(settings: StoredAiSettings) {
  const directory = path.dirname(CREDENTIALS_PATH)
  const temporaryPath = `${CREDENTIALS_PATH}.${process.pid}.${Date.now()}.tmp`
  await mkdir(directory, { recursive: true })

  try {
    await writeFile(temporaryPath, `${JSON.stringify(settings, null, 2)}\n`, { encoding: "utf8", mode: 0o600 })
    await rename(temporaryPath, CREDENTIALS_PATH)
    await chmod(CREDENTIALS_PATH, 0o600).catch(() => undefined)
  } catch {
    await unlink(temporaryPath).catch(() => undefined)
    throw new AiSettingsStoreError()
  }
}

async function readAiSettings(accountId?: number): Promise<StoredAiSettings> {
  if (accountId === undefined) return readLegacyAiSettings()
  return parseAccountAiSettings(await ensureAccountSettings(accountId))
}

async function writeAiSettings(settings: StoredAiSettings, accountId?: number) {
  if (accountId !== undefined) {
    await saveAccountAiSettings(accountId, settings)
    return
  }
  await writeLegacyAiSettings(settings)
}

function toPublicSettings(settings: StoredAiSettings, accountId?: number): PublicAiSettings {
  return {
    activeProvider: settings.activeProvider,
    providers: AI_PROVIDER_PRESETS.map((provider) => {
      const record = settings.providers[provider.id]
      const endpoint = resolveEndpointValue(record, provider)
      const credential = resolveCredential(record, provider.id, accountId !== undefined)

      return {
        ...provider,
        ...endpoint,
        keyConfigured: Boolean(credential.apiKey),
      keyHint: (credential.source === "account" || credential.source === "local-file") && credential.apiKey
        ? maskApiKey(credential.apiKey)
        : credential.source === "environment"
          ? "环境变量"
          : null,
        credentialSource: credential.source,
        ready: !provider.requiresApiKey || Boolean(credential.apiKey),
        updatedAt: record?.updatedAt ?? null,
      }
    }),
  }
}

export async function getPublicAiSettings(accountId?: number): Promise<PublicAiSettings> {
  return toPublicSettings(await readAiSettings(accountId), accountId)
}

export async function saveAiSettings(rawUpdate: unknown, accountId?: number): Promise<PublicAiSettings> {
  const update = parseAiSettingsUpdate(rawUpdate)
  const task = async () => {
    const current = await readAiSettings(accountId)
    const next = applyAiSettingsUpdate(current, update)
    await writeAiSettings(next, accountId)
    return toPublicSettings(next, accountId)
  }

  const result = writeQueue.then(task)
  writeQueue = result.then(
    () => undefined,
    () => undefined
  )
  return result
}

export async function getActiveAiProviderConfig(accountId?: number): Promise<ResolvedAiProviderConfig> {
  const settings = await readAiSettings(accountId)
  const provider = getAiProviderPreset(settings.activeProvider)
  const record = settings.providers[provider.id]
  const endpoint = resolveEndpointValue(record, provider)
  const credential = resolveCredential(record, provider.id)

  if (provider.requiresApiKey && !credential.apiKey) throw new MissingAiCredentialError()

  return {
    providerId: provider.id,
    ...endpoint,
    ...(credential.apiKey ? { apiKey: credential.apiKey } : {}),
    visionCapability: provider.visionCapability,
  }
}

export function isAiSettingsValidationError(error: unknown): error is AiSettingsValidationError {
  return error instanceof AiSettingsValidationError
}
