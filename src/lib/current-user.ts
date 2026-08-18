import "server-only"

import { authRequired } from "@/lib/access/gate"
import { getAuthenticatedProfile } from "@/lib/auth/server"
import { prisma } from "@/lib/prisma"

/**
 * The course build intentionally exposes one primary profile. Historical demo
 * databases may contain more than one row, so the smallest id is the stable
 * compatibility rule. Client supplied ids must never participate in this choice.
 */
export async function getCurrentUser() {
  const authenticated = await getAuthenticatedProfile()
  if (authenticated) {
    return prisma.userProfile.findUnique({ where: { userId: authenticated.userId } })
  }
  if (authRequired()) return null

  return prisma.userProfile.findFirst({
    orderBy: { userId: "asc" },
  })
}
