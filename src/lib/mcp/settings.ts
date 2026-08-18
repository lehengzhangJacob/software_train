import "server-only"

import { chmod, mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises"
import path from "node:path"
import {
  ensureAccountSettings,
  parseAccountMcDonaldSettings,
  saveAccountMcDonaldSettings,
} from "@/lib/account/settings"
import { McpUnavailableError } from "@/lib/mcp/contracts"
import {
  MCDONALDS_MCP_ENDPOINT,
  McDonaldSettingsValidationError,
  applyMcDonaldSettingsUpdate,
  createDefaultMcDonaldSettings,
  maskMcDonaldToken,
  normalizeMcDonaldEndpoint,
  parseMcDonaldSettingsUpdate,
  parseStoredMcDonaldSettings,
  type StoredMcDonaldSettings,
} from "@/lib/mcp/settings-contract"

const MCDONALDS_SETTINGS_PATH = path.join(process.cwd(), "data", "mcdonalds.json")

export interface PublicMcDonaldSettings {
  endpoint: string
  tokenConfigured: boolean
  tokenHint: string | null
  credentialSource: "account" | "local-file" | "environment" | null
  updatedAt: string | null
}

export interface McDonaldMcpConfig {
  endpoint: string
  token: string
}

interface McDonaldCredentialResolution {
  token: string | undefined
  source: "account" | "local-file" | "environment" | null
}

let writeQueue: Promise<void> = Promise.resolve()

function environmentValue(name: string) {
  return process.env[name]?.trim() || undefined
}

function resolveEndpoint(storedEndpoint?: string) {
  return normalizeMcDonaldEndpoint(storedEndpoint?.trim() || environmentValue("MCDONALDS_MCP_URL") || MCDONALDS_MCP_ENDPOINT)
}

async function readLegacySettings(): Promise<StoredMcDonaldSettings> {
  let raw: string
  try {
    raw = await readFile(MCDONALDS_SETTINGS_PATH, "utf8")
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return createDefaultMcDonaldSettings()
    }
    throw new McDonaldSettingsValidationError("无法读取本机麦当劳 MCP 设置")
  }

  try {
    return parseStoredMcDonaldSettings(JSON.parse(raw))
  } catch {
    throw new McDonaldSettingsValidationError("本机麦当劳 MCP 设置已损坏")
  }
}

async function writeLegacySettings(settings: StoredMcDonaldSettings) {
  const directory = path.dirname(MCDONALDS_SETTINGS_PATH)
  const temporaryPath = `${MCDONALDS_SETTINGS_PATH}.${process.pid}.${Date.now()}.tmp`
  await mkdir(directory, { recursive: true })
  try {
    await writeFile(temporaryPath, `${JSON.stringify(settings, null, 2)}\n`, { encoding: "utf8", mode: 0o600 })
    await rename(temporaryPath, MCDONALDS_SETTINGS_PATH)
    await chmod(MCDONALDS_SETTINGS_PATH, 0o600).catch(() => undefined)
  } catch {
    await unlink(temporaryPath).catch(() => undefined)
    throw new McDonaldSettingsValidationError("保存本机麦当劳 MCP 设置失败")
  }
}

async function readSettings(accountId?: number) {
  if (accountId === undefined) {
    return { settings: await readLegacySettings(), endpoint: undefined as string | undefined, accountScoped: false }
  }
  const row = await ensureAccountSettings(accountId)
  return { settings: parseAccountMcDonaldSettings(row), endpoint: row.mcdonaldsEndpoint, accountScoped: true }
}

async function writeSettings(settings: StoredMcDonaldSettings, accountId?: number) {
  if (accountId !== undefined) {
    await saveAccountMcDonaldSettings(accountId, settings)
    return
  }
  await writeLegacySettings(settings)
}

function resolveToken(settings: StoredMcDonaldSettings, accountScoped = false): McDonaldCredentialResolution {
  if (settings.token === null) return { token: undefined, source: null }
  if (settings.token) return { token: settings.token, source: accountScoped ? "account" : "local-file" }
  if (accountScoped) return { token: undefined, source: null }
  const token = environmentValue("MCDONALDS_MCP_TOKEN")
  return token ? { token, source: "environment" } : { token: undefined, source: null }
}

function toPublicSettings(settings: StoredMcDonaldSettings, storedEndpoint?: string, accountScoped = false): PublicMcDonaldSettings {
  const credential = resolveToken(settings, accountScoped)
  return {
    endpoint: resolveEndpoint(storedEndpoint),
    tokenConfigured: Boolean(credential.token),
    tokenHint: credential.source === "local-file" && credential.token
      ? maskMcDonaldToken(credential.token)
      : credential.source === "environment"
        ? "环境变量"
        : null,
    credentialSource: credential.source,
    updatedAt: settings.updatedAt,
  }
}

export async function getPublicMcDonaldSettings(accountId?: number) {
  const resolved = await readSettings(accountId)
  return toPublicSettings(resolved.settings, resolved.endpoint, resolved.accountScoped)
}

export async function saveMcDonaldSettings(rawUpdate: unknown, accountId?: number) {
  const update = parseMcDonaldSettingsUpdate(rawUpdate)
  const task = async () => {
    const current = await readSettings(accountId)
    const next = applyMcDonaldSettingsUpdate(current.settings, update)
    await writeSettings(next, accountId)
    return toPublicSettings(next, current.endpoint, current.accountScoped)
  }
  const result = writeQueue.then(task)
  writeQueue = result.then(() => undefined, () => undefined)
  return result
}

export async function getMcDonaldMcpConfig(accountId?: number): Promise<McDonaldMcpConfig> {
  const resolved = await readSettings(accountId)
  const credential = resolveToken(resolved.settings)
  if (!credential.token) throw new McpUnavailableError("请先在 AI 服务页面配置麦当劳 MCP Token")
  return { endpoint: resolveEndpoint(resolved.endpoint), token: credential.token }
}

export function isMcDonaldSettingsValidationError(error: unknown): error is McDonaldSettingsValidationError {
  return error instanceof McDonaldSettingsValidationError
}
