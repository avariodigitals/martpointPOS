import { beforeEach, describe, expect, it, vi } from "vitest"
import type { User } from "@/lib/admin-types"
import { renderSignatureTemplate } from "@/lib/email-signature"
const settings = vi.hoisted(() => vi.fn())
vi.mock("@/lib/settings", () => ({ readSettings: settings }))
import { getProfileSignatureTemplate, resolveProfileSignature } from "@/lib/profile-signature"
const user: User = {
  id: "user", username: "ada", name: "Ada", email: "ada@example.test", phone: "+2341111111",
  role: "Sales", signatureHtml: "", status: "ACTIVE", createdAt: "", passwordHash: "",
}
beforeEach(() => settings.mockResolvedValue({ general: { companyName: "MartPoint", phone: "+2342222222", supportPhone: "+2343333333" } }))
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
  it("preserves existing custom HTML signatures", async () => {
    expect(await resolveProfileSignature({ ...user, signatureHtml: "<p>Custom signature</p>" })).toBe("<p>Custom signature</p>")
  })
  it("renders edited text safely instead of executing it", async () => {
    const template = await getProfileSignatureTemplate(user)
    const html = renderSignatureTemplate({ ...template, name: '<script>alert("x")</script>', extra: '<img src=x onerror=bad()>' })
    expect(html).not.toMatch(/<script|<img/)
    expect(html).toContain("&lt;script&gt;")
  })
})
