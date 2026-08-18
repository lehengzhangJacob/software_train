import "server-only"

import { readFile } from "node:fs/promises"
import path from "node:path"
import type { AccountSettings } from "@prisma/client"

import { prisma } from "@/lib/prisma"
import {
  createDefaultAiSettings,
  parseStoredAiSettings,
  type StoredAiSettings,
} from "@/lib/ai/settings-contract"
import {
  MCDONALDS_MCP_ENDPOINT,
  createDefaultMcDonaldSettings,
  parseStoredMcDonaldSettings,
  type StoredMcDonaldSettings,
} from "@/lib/mcp/settings-contract"

const LEGACY_AI_SETTINGS_PATH = path.join(process.cwd(), "data", "credentials.json")
const LEGACY_MCDONALDS_SETTINGS_PATH = path.join(process.cwd(), "data", "mcdonalds.json")

export type AccountSettingsRow = AccountSettings

function isMissingFile(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT")
}

async function readLegacyJson(filePath: string) {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as unknown
  } catch (error) {
    if (isMissingFile(error)) return null
    return null
  }
}

async function readLegacyAiSettings(): Promise<StoredAiSettings> {
  const raw = await readLegacyJson(LEGACY_AI_SETTINGS_PATH)
  if (!raw) return createDefaultAiSettings()
  try {
    return parseStoredAiSettings(raw)
  } catch {
    return createDefaultAiSettings()
  }
}

async function readLegacyMcDonaldSettings(): Promise<StoredMcDonaldSettings> {
  const raw = await readLegacyJson(LEGACY_MCDONALDS_SETTINGS_PATH)
  if (!raw) return createDefaultMcDonaldSettings()
  try {
    return parseStoredMcDonaldSettings(raw)
  } catch {
    return createDefaultMcDonaldSettings()
  }
}

async function shouldInheritLegacySettings(accountId: number) {
  const firstAccount = await prisma.userAccount.findFirst({
    orderBy: { accountId: "asc" },
    select: { accountId: true },
  })
  return firstAccount?.accountId === accountId
}

export async function ensureAccountSettings(accountId: number): Promise<AccountSettingsRow> {
  const existing = await prisma.accountSettings.findUnique({ where: { accountId } })
  if (existing) return existing

  const inheritLegacy = await shouldInheritLegacySettings(accountId)
  const [aiSettings, mcdonaldsSettings] = inheritLegacy
    ? await Promise.all([readLegacyAiSettings(), readLegacyMcDonaldSettings()])
    : [createDefaultAiSettings(), createDefaultMcDonaldSettings()]

  try {
    return await prisma.accountSettings.create({
      data: {
        accountId,
        aiSettingsJson: JSON.stringify(aiSettings),
        mcdonaldsEndpoint: process.env.MCDONALDS_MCP_URL?.trim() || MCDONALDS_MCP_ENDPOINT,
        mcdonaldsToken: mcdonaldsSettings.token ?? null,
      },
    })
  } catch (error) {
    if ((error as { code?: string }).code !== "P2002") throw error
    const raced = await prisma.accountSettings.findUnique({ where: { accountId } })
    if (!raced) throw error
    return raced
  }
}

export async function saveAccountAiSettings(accountId: number, settings: StoredAiSettings) {
  await ensureAccountSettings(accountId)
  return prisma.accountSettings.update({
    where: { accountId },
    data: { aiSettingsJson: JSON.stringify(settings) },
  })
}

export async function saveAccountMcDonaldSettings(
  accountId: number,
  settings: StoredMcDonaldSettings,
) {
  await ensureAccountSettings(accountId)
  return prisma.accountSettings.update({
    where: { accountId },
    data: { mcdonaldsToken: settings.token ?? null },
  })
}

export function parseAccountAiSettings(row: AccountSettingsRow): StoredAiSettings {
  if (!row.aiSettingsJson) return createDefaultAiSettings()
  try {
    return parseStoredAiSettings(JSON.parse(row.aiSettingsJson))
  } catch {
    return createDefaultAiSettings()
  }
}

export function parseAccountMcDonaldSettings(row: AccountSettingsRow): StoredMcDonaldSettings {
  try {
    return parseStoredMcDonaldSettings({
      version: 1,
      token: row.mcdonaldsToken,
      updatedAt: row.updatedAt.toISOString(),
    })
  } catch {
    return createDefaultMcDonaldSettings()
  }
}
