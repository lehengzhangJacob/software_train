import "server-only"

import { authRequired } from "@/lib/access/gate"
import { getCurrentAccountId } from "@/lib/current-user"

export async function getAccountScope() {
  const accountId = await getCurrentAccountId()
  return {
    accountId: accountId ?? undefined,
    unauthorized: authRequired() && accountId === null,
  }
}
