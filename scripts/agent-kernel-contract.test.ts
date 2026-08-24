import assert from "node:assert/strict"
import test from "node:test"
import { ScriptedModel, assistantMessage, functionCall, modelStream } from "@openai/agents-core/testing"
import { tool, type ModelProvider } from "@openai/agents"
import { z } from "zod"
import { runAgentKernel } from "../src/lib/agent/kernel/runner"
import { defaultAgentKernelCapabilities } from "../src/lib/agent/kernel/contracts"
import type { ResolvedAiProviderConfig } from "../src/lib/ai/settings"
import { createAgentTraceRecorder } from "../src/lib/agent/trace"

const config = {
  providerId: "openai-compatible",
  baseUrl: "https://provider.example/v1",
  model: "kernel-test",
  visionModel: "kernel-test-vision",
  visionCapability: "none",
  apiKey: "test-key",
} as unknown as ResolvedAiProviderConfig

function providerFor(model: ScriptedModel): ModelProvider {
  return { getModel: () => model }
}

test("AgentKernel uses the SDK stream and forwards only answer text deltas", async () => {
  const model = new ScriptedModel([
    modelStream([
      { type: "output_text_delta", delta: "你" },
      { type: "output_text_delta", delta: "好" },
      {
        type: "response_done",
        response: {
          id: "response-1",
          usage: { inputTokens: 2, outputTokens: 2, totalTokens: 4 },
          output: [{
            type: "message",
            role: "assistant",
            status: "completed",
            content: [{ type: "output_text", text: "你好" }],
          }],
        },
      },
    ]),
  ])
  const deltas: string[] = []
  const result = await runAgentKernel({
    config,
    instructions: "只回答中文。",
    messages: [{ role: "user", content: "之前的问题" }],
    message: "现在回答",
    modelProvider: providerFor(model),
    capabilities: { stream: true, toolCalls: false },
    onTextDelta: (delta) => { deltas.push(delta) },
  })

  assert.equal(result.text, "你好")
  assert.equal(result.streamed, true)
  assert.equal(result.mode, "single-turn")
  assert.deepEqual(deltas, ["你", "好"])
  assert.equal(model.calls.length, 1)
  assert.equal(model.calls[0]?.streamed, true)
})

test("AgentKernel makes provider fallback explicit when streaming is unavailable", async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>
    assert.equal(body.stream, undefined)
    return Response.json({ choices: [{ message: { content: "完整回答" } }] })
  }

  try {
    const deltas: string[] = []
    const result = await runAgentKernel({
      config,
      instructions: "只回答中文。",
      messages: [],
      message: "回答",
      capabilities: { stream: false, toolCalls: false },
      onTextDelta: (delta) => { deltas.push(delta) },
    })
    assert.equal(result.text, "完整回答")
    assert.equal(result.streamed, false)
    assert.equal(result.mode, "fallback")
    assert.deepEqual(deltas, ["完整回答"])
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("AgentKernel runs a registered tool loop and records canonical tool Trace", async () => {
  let executions = 0
  const fixtureTool = tool({
    name: "read_fixture",
    description: "读取测试夹具",
    parameters: z.object({}),
    execute: async () => {
      executions += 1
      return "fixture-value-must-not-enter-trace"
    },
  })
  const model = new ScriptedModel([
    modelStream([
      {
        type: "response_done",
        response: {
          id: "response-tool",
          usage: { inputTokens: 2, outputTokens: 1, totalTokens: 3 },
          output: [functionCall("read_fixture", {}, { callId: "call-1" })],
        },
      },
    ]),
    modelStream([
      { type: "output_text_delta", delta: "工具后" },
      { type: "output_text_delta", delta: "答案" },
      {
        type: "response_done",
        response: {
          id: "response-answer",
          usage: { inputTokens: 3, outputTokens: 2, totalTokens: 5 },
          output: [assistantMessage("工具后答案")],
        },
      },
    ]),
  ])
  const trace = createAgentTraceRecorder()
  const result = await runAgentKernel({
    config,
    instructions: "需要时使用工具。",
    messages: [],
    message: "读取夹具并回答",
    modelProvider: providerFor(model),
    capabilities: { stream: true, toolCalls: true },
    tools: [fixtureTool],
    context: {},
    trace,
    maxTurns: 3,
  })

  const events = trace.snapshot()
  const started = events.find((event) => event.eventType === "tool.started")
  const completed = events.find((event) => event.eventType === "tool.result")
  assert.equal(result.text, "工具后答案")
  assert.equal(result.mode, "autonomous")
  assert.equal(result.streamed, true)
  assert.equal(result.turns, 2)
  assert.equal(executions, 1)
  assert.equal(started?.toolName, "read_fixture")
  assert.equal(completed?.toolName, "read_fixture")
  assert.equal(completed?.parentId, started?.eventId)
  assert.equal(events.some((event) => event.safeSummary?.includes("fixture-value")), false)
  assert.equal(model.calls.length, 2)
  assert.equal(model.calls[0]?.streamed, true)
  assert.equal(model.calls[1]?.streamed, true)
})

test("AgentKernel keeps tool failures visible instead of disguising them as provider fallback", async () => {
  const failingTool = tool({
    name: "read_fixture",
    description: "读取测试夹具",
    parameters: z.object({}),
    outputSchema: z.object({ value: z.string() }),
    errorFunction: null,
    execute: async () => {
      throw new Error("fixture tool failed")
    },
  })
  const model = new ScriptedModel([
    modelStream([
      {
        type: "response_done",
        response: {
          id: "response-tool-failure",
          usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          output: [functionCall("read_fixture", {}, { callId: "call-failure" })],
        },
      },
    ]),
  ])
  const trace = createAgentTraceRecorder()

  await assert.rejects(
    () => runAgentKernel({
      config,
      instructions: "需要时使用工具。",
      messages: [],
      message: "读取夹具",
      modelProvider: providerFor(model),
      capabilities: { stream: true, toolCalls: true },
      tools: [failingTool],
      context: {},
      trace,
      maxTurns: 2,
    }),
    /fixture tool failed/,
  )
  const events = trace.snapshot()
  const started = events.find((event) => event.eventType === "tool.started")
  const failed = events.find((event) => event.eventType === "tool.result")
  assert.equal(started?.toolName, "read_fixture")
  assert.equal(failed?.status, "failed")
  assert.equal(failed?.parentId, started?.eventId)
})

test("AgentKernel defaults to a non-autonomous capability gate", () => {
  assert.deepEqual(defaultAgentKernelCapabilities(), { stream: true, toolCalls: false })
})
