/* Simple in-memory rate limiter for API routes.
 * For production with multiple instances, swap for Redis-backed limiter.
 */

interface LimitEntry {
  count: number
  resetAt: number
}

const store = new Map<string, LimitEntry>()

function getClientIp(request: Request): string {
  // Check forwarded headers (Vercel, nginx, Cloudflare, etc.)
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) {
    return forwarded.split(",")[0].trim()
  }
  const cfConnecting = request.headers.get("cf-connecting-ip")
  if (cfConnecting) return cfConnecting.trim()
  // Fall back to a generic key for the endpoint
  return "unknown"
}

export function checkRateLimit(
  request: Request,
  options: { key: string; max: number; windowSeconds: number }
): { allowed: boolean; remaining: number; resetAt: number } {
  const ip = getClientIp(request)
  const storeKey = `${options.key}:${ip}`
  const now = Date.now()

  const entry = store.get(storeKey)
  if (!entry || now > entry.resetAt) {
    // Window expired or first request — reset
    const newEntry: LimitEntry = {
      count: 1,
      resetAt: now + options.windowSeconds * 1000,
    }
    store.set(storeKey, newEntry)
    return { allowed: true, remaining: options.max - 1, resetAt: newEntry.resetAt }
  }

  if (entry.count >= options.max) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt }
  }

  entry.count += 1
  return { allowed: true, remaining: options.max - entry.count, resetAt: entry.resetAt }
}

// Periodic cleanup to prevent memory leak
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of store.entries()) {
    if (now > entry.resetAt) {
      store.delete(key)
    }
  }
}, 60_000)
