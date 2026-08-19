import { apiError, apiSuccess } from "@/lib/api-response"
import { authRequired } from "@/lib/access/gate"
import { getCurrentUser } from "@/lib/current-user"
import { prisma } from "@/lib/prisma"
import { parseUserProfileInput, ValidationError } from "@/lib/validation"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    return apiSuccess(await getCurrentUser())
  } catch {
    return apiError("读取个人档案失败", 500)
  }
}

export async function PUT(request: Request) {
  try {
    const input = parseUserProfileInput(await request.json())
    const current = await getCurrentUser()
    if (!current && authRequired()) return apiError("unauthorized", 401)
    const user = current
      ? await prisma.userProfile.update({ where: { userId: current.userId }, data: input })
      : await prisma.userProfile.create({ data: input })

    return apiSuccess(user)
  } catch (error) {
    if (error instanceof ValidationError) return apiError(error.message, 422)
    if (error instanceof SyntaxError) return apiError("请求 JSON 格式无效", 400)
    return apiError("保存个人档案失败", 500)
  }
}
