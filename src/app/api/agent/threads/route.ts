import { NextRequest } from "next/server"
import { apiError, apiSuccess } from "@/lib/api-response"
import { AgentNotFoundError, AgentValidationError, parseAgentThreadCreateInput } from "@/lib/agent/contracts"
import { createAgentThread, deleteAgentThread, getAgentThread, listAgentThreads } from "@/lib/agent/repository"
import { getCurrentUser } from "@/lib/current-user"

export const dynamic = "force-dynamic"

function parseId(value: string | null) {
  const id = value === null ? Number.NaN : Number(value)
  if (!Number.isInteger(id) || id <= 0) throw new AgentValidationError("对话 ID 必须是正整数")
  return id
}

function requestFailure(error: unknown, fallback: string) {
  if (error instanceof AgentValidationError || error instanceof AgentNotFoundError) {
    return apiError(error.message, error instanceof AgentNotFoundError ? 404 : 422)
  }
  if (error instanceof SyntaxError) return apiError("请求 JSON 格式无效", 400)
  return apiError(fallback, 500)
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return apiError("请先创建个人档案", 404)
    const id = new URL(request.url).searchParams.get("id")
    return apiSuccess(id ? await getAgentThread(user.userId, parseId(id)) : await listAgentThreads(user.userId))
  } catch (error) {
    return requestFailure(error, "读取 Agent 对话失败")
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) return apiError("请先创建个人档案", 404)
    const input = parseAgentThreadCreateInput(await request.json())
    return apiSuccess(await createAgentThread(user.userId, input.title), 201)
  } catch (error) {
    return requestFailure(error, "创建 Agent 对话失败")
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return apiError("请先创建个人档案", 404)
    await deleteAgentThread(user.userId, parseId(new URL(request.url).searchParams.get("id")))
    return apiSuccess({ deleted: true })
  } catch (error) {
    return requestFailure(error, "删除 Agent 对话失败")
  }
}
