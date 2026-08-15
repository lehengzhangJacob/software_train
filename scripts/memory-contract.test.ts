import assert from "node:assert/strict"
import test from "node:test"
import {
  isMemoryEligible,
  MemoryValidationError,
  parseMemoryCreateInput,
  parseMemoryUpdateInput,
} from "../src/lib/memory/contracts"

const now = new Date("2026-08-15T12:00:00.000Z")

test("manual memory input is normalized and server-owned fields are ignored", () => {
  const parsed = parseMemoryCreateInput({
    category: "preference",
    content: "  更喜欢清淡的晚餐  ",
    importance: 0.8,
    expiresAt: "2026-09-01T00:00:00.000Z",
    userId: 999,
    sourceKind: "agent_inference",
  }, now)

  assert.deepEqual(parsed, {
    category: "preference",
    content: "更喜欢清淡的晚餐",
    importance: 0.8,
    expiresAt: new Date("2026-09-01T00:00:00.000Z"),
  })
})

test("memory content rejects credentials and image payloads", () => {
  for (const content of [
    "API Key = local-test-secret-value",
    "Bearer abcdefghijklmnopqrstuvwxyz",
    "data:image/png;base64,abcdef",
  ]) {
    assert.throws(
      () => parseMemoryCreateInput({ category: "context", content }, now),
      MemoryValidationError
    )
  }
})

test("updates require an owned field and support reversible disable or expiry clearing", () => {
  assert.throws(() => parseMemoryUpdateInput({ memoryId: 1 }, now), /没有可更新/)
  assert.deepEqual(parseMemoryUpdateInput({ memoryId: 3, status: "disabled", expiresAt: null }, now), {
    memoryId: 3,
    status: "disabled",
    expiresAt: null,
  })
})

test("retrieval excludes disabled and expired memories", () => {
  assert.equal(isMemoryEligible({ status: "active", expiresAt: null }, now), true)
  assert.equal(isMemoryEligible({ status: "disabled", expiresAt: null }, now), false)
  assert.equal(isMemoryEligible({ status: "active", expiresAt: new Date("2026-08-15T11:59:59.000Z") }, now), false)
  assert.equal(isMemoryEligible({ status: "active", expiresAt: new Date("2026-08-15T12:00:01.000Z") }, now), true)
})
