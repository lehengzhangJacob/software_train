import { apiError, apiSuccess } from "@/lib/api-response"
import {
  AgentMemoryCandidateError,
  AgentValidationError,
  parseAgentMemoryConfirmationInput,
} from "@/lib/agent/contracts"
import { confirmAgentMemory } from "@/lib/agent/repository"
import { getCurrentUser } from "@/lib/current-user"

export const dynamic = "force-dynamic"

function requestFailure(error: unknown, fallback: string) {
  if (error instanceof AgentValidationError) return apiError(error.message, 422)
  if (error instanceof AgentMemoryCandidateError) return apiError(error.message, 404)
  if (error instanceof SyntaxError) return apiError("请求 JSON 格式无效", 400)
  return apiError(fallback, 500)
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) return apiError("请先创建个人档案", 404)
    const input = parseAgentMemoryConfirmationInput(await request.json())
    const memory = await confirmAgentMemory(user.userId, input.messageId, input.candidateIndex)
    return apiSuccess({
      memoryId: memory.memoryId,
      category: memory.category,
      content: memory.content,
      sourceKind: memory.sourceKind,
      isUserConfirmed: memory.isUserConfirmed,
    }, 201)
  } catch (error) {
    return requestFailure(error, "确认记忆候选失败")
  }
}
