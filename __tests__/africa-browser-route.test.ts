import { beforeEach, describe, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({ session: vi.fn(), from: vi.fn(), config: vi.fn(), capability: vi.fn(), mapping: vi.fn(), limit: vi.fn(), creatorAllowed: true, contactError: false, contact: null as null | Record<string, unknown>, permission: true, ready: true, insertError: null as null | { code: string }, inserted: [] as Record<string, unknown>[], updated: [] as Record<string, unknown>[] }))
vi.mock("@/lib/admin-auth", () => ({ getSession: mocks.session, hasPermission: (_role: string, permission: string) => mocks.permission && (permission !== "creator.view" || mocks.creatorAllowed) }))
vi.mock("@/lib/supabase", () => ({ isSupabaseConfigured: () => true, supabase: { from: mocks.from } }))
vi.mock("@/lib/africa-browser-voice", () => ({ africaBrowserConfig: mocks.config, africaBrowserReady: () => mocks.ready, africaCapability: mocks.capability }))
vi.mock("@/lib/africastalking", () => ({ resolveAfricaBusinessId: mocks.mapping }))
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: mocks.limit }))
import { GET, POST } from "@/app/api/azera/calls/africa-browser/route"
const request = (body: Record<string, unknown> = { conversationId: "conversation-1", customer_phone: "+19999999999" }, origin?: string) => new Request("https://example.test/africa-browser", { method: "POST", headers: { "Content-Type": "application/json", ...(origin ? { origin } : {}) }, body: JSON.stringify(body) })
beforeEach(() => {
  vi.clearAllMocks(); mocks.permission = true; mocks.ready = true; mocks.insertError = null; mocks.inserted = []; mocks.updated = []
  mocks.creatorAllowed = true; mocks.contactError = false; mocks.contact = { id: "creator-1", full_name: "Ada Creator", phone: "08000000002", status: "ACTIVE" }
  mocks.mapping.mockResolvedValue("platform-business"); mocks.limit.mockResolvedValue({ allowed: true })
  mocks.session.mockResolvedValue({ userId: "agent-1", name: "Test Agent", role: "Admin" })
  mocks.config.mockResolvedValue({ apiKey: "test-server-only-key", username: "test-live", phone: "+2348000000000" }); mocks.capability.mockResolvedValue("test-short-lived-capability")
  mocks.from.mockImplementation(table => {
    const q = { select: () => q, eq: () => q, lt: () => q, is: () => q,
      maybeSingle: async () => ({ data: ["creators", "creator_applications"].includes(table) ? mocks.contact : { id: "conversation-1", business_id: "business-1", customer_phone: "08000000001", customer_name: "Customer" }, error: mocks.contactError ? { message: "Database unavailable" } : null }),
      insert: async (row: Record<string, unknown>) => { mocks.inserted.push({ table, ...row }); return { error: table === "azera_calls" ? mocks.insertError : null } },
      update: (row: Record<string, unknown>) => { mocks.updated.push(row); return q },
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({ error: null }).then(resolve),
    }; return q
  })
})
describe("Africa’s Talking browser-call preparation", () => {
  it("reports readiness without leaking provider credentials", async () => {
    const body = await (await GET()).text()
    expect(body).toContain('"ready":true'); expect(body).not.toContain("test-server-only-key")
  })
  it("uses the stored contact number and returns only a short-lived capability, never calling a phone server-side", async () => {
    const response = await POST(request()), body = await response.json()
    expect(response.status).toBe(200)
    expect(body).toMatchObject({ phone: "+2348000000001", token: "test-short-lived-capability", provider: "africas_talking" })
    expect(JSON.stringify(body)).not.toContain("test-server-only-key")
    expect(mocks.inserted[0]).toMatchObject({ sip_provider: "africas_talking_browser", agent_user_id: "agent-1", sip_to_number: "+2348000000001" })
  })
  it("refuses missing configuration before creating a call or issuing a token", async () => {
    mocks.ready = false
    expect((await POST(request())).status).toBe(503)
    expect(mocks.inserted).toHaveLength(0); expect(mocks.capability).not.toHaveBeenCalled()
  })
  it("prevents simultaneous browser telephone sessions for an agent", async () => {
    mocks.insertError = { code: "23505" }
    expect((await POST(request())).status).toBe(409); expect(mocks.capability).not.toHaveBeenCalled()
  })
  it("records a failed preparation if the provider refuses a capability", async () => {
    mocks.capability.mockRejectedValue(new Error("Voice activation required"))
    expect((await POST(request())).status).toBe(502)
    expect(mocks.updated).toContainEqual(expect.objectContaining({ status: "failed" }))
  })
  it("requires an authorised admin-portal agent", async () => {
    mocks.permission = false
    expect((await POST(request())).status).toBe(403); expect(mocks.from).not.toHaveBeenCalled()
  })
  it("prepares a manual number without creating a conversation or exposing a permanent key", async () => {
    const response = await POST(request({ phone: "08000000003", name: "Manual contact", business_id: "untrusted-other-business" }))
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ phone: "+2348000000003", token: "test-short-lived-capability" })
    expect(mocks.inserted[0]).toMatchObject({ business_id: "platform-business", conversation_id: null, customer_name: "Manual contact", sip_to_number: "+2348000000003", agent_user_id: "agent-1" })
    expect(mocks.mapping).toHaveBeenCalledWith("+2348000000000")
    expect(mocks.inserted.some(row => row.table === "azera_conversations")).toBe(false)
    expect(mocks.inserted[1]).toMatchObject({ metadata: { source_type: "manual", source_id: null } })
  })
  it.each(["creatorId", "applicationId"])("reloads %s from the database and records its source", async key => {
    const response = await POST(request({ [key]: "creator-1", customer_phone: "+19999999999" }))
    expect(response.status).toBe(200)
    expect(mocks.inserted[0]).toMatchObject({ conversation_id: null, customer_name: "Ada Creator", customer_phone: "+2348000000002" })
    expect(mocks.inserted[1]).toMatchObject({ metadata: { source_type: key === "creatorId" ? "creator" : "creator_application", source_id: "creator-1" } })
  })
  it.each([{}, { phone: "" }, { phone: "911" }, { phone: "sip:untrusted@example.com" }, { phone: "+2348000000001;dial=1234" }, { phone: "+2348000000001", creatorId: "creator-1" }, { phone: "+2348000000001", name: "Bad\nName" }])("rejects malformed/ambiguous dial requests", async body => {
    expect((await POST(request(body))).status).toBe(400)
    expect(mocks.capability).not.toHaveBeenCalled(); expect(mocks.inserted).toHaveLength(0)
  })
  it("rejects cross-origin requests and rate-limited attempts before issuing a capability", async () => {
    expect((await POST(request({ phone: "+2348000000001" }, "https://evil.example"))).status).toBe(403)
    mocks.limit.mockResolvedValue({ allowed: false })
    expect((await POST(request({ phone: "+2348000000001" }))).status).toBe(429)
    expect(mocks.capability).not.toHaveBeenCalled(); expect(mocks.from).not.toHaveBeenCalled()
  })
  it("requires creator permission and an existing valid creator phone", async () => {
    mocks.creatorAllowed = false
    expect((await POST(request({ creatorId: "creator-1" }))).status).toBe(403)
    mocks.creatorAllowed = true; mocks.contact = null
    expect((await POST(request({ creatorId: "missing" }))).status).toBe(404)
    mocks.contact = { id: "creator-1", phone: "", status: "ACTIVE" }
    expect((await POST(request({ creatorId: "creator-1" }))).status).toBe(400)
    mocks.contact.status = "REMOVED"
    expect((await POST(request({ creatorId: "creator-1" }))).status).toBe(404)
    expect(mocks.capability).not.toHaveBeenCalled()
  })
  it("fails closed if creator lookup or platform business mapping fails", async () => {
    mocks.contactError = true
    expect((await POST(request({ creatorId: "creator-1" }))).status).toBe(503)
    mocks.contactError = false; mocks.mapping.mockResolvedValue(null)
    expect((await POST(request({ phone: "+2348000000001" }))).status).toBe(503)
    expect(mocks.capability).not.toHaveBeenCalled(); expect(mocks.inserted).toHaveLength(0)
  })
})
