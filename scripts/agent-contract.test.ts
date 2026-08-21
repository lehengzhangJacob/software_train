import assert from "node:assert/strict"
import test from "node:test"
import {
  extractAssistantResponse,
  parseAgentChatInput,
  parseAgentMemoryConfirmationInput,
  parseAgentMessageMetadata,
} from "../src/lib/agent/contracts"
import { hasExplicitOrderingIntent } from "../src/lib/agent/ordering-intent"
import { classifyAction, issueOrderingGrant } from "../src/lib/actions/policy"
import { createAgentActivityRecorder, getRunningActivityLabel } from "../src/lib/agent/activity"
import {
  buildAgentDateInstruction,
  filterEligibleMemories,
  redactSuppressedMemoryContent,
} from "../src/lib/agent/context-safety"

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

test("metadata memory ids round-trip and accept legacy confirmation ids", () => {
  const parsed = parseAgentMessageMetadata(JSON.stringify({
    memoryCandidates: [{ category: "goal", content: "本周想规律吃早餐", importance: 0.7, confidence: 0.8 }],
    confirmedMemoryIds: { "0": 4, "bad": "nope" },
    memoryIds: { "1": 5, "bad": -2 },
    usedMemoryIds: [1, 2, "bad"],
    apiKey: "must-not-survive",
  }))
  assert.deepEqual(parsed.memoryIds, { "0": 4, "1": 5 })
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

test("ordering intent fires only for explicit current mcdonald requests", () => {
  const positives = [
    "帮我点份麦当劳",
    "来一份巨无霸套餐",
    "我要点麦当劳外卖",
    "给我来个麦辣鸡腿堡",
    "中午帮我订个麦当劳",
    "麦当劳直接点个套餐吧",
    "昨天点过板烧，今天再帮我点一次",
  ]
  for (const message of positives) assert.equal(hasExplicitOrderingIntent(message), true, message)

  const negatives = [
    "麦当劳的汉堡健康吗",
    "我饿了",
    "麦当劳热量高吗",
    "在麦当劳点餐要注意什么",
    "怎么点麦当劳外卖更划算",
    "麦当劳点餐攻略",
    "你上次说的那个订单呢",
    "我想吃麦当劳",
    "帮我点份肯德基",
    "先不点麦当劳了",
    "已经点过了，不用再点",
    "",
  ]
  for (const message of negatives) assert.equal(hasExplicitOrderingIntent(message), false, message)
})

test("ordering grant requires explicit intent and allows one unpaid order per request", () => {
  assert.throws(() => issueOrderingGrant(false), /明确点餐意图/)
  const grant = issueOrderingGrant(hasExplicitOrderingIntent("帮我点份麦当劳"))
  grant.claimCreateOrder()
  assert.throws(() => grant.claimCreateOrder(), /最多创建一笔/)
})

test("mcdonald order-chain tools map to the right action classes", () => {
  assert.equal(classifyAction("create-order"), "external_write")
  assert.equal(classifyAction("calculate-price"), "draft")
  assert.equal(classifyAction("query-meals"), "read")
  assert.equal(classifyAction("query-order"), "read")
})

test("agent activity recorder merges updates and redacts credentials", async () => {
  const recorder = createAgentActivityRecorder()
  await recorder.emit({
    activityId: "tool-1",
    kind: "tool",
    label: "Read menu",
    toolName: "query-meals",
    status: "running",
    startedAt: "2026-08-18T00:00:00.000Z",
  })
  await recorder.emit({
    activityId: "tool-1",
    kind: "tool",
    label: "Read menu",
    toolName: "query-meals",
    status: "completed",
    startedAt: "2026-08-18T00:00:00.000Z",
    finishedAt: "2026-08-18T00:00:00.120Z",
    durationMs: 120,
    detail: "Bearer test-secret-value",
  })

  assert.deepEqual(recorder.snapshot(), [
    {
      activityId: "tool-1",
      kind: "tool",
      label: "Read menu",
      toolName: "query-meals",
      status: "completed",
      startedAt: "2026-08-18T00:00:00.000Z",
      finishedAt: "2026-08-18T00:00:00.120Z",
      durationMs: 120,
      detail: "[credential redacted]",
    },
  ])
})

test("agent context excludes disabled or expired memories and redacts suppressed history", () => {
  const now = new Date("2026-08-21T12:00:00.000Z")
  const eligible = filterEligibleMemories([
    { status: "active", expiresAt: null, content: "keep" },
    { status: "disabled", expiresAt: null, content: "disabled" },
    { status: "active", expiresAt: new Date("2026-08-21T11:59:59.000Z"), content: "expired" },
  ], now)
  assert.deepEqual(eligible.map((memory) => memory.content), ["keep"])
  assert.equal(
    redactSuppressedMemoryContent("用户说过 disabled，摘要里也有 disabled。", ["disabled"]),
    "用户说过 [已停用记忆已移除]，摘要里也有 [已停用记忆已移除]。",
  )
  assert.equal(
    buildAgentDateInstruction("2026-08-21"),
    "应用今天的本地日期：2026-08-21。所有“今天/昨天/明天”等相对日期都以此为基准。",
  )
})

test("agent waiting copy follows the currently running activity", () => {
  assert.equal(
    getRunningActivityLabel([
      { activityId: "context", kind: "context", label: "整理上下文", status: "completed", startedAt: "2026-08-21T12:00:00.000Z" },
      { activityId: "model", kind: "model", label: "生成建议", status: "running", startedAt: "2026-08-21T12:00:01.000Z" },
    ]),
    "生成建议",
  )
})
