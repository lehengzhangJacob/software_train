import assert from "node:assert/strict"
import test from "node:test"

import { decideAccess } from "../src/lib/access/gate"
import { createSessionToken, digestToken, hashPassword, normalizeLogin, verifyPassword } from "../src/lib/auth/crypto"
import { shouldUseSecureAuthCookie } from "../src/lib/auth/cookie-policy"
import { parseLoginInput, parseRegisterInput, AuthValidationError } from "../src/lib/auth/validation"

test("account gate: local compatibility and cloud session boundary", () => {
  assert.equal(decideAccess("/dashboard", false, false), "allow")
  assert.equal(decideAccess("/api/users", false, true), "unauthorized-api")
  assert.equal(decideAccess("/dashboard", false, true), "gate-page")
  assert.equal(decideAccess("/auth", false, true), "allow")
  assert.equal(decideAccess("/api/auth/login", false, true), "allow")
  assert.equal(decideAccess("/api/users", true, true), "allow")
})

test("passwords: salted scrypt hashes verify without exposing raw values", () => {
  const hash = hashPassword("correct horse battery staple")
  assert.match(hash, /^scrypt\$[0-9a-f]+\$[0-9a-f]+$/)
  assert.notEqual(hash, "correct horse battery staple")
  assert.equal(verifyPassword("correct horse battery staple", hash), true)
  assert.equal(verifyPassword("wrong password", hash), false)
  assert.notEqual(hashPassword("correct horse battery staple"), hash)
})

test("session tokens: random raw token and stable digest", () => {
  const token = createSessionToken()
  assert.match(token, /^[A-Za-z0-9_-]{40,}$/)
  assert.match(digestToken(token), /^[0-9a-f]{64}$/)
  assert.notEqual(createSessionToken(), token)
})

test("session cookie security: HTTPS stays secure and plain HTTP is explicit", () => {
  assert.equal(shouldUseSecureAuthCookie({ NODE_ENV: "production" }), true)
  assert.equal(shouldUseSecureAuthCookie({ NODE_ENV: "production", AUTH_COOKIE_SECURE: "false" }), false)
  assert.equal(shouldUseSecureAuthCookie({ NODE_ENV: "production", AUTH_COOKIE_SECURE: "true" }), true)
  assert.equal(shouldUseSecureAuthCookie({ NODE_ENV: "development", AUTH_COOKIE_SECURE: "true" }), true)
})

test("auth input: login normalization and registration defaults", () => {
  assert.equal(normalizeLogin("  Alice@Example.COM "), "alice@example.com")
  const input = parseRegisterInput({ login: " Alice ", password: "password123", inviteCode: "invite-1", username: "Alice" })
  assert.equal(input.login, "alice")
  assert.equal(input.gender, "other")
  assert.equal(input.activityLevel, "sedentary")
  assert.equal(input.age, 30)
})

test("auth input: weak passwords are rejected", () => {
  assert.throws(
    () => parseLoginInput({ login: "alice", password: "" }),
    (error) => error instanceof AuthValidationError,
  )
  assert.throws(
    () => parseRegisterInput({ login: "alice", password: "short", inviteCode: "invite", username: "Alice" }),
    (error) => error instanceof AuthValidationError,
  )
})
