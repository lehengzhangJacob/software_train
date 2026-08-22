import assert from "node:assert/strict"
import test from "node:test"

import { requestAiChatCompletionStream } from "../src/lib/ai/client"
import { projectAssistantVisibleText } from "../src/lib/agent/contracts"
import type { ResolvedAiProviderConfig } from "../src/lib/ai/settings"

const config = {
  providerId: "openai-compatible",
  baseUrl: "https://provider.example/v1",
  model: "trace-test",
  visionModel: "trace-test-vision",
  visionCapability: "none",
} as unknown as ResolvedAiProviderConfig

test("streaming answer projection holds complete and partial internal markers", () => {
  assert.equal(projectAssistantVisibleText("建议先做热身<exercise-"), "建议先做热身")
  assert.equal(projectAssistantVisibleText("建议先做热身<exercise-plan>"), "建议先做热身")
  assert.equal(projectAssistantVisibleText("先记录偏好<memory-candidates>["), "先记录偏好")
  assert.equal(projectAssistantVisibleText("普通回答"), "普通回答")
})

test("OpenAI-compatible SSE parser forwards actual answer deltas in order", async () => {
  const originalFetch = globalThis.fetch
  const encoder = new TextEncoder()
  globalThis.fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>
    assert.equal(body.stream, true)
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"你"}}]}\n\n'))
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"好"}}]}\n\n'))
        controller.enqueue(encoder.encode("data: [DONE]\n\n"))
        controller.close()
      },
    })
    return new Response(stream, { headers: { "content-type": "text/event-stream" } })
  }

  try {
    const deltas: string[] = []
    const result = await requestAiChatCompletionStream(config, { messages: [] }, (delta) => {
      deltas.push(delta)
    })
    assert.equal(result.streamed, true)
    assert.equal(result.text, "你好")
    assert.deepEqual(deltas, ["你", "好"])
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("reasoning deltas stay private while answer content still streams", async () => {
  const originalFetch = globalThis.fetch
  const encoder = new TextEncoder()
  globalThis.fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>
    assert.equal(body.reasoning_effort, "low")
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"reasoning":"不可展示的推理"}}]}\n\n'))
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"<exercise-plan>"}}]}\n\n'))
        controller.enqueue(encoder.encode("data: [DONE]\n\n"))
        controller.close()
      },
    })
    return new Response(stream, { headers: { "content-type": "text/event-stream" } })
  }

  try {
    const deltas: string[] = []
    const result = await requestAiChatCompletionStream(
      config,
      { messages: [], reasoning_effort: "low" },
      (delta) => {
        deltas.push(delta)
      },
    )
    assert.equal(result.text, "<exercise-plan>")
    assert.deepEqual(deltas, ["<exercise-plan>"])
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("non-streaming providers are explicit fallback responses", async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async (_input, init) => {
    const body = JSON.parse(String(init?.body)) as Record<string, unknown>
    assert.equal(body.stream, true)
    return Response.json({ choices: [{ message: { content: "完整答案" } }] })
  }

  try {
    const result = await requestAiChatCompletionStream(config, { messages: [] })
    assert.equal(result.streamed, false)
    assert.equal(result.text, "完整答案")
  } finally {
    globalThis.fetch = originalFetch
  }
})
