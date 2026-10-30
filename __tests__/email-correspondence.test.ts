import { beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({ actor: vi.fn(), auth: vi.fn(), footer: vi.fn(), settings: vi.fn() }))
vi.mock("@/lib/admin-mailbox-correspondence", () => ({ mirrorSentMessageToMailbox: vi.fn() }))
vi.mock("@/lib/profile-signature", () => ({
  resolveProfileSignature: vi.fn(async (actor: { signatureHtml?: string } | undefined) => actor?.signatureHtml || "")
}))
vi.mock("@/lib/settings", () => ({ getEmailFooterSettings: m.footer }))
vi.mock("@/lib/admin-auth", () => ({ authorizeAdmin: m.auth, getUserById: m.actor }))
vi.mock("@/lib/email", () => ({ getEmailSettings: m.settings }))
vi.mock("@/lib/supabase", () => ({
  isSupabaseConfigured: () => true,
  supabase: { from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { full_name: "Ade", business_name: "Ade Shop" } }) }) }) }) }
}))

import { ensureBrandedHtml, normalEmailHtml } from "@/lib/email-templates"
import { emailComposerFields, renderCorrespondenceHtml } from "@/lib/email-correspondence"
import { renderLeadEmail } from "@/lib/lead-email-outbound"
import { renderPartnerEmail } from "@/lib/partner-email"
import { renderCreatorEmail } from "@/lib/creator-email"
import { POST as previewLeadEmail } from "@/app/api/admin/leads/[id]/emails/preview/route"

const footer = { companyName: "MartPoint Solutions", contactEmail: "hello@example.test", phone: "+2347000000000", website: "martpoint.com.ng", social: { linkedin: "https://linkedin.com/company/usemartpoint" } }
const bodyHtml = '<p>Hi Ade,</p><p>Please review <strong>the proposal</strong> and <a href="https://example.test">reply here</a>.</p><ul><li>First step</li><li>Second step</li></ul>'
const signature = "<p>Ada</p><p>Account Manager</p>"
const settings = { signature: "", signatureHtml: "", smtp: { fromEmail: "", user: "" } }

beforeEach(() => {
  vi.clearAllMocks()
  m.footer.mockResolvedValue(footer)
  m.settings.mockResolvedValue(settings)
  m.actor.mockResolvedValue({ signatureHtml: signature })
  m.auth.mockResolvedValue({ session: { userId: "admin-id" }, denied: null })
})

describe("normal correspondence layout", () => {
  it("keeps formatting, contact footer, social links and banner without a header or card", async () => {
    const html = await renderCorrespondenceHtml(bodyHtml + signature, "Hi Ade", "normal")
    expect(html).toContain(bodyHtml)
    expect(html).toContain(signature)
    for (const value of ["footerbanner.png", footer.contactEmail, footer.social.linkedin, "All rights reserved."]) expect(html).toContain(value)
    for (const value of ["linear-gradient", "box-shadow", "logo-white.png", "background-color:#f5f6f7", "Best regards,<br/>"]) expect(html).not.toContain(value)
    expect(html).toContain('data-martpoint-layout="normal"')
    expect(ensureBrandedHtml(html)).toBe(html)
  })
  it("still offers the existing branded card", async () => {
    const html = await renderCorrespondenceHtml(bodyHtml, "Hi Ade", "branded")
    expect(html).toContain("linear-gradient")
    expect(html).toContain("box-shadow")
    expect(html).toContain("footerbanner.png")
    expect(html).toContain(bodyHtml)
  })
  it("escapes footer values and uses defaults when live settings fail", async () => {
    expect(normalEmailHtml("Hello", { footer: { companyName: "<script>" } })).toContain("&lt;script&gt;")
    m.footer.mockRejectedValue(new Error("offline"))
    expect(await renderCorrespondenceHtml("Hello", "Hello", "normal")).toContain("footerbanner.png")
  })
  it("supports both styles for partner and creator messages with exactly one personal signature", async () => {
    for (const layout of ["normal", "branded"] as const) {
      const messages = await Promise.all([
        renderPartnerEmail(bodyHtml, signature, "Ada", layout),
        renderCreatorEmail("Plain fallback", signature, layout, bodyHtml),
      ])
      for (const message of messages) {
        expect(message.html.split(signature)).toHaveLength(2)
        expect(message.html).toContain("<strong>the proposal</strong>")
        expect(message.text).toContain("Account Manager")
        expect(message.html.includes('data-martpoint-layout="normal"')).toBe(layout === "normal")
      }
    }
  })
  it("sanitizes rich lead HTML and generates its plain-text alternative", async () => {
    const message = await renderLeadEmail({ body: "Ignored plain fallback", bodyHtml: bodyHtml + '<script>bad()</script><img src="x" onerror="bad()">', layout: "normal", signatureHtml: signature }, settings as never)
    expect(message.html).toContain("<strong>the proposal</strong>")
    expect(message.html).not.toMatch(/<script|onerror/)
    expect(message.text).toContain("First step")
    expect(message.text).not.toContain("Ignored plain fallback")
  })
  it("rejects blank rich text and an unrecognized style", () => {
    expect(emailComposerFields.bodyHtml.safeParse("<p><br></p>").success).toBe(false)
    expect(emailComposerFields.bodyHtml.safeParse("<script>bad()</script>").success).toBe(false)
    expect(emailComposerFields.layout.safeParse("unknown").success).toBe(false)
  })
  it("previews the exact same signature, style and footer used for lead delivery", async () => {
    for (const layout of ["normal", "branded"] as const) {
      const expected = await renderLeadEmail({ body: "Hello", bodyHtml, layout, signatureHtml: signature }, settings as never)
      const response = await previewLeadEmail(new Request("http://localhost/emails/preview", {
        method: "POST", body: JSON.stringify({ subject: "Proposal", body: "Hello", bodyHtml, layout }),
      }), { params: Promise.resolve({ id: "lead-id" }) })
      expect(response.status).toBe(200)
      expect(await response.json()).toMatchObject({ html: expected.html, text: expected.text })
    }
  })
})
