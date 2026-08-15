import assert from "node:assert/strict"
import test from "node:test"
import { providerFailureForStatus } from "../src/lib/ai/errors"
import {
  applyAiSettingsUpdate,
  createDefaultAiSettings,
  maskApiKey,
  parseAiSettingsUpdate,
} from "../src/lib/ai/settings-contract"

test("blank API Key preserves an existing local credential", () => {
  const initial = applyAiSettingsUpdate(
    createDefaultAiSettings(),
    parseAiSettingsUpdate({
      providerId: "openai",
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-4.1-mini",
      apiKey: "local-test-value-1234",
    }),
    "2026-08-15T00:00:00.000Z"
  )
  const updated = applyAiSettingsUpdate(
    initial,
    parseAiSettingsUpdate({
      providerId: "openai",
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-4.1-mini",
      apiKey: "",
    }),
    "2026-08-15T00:01:00.000Z"
  )

  assert.equal(updated.providers.openai?.apiKey, "local-test-value-1234")
})

test("explicit clear removes a local credential without changing the selected provider", () => {
  const initial = applyAiSettingsUpdate(
    createDefaultAiSettings(),
    parseAiSettingsUpdate({
      providerId: "stepfun",
      baseUrl: "https://api.stepfun.com/v1",
      model: "step-3.7-flash",
      apiKey: "step-secret-5678",
    })
  )
  const cleared = applyAiSettingsUpdate(
    initial,
    parseAiSettingsUpdate({
      providerId: "stepfun",
      baseUrl: "https://api.stepfun.com/v1",
      model: "step-3.7-flash",
      clearApiKey: true,
    })
  )

  assert.equal(cleared.activeProvider, "stepfun")
  assert.equal(cleared.providers.stepfun?.apiKey, null)
})

test("rejects unsafe endpoints and invalid model names", () => {
  assert.throws(
    () => parseAiSettingsUpdate({ providerId: "custom", baseUrl: "http://example.com/v1", model: "demo" }),
    /Base URL/
  )
  assert.throws(
    () => parseAiSettingsUpdate({ providerId: "custom", baseUrl: "https://example.com/v1", model: "not a model" }),
    /模型名称/
  )
})

test("credential display and provider failures remain sanitized", () => {
  const masked = maskApiKey("local-test-value-1234")
  assert.equal(masked, "••••1234")
  assert.equal(masked.includes("local-secret"), false)
  assert.equal(providerFailureForStatus(401).message.includes("secret"), false)
  assert.equal(providerFailureForStatus(429).message, "AI 提供商请求过于频繁或余额不足")
})
