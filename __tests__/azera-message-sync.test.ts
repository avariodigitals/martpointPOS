import { beforeEach, describe, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({ session: vi.fn(), from: vi.fn(), order: vi.fn(), limit: vi.fn() }))
vi.mock("@/lib/admin-auth", () => ({ getSession: mocks.session, hasPermission: () => true }))
vi.mock("@/lib/supabase", () => ({ isSupabaseConfigured: () => true, supabase: { from: mocks.from } }))
import { GET } from "@/app/api/azera/conversations/[id]/messages/route"
const context = { params: Promise.resolve({ id: "conversation-1" }) }
beforeEach(() => {
  vi.clearAllMocks()
  mocks.session.mockResolvedValue({ userId: "agent-1", role: "ADMIN" })
  const query = { select: () => query, eq: () => query, order: mocks.order, limit: mocks.limit }
  mocks.order.mockReturnValue(query); mocks.from.mockReturnValue(query)
  mocks.limit.mockResolvedValue({ data: [{ id: "newest" }, { id: "older" }], error: null })
})
describe("Omnichannel recent-message feed", () => {
  it("selects the newest window then returns chronological display order", async () => {
    const response = await GET(new Request("https://example.test/messages?limit=100"), context)
    expect(mocks.order).toHaveBeenCalledWith("created_at", { ascending: false })
    expect(mocks.limit).toHaveBeenCalledWith(100)
    expect(await response.json()).toEqual({ messages: [{ id: "older" }, { id: "newest" }] })
    expect(response.headers.get("Cache-Control")).toBe("no-store")
  })
  it("does not permit a negative query limit", async () => {
    await GET(new Request("https://example.test/messages?limit=-100"), context)
    expect(mocks.limit).toHaveBeenCalledWith(1)
  })
  it("requires admin authorization before loading messages", async () => {
    mocks.session.mockResolvedValue(null)
    expect((await GET(new Request("https://example.test/messages"), context)).status).toBe(403)
    expect(mocks.from).not.toHaveBeenCalled()
  })
})
