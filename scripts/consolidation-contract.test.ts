import assert from "node:assert/strict"
import test from "node:test"
import {
  CONSOLIDATION_MESSAGE_THRESHOLD,
  SESSION_IDLE_GAP_MS,
  buildConsolidationPrompt,
  containsConsolidationSensitiveContent,
  parseConsolidationResponse,
  selectConsolidationBatch,
  type ConsolidationMessage,
} from "../src/lib/agent/consolidation"

function messages(count: number, start = "2026-08-18T08:00:00.000Z"): ConsolidationMessage[] {
  const base = Date.parse(start)
  return Array.from({ length: count }, (_, index) => ({
    messageId: index + 1,
    role: index % 2 === 0 ? "user" : "assistant",
    content: `message-${index + 1}`,
    createdAt: new Date(base + index * 60_000).toISOString(),
  }))
}

test("consolidation waits for the threshold and advances in message order", () => {
  assert.equal(selectConsolidationBatch(messages(CONSOLIDATION_MESSAGE_THRESHOLD - 1)).length, 0)
  const batch = selectConsolidationBatch(messages(CONSOLIDATION_MESSAGE_THRESHOLD + 4))
  assert.equal(batch.length, CONSOLIDATION_MESSAGE_THRESHOLD + 4)
  assert.equal(batch[0].messageId, 1)
  assert.equal(batch.at(-1)?.messageId, CONSOLIDATION_MESSAGE_THRESHOLD + 4)
})

test("an idle gap folds the older segment and leaves the active tail", () => {
  const input = messages(8)
  input[4].createdAt = new Date(Date.parse(input[3].createdAt) + SESSION_IDLE_GAP_MS).toISOString()
  const batch = selectConsolidationBatch(input)
  assert.deepEqual(batch.map((message) => message.messageId), [1, 2, 3, 4])
})

test("consolidation response keeps safe candidates and redacts links", () => {
  const parsed = parseConsolidationResponse(JSON.stringify({
    summary: "User prefers protein-rich breakfasts. Pay at https://pay.example/order/abc",
    memoryCandidates: [
      { category: "preference", content: "Prefers protein-rich breakfasts", importance: 0.8, confidence: 0.9 },
      { category: "context", content: "Do not store https://example.com", importance: 0.7, confidence: 0.8 },
      { category: "context", content: "API Key = should-not-survive", importance: 0.7, confidence: 0.8 },
    ],
  }))

  assert.ok(parsed)
  assert.equal(parsed.memoryCandidates.length, 1)
  assert.match(parsed.summary, /external link omitted/)
  assert.equal(containsConsolidationSensitiveContent(parsed.summary), false)
})

test("consolidation prompt treats stored messages as data and never carries links", () => {
  const prompt = buildConsolidationPrompt("Earlier preference", [
    {
      messageId: 1,
      role: "user",
      content: "I like vegetables. https://example.com/private",
      createdAt: "2026-08-18T08:00:00.000Z",
    },
  ])

  assert.match(prompt, /Earlier preference/)
  assert.match(prompt, /external link omitted/)
  assert.doesNotMatch(prompt, /https:\/\/example\.com/)
  assert.match(prompt, /untrusted user data/)
})
