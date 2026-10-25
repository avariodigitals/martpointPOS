import { beforeEach, describe, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({ session: vi.fn(), from: vi.fn(), config: vi.fn(), capability: vi.fn(), permission: true, ready: true, insertError: null as null | { code: string }, inserted: [] as Record<string, unknown>[], updated: [] as Record<string, unknown>[] }))
vi.mock("@/lib/admin-auth", () => ({ getSession: mocks.session, hasPermission: () => mocks.permission }))
vi.mock("@/lib/supabase", () => ({ isSupabaseConfigured: () => true, supabase: { from: mocks.from } }))
vi.mock("@/lib/africa-browser-voice", () => ({ africaBrowserConfig: mocks.config, africaBrowserReady: () => mocks.ready, africaCapability: mocks.capability }))
import { GET, POST } from "@/app/api/azera/calls/africa-browser/route"
const request = (body = { conversationId: "conversation-1", customer_phone: "+19999999999" }) => new Request("https://example.test/africa-browser", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
beforeEach(() => {
  vi.clearAllMocks(); mocks.permission = true; mocks.ready = true; mocks.insertError = null; mocks.inserted = []; mocks.updated = []
  mocks.session.mockResolvedValue({ userId: "agent-1", name: "Test Agent", role: "Admin" })
  mocks.config.mockResolvedValue({ apiKey: "test-server-only-key", username: "test-live", phone: "+2348000000000" }); mocks.capability.mockResolvedValue("test-short-lived-capability")
  mocks.from.mockImplementation(table => {
    const q = { select: () => q, eq: () => q, lt: () => q,
      maybeSingle: async () => ({ data: { id: "conversation-1", business_id: "business-1", customer_phone: "08000000001", customer_name: "Customer" }, error: null }),
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
})
