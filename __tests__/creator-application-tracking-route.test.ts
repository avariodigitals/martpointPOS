import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ authorize: vi.fn(), list: vi.fn() }))
vi.mock("@/lib/admin-auth", () => ({ authorizeAdmin: mocks.authorize }))
vi.mock("@/lib/creator-applications", () => ({ listCreatorApplicationsPage: mocks.list }))
import { GET } from "@/app/api/admin/creators/applications/route"

beforeEach(() => {
  vi.clearAllMocks()
  mocks.authorize.mockResolvedValue({ denied: null })
  mocks.list.mockResolvedValue({ applications: [], total: 0, page: 1, pageSize: 25 })
})

describe("Admin creator reply tracker API", () => {
  it("requires creator-view permission before loading tracking data", async () => {
    mocks.authorize.mockResolvedValue({ denied: new Response(null, { status: 403 }) })
    expect((await GET(new Request("https://example.test/api/admin/creators/applications"))).status).toBe(403)
    expect(mocks.authorize).toHaveBeenCalledWith("creator.view")
    expect(mocks.list).not.toHaveBeenCalled()
  })
  it("passes safe reply/page filters and prevents browser caching", async () => {
    const response = await GET(new Request("https://example.test/api/admin/creators/applications?response=needs_review&status=MANUAL_REVIEW&page=2&q=Ada"))
    expect(response.status).toBe(200)
    expect(response.headers.get("Cache-Control")).toContain("no-store")
    expect(mocks.list).toHaveBeenCalledWith(expect.objectContaining({ response: "needs_review", status: "MANUAL_REVIEW", q: "Ada" }), 2, 25)
  })
  it("rejects an unknown reply filter", async () => {
    expect((await GET(new Request("https://example.test/api/admin/creators/applications?response=unknown"))).status).toBe(400)
    expect(mocks.list).not.toHaveBeenCalled()
  })
  it("returns an explicit failure rather than an empty success response", async () => {
    mocks.list.mockRejectedValue(new Error("Database offline"))
    expect((await GET(new Request("https://example.test/api/admin/creators/applications"))).status).toBe(503)
  })
})
