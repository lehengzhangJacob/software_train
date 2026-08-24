import assert from "node:assert/strict"
import test from "node:test"
import { effectiveTraceStatus, projectTrace, projectTraceEvents } from "../src/lib/agent/trace-projection"
import type { AgentTraceEvent } from "../src/lib/agent/trace-contract"

function event(partial: Partial<AgentTraceEvent> & Pick<AgentTraceEvent, "eventType" | "status" | "label" | "sequence">): AgentTraceEvent {
  return {
    version: 1,
    traceId: "trace-ui",
    runId: "run-ui",
    eventId: `event-${partial.sequence}`,
    occurredAt: `2026-08-24T00:00:${String(partial.sequence).padStart(2, "0")}Z`,
    ...partial,
  }
}

test("Trace projection collapses logical spans, closes deltas and preserves first sequence order", () => {
  const events = [
    event({ eventType: "run.started", status: "running", label: "开始 Agent 回合", sequence: 0 }),
    event({ eventType: "step.started", status: "running", label: "读取资料", sequence: 1, eventId: "context" }),
    event({ eventType: "step.completed", status: "completed", label: "读取资料", sequence: 2, parentId: "context" }),
    event({ eventType: "tool.result", status: "completed", label: "调用 read_custom_source", sequence: 4, parentId: "tool", toolName: "read_custom_source" }),
    event({ eventType: "tool.started", status: "running", label: "调用 read_custom_source", sequence: 2, eventId: "tool", toolName: "read_custom_source" }),
    event({ eventType: "model.started", status: "running", label: "健康 Agent 生成建议", sequence: 3, eventId: "model" }),
    event({ eventType: "model.delta", status: "running", label: "模型返回增量", sequence: 5, parentId: "model" }),
    event({ eventType: "model.delta", status: "running", label: "模型返回增量", sequence: 6, parentId: "model" }),
    event({ eventType: "answer.delta", status: "running", label: "答案增量", sequence: 7, parentId: "model" }),
    event({ eventType: "step.completed", status: "completed", label: "健康 Agent 生成建议", sequence: 8, parentId: "model" }),
    event({ eventType: "step.started", status: "running", label: "保存 Agent 回复", sequence: 9, eventId: "save" }),
    event({ eventType: "step.completed", status: "completed", label: "保存 Agent 回复", sequence: 10, parentId: "save" }),
    event({ eventType: "run.completed", status: "completed", label: "Agent 回合完成", sequence: 11 }),
    event({ eventType: "answer.delta", status: "running", label: "答案增量", sequence: 12, parentId: "model" }),
  ]

  const projection = projectTrace(events)
  assert.equal(projection.status, "completed")
  assert.equal(projection.terminalSequence, 11)
  assert.deepEqual(projection.events.map((item) => item.eventType), [
    "step.started",
    "tool.started",
    "model.started",
    "model.delta",
    "answer.delta",
    "step.started",
  ])
  assert.deepEqual(projection.events.map((item) => item.firstSequence), [1, 2, 3, 5, 7, 9])
  assert.equal(projection.events.find((item) => item.eventType === "model.started")?.status, "completed")
  assert.equal(projection.events.find((item) => item.eventType === "model.delta")?.status, "completed")
  assert.equal(projection.events.find((item) => item.eventType === "answer.delta")?.status, "completed")
  assert.equal(projection.events.find((item) => item.eventType === "tool.started")?.toolName, "read_custom_source")
  assert.equal(projection.events.find((item) => item.eventType === "tool.started")?.lastSequence, 4)
  assert.equal(projection.events.find((item) => item.eventType === "model.delta")?.deltaCount, 2)

  const defaultView = projectTraceEvents(events, false)
  assert.equal(defaultView.some((item) => item.eventType === "model.delta"), false)
  assert.equal(defaultView.some((item) => item.eventType === "run.completed"), false)
  assert.ok(defaultView.length <= 5)
  assert.deepEqual(defaultView.map((item) => item.label), ["准备相关信息", "生成个性化建议", "保存本回合结果"])
})

test("friendly projection gives a real search span its own research phase", () => {
  const events = [
    event({ eventType: "run.started", status: "running", label: "开始 Agent 回合", sequence: 0 }),
    event({ eventType: "tool.started", status: "running", label: "调用 web_search", sequence: 1, eventId: "search", toolName: "web_search" }),
    event({ eventType: "tool.result", status: "completed", label: "调用 web_search", sequence: 2, parentId: "search", toolName: "web_search", safeSummary: "公开资料检索完成，共 2 条来源" }),
    event({ eventType: "model.started", status: "running", label: "健康 Agent 生成建议", sequence: 3, eventId: "model" }),
    event({ eventType: "step.completed", status: "completed", label: "健康 Agent 生成建议", sequence: 4, parentId: "model" }),
    event({ eventType: "run.completed", status: "completed", label: "Agent 回合完成", sequence: 5 }),
  ]
  const friendly = projectTraceEvents(events, false)
  assert.deepEqual(friendly.map((item) => item.label), ["检索公开资料", "生成个性化建议"])
  assert.equal(friendly[0]?.status, "completed")
})

test("active SSE keeps a terminal trace visibly in progress until done arrives", () => {
  const projection = projectTrace([
    event({ eventType: "run.started", status: "running", label: "开始 Agent 回合", sequence: 0 }),
    event({ eventType: "run.completed", status: "completed", label: "Agent 回合完成", sequence: 1 }),
  ])

  assert.equal(effectiveTraceStatus(projection, true), "running")
  assert.equal(effectiveTraceStatus(projection, false), "completed")

  const failed = projectTrace([
    event({ eventType: "run.started", status: "running", label: "开始 Agent 回合", sequence: 0 }),
    event({ eventType: "run.failed", status: "failed", label: "Agent 回合失败", sequence: 1 }),
  ])
  assert.equal(effectiveTraceStatus(failed, true), "failed")
})
