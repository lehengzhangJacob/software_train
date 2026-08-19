import { NextRequest } from "next/server"
import { apiError, apiSuccess } from "@/lib/api-response"
import { getCurrentUser } from "@/lib/current-user"
import { prisma } from "@/lib/prisma"
import { getTodayStr } from "@/lib/utils"
import {
  parseDate,
  parseMealBatchCreateInput,
  parseMealCreateInput,
  parseMealUpdateInput,
  parsePositiveInteger,
  ValidationError,
} from "@/lib/validation"

export const dynamic = "force-dynamic"

function getCurrentTime() {
  return new Date().toTimeString().slice(0, 8)
}

function requestFailure(error: unknown, fallback: string) {
  if (error instanceof ValidationError) return apiError(error.message, 422)
  if (error instanceof SyntaxError) return apiError("请求 JSON 格式无效", 400)
  return apiError(fallback, 500)
}

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return apiError("请先创建个人档案", 404)

    const { searchParams } = new URL(request.url)
    const date = parseDate(searchParams.get("date") ?? getTodayStr(), "查询日期")
    const records = await prisma.mealRecord.findMany({
      where: { userId: user.userId, recordDate: date },
      orderBy: [{ recordTime: "asc" }],
    })

    return apiSuccess(records)
  } catch (error) {
    return requestFailure(error, "读取饮食记录失败")
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) return apiError("请先创建个人档案", 404)

    const body: unknown = await request.json()
    const defaults = {
      date: getTodayStr(),
      time: getCurrentTime(),
    }

    if (
      body &&
      typeof body === "object" &&
      !Array.isArray(body) &&
      Object.hasOwn(body as Record<string, unknown>, "items")
    ) {
      // Validate all items before entering the transaction to guarantee an
      // invalid batch cannot leave a partially saved meal log.
      const { items } = parseMealBatchCreateInput(body, defaults)
      const records = await prisma.$transaction(
        items.map((input) =>
          prisma.mealRecord.create({
            data: { userId: user.userId, ...input },
          })
        )
      )
      return apiSuccess(records, 201)
    }

    const input = parseMealCreateInput(body, defaults)
    const record = await prisma.mealRecord.create({
      data: { userId: user.userId, ...input },
    })
    return apiSuccess(record, 201)
  } catch (error) {
    return requestFailure(error, "保存饮食记录失败")
  }
}

export async function PUT(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) return apiError("请先创建个人档案", 404)

    const body: unknown = await request.json()
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new ValidationError("请求内容必须是对象")
    }
    const recordId = parsePositiveInteger((body as Record<string, unknown>).recordId, "记录 ID")
    const data = parseMealUpdateInput(body)
    const owned = await prisma.mealRecord.findFirst({
      where: { recordId, userId: user.userId },
      select: { recordId: true },
    })
    if (!owned) return apiError("饮食记录不存在", 404)

    const record = await prisma.mealRecord.update({ where: { recordId }, data })
    return apiSuccess(record)
  } catch (error) {
    return requestFailure(error, "更新饮食记录失败")
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser()
    if (!user) return apiError("请先创建个人档案", 404)

    const { searchParams } = new URL(request.url)
    const rawId = searchParams.get("id")
    const recordId = parsePositiveInteger(rawId === null ? null : Number(rawId), "记录 ID")
    const owned = await prisma.mealRecord.findFirst({
      where: { recordId, userId: user.userId },
      select: { recordId: true },
    })
    if (!owned) return apiError("饮食记录不存在", 404)

    await prisma.mealRecord.delete({ where: { recordId } })
    return apiSuccess({ deleted: true })
  } catch (error) {
    return requestFailure(error, "删除饮食记录失败")
  }
}
