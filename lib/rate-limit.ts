/* ───────────────────────────  Rate limiting  ───────────────────────────
 * Default: in-memory fixed-window limiter (suitable for single-instance dev).
 * Production: set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN for
 * distributed rate limiting via Upstash Redis REST API.
 *
 * This is an abstraction: callers do not need to know which backend is active.
 */

interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
}

interface RateLimitOptions {
  key: string
  max: number
  windowSeconds: number
}

function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) {
    return forwarded.split(",")[0].trim()
  }
  const cfConnecting = request.headers.get("cf-connecting-ip")
  if (cfConnecting) return cfConnecting.trim()
  return "unknown"
}

/* ─── In-memory backend (dev / single-instance fallback) ─── */

interface MemoryEntry {
  count: number
  resetAt: number
}

const memoryStore = new Map<string, MemoryEntry>()

setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of memoryStore.entries()) {
    if (now > entry.resetAt) memoryStore.delete(key)
  }
}, 60_000)

function checkMemoryRateLimit(storeKey: string, max: number, windowSeconds: number): RateLimitResult {
  const now = Date.now()
  const entry = memoryStore.get(storeKey)
  if (!entry || now > entry.resetAt) {
    const resetAt = now + windowSeconds * 1000
    memoryStore.set(storeKey, { count: 1, resetAt })
    return { allowed: true, remaining: max - 1, resetAt }
  }
  if (entry.count >= max) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt }
  }
  entry.count += 1
  return { allowed: true, remaining: max - entry.count, resetAt: entry.resetAt }
}

/* ─── Upstash Redis REST backend (optional, production) ─── */

async function checkUpstashRateLimit(storeKey: string, max: number, windowSeconds: number): Promise<RateLimitResult> {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) {
    return checkMemoryRateLimit(storeKey, max, windowSeconds)
  }

  const nowMs = Date.now()
  const expireKey = `${storeKey}:expire`

  // INCR the counter; on first request also set TTL.
  const incrUrl = `${url}/incr/${encodeURIComponent(storeKey)}?token=${token}`
  const incrRes = await fetch(incrUrl, { method: "POST" }).catch(() => null)
  if (!incrRes) {
    return checkMemoryRateLimit(storeKey, max, windowSeconds)
  }
  const incrData = (await incrRes.json().catch(() => ({ result: 1 }))) as { result?: number }
  const count = incrData.result ?? 1

  if (count === 1) {
    // Set the expiry on first request in this window.
    await fetch(`${url}/expire/${encodeURIComponent(storeKey)}?seconds=${windowSeconds}&token=${token}`, {
      method: "POST",
    }).catch(() => null)
    await fetch(`${url}/set/${encodeURIComponent(expireKey)}?value=${nowMs + windowSeconds * 1000}&ex=${windowSeconds}&token=${token}`, {
      method: "POST",
    }).catch(() => null)
  }

  const ttlRes = await fetch(`${url}/ttl/${encodeURIComponent(storeKey)}?token=${token}`).catch(() => null)
  let ttlSeconds = windowSeconds
  if (ttlRes) {
    const ttlData = (await ttlRes.json().catch(() => ({ result: windowSeconds }))) as { result?: number }
    ttlSeconds = ttlData.result ?? windowSeconds
  }
  const resetAt = nowMs + Math.max(0, ttlSeconds) * 1000
  const allowed = count <= max
  return { allowed, remaining: Math.max(0, max - count), resetAt }
}

/* ─── Public API ─── */

export async function checkRateLimit(
  request: Request,
  options: RateLimitOptions
): Promise<RateLimitResult> {
  const ip = getClientIp(request)
  const storeKey = `${options.key}:${ip}`

  const useRedis = Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN)
  if (useRedis) {
    return checkUpstashRateLimit(storeKey, options.max, options.windowSeconds)
  }
  return checkMemoryRateLimit(storeKey, options.max, options.windowSeconds)
}

export function checkRateLimitSync(
  request: Request,
  options: RateLimitOptions
): RateLimitResult {
  const ip = getClientIp(request)
  const storeKey = `${options.key}:${ip}`
  return checkMemoryRateLimit(storeKey, options.max, options.windowSeconds)
}
