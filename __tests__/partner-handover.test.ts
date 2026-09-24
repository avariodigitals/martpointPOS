import { describe, expect, it } from "vitest"
import { renderEmailTemplate } from "../lib/email-templates"

describe("partner_installation_handover template", () => {
  it("renders store URL, credentials and partner name", async () => {
    const tpl = await renderEmailTemplate("partner_installation_handover", {
      contactName: "Ada",
      businessName: "Ada Stores",
      partnerName: "InstallCo",
      softwareUrl: "https://ada.martpoint.com.ng/admin",
      adminUsername: "ada@stores.com",
      tempPassword: "Temp#1234",
      messageBlock: "Your products are already loaded.\n\n",
      supportBlock: "Your support contact: support@installco.com\n\n",
    })

    expect(tpl.subject).toContain("Ada Stores")
    expect(tpl.text).toContain("https://ada.martpoint.com.ng/admin")
    expect(tpl.text).toContain("ada@stores.com")
    expect(tpl.text).toContain("Temp#1234")
    expect(tpl.text).toContain("InstallCo")
    expect(tpl.text).toContain("Your products are already loaded.")
    expect(tpl.text).toContain("support@installco.com")
    expect(tpl.text).toContain("installation guide")
    // no leftover placeholders
    expect(tpl.text).not.toMatch(/\{\{\w+\}\}/)
  })

  it("renders cleanly when optional blocks are empty", async () => {
    const tpl = await renderEmailTemplate("partner_installation_handover", {
      contactName: "Bob",
      businessName: "Bob Mart",
      partnerName: "Partner",
      softwareUrl: "https://bob.martpoint.com.ng",
      adminUsername: "bob",
      tempPassword: "pass",
      messageBlock: "",
      supportBlock: "",
    })
    expect(tpl.text).not.toMatch(/\{\{\w+\}\}/)
  })
})
