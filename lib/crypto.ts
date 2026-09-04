import crypto from "crypto"

/* ───────────────────────────  Low-level password/token crypto  ───────────────────────────
 * Shared by admin-auth and partner-auth. No business logic, no session handling.
 */

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex")
  const hash = crypto.scryptSync(password, salt, 64).toString("hex")
  return `${salt}:${hash}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":")
  if (!salt || !hash) return false
  const derived = crypto.scryptSync(password, salt, 64).toString("hex")
  try {
    const storedBuf = Buffer.from(hash, "hex")
    const derivedBuf = Buffer.from(derived, "hex")
    if (storedBuf.length !== derivedBuf.length) return false
    return crypto.timingSafeEqual(storedBuf, derivedBuf)
  } catch {
    return false
  }
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex")
}
