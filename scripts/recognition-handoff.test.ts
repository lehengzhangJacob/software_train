import assert from "node:assert/strict"
import test from "node:test"
import {
  beginRecognitionHandoff,
  consumeRecognitionHandoff,
  publishRecognitionHandoff,
  RECOGNITION_HANDOFF_KEY,
  type RecognitionHandoffStorage,
} from "../src/lib/food/recognition-handoff"

function createStorage(): RecognitionHandoffStorage {
  let value: string | null = null
  return {
    getItem: () => value,
    setItem: (_key, next) => { value = next },
    removeItem: () => { value = null },
  }
}

const foods = [
  {
    name: "鸡蛋",
    calories: 120,
    protein: 10,
    fat: 8,
    carbs: 1,
    portion: "2 个",
    confidence: 0.94,
  },
]

test("recognition handoff is session-scoped and consumed exactly once", () => {
  const storage = createStorage()
  assert.equal(beginRecognitionHandoff("request-a", storage, 1_000), true)
  assert.equal(publishRecognitionHandoff("request-a", foods, storage, 2_000), true)
  assert.deepEqual(consumeRecognitionHandoff(storage, 3_000), foods)
  assert.equal(consumeRecognitionHandoff(storage, 3_001), null)
})

test("a late recognition response cannot overwrite a newer request", () => {
  const storage = createStorage()
  beginRecognitionHandoff("request-a", storage, 1_000)
  beginRecognitionHandoff("request-b", storage, 2_000)
  assert.equal(publishRecognitionHandoff("request-a", foods, storage, 3_000), false)
  assert.equal(publishRecognitionHandoff("request-b", foods, storage, 4_000), true)
  assert.deepEqual(consumeRecognitionHandoff(storage, 5_000), foods)
})

test("handoff rejects image-bearing or malformed candidates and expires stale payloads", () => {
  const storage = createStorage()
  beginRecognitionHandoff("request-a", storage, 1_000)
  assert.equal(
    publishRecognitionHandoff("request-a", [{ ...foods[0], portion: "data:image/png;base64,abc" }], storage, 2_000),
    false,
  )
  storage.setItem(RECOGNITION_HANDOFF_KEY, JSON.stringify({
    version: 1,
    requestId: "request-a",
    status: "ready",
    createdAt: 1_000,
    foods,
  }))
  assert.equal(consumeRecognitionHandoff(storage, 10 * 60 * 1_000 + 1_001), null)
})
