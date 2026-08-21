import assert from "node:assert/strict"
import test from "node:test"

import { parseAppVersionPayload, shouldPromptForUpdate } from "../src/lib/app-update-shared"

test("version payload parser accepts the public envelope and rejects malformed data", () => {
  const payload = parseAppVersionPayload({
    data: {
      version: "0.1.0",
      build: "build-a",
      releaseUrl: "https://example.com/release",
      androidReleaseUrl: "https://example.com/android",
    },
    error: null,
  })

  assert.deepEqual(payload, {
    version: "0.1.0",
    build: "build-a",
    releaseUrl: "https://example.com/release",
    androidReleaseUrl: "https://example.com/android",
  })
  assert.equal(parseAppVersionPayload({ data: null, error: "bad" }), null)
  assert.equal(parseAppVersionPayload({ data: { version: "0.1.0" }, error: null }), null)
})

test("update prompt only appears when the build id changes", () => {
  assert.equal(shouldPromptForUpdate("build-a", "build-a"), false)
  assert.equal(shouldPromptForUpdate("build-a", "build-b"), true)
  assert.equal(shouldPromptForUpdate("", "build-b"), false)
})
