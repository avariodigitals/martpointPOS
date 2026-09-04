import crypto from "crypto"

/* ───────────────────────────  Session signing/verification  ───────────────────────────
 * One shared secret, separate cookies. Payloads are typed by caller.
 */

export function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET
  if (secret && secret.length >= 32) return secret

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "SESSION_SECRET environment variable is required and must be at least 32 characters. " +
      "Set it in your hosting platform before deploying."
    )
  }

  console.warn(
    "\n[SECURITY WARNING] SESSION_SECRET not set or too short.\n" +
    "Using temporary dev fallback. Sessions will NOT be secure.\n" +
    "Set SESSION_SECRET in .env.local before any production use.\n"
  )

  return "dev-session-secret-do-not-use-in-production-1234567890"
}

export function signSession<T extends object>(payload: T): string {
  const secret = getSessionSecret()
  const data = JSON.stringify(payload)
  const signature = crypto.createHmac("sha256", secret).update(data).digest("hex")
  return Buffer.from(`${data}.${signature}`).toString("base64")
}

export function verifySession<T extends object>(
  token: string,
  guard: (value: unknown) => value is T
): T | null {
  try {
    const decoded = Buffer.from(token, "base64").toString("utf-8")
    const lastDot = decoded.lastIndexOf(".")
    if (lastDot === -1) return null
    const data = decoded.slice(0, lastDot)
    const signature = decoded.slice(lastDot + 1)
    const secret = getSessionSecret()
    const expected = crypto.createHmac("sha256", secret).update(data).digest("hex")
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null
    const parsed = JSON.parse(data)
    return guard(parsed) ? parsed : null
  } catch {
    return null
  }
}
