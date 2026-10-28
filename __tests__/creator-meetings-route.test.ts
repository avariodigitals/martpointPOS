import { beforeEach, describe, it, expect, vi } from "vitest"
const f = vi.hoisted(() => ({
  denied: false,
  manage: true,
  connected: true,
  schedule: vi.fn(),
  audit: vi.fn()
}))
vi.mock("@/lib/admin-auth", () => ({
  authorizeAdmin: vi.fn(async () =>
    f.denied
      ? { denied: Response.json({ error: "Forbidden" }, { status: 403 }), session: null }
      : { denied: null, session: { userId: "agent-one", name: "Amaka", username: "amaka", role: "Admin" } }
  ),
  hasPermission: () => f.manage
}))
vi.mock("@/lib/creator-applications", () => ({
  listInterviews: async () => [{ id: "meeting-one" }],
  scheduleCreatorInterview: f.schedule
}))
vi.mock("@/lib/google-calendar", () => ({
  getGoogleSettings: async () => ({ refreshToken: "must-not-leak" }),
  isGoogleConnected: () => f.connected
}))
vi.mock("@/lib/audit", () => ({
  recordAudit: f.audit,
  auditContextFromSession: () => ({ actorId: "agent-one" }),
  AUDIT_ACTIONS: { CREATOR_INTERVIEW_SCHEDULED: "CREATOR_INTERVIEW_SCHEDULED" },
  AUDIT_ENTITIES: { CREATOR_INTERVIEW: "creator_interview" }
}))
vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: () => {
      const q = {
        select: () => q,
        eq: () => q,
        is: () => q,
        maybeSingle: async () => ({ data: { id: "app-one" }, error: null })
      }
      return q
    }
  }
}))
import { GET, POST } from "@/app/api/admin/creators/applications/[id]/interviews/route"
const params = { params: Promise.resolve({ id: "app-one" }) }
const post = (body: Record<string, unknown> = {}, origin?: string) =>
  POST(
    new Request("https://example.test/meetings", {
      method: "POST",
      headers: { "content-type": "application/json", ...(origin ? { origin } : {}) },
      body: JSON.stringify({
        scheduledAt: "2027-01-01T10:00:00Z",
        durationMinutes: 30,
        requireGoogleMeet: true,
        meetingKind: "meeting",
        title: "Campaign review",
        ...body
      })
    }),
    params
  )
beforeEach(() => {
  vi.clearAllMocks()
  f.denied = false
  f.manage = true
  f.connected = true
  f.schedule.mockResolvedValue({
    ok: true,
    interviewId: "meeting-one",
    meetingUrl: "https://meet.google.com/abc-defg-hij"
  })
})
describe("creator meetings API", () => {
  it("requires authorization for meeting reads and booking", async () => {
    f.denied = true
    expect((await GET(new Request("https://example.test/meetings"), params)).status).toBe(403)
    expect((await post()).status).toBe(403)
    expect(f.schedule).not.toHaveBeenCalled()
  })
  it("exposes only connection readiness, not OAuth credentials", async () => {
    const response = await GET(new Request("https://example.test/meetings"), params)
    const text = await response.text()
    expect(text).toContain('"googleConnected":true')
    expect(text).not.toContain("must-not-leak")
    expect(response.headers.get("cache-control")).toBe("private, no-store")
  })
  it("passes authenticated actor and meeting purpose to Google booking", async () => {
    expect((await post({ actor: { id: "attacker" } })).status).toBe(200)
    expect(f.schedule).toHaveBeenCalledWith(
      expect.objectContaining({
        applicationId: "app-one",
        requireGoogleMeet: true,
        meetingKind: "meeting",
        actor: { id: "agent-one", name: "Amaka" }
      })
    )
    expect(f.audit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ entityId: "meeting-one" })
    )
  })
  it("rejects cross-origin booking requests before invoking Google", async () => {
    expect((await post({}, "https://other.test")).status).toBe(403)
    expect(f.schedule).not.toHaveBeenCalled()
  })
  it("rejects malformed meeting dates or duration", async () => {
    expect((await post({ scheduledAt: "invalid" })).status).toBe(400)
    expect((await post({ durationMinutes: 1000 })).status).toBe(400)
    expect(f.schedule).not.toHaveBeenCalled()
  })
  it("returns a saved-meeting warning rather than encouraging duplicate scheduling on failed email", async () => {
    f.schedule.mockResolvedValue({
      ok: true,
      interviewId: "meeting-one",
      warning: "Meeting saved, but email failed"
    })
    const response = await post()
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      success: true,
      warning: expect.stringContaining("email failed")
    })
  })
})
