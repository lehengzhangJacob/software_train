import { apiError, apiSuccess } from "@/lib/api-response"
import {
  AgentNotFoundError,
  AgentValidationError,
  extractAssistantResponse,
  parseAgentChatInput,
  sanitizeAssistantText,
} from "@/lib/agent/contracts"
import {
  appendAgentMessage,
  ensureAgentThread,
  getAgentMessageHistory,
  getAgentThread,
} from "@/lib/agent/repository"
import { getAgentContext, buildAgentSystemPrompt } from "@/lib/agent/context"
import { getCurrentUser } from "@/lib/current-user"
import { getAssistantText, requestAiChatCompletion } from "@/lib/ai/client"
import { getPublicAiError } from "@/lib/ai/errors"
import { getActiveAiProviderConfig } from "@/lib/ai/settings"
import { markMemoriesUsed } from "@/lib/memory/repository"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

function titleFromMessage(message: string) {
  const compact = message.replace(/\s+/g, " ").trim()
  return compact.length > 28 ? `${compact.slice(0, 28)}…` : compact
}

function requestFailure(error: unknown, fallback: string) {
  if (error instanceof AgentValidationError) return apiError(error.message, 422)
  if (error instanceof AgentNotFoundError) return apiError(error.message, 404)
  if (error instanceof SyntaxError) return apiError("请求 JSON 格式无效", 400)
  return apiError(fallback, 500)
}

export async function POST(request: Request) {
  try {
    const contentLength = Number(request.headers.get("content-length") ?? 0)
    if (contentLength > 64 * 1024) return apiError("消息请求过大", 413)

    const user = await getCurrentUser()
    if (!user) return apiError("请先创建个人档案", 404)
    const input = parseAgentChatInput(await request.json())
    // Resolve credentials before creating a thread so an unconfigured local
    // provider cannot leave behind a ghost conversation.
    const config = await getActiveAiProviderConfig()
    const threadId = await ensureAgentThread(user.userId, input.threadId, titleFromMessage(input.message))
    const userMessage = await appendAgentMessage(user.userId, threadId, "user", input.message)
    const [context, history] = await Promise.all([
      getAgentContext(user.userId),
      getAgentMessageHistory(user.userId, threadId),
    ])

    const result = await requestAiChatCompletion(config, {
      messages: [
        { role: "system", content: buildAgentSystemPrompt(context) },
        ...history.map((message) => ({ role: message.role, content: message.content })),
      ],
      temperature: 0.4,
      max_tokens: 1_500,
    })
    const rawText = getAssistantText(result)
    if (!rawText) return apiError("AI 没有返回可读内容", 502)

    const parsed = extractAssistantResponse(sanitizeAssistantText(rawText))
    const assistantMessage = await appendAgentMessage(user.userId, threadId, "assistant", parsed.visibleText, {
      memoryCandidates: parsed.candidates,
      usedMemoryIds: context.memories.map((memory) => memory.memoryId),
    })
    await markMemoriesUsed(user.userId, context.memories.map((memory) => memory.memoryId))

    return apiSuccess({
      thread: await getAgentThread(user.userId, threadId),
      userMessage,
      assistantMessage,
    })
  } catch (error) {
    const aiFailure = getPublicAiError(error)
    if (aiFailure.status !== 500 || error?.constructor?.name === "MissingAiCredentialError" || error?.constructor?.name === "AiProviderError") {
      return apiError(aiFailure.message, aiFailure.status)
    }
    return requestFailure(error, "Agent 对话失败")
  }
}
