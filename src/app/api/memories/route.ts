import { NextRequest } from "next/server"
import { apiError, apiSuccess } from "@/lib/api-response"
import { getCurrentUser } from "@/lib/current-user"
import {
  MemoryValidationError,
  parseMemoryCreateInput,
  parseMemoryQueryStatus,
  parseMemoryUpdateInput,
} from "@/lib/memory/contracts"
import {
  createUserMemory,
  deleteUserMemory,
  listMemoryItems,
  MemoryNotFoundError,
  updateUserMemory,
} from "@/lib/memory/repository"

export const dynamic = "force-dynamic"

function requestFailure(error: unknown, fallback: string) {
  if (error instanceof MemoryValidationError) return apiError(error.message, 422)
  if (error instanceof MemoryNotFoundError) return apiError(error.message, 404)
  if (error instanceof SyntaxError) return apiError("请求 JSON 格式无效", 400)
  return apiError(fallback, 500)
}

function parseQueryId(value: string | null) {
  const parsed = value === null ? Number.NaN : Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) throw new MemoryValidationError("记忆 ID 必须是正整数")
  return parsed
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return apiError("请先创建个人档案", 404)
    const status = parseMemoryQueryStatus(new URL(request.url).searchParams.get("status"))
    return apiSuccess(await listMemoryItems(user.userId, status))
  } catch (error) {
    return requestFailure(error, "读取长期记忆失败")
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) return apiError("请先创建个人档案", 404)
    const memory = await createUserMemory(user.userId, parseMemoryCreateInput(await request.json()))
    return apiSuccess(memory, 201)
  } catch (error) {
    return requestFailure(error, "创建长期记忆失败")
  }
}

export async function PATCH(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) return apiError("请先创建个人档案", 404)
    return apiSuccess(await updateUserMemory(user.userId, parseMemoryUpdateInput(await request.json())))
  } catch (error) {
    return requestFailure(error, "更新长期记忆失败")
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return apiError("请先创建个人档案", 404)
    const memoryId = parseQueryId(new URL(request.url).searchParams.get("id"))
    await deleteUserMemory(user.userId, memoryId)
    return apiSuccess({ deleted: true })
  } catch (error) {
    return requestFailure(error, "删除长期记忆失败")
  }
}
