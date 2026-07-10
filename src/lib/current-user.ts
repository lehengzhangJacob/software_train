import "server-only"

import { prisma } from "@/lib/prisma"

/**
 * The course build intentionally exposes one primary profile. Historical demo
 * databases may contain more than one row, so the smallest id is the stable
 * compatibility rule. Client supplied ids must never participate in this choice.
 */
export async function getCurrentUser() {
  return prisma.userProfile.findFirst({
    orderBy: { userId: "asc" },
  })
}
