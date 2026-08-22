import "@/lib/ai/server-only"

import { AiProviderError, providerFailureForStatus } from "@/lib/ai/errors"
import type { ResolvedAiProviderConfig } from "@/lib/ai/settings"

export async function requestAiChatCompletion(
  config: ResolvedAiProviderConfig,
  body: Record<string, unknown>,
  // DashScope-compatible endpoints can take ~30s even for short chats; 60s
  // keeps the gate practical without letting a hung provider stall the UI.
  timeoutMs = 60_000,
  model = config.model
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
      body: JSON.stringify({ model, ...body }),
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

export interface AiChatStreamResult {
  raw: unknown
  text: string
  streamed: boolean
}

function extractAssistantDelta(value: unknown): string {
  if (!isRecord(value) || !Array.isArray(value.choices)) return ""
  const firstChoice = value.choices[0]
  if (!isRecord(firstChoice) || !isRecord(firstChoice.delta)) return ""
  const content = firstChoice.delta.content
  if (typeof content === "string") return content
  if (!Array.isArray(content)) return ""
  return content
    .filter(isRecord)
    .map((part) => (typeof part.text === "string" ? part.text : ""))
    .join("")
}

/**
 * Consume an OpenAI-compatible SSE response. Providers that do not expose a
 * stream are returned as one explicit fallback result so callers never fake a
 * typewriter effect in the UI.
 */
export async function requestAiChatCompletionStream(
  config: ResolvedAiProviderConfig,
  body: Record<string, unknown>,
  onDelta?: (delta: string) => void | Promise<void>,
  timeoutMs = 60_000,
  model = config.model,
): Promise<AiChatStreamResult> {
  let response: Response
  try {
    response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
      },
      signal: AbortSignal.timeout(timeoutMs),
      body: JSON.stringify({ model, stream: true, ...body }),
    })
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      throw new AiProviderError("AI 提供商请求超时", 504)
    }
    throw new AiProviderError("无法连接 AI 提供商")
  }

  if (!response.ok) throw providerFailureForStatus(response.status)

  const contentType = response.headers.get("content-type")?.toLowerCase() ?? ""
  if (!response.body || !contentType.includes("text/event-stream")) {
    try {
      const raw = await response.json()
      return { raw, text: getAssistantText(raw) ?? "", streamed: false }
    } catch {
      throw new AiProviderError("AI 提供商返回了无效响应")
    }
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  let text = ""
  let done = false

  const consumeLine = async (line: string) => {
    const trimmed = line.trim()
    if (!trimmed.startsWith("data:")) return
    const payload = trimmed.slice(5).trim()
    if (!payload || payload === "[DONE]") {
      done = payload === "[DONE]" || done
      return
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(payload)
    } catch {
      return
    }
    const delta = extractAssistantDelta(parsed)
    if (!delta) return
    text += delta
    await onDelta?.(delta)
  }

  while (!done) {
    const chunk = await reader.read()
    if (chunk.done) {
      buffer += decoder.decode()
      break
    }
    buffer += decoder.decode(chunk.value, { stream: true })
    const lines = buffer.split("\n")
    buffer = lines.pop() ?? ""
    for (const line of lines) await consumeLine(line)
  }
  if (buffer.trim()) await consumeLine(buffer)

  return {
    raw: { choices: [{ message: { content: text } }] },
    text,
    streamed: true,
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
