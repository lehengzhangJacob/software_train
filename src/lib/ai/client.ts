import "@/lib/ai/server-only"

import { AiProviderError, providerFailureForStatus } from "@/lib/ai/errors"
import type { ResolvedAiProviderConfig } from "@/lib/ai/settings"

export async function requestAiChatCompletion(
  config: ResolvedAiProviderConfig,
  body: Record<string, unknown>,
  timeoutMs = 30_000
): Promise<unknown> {
  let response: Response
  try {
    response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
      },
      signal: AbortSignal.timeout(timeoutMs),
      body: JSON.stringify({ model: config.model, ...body }),
    })
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      throw new AiProviderError("AI 提供商请求超时", 504)
    }
    throw new AiProviderError("无法连接 AI 提供商")
  }

  if (!response.ok) throw providerFailureForStatus(response.status)

  try {
    return await response.json()
  } catch {
    throw new AiProviderError("AI 提供商返回了无效响应")
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

export function getAssistantText(result: unknown): string | null {
  if (!isRecord(result) || !Array.isArray(result.choices)) return null
  const firstChoice = result.choices[0]
  if (!isRecord(firstChoice) || !isRecord(firstChoice.message)) return null
  const content = firstChoice.message.content
  if (typeof content === "string" && content.trim()) return content
  if (!Array.isArray(content)) return null

  const text = content
    .filter(isRecord)
    .map((part) => (typeof part.text === "string" ? part.text : ""))
    .join("")
    .trim()
  return text || null
}
