import assert from "node:assert/strict"
import test from "node:test"

import {
  AGENT_TRACE_VERSION,
  assertTraceSequence,
  isAgentTraceEvent,
  sanitizeTraceSummary,
  sanitizeTraceText,
  type AgentTraceEvent,
} from "../src/lib/agent/trace-contract"

function event(sequence: number, extra: Partial<AgentTraceEvent> = {}): AgentTraceEvent {
  return {
    version: AGENT_TRACE_VERSION,
    traceId: "trace-1",
    runId: "run-1",
    eventId: `event-${sequence}`,
    sequence,
    occurredAt: "2026-08-22T00:00:00.000Z",
    eventType: "step.started",
    status: "running",
    label: "读取营养档案",
    ...extra,
  }
}

test("Trace event envelope accepts safe fields and rejects malformed fields", () => {
  assert.equal(isAgentTraceEvent(event(0)), true)
  assert.equal(
    isAgentTraceEvent({ ...event(0), eventType: "tool.started", toolName: "query-meals" }),
    true,
  )
  assert.equal(isAgentTraceEvent({ ...event(0), sequence: 0.5 }), false)
  assert.equal(isAgentTraceEvent({ ...event(0), eventType: "tool.started", toolName: 42 }), false)
  assert.equal(isAgentTraceEvent({ ...event(0), durationMs: -1 }), false)
})

test("Trace sequence is strictly increasing for one run", () => {
  assert.doesNotThrow(() => assertTraceSequence([event(0), event(1), event(2)]))
  assert.throws(() => assertTraceSequence([event(0), event(0)]), /strictly increasing/)
  assert.throws(() => assertTraceSequence([event(1), event(0)]), /strictly increasing/)
})

test("safe summaries redact secrets, URLs, payment links and remain bounded", () => {
  const summary = sanitizeTraceSummary(
    "token=abc123; paymentUrl=https://pay.example/secret; context\nready",
  )
  assert.equal(summary, "[redacted]; [redacted] context ready")
  assert.equal(sanitizeTraceSummary("   \n\t"), undefined)
  assert.equal(sanitizeTraceSummary("x".repeat(240))?.length, 180)
})

test("Trace events do not expose raw input/output fields", () => {
  const safe = event(0)
  assert.equal("input" in safe, false)
  assert.equal("output" in safe, false)
  assert.equal("reasoning" in safe, false)
})

test("answer deltas redact URLs and credentials before leaving the trace boundary", () => {
  assert.equal(sanitizeTraceText("参考 https://example.com；token=secret"), "参考 [redacted]")
})
