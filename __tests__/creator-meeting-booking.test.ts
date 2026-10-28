import { beforeEach, describe, expect, it, vi } from "vitest"
const f = vi.hoisted(() => ({
  connected: true,
  saveError: false,
  appStatus: "APPROVED",
  activated: true,
  insert: vi.fn(),
  update: vi.fn(),
  meet: vi.fn(),
  remove: vi.fn(),
  email: vi.fn(),
  notify: vi.fn()
}))
vi.mock("@/lib/google-calendar", () => ({
  getGoogleSettings: async () => ({}),
  isGoogleConnected: () => f.connected,
  createMeetEvent: f.meet,
  deleteCalendarEvent: f.remove
}))
vi.mock("@/lib/admin-auth", () => ({
  getUserById: async () => ({ signatureHtml: "<p>Amaka signature</p>" })
}))
vi.mock("@/lib/email", () => ({
  getEmailSettings: async () => ({ fromEmail: "creators@example.test", provider: "test" }),
  sendEmail: f.email,
  REPLY_TO: { creators: "creators@martpoint.com.ng" }
}))
vi.mock("@/lib/creator-email", () => ({
  renderCreatorEmail: async (body: string, signature: string) => ({ text: body, html: body + signature })
}))
vi.mock("@/lib/creator-notifications", () => ({
  sendCreatorNotification: f.notify,
  buildCreatorInterviewIcs: () => ({ filename: "meeting.ics", content: "test" }),
  pushCreatorNotification: vi.fn()
}))
vi.mock("@/lib/supabase", () => ({
  isSupabaseConfigured: () => true,
  supabase: {
    from: (table: string) => {
      const q = {
        select: () => q,
        eq: () => q,
        is: () => q,
        insert: (value: unknown) => {
          f.insert(table, value)
          return q
        },
        update: (value: unknown) => {
          f.update(table, value)
          return q
        },
        maybeSingle: async () => ({
          data: {
            id: "app-one",
            full_name: "Ada",
            email: "ada@example.test",
            reference_number: "CR-1",
            status: f.appStatus,
            created_creator_id: f.activated ? "creator-one" : null
          },
          error: null
        }),
        single: async () => ({
          data: f.saveError ? null : { id: "meeting-one" },
          error: f.saveError ? { message: "failed" } : null
        }),
        then: <T>(resolve: (value: { error: null }) => T) => Promise.resolve({ error: null }).then(resolve)
      }
      return q
    }
  }
}))
import { scheduleCreatorInterview } from "@/lib/creator-applications"
const input = () => ({
  applicationId: "app-one",
  scheduledAt: new Date(Date.now() + 86400000).toISOString(),
  durationMinutes: 30,
  meetingKind: "meeting" as const,
  requireGoogleMeet: true,
  title: "Creator campaign planning",
  actor: { id: "agent-one", name: "Amaka" }
})
beforeEach(() => {
  vi.clearAllMocks()
  f.connected = true
  f.saveError = false
  f.appStatus = "APPROVED"
  f.activated = true
  f.meet.mockResolvedValue({ meetLink: "https://meet.google.com/abc-defg-hij", eventId: "google-one" })
  f.remove.mockResolvedValue(undefined)
  f.email.mockResolvedValue(true)
  f.notify.mockResolvedValue(true)
})
describe("creator Google Meet booking", () => {
  it("does not save a fake or linkless meeting when Google is disconnected", async () => {
    f.connected = false
    expect((await scheduleCreatorInterview(input())).ok).toBe(false)
    expect(f.meet).not.toHaveBeenCalled()
    expect(f.insert).not.toHaveBeenCalled()
    expect(f.email).not.toHaveBeenCalled()
  })
  it("does not save a meeting or send an invitation if Meet creation fails", async () => {
    f.meet.mockRejectedValue(new Error("Reconnect Google"))
    expect(await scheduleCreatorInterview(input())).toMatchObject({ ok: false, error: "Reconnect Google" })
    expect(f.insert).not.toHaveBeenCalled()
    expect(f.email).not.toHaveBeenCalled()
  })
  it("creates a linked Meet, uses staff signature, retains invite status and does not undo approval", async () => {
    const result = await scheduleCreatorInterview(input())
    expect(result).toMatchObject({ ok: true, meetingUrl: "https://meet.google.com/abc-defg-hij" })
    expect(f.meet).toHaveBeenCalledWith(
      expect.objectContaining({
        attendeeEmail: "ada@example.test",
        timezone: "Africa/Lagos",
        summary: "Creator campaign planning"
      })
    )
    expect(f.insert).toHaveBeenCalledWith(
      "creator_interviews",
      expect.objectContaining({
        application_id: "app-one",
        meeting_kind: "meeting",
        google_event_id: "google-one"
      })
    )
    expect(f.email).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "ada@example.test",
        replyTo: "creators@martpoint.com.ng",
        html: expect.stringContaining("Amaka signature"),
        attachments: expect.any(Array)
      })
    )
    expect(f.update.mock.calls.some(([table]) => table === "creator_applications")).toBe(false)
    expect(f.update).toHaveBeenCalledWith("creator_interviews", { invite_status: "accepted" })
  })
  it("cleans up the Google event if the local meeting cannot be saved", async () => {
    f.saveError = true
    expect((await scheduleCreatorInterview(input())).ok).toBe(false)
    expect(f.remove).toHaveBeenCalledWith("google-one")
    expect(f.email).not.toHaveBeenCalled()
  })
  it("reports failed invite delivery without claiming booking failed or creating another event", async () => {
    f.email.mockResolvedValue(false)
    expect(await scheduleCreatorInterview(input())).toMatchObject({
      ok: true,
      warning: expect.stringContaining("do not schedule it again")
    })
    expect(f.update).toHaveBeenCalledWith("creator_interviews", { invite_status: "failed" })
    expect(f.meet).toHaveBeenCalledTimes(1)
  })
  it("does not move an activated creator backwards when an interview is scheduled", async () => {
    await scheduleCreatorInterview({ ...input(), meetingKind: "interview" })
    expect(f.update.mock.calls.some(([table]) => table === "creator_applications")).toBe(false)
  })
  it("validates dates and durations before calling Google", async () => {
    for (const patch of [
      { scheduledAt: "bad" },
      { scheduledAt: "2020-01-01T00:00:00Z" },
      { durationMinutes: 0 },
      { durationMinutes: 500 }
    ])
      expect((await scheduleCreatorInterview({ ...input(), ...patch })).ok).toBe(false)
    expect(f.meet).not.toHaveBeenCalled()
  })
})
