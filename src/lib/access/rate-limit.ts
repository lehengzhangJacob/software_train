// Process-local attempt limiter for access-code verification. Suitable for
// the single-instance gate; resets on restart (ADR-0007 known debt).

const WINDOW_MS = 10 * 60 * 1000
const MAX_ATTEMPTS = 10

interface Bucket {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

export interface AttemptResult {
  allowed: boolean
  retryAfterSeconds: number
}

export function takeAttempt(key: string, now = Date.now()): AttemptResult {
  const bucket = buckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS })
    return { allowed: true, retryAfterSeconds: 0 }
  }
  if (bucket.count >= MAX_ATTEMPTS) {
    return { allowed: false, retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000) }
  }
  bucket.count += 1
  return { allowed: true, retryAfterSeconds: 0 }
}

export function resetAttempts(key: string): void {
  buckets.delete(key)
}
