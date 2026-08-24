import assert from "node:assert/strict"
import test from "node:test"
import { ScriptedModel, modelStream } from "@openai/agents-core/testing"
import type { ModelProvider } from "@openai/agents"
import { runAgentKernel } from "../src/lib/agent/kernel/runner"
import { defaultAgentKernelCapabilities } from "../src/lib/agent/kernel/contracts"
import type { ResolvedAiProviderConfig } from "../src/lib/ai/settings"

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

test("AgentKernel defaults to a non-autonomous capability gate", () => {
  assert.deepEqual(defaultAgentKernelCapabilities(), { stream: true, toolCalls: false })
})
