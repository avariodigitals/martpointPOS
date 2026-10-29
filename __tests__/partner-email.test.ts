import { beforeEach, describe, expect, it, vi } from "vitest"
vi.mock("@/lib/supabase", () => ({ supabase: {} }))
vi.mock("@/lib/settings", () => ({ getEmailFooterSettings: async () => ({ companyName: "MartPoint" }) }))
import { buildPartnerEmailContent, partnerEmailRecipients, renderPartnerEmail } from "@/lib/partner-email"
import { relevantPartnerTabs } from "@/lib/partner-permissions"

describe("partner email content and recipients", () => {
  beforeEach(() => { vi.clearAllMocks() })
  it("shows Email directly after Overview even without partner capabilities", () => {
    expect(relevantPartnerTabs([]).slice(0, 2)).toEqual(["overview", "email"])
  })
  it("normalizes and deduplicates contacts, excludes disabled users and invalid addresses", () => {
    expect(
      partnerEmailRecipients({ public_email: "OWNER@example.test " }, [
        { email: "owner@example.test", full_name: "Owner", status: "ACTIVE" },
        { email: "invited@example.test", full_name: "Invited user", status: "INVITED" },
        { email: "disabled@example.test", full_name: "Disabled user", status: "DISABLED" },
        { email: "bad-address", full_name: "Bad user", status: "ACTIVE" }
      ])
    ).toEqual([
      { email: "owner@example.test", label: "Partner contact" },
      { email: "invited@example.test", label: "Invited user" }
    ])
  })
  it("preserves formatted text and the personal signature while removing executable HTML", () => {
    const result = buildPartnerEmailContent(
      '<p>Hello <strong>partner</strong></p><script>bad()</script><a href="javascript:bad()">link</a>',
      '<p>Ralph <img src="https://example.test/logo.png" onerror="bad()"></p>',
      "Ignored"
    )
    expect(result.html).toContain("<strong>partner</strong>")
    expect(result.text).toContain("-- \nRalph")
    expect(result.html).not.toMatch(/script|onerror|javascript:/)
  })
  it("uses the logged-in sender's name in a safe fallback signature", () => {
    const result = buildPartnerEmailContent("<p>Hello</p>", "", "Jane <Admin>")
    expect(result.html).toContain("Jane &lt;Admin&gt;")
    expect(result.text).toContain("MartPoint Partner Team")
  })
  it("rejects visually empty editor content", () => {
    expect(() => buildPartnerEmailContent("<p><br></p>", "", "Admin")).toThrow("Message is required")
  })
  it("renders the actual branded document with the signature and banner", async () => {
    const result = await renderPartnerEmail("<p>Good morning</p>", "<p>Personal signature</p>", "Admin")
    expect(result.html).toContain("Personal signature")
    expect(result.html).toContain("footerbanner.png")
    expect(result.html).toContain("Partner Network")
    expect(result.html).not.toContain("Creator Network")
  })
})
