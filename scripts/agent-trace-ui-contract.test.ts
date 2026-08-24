import assert from "node:assert/strict"
import test from "node:test"
import { projectTraceEvents } from "../src/components/agent/agent-trace-panel"
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

test("Trace UI projects live event order and tool parentage without inventing steps", () => {
  const events = [
    event({ eventType: "model.delta", status: "running", label: "模型返回增量", sequence: 4, parentId: "model" }),
    event({ eventType: "tool.result", status: "completed", label: "调用 read_custom_source", sequence: 3, parentId: "tool", toolName: "read_custom_source" }),
    event({ eventType: "run.started", status: "running", label: "开始 Agent 回合", sequence: 0 }),
    event({ eventType: "tool.started", status: "running", label: "调用 read_custom_source", sequence: 2, eventId: "tool", toolName: "read_custom_source" }),
    event({ eventType: "model.delta", status: "running", label: "模型返回增量", sequence: 5, parentId: "model" }),
    event({ eventType: "answer.delta", status: "running", label: "答案增量", sequence: 6, parentId: "model" }),
  ]

  const defaultView = projectTraceEvents(events, false)
  assert.deepEqual(defaultView.map((item) => item.eventType), ["run.started", "tool.started", "tool.result", "answer.delta"])
  assert.equal(defaultView[1]?.toolName, "read_custom_source")
  assert.equal(defaultView[2]?.parentId, "tool")
  assert.equal(defaultView.some((item) => item.eventType === "model.delta"), false)

  const technicalView = projectTraceEvents(events, true)
  const modelDelta = technicalView.find((item) => item.eventType === "model.delta")
  assert.equal(modelDelta?.deltaCount, 2)
  assert.deepEqual(technicalView.map((item) => item.sequence), [0, 2, 3, 5, 6])
})
