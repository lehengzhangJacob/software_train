import "server-only"

import { authRequired } from "@/lib/access/gate"
import { getAuthenticatedIdentity } from "@/lib/auth/server"
import { prisma } from "@/lib/prisma"

/**
 * The course build intentionally exposes one primary profile. Historical demo
 * databases may contain more than one row, so the smallest id is the stable
 * compatibility rule. Client supplied ids must never participate in this choice.
 */
export async function getCurrentUser() {
  const authenticated = await getAuthenticatedIdentity()
  if (authenticated) {
    return prisma.userProfile.findUnique({ where: { userId: authenticated.userId } })
  }
  if (authRequired()) return null

  return prisma.userProfile.findFirst({
    orderBy: { userId: "asc" },
  })
}

export async function getCurrentAccountId(): Promise<number | null> {
  const authenticated = await getAuthenticatedIdentity()
  if (authenticated) return authenticated.accountId
  if (authRequired()) return null

  const profile = await prisma.userProfile.findFirst({ orderBy: { userId: "asc" } })
  if (!profile) return null
  const account = await prisma.userAccount.findUnique({
    where: { profileId: profile.userId },
    select: { accountId: true },
  })
  return account?.accountId ?? null
}

export async function getAccountIdForProfile(userId: number): Promise<number | null> {
  const account = await prisma.userAccount.findUnique({
    where: { profileId: userId },
    select: { accountId: true },
  })
  return account?.accountId ?? null
}
