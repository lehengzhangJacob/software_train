import assert from "node:assert/strict"
import test from "node:test"
import {
  extractAssistantResponse,
  parseAgentChatInput,
  parseAgentMemoryConfirmationInput,
  parseAgentMessageMetadata,
} from "../src/lib/agent/contracts"

test("agent chat input rejects credentials and normalizes a message", () => {
  assert.deepEqual(parseAgentChatInput({ message: "  今天晚餐怎么吃？  " }), {
    threadId: null,
    message: "今天晚餐怎么吃？",
  })
  assert.throws(() => parseAgentChatInput({ message: "API Key = local-secret-value" }), /不能包含/)
})

test("assistant response separates safe memory candidates from visible text", () => {
  const parsed = extractAssistantResponse(
    "建议晚餐增加一份蔬菜。\n<memory-candidates>[{\"category\":\"preference\",\"content\":\"工作日晚餐希望清淡一些\",\"importance\":0.8,\"confidence\":0.75}]</memory-candidates>"
  )
  assert.equal(parsed.visibleText, "建议晚餐增加一份蔬菜。")
  assert.equal(parsed.candidates.length, 1)
  assert.equal(parsed.candidates[0].category, "preference")
})

test("metadata confirmation state round-trips without exposing unknown fields", () => {
  const parsed = parseAgentMessageMetadata(JSON.stringify({
    memoryCandidates: [{ category: "goal", content: "本周想规律吃早餐", importance: 0.7, confidence: 0.8 }],
    confirmedMemoryIds: { "0": 4, "bad": "nope" },
    usedMemoryIds: [1, 2, "bad"],
    apiKey: "must-not-survive",
  }))
  assert.deepEqual(parsed.confirmedMemoryIds, { "0": 4 })
  assert.deepEqual(parsed.usedMemoryIds, [1, 2])
  assert.equal(parsed.memoryCandidates?.[0].content, "本周想规律吃早餐")
  assert.equal("apiKey" in parsed, false)
})

test("memory confirmation input is bounded to the candidate slots", () => {
  assert.deepEqual(parseAgentMemoryConfirmationInput({ messageId: 3, candidateIndex: 2 }), {
    messageId: 3,
    candidateIndex: 2,
  })
  assert.throws(() => parseAgentMemoryConfirmationInput({ messageId: 3, candidateIndex: 3 }), /序号无效/)
})
