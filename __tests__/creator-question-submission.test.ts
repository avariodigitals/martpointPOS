import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ from: vi.fn(), notify: vi.fn(), sign: vi.fn(), state: "Sent", fail: false, updates: [] as Record<string, unknown>[], fields: [] as Record<string, unknown>[] }))
vi.mock("@/lib/supabase", () => ({ isSupabaseConfigured: () => true, supabase: { from: mocks.from } }))
vi.mock("@/lib/admin-notifications", () => ({ notifyAllAdmins: mocks.notify }))
vi.mock("@/lib/creator-applications", () => ({ changeCreatorApplicationStatus: vi.fn() }))
vi.mock("@/lib/creator-storage", () => ({ uploadCreatorFile: vi.fn(), createCreatorFileSignedUrl: mocks.sign }))
import { submitApplicationQuestionResponses, withSignedAttachmentUrls, type CreatorApplicationQuestionRound } from "@/lib/creator-application-questions"

beforeEach(() => {
  vi.clearAllMocks()
  mocks.state = "Sent"; mocks.fail = false; mocks.updates = []; mocks.fields = [{ name: "answer", label: "Why MartPoint?", required: true, type: "text" }]
  mocks.notify.mockResolvedValue(undefined)
  mocks.from.mockImplementation((table: string) => {
    let changes: Record<string, unknown> | null = null
    const q = {
      select: () => q, eq: vi.fn(() => q),
      update: (values: Record<string, unknown>) => { changes = values; mocks.updates.push(values); return q },
      maybeSingle: async () => {
        if (table === "creator_applications") return { data: { status: "MANUAL_REVIEW", status_history: [], full_name: "Ada Obi", reference_number: "MPC-001" }, error: null }
        if (changes) {
          if (mocks.fail) return { data: null, error: { message: "Database error" } }
          if (mocks.state !== "Sent") return { data: null, error: null }
          mocks.state = "Submitted"
          expect(q.eq).toHaveBeenCalledWith("status", "Sent")
          return { data: { id: "round-1" }, error: null }
        }
        return { data: { id: "round-1", application_id: "app-1", title: "Verification", fields: mocks.fields, status: mocks.state }, error: null }
      },
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({ error: null }).then(resolve),
    }
    return q
  })
})

describe("Creator question submission alerts", () => {
  it("saves the reply, cancels reminders, and alerts the reviewer roles with an absolute email link", async () => {
    expect(await submitApplicationQuestionResponses("token", { answer: "My response" })).toEqual({ ok: true })
    expect(mocks.updates).toContainEqual(expect.objectContaining({ status: "Submitted", next_reminder_at: null }))
    expect(mocks.updates.some((update) => update.status === "APPROVED")).toBe(false)
    expect(mocks.notify).toHaveBeenCalledTimes(1)
    const alert = mocks.notify.mock.calls[0][0]
    expect(alert).toMatchObject({ type: "CREATOR_QUESTION_RESPONSES_SUBMITTED", source_id: "round-1", roles: ["Admin", "Digital Marketer"], deep_link: "/admin/creators/applications/app-1#questions", email: { route: "creator_application" } })
    expect(alert.message).toContain("Ada Obi")
    expect(alert.email.text).toMatch(/https:\/\/[^\s]+\/admin\/creators\/applications\/app-1#questions/)
    expect(JSON.stringify(alert)).not.toContain("My response")
  })
  it("sends just one alert for concurrent submissions and cannot overwrite the winner", async () => {
    const results = await Promise.all([
      submitApplicationQuestionResponses("token", { answer: "First" }),
      submitApplicationQuestionResponses("token", { answer: "Second" }),
    ])
    expect(results.filter((result) => result.ok)).toHaveLength(1)
    expect(mocks.notify).toHaveBeenCalledTimes(1)
  })
  it("does not alert on validation or database failure", async () => {
    expect((await submitApplicationQuestionResponses("token", {})).ok).toBe(false)
    mocks.fail = true
    expect((await submitApplicationQuestionResponses("token", { answer: "Test" })).ok).toBe(false)
    expect(mocks.notify).not.toHaveBeenCalled()
  })
  it("keeps the saved response successful if alert delivery throws", async () => {
    mocks.notify.mockRejectedValueOnce(new Error("Email service unavailable"))
    expect((await submitApplicationQuestionResponses("token", { answer: "Test" })).ok).toBe(true)
    expect(mocks.state).toBe("Submitted")
  })
  it("requires mandatory attachments and signs private files for the review panel", async () => {
    mocks.fields = [{ name: "proof", label: "Proof of reach", type: "file", required: true }]
    expect((await submitApplicationQuestionResponses("token", {})).ok).toBe(false)
    const file = { name: "proof.pdf", path: "private/round-1/proof.pdf", size: 500, mime: "application/pdf" }
    expect((await submitApplicationQuestionResponses("token", { proof: [file] }, ["proof"])).ok).toBe(true)
    mocks.sign.mockResolvedValue("https://storage.test/signed-short-lived-file")
    const signed = await withSignedAttachmentUrls({ fields: mocks.fields, responses: { proof: [file] } } as unknown as CreatorApplicationQuestionRound)
    expect(mocks.sign).toHaveBeenCalledWith(file.path, 300)
    expect(signed.responses.proof).toEqual([{ name: file.name, size: 500, mime: file.mime, url: "https://storage.test/signed-short-lived-file" }])
    expect(JSON.stringify(mocks.notify.mock.calls)).not.toContain(file.path)
  })
})
