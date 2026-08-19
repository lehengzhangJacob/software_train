import { apiSuccess } from "@/lib/api-response"
import { clearSessionCookie, deleteSession, getSessionToken } from "@/lib/auth/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST() {
  await deleteSession(await getSessionToken())
  await clearSessionCookie()
  return apiSuccess({ ok: true })
}
