import assert from "node:assert/strict"
import test from "node:test"
import { AGENT_OFF_TOPIC_REPLY, classifyAgentIntent } from "../src/lib/agent/policy/intent"

test("Warhammer is handled as an explicit off-topic request without search", () => {
  const decision = classifyAgentIntent("战锤40K这个IP的历史有多少年了？")
  assert.equal(decision.intent, "off-topic")
  assert.equal(decision.inScope, false)
  assert.equal(decision.requiresWebSearch, false)
  assert.equal(decision.safeReply, AGENT_OFF_TOPIC_REPLY)
})

test("a themed workout remains in scope when the user provides a coaching bridge", () => {
  const decision = classifyAgentIntent("用战锤40K主题帮我设计一个训练激励")
  assert.equal(decision.intent, "fitness")
  assert.equal(decision.inScope, true)
})

test("fitness and recovery requests stay in the coaching domain", () => {
  assert.equal(classifyAgentIntent("我最近俯卧撑怎么安排").intent, "fitness")
  assert.equal(classifyAgentIntent("昨晚睡不好，今天怎么恢复").intent, "recovery")
})

test("current nutrition research asks for web search while personal advice does not", () => {
  const current = classifyAgentIntent("查一下最新的蛋白质摄入指南")
  assert.equal(current.intent, "current-research")
  assert.equal(current.requiresWebSearch, true)

  const personal = classifyAgentIntent("我今天晚餐怎么吃")
  assert.equal(personal.intent, "nutrition")
  assert.equal(personal.requiresWebSearch, false)
})

test("ambiguous messages remain eligible for a clarifying Agent reply", () => {
  const decision = classifyAgentIntent("你好")
  assert.equal(decision.intent, "ambiguous")
  assert.equal(decision.inScope, true)
  assert.equal(decision.requiresWebSearch, false)
})
