import { beforeEach, describe, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({ session: vi.fn(), from: vi.fn(), signed: vi.fn(), rows: [] as Record<string, unknown>[] }))
vi.mock("@/lib/admin-auth", () => ({ getSession: mocks.session, hasPermission: () => true }))
vi.mock("@/lib/supabase", () => ({ isSupabaseConfigured: () => true, supabase: { from: mocks.from, storage: { from: () => ({ createSignedUrl: mocks.signed }) } } }))
import { GET } from "@/app/api/azera/call-recordings/route"
beforeEach(() => {
  vi.clearAllMocks(); mocks.rows = []
  mocks.session.mockResolvedValue({ userId: "agent-1", role: "Admin" })
  mocks.signed.mockResolvedValue({ data: { signedUrl: "https://storage.example.test/private?token=test" } })
  mocks.from.mockImplementation(() => { const q = { select: () => q, eq: () => q, order: () => q, limit: async () => ({ data: mocks.rows, error: null }) }; return q })
})
describe("Call recording privacy", () => {
  it("requires an authorised admin portal session", async () => {
    mocks.session.mockResolvedValue(null)
    expect((await GET(new Request("https://example.test/recordings"))).status).toBe(403)
    expect(mocks.signed).not.toHaveBeenCalled()
  })
  it("replaces historical public paths with short-lived private storage URLs", async () => {
    mocks.rows = [{ id: "recording-1", recording_path: "business/call/file.webm", recording_url: "https://old.example.test/public" }]
    const result = await (await GET(new Request("https://example.test/recordings"))).json()
    expect(mocks.signed).toHaveBeenCalledWith("business/call/file.webm", 300)
    expect(result.data[0].recording_url).not.toContain("old.example.test")
  })
  it("does not issue playback links for expired recordings", async () => {
    mocks.rows = [{ id: "recording-1", recording_path: "business/call/file.webm", recording_url: "", retention_expires_at: "2020-01-01T00:00:00Z" }]
    const result = await (await GET(new Request("https://example.test/recordings"))).json()
    expect(result.data[0]).toMatchObject({ recording_url: null, expired: true }); expect(mocks.signed).not.toHaveBeenCalled()
  })
  it("does not render unsafe historical recording URL protocols", async () => {
    mocks.rows = [{ id: "recording-1", recording_url: "javascript:unexpected()" }]
    const result = await (await GET(new Request("https://example.test/recordings"))).json()
    expect(result.data[0].recording_url).toBeNull()
  })
})
