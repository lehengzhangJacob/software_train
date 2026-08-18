import { apiError, apiSuccess } from "@/lib/api-response"
import { getAuthenticatedProfile } from "@/lib/auth/server"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function GET() {
  const user = await getAuthenticatedProfile()
  return user ? apiSuccess({ user }) : apiError("unauthorized", 401)
}
