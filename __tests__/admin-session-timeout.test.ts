import { describe, it, expect, vi, afterEach } from "vitest"
import { cookies } from "next/headers"
import { getSession, isAdminSessionExpired, type SessionPayload } from "@/lib/admin-auth"
import { signSession } from "@/lib/session-secret"

vi.mock("next/headers", () => ({ cookies: vi.fn() }))

afterEach(() => vi.unstubAllEnvs())

describe("getSession during server rendering", () => {
  it("rejects an expired signed session without writing to read-only cookies", async () => {
    vi.stubEnv("ADMIN_SESSION_TIMEOUT_MINUTES", "30")
    const token = signSession(session({ lastActive: Date.now() - 31 * MINUTE }))
    const deleteCookie = vi.fn(() => {
      throw new Error("Cookies can only be modified in a Server Action or Route Handler")
    })
    vi.mocked(cookies).mockResolvedValue({
      get: vi.fn(() => ({ name: "admin-session", value: token })),
      delete: deleteCookie,
    } as unknown as Awaited<ReturnType<typeof cookies>>)

    await expect(getSession()).resolves.toBeNull()
    expect(deleteCookie).not.toHaveBeenCalled()
  })
})

/* ─────────────────────────────────────────────────────────────────────────────
 * Regression: reconnecting Google signed the admin out with "Your session
 * expired due to inactivity."
 *
 * The OAuth round-trip leaves the admin portal and returns via Google, so the
 * browser makes an ordinary top-level (same-site GET) navigation back to
 * /api/admin/google/callback. With the session cookie set SameSite=Strict that
 * cookie is NOT sent — neither on Google's redirect back nor on the immediate
 * follow-up redirect to /admin/settings.
 *
 * The callback then lands on /admin/settings with no session, which redirects to
 * /admin/login?expired=1, producing the inactivity banner even though the admin
 * was never idle.
 *
 * These tests lock in the timeout semantics so we can be sure the *session
 * logic* is not the culprit, and that a genuine idle expiry still works.
 * ──────────────────────────────────────────────────────────────────────────── */

const MINUTE = 60 * 1000

function session(overrides: Partial<SessionPayload> = {}): SessionPayload {
  const now = Date.now()
  return {
    userId: "user-1",
    username: "admin",
    role: "SUPER_ADMIN",
    name: "Admin",
    iat: now,
    lastActive: now,
    ...overrides,
  } as SessionPayload
}

describe("isAdminSessionExpired", () => {
  it("does NOT report expiry for a session that was just active", () => {
    // This is the state an admin is in when they click Connect Google.
    expect(isAdminSessionExpired(session())).toBe(false)
  })

  it("does not report expiry for a session active a minute ago", () => {
    expect(isAdminSessionExpired(session({ lastActive: Date.now() - MINUTE }))).toBe(false)
  })

  it("still reports expiry once the idle window has genuinely passed", () => {
    const timeout = Number(process.env.ADMIN_SESSION_TIMEOUT_MINUTES || 30) * MINUTE
    expect(isAdminSessionExpired(session({ lastActive: Date.now() - timeout - MINUTE }))).toBe(true)
  })

  it("falls back to iat for legacy sessions without lastActive", () => {
    const legacy = session()
    delete (legacy as unknown as Record<string, unknown>).lastActive
    expect(isAdminSessionExpired(legacy)).toBe(false)

    const staleLegacy = session({ iat: Date.now() - 60 * MINUTE })
    delete (staleLegacy as unknown as Record<string, unknown>).lastActive
    expect(isAdminSessionExpired(staleLegacy)).toBe(true)
  })

  it("treats a session with no timestamps as not expired (legacy safety)", () => {
    const noTimestamps = {
      userId: "u",
      username: "a",
      role: "SUPER_ADMIN",
      name: "A",
    } as unknown as SessionPayload
    expect(isAdminSessionExpired(noTimestamps)).toBe(false)
  })
})
