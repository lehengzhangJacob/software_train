import assert from "node:assert/strict"
import test from "node:test"

import { requestAiChatCompletionStream } from "../src/lib/ai/client"
import type { ResolvedAiProviderConfig } from "../src/lib/ai/settings"

const config = {
  providerId: "openai-compatible",
  baseUrl: "https://provider.example/v1",
  model: "trace-test",
  visionModel: "trace-test-vision",
  visionCapability: "none",
} as unknown as ResolvedAiProviderConfig

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
