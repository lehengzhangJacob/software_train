import "server-only"

import { chmod, mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises"
import path from "node:path"
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
  credentialSource: "local-file" | "environment" | null
  updatedAt: string | null
}

export interface McDonaldMcpConfig {
  endpoint: string
  token: string
}

interface McDonaldCredentialResolution {
  token: string | undefined
  source: "local-file" | "environment" | null
}

let writeQueue: Promise<void> = Promise.resolve()

function environmentValue(name: string) {
  return process.env[name]?.trim() || undefined
}

function resolveEndpoint() {
  return normalizeMcDonaldEndpoint(environmentValue("MCDONALDS_MCP_URL") ?? MCDONALDS_MCP_ENDPOINT)
}

async function readSettings(): Promise<StoredMcDonaldSettings> {
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

async function writeSettings(settings: StoredMcDonaldSettings) {
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

function resolveToken(settings: StoredMcDonaldSettings): McDonaldCredentialResolution {
  if (settings.token === null) return { token: undefined, source: null }
  if (settings.token) return { token: settings.token, source: "local-file" }
  const token = environmentValue("MCDONALDS_MCP_TOKEN")
  return token ? { token, source: "environment" } : { token: undefined, source: null }
}

function toPublicSettings(settings: StoredMcDonaldSettings): PublicMcDonaldSettings {
  const credential = resolveToken(settings)
  return {
    endpoint: resolveEndpoint(),
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

export async function getPublicMcDonaldSettings() {
  return toPublicSettings(await readSettings())
}

export async function saveMcDonaldSettings(rawUpdate: unknown) {
  const update = parseMcDonaldSettingsUpdate(rawUpdate)
  const task = async () => {
    const next = applyMcDonaldSettingsUpdate(await readSettings(), update)
    await writeSettings(next)
    return toPublicSettings(next)
  }
  const result = writeQueue.then(task)
  writeQueue = result.then(() => undefined, () => undefined)
  return result
}

export async function getMcDonaldMcpConfig(): Promise<McDonaldMcpConfig> {
  const settings = await readSettings()
  const credential = resolveToken(settings)
  if (!credential.token) throw new McpUnavailableError("请先在 AI 服务页面配置麦当劳 MCP Token")
  return { endpoint: resolveEndpoint(), token: credential.token }
}

export function isMcDonaldSettingsValidationError(error: unknown): error is McDonaldSettingsValidationError {
  return error instanceof McDonaldSettingsValidationError
}
