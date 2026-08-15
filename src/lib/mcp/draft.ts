import { randomUUID } from "node:crypto"
import { issueActionConfirmation } from "@/lib/actions/policy"
import type { TakeoutOrderDraftInput, TakeoutOrderSubmission } from "@/lib/mcp/contracts"

export function createTakeoutOrderDraft(input: TakeoutOrderDraftInput) {
  const totalCents = input.items.reduce((sum, item) => sum + item.quantity * item.unitPriceCents, 0)
  const submission: TakeoutOrderSubmission = { ...input, totalCents }
  const draft = {
    draftId: randomUUID(),
    toolName: "takeout_order_submit" as const,
    actionClass: "external_write" as const,
    ...submission,
    createdAt: new Date().toISOString(),
  }
  return {
    ...draft,
    confirmation: issueActionConfirmation(draft.toolName, submission),
  }
}
