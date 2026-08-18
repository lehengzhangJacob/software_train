import assert from "node:assert/strict"
import test from "node:test"

import {
  ACCESS_COOKIE,
  constantTimeEqualHex,
  decideAccess,
  digestAccessCode,
} from "../src/lib/access/gate"
import { resetAttempts, takeAttempt } from "../src/lib/access/rate-limit"

test("decideAccess: gate disabled allows everything", () => {
  assert.equal(decideAccess("/dashboard", false, false), "allow")
  assert.equal(decideAccess("/api/users", false, false), "allow")
})

test("decideAccess: unauthenticated page goes to gate page", () => {
  assert.equal(decideAccess("/", false, true), "gate-page")
  assert.equal(decideAccess("/dashboard", false, true), "gate-page")
  assert.equal(decideAccess("/agent", false, true), "gate-page")
})

test("decideAccess: unauthenticated API returns 401 semantics", () => {
  assert.equal(decideAccess("/api/users", false, true), "unauthorized-api")
  assert.equal(decideAccess("/api/agent", false, true), "unauthorized-api")
  assert.equal(decideAccess("/api/agent/threads", false, true), "unauthorized-api")
})

test("decideAccess: gate surfaces stay reachable when unauthenticated", () => {
  assert.equal(decideAccess("/access", false, true), "allow")
  assert.equal(decideAccess("/api/auth/verify", false, true), "allow")
})

test("decideAccess: authed requests pass everywhere", () => {
  assert.equal(decideAccess("/api/users", true, true), "allow")
  assert.equal(decideAccess("/dashboard", true, true), "allow")
})

test("digestAccessCode: stable 64-char hex, differs per code", async () => {
  const a = await digestAccessCode("hunter2")
  const b = await digestAccessCode("hunter2")
  const c = await digestAccessCode("hunter3")
  assert.match(a, /^[0-9a-f]{64}$/)
  assert.equal(a, b)
  assert.notEqual(a, c)
})

test("constantTimeEqualHex: only equal 64-hex digests pass", async () => {
  const digest = await digestAccessCode("secret-code")
  assert.equal(constantTimeEqualHex(digest, digest), true)
  assert.equal(constantTimeEqualHex(digest, "0".repeat(64)), false)
  assert.equal(constantTimeEqualHex(digest, "short"), false)
  // raw access code (not a digest) must never validate
  assert.equal(constantTimeEqualHex("secret-code", digest), false)
})

test("rate limit: 10 attempts per window then blocked, reset clears", () => {
  const key = `test-${Date.now()}`
  for (let i = 0; i < 10; i += 1) {
    assert.equal(takeAttempt(key, 1_000_000).allowed, true)
  }
  const blocked = takeAttempt(key, 1_000_001)
  assert.equal(blocked.allowed, false)
  assert.ok(blocked.retryAfterSeconds > 0)
  resetAttempts(key)
  assert.equal(takeAttempt(key, 1_000_002).allowed, true)
})

test("cookie name is the documented shared constant", () => {
  assert.equal(ACCESS_COOKIE, "ft_access")
})
