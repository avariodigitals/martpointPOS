import { beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({ session: vi.fn(), user: vi.fn(), update: vi.fn(), audit: vi.fn() }))
vi.mock("@/lib/admin-auth", () => ({ getSession: m.session, getUserById: m.user, updateUser: m.update }))
vi.mock("@/lib/supabase", () => ({ isSupabaseConfigured: () => true }))
vi.mock("@/lib/settings", () => ({ readSettings: async () => ({ general: { supportPhone: "+2343333333" } }) }))
vi.mock("@/lib/audit", () => ({
  auditContextFromSession: () => ({}), recordAudit: m.audit,
  AUDIT_ACTIONS: { ADMIN_USER_UPDATED: "ADMIN_USER_UPDATED" }, AUDIT_ENTITIES: { ADMIN_USER: "admin_user" },
}))
import { PATCH } from "@/app/api/admin/profile/signature/route"

const request = (body: unknown) => new Request("http://localhost/api/admin/profile/signature", { method: "PATCH", body: JSON.stringify(body) })
beforeEach(() => {
  vi.clearAllMocks()
  m.session.mockResolvedValue({ userId: "current-user", role: "Sales" })
  m.user.mockResolvedValue({ status: "ACTIVE" })
  m.update.mockImplementation(async (_id, updates) => ({ signatureHtml: updates.signatureHtml }))
})
describe("self-service profile signature", () => {
  it("saves plain template fields and the personal phone without changing account permissions", async () => {
    m.user.mockResolvedValueOnce({ status: "ACTIVE", name: "Ada", role: "Sales", email: "ada@example.test" })
    const template = { name: "Ada", title: "Sales manager", email: "ada@example.test", phone: "+2341111111", company: "MartPoint", extra: "Happy to help" }
    const response = await PATCH(request({ template, profilePhone: "+2341111111" }))
    expect(response.status).toBe(200)
    expect(m.update).toHaveBeenCalledWith("current-user", expect.objectContaining({ signatureTemplate: template, phone: "+2341111111" }))
    expect(m.update.mock.calls[0][1]).not.toHaveProperty("role")
    expect((await response.json()).signatureHtml).toContain('href="mailto:ada@example.test"')
  })
  it("uses the server-configured support phone when saving a support template", async () => {
    m.user.mockResolvedValueOnce({ status: "ACTIVE", name: "Ada", role: "Customer Care", email: "ada@example.test" })
    const template = { name: "Ada", title: "Support", email: "ada@example.test", phone: "client number", company: "MartPoint", extra: "" }
    const response = await PATCH(request({ template, profilePhone: "+2341111111" }))
    const data = await response.json()
    expect(response.status).toBe(200)
    expect(data.template.phone).toBe("+2343333333")
    expect(data.signatureHtml).not.toContain("client number")
  })
  it("lets a staff member save their own signature without team-management permissions", async () => {
    const response = await PATCH(request({ signatureHtml: "<p><strong>Ada</strong></p>" }))
    expect(response.status).toBe(200)
    expect(m.update).toHaveBeenCalledWith("current-user", { signatureHtml: "<p><strong>Ada</strong></p>" })
    expect(m.audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ entityId: "current-user", metadata: { field: "signature_html", selfService: true } }))
  })
  it("refuses another user id or privilege-changing fields", async () => {
    expect((await PATCH(request({ id: "other-user", role: "Super Admin", signatureHtml: "<p>Ada</p>" }))).status).toBe(400)
    expect(m.update).not.toHaveBeenCalled()
  })
  it("removes executable HTML and preserves safe links and logo images", async () => {
    const response = await PATCH(request({ signatureHtml: '<p>Ada</p><script>bad()</script><img src="https://example.test/logo.png" onerror="bad()"><a href="javascript:bad()">Unsafe</a>' }))
    const data = await response.json()
    expect(data.signatureHtml).toContain("https://example.test/logo.png")
    expect(data.signatureHtml).not.toMatch(/script|onerror|javascript:/)
  })
  it("allows clearing an empty editor so the team fallback can be used", async () => {
    expect((await PATCH(request({ signatureHtml: "<p><br></p>" }))).status).toBe(200)
    expect(m.update).toHaveBeenCalledWith("current-user", { signatureHtml: "" })
  })
  it("rejects unsigned and disabled accounts", async () => {
    m.session.mockResolvedValueOnce(null)
    expect((await PATCH(request({ signatureHtml: "" }))).status).toBe(401)
    m.user.mockResolvedValueOnce({ status: "DISABLED" })
    expect((await PATCH(request({ signatureHtml: "" }))).status).toBe(403)
    expect(m.update).not.toHaveBeenCalled()
  })
  it("reports a failed write without claiming the signature was saved", async () => {
    m.update.mockResolvedValueOnce(null)
    expect((await PATCH(request({ signatureHtml: "<p>Ada</p>" }))).status).toBe(500)
  })
})
