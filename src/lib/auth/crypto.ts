import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto"

const PASSWORD_SALT_BYTES = 16
const PASSWORD_KEY_BYTES = 64

export function normalizeLogin(value: string): string {
  return value.trim().toLowerCase()
}

export function digestToken(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex")
}

export function createSessionToken(): string {
  return randomBytes(32).toString("base64url")
}

export function hashPassword(password: string): string {
  const salt = randomBytes(PASSWORD_SALT_BYTES).toString("hex")
  const derived = scryptSync(password, salt, PASSWORD_KEY_BYTES).toString("hex")
  return `scrypt$${salt}$${derived}`
}

export function verifyPassword(password: string, encoded: string): boolean {
  const [algorithm, salt, expectedHex] = encoded.split("$")
  if (algorithm !== "scrypt" || !salt || !expectedHex || !/^[0-9a-f]+$/i.test(expectedHex)) return false

  try {
    const expected = Buffer.from(expectedHex, "hex")
    const actual = scryptSync(password, salt, expected.length)
    return expected.length === actual.length && timingSafeEqual(expected, actual)
  } catch {
    return false
  }
}
