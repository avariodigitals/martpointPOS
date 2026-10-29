import { beforeEach, describe, expect, it, vi } from "vitest"
import { base64ByteLength, leadEmailAttachmentsSchema, MAX_LEAD_EMAIL_ATTACHMENT_BYTES } from "@/lib/lead-email-attachments"

const m = vi.hoisted(() => ({ auth: vi.fn(), send: vi.fn(), lead: vi.fn() }))
vi.mock("@/lib/admin-auth", () => ({ authorizeAdmin: m.auth, getUserById: async () => ({ signatureHtml: "" }) }))
vi.mock("@/lib/audit", () => ({
  auditContextFromSession: () => ({}), recordAudit: async () => {},
  AUDIT_ACTIONS: { LEAD_UPDATED: "LEAD_UPDATED" }, AUDIT_ENTITIES: { LEAD: "lead" }
}))
vi.mock("@/lib/supabase", () => ({
  isSupabaseConfigured: () => true,
  supabase: { from: () => ({ select: () => ({ eq: () => ({ single: m.lead }) }) }) }
}))
vi.mock("@/lib/lead-email-outbound", () => ({ sendLeadEmail: m.send }))
import { POST } from "@/app/api/admin/leads/[id]/emails/route"

const attachment = { filename: "proposal.pdf", content: Buffer.from("%PDF-1.4 test document").toString("base64") }
const params = { params: Promise.resolve({ id: "lead-id" }) }
const request = (attachments: unknown) => new Request("http://localhost/api/admin/leads/lead-id/emails", {
  method: "POST", headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ subject: "Your proposal", body: "Please see the attached documents.", attachments })
})

beforeEach(() => {
  vi.clearAllMocks()
  m.auth.mockResolvedValue({ session: { userId: "admin-id", name: "Ada" }, denied: null })
  m.lead.mockResolvedValue({ data: { id: "lead-id", email: "lead@example.test" } })
  m.send.mockResolvedValue({ sent: true, email: { id: "email-id", status: "sent" } })
})

describe("lead email attachment limits", () => {
  it("measures padded base64 accurately", () => {
    for (const value of ["a", "ab", "abc", "abcd"]) {
      expect(base64ByteLength(Buffer.from(value).toString("base64"))).toBe(Buffer.byteLength(value))
    }
  })
  it("accepts common documents and an exact-limit attachment", () => {
    expect(leadEmailAttachmentsSchema.safeParse([attachment, { ...attachment, filename: "pricing.xlsx" }]).success).toBe(true)
    const content = Buffer.alloc(MAX_LEAD_EMAIL_ATTACHMENT_BYTES).toString("base64")
    expect(leadEmailAttachmentsSchema.safeParse([{ filename: "proposal.pdf", content }]).success).toBe(true)
  })
  it("rejects aggregate overflow even when each file fits", () => {
    const content = Buffer.alloc(2 * 1024 * 1024).toString("base64")
    expect(leadEmailAttachmentsSchema.safeParse([{ filename: "one.pdf", content }, { filename: "two.pdf", content }]).success).toBe(false)
  })
  it("rejects too many files, empty or malformed data and unsafe names", () => {
    expect(leadEmailAttachmentsSchema.safeParse(Array(6).fill(attachment)).success).toBe(false)
    for (const content of ["", "not base64", "data:application/pdf;base64,YQ==", "YQ="]) {
      expect(leadEmailAttachmentsSchema.safeParse([{ ...attachment, content }]).success).toBe(false)
    }
    for (const filename of ["../file.pdf", "file\r\n.pdf", "dir\\file.docx"]) {
      expect(leadEmailAttachmentsSchema.safeParse([{ ...attachment, filename }]).success).toBe(false)
    }
  })
})

describe("lead email send route with documents", () => {
  it("passes the selected document bytes to the sender", async () => {
    expect((await POST(request([attachment]), params)).status).toBe(200)
    expect(m.send).toHaveBeenCalledWith(expect.objectContaining({
      leadId: "lead-id", to: ["lead@example.test"], attachments: [attachment]
    }))
  })
  it("rejects malformed attachments before loading or sending to a lead", async () => {
    expect((await POST(request([{ ...attachment, content: "bad data" }]), params)).status).toBe(400)
    expect(m.lead).not.toHaveBeenCalled()
    expect(m.send).not.toHaveBeenCalled()
  })
  it("requires authentication before accepting documents", async () => {
    m.auth.mockResolvedValue({ denied: new Response("Unauthorized", { status: 401 }) })
    expect((await POST(request([attachment]), params)).status).toBe(401)
    expect(m.send).not.toHaveBeenCalled()
  })
})
