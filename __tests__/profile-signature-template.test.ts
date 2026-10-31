import { beforeEach, describe, expect, it, vi } from "vitest"
import type { User } from "@/lib/admin-types"
import { DEFAULT_PROFILE_SIGNATURE_HTML, prepareProfileSignatureHtml, renderProfileSignatureHtml, renderSignatureTemplate } from "@/lib/email-signature"
import { sanitizeSupportHtml } from "@/lib/support-html"
const settings = vi.hoisted(() => vi.fn())
vi.mock("@/lib/settings", () => ({ readSettings: settings }))
import { getProfileSignatureTemplate, resolveProfileSignature } from "@/lib/profile-signature"
const user: User = {
  id: "user", username: "ada", name: "Ada", email: "ada@example.test", phone: "+2341111111",
  role: "Sales", signatureHtml: "", status: "ACTIVE", createdAt: "", passwordHash: "",
}
beforeEach(() => settings.mockResolvedValue({ general: { companyName: "MartPoint", phone: "+2342222222", supportPhone: "+2343333333", whatsappNumber: "+2345555555" } }))
describe("profile signature templates", () => {
  it("seeds personal details and generates clickable contacts", async () => {
    const template = await getProfileSignatureTemplate(user)
    expect(template).toMatchObject({ name: "Ada", title: "Sales", email: user.email, phone: user.phone, company: "MartPoint" })
    const html = await resolveProfileSignature(user)
    expect(html).toContain('href="mailto:ada@example.test"')
    expect(html).toContain('href="tel:+2341111111"')
  })
  it.each(["Customer Care", "Tech"] as const)("resolves the current support number for %s even after saving a template", async (role) => {
    const signatureTemplate = await getProfileSignatureTemplate(user)
    const supportUser = { ...user, role, signatureTemplate }
    expect(await resolveProfileSignature(supportUser)).toContain("+2343333333")
    settings.mockResolvedValue({ general: { supportPhone: "+2344444444" } })
    const html = await resolveProfileSignature(supportUser)
    expect(html).toContain("+2344444444")
    expect(html).not.toContain(user.phone)
  })
  it("falls back to the configured company number for support", async () => {
    settings.mockResolvedValue({ general: { phone: "+2342222222" } })
    expect((await getProfileSignatureTemplate({ ...user, role: "Tech" })).phone).toBe("+2342222222")
  })
  it("uses the shared layout for profiles with legacy custom HTML", async () => {
    const html = await resolveProfileSignature({ ...user, signatureHtml: "<p>Custom signature</p>" })
    expect(html).toContain("Ada")
    expect(html).not.toContain("Custom signature")
  })
  it("gets mobile from the live company WhatsApp setting rather than saved profile data", async () => {
    const signatureTemplate = { ...(await getProfileSignatureTemplate(user)), mobile: "old number" }
    const html = await resolveProfileSignature({ ...user, signatureTemplate })
    expect(html).toContain('href="https://wa.me/2345555555"')
    expect(html).not.toContain("old number")
    expect(html).not.toContain("08037978230")
  })
  it("does not invent a mobile number when WhatsApp is unset", async () => {
    settings.mockResolvedValue({ general: {} })
    expect((await getProfileSignatureTemplate(user)).mobile).toBe("")
    expect(await resolveProfileSignature(user)).not.toContain("wa.me/")
  })
  it("applies the saved size to real outgoing HTML, including image attributes", async () => {
    settings.mockResolvedValue({ email: { profileSignatureScale: 50 } })
    const html = await resolveProfileSignature(user)
    expect(html).toContain("max-width:500px")
    expect(html).toContain("font-size:16px")
    expect(html).toContain('width="500"')
    expect(html).not.toContain('width="1000"')
  })
  it("scales the preview and outgoing layout identically through HTML sanitization", async () => {
    const fields = await getProfileSignatureTemplate(user)
    const preview = renderProfileSignatureHtml(sanitizeSupportHtml(prepareProfileSignatureHtml(DEFAULT_PROFILE_SIGNATURE_HTML, 65)), fields)
    expect(preview).toBe(await resolveProfileSignature(user))
    expect(preview).toContain("max-width:650px")
    expect(preview).toContain("font-size:21px")
  })
  it("upgrades the original hard-coded mobile link in previously saved templates", async () => {
    const legacy = DEFAULT_PROFILE_SIGNATURE_HTML.replace("{{mobile_link}}", '<a href="https://wa.me/2348037978230" style="color:#111827;text-decoration:none">08037978230</a>')
    settings.mockResolvedValue({ general: { whatsappNumber: "+2347777777" }, email: { profileSignatureHtmlTemplate: legacy, profileSignatureScale: 100 } })
    const html = await resolveProfileSignature(user)
    expect(html).toContain("+2347777777")
    expect(html).not.toContain("08037978230")
    expect(html).toContain("max-width:1000px")
  })
  it("renders edited text safely instead of executing it", async () => {
    const template = await getProfileSignatureTemplate(user)
    const html = renderSignatureTemplate({ ...template, name: '<script>alert("x")</script>', extra: '<img src=x onerror=bad()>' })
    expect(html).not.toMatch(/<script|<img/)
    expect(html).toContain("&lt;script&gt;")
  })
})
