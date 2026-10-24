import { beforeEach, describe, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({ admin: vi.fn(), customer: vi.fn(), from: vi.fn(), token: vi.fn() }))
vi.mock("@/lib/admin-auth", () => ({ getSession: mocks.admin, hasPermission: () => true }))
vi.mock("@/lib/customer-support-auth", () => ({ getCustomerSupportSession: mocks.customer }))
vi.mock("@/lib/supabase", () => ({ supabase: { from: mocks.from } }))
vi.mock("@/lib/azera-public-auth", () => ({ verifyConversationToken: mocks.token, tokenFromRequest: (request: Request) => request.headers.get("x-azera-chat-token") }))
import { getCallAccess, callIceServers } from "@/lib/azera-call-access"
const call = { id: "call-1", business_id: "business-1", conversation_id: "conversation-1" }
const conversation = { id: "conversation-1", business_id: "business-1", external_id: "visitor-1" }
const req = (token = false) => new Request("https://example.test", { headers: token ? { "x-azera-chat-token": "token" } : {} })
beforeEach(() => {
  vi.clearAllMocks()
  mocks.admin.mockResolvedValue(null); mocks.customer.mockResolvedValue(null)
  mocks.token.mockReturnValue({ conversationId: "conversation-1", businessId: "business-1", externalId: "visitor-1" })
  mocks.from.mockImplementation((table: string) => {
    const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: table === "azera_calls" ? call : conversation, error: null }) }
    return query
  })
})
describe("Call resource authorization", () => {
  it("authorizes a visitor only for their bound conversation", async () => {
    expect(await getCallAccess(req(true), "call-1")).toMatchObject({ actor: { type: "customer", id: null } })
    mocks.token.mockReturnValue({ conversationId: "another-conversation", businessId: "business-1", externalId: "visitor-1" })
    expect(await getCallAccess(req(true), "call-1")).toBeNull()
    mocks.token.mockReturnValue({ conversationId: "conversation-1", businessId: "business-1", externalId: "another-visitor" })
    expect(await getCallAccess(req(true), "call-1")).toBeNull()
  })
  it("does not allow a customer cookie to access another business’s calls", async () => {
    mocks.customer.mockResolvedValue({ businessId: "business-2" })
    expect(await getCallAccess(req(), "call-1")).toBeNull()
    mocks.customer.mockResolvedValue({ businessId: "business-1" })
    expect(await getCallAccess(req(), "call-1")).toMatchObject({ actor: { type: "customer", id: null } })
  })
  it("keeps public visitor identity even when staff are logged into admin", async () => {
    mocks.admin.mockResolvedValue({ userId: "agent-1", role: "ADMIN" })
    expect(await getCallAccess(req(true), "call-1")).toMatchObject({ actor: { type: "customer" } })
    expect(await getCallAccess(req(), "call-1")).toMatchObject({ actor: { type: "agent", id: "agent-1" } })
    mocks.token.mockReturnValue(null)
    expect(await getCallAccess(req(true), "call-1")).toBeNull()
  })
  it("only exposes TURN configuration with credentials and uses expiring credentials for a shared secret", () => {
    vi.stubEnv("AZERA_TURN_URLS", "turn:relay.example.test:3478,turns:relay.example.test:5349")
    vi.stubEnv("AZERA_TURN_USERNAME", ""); vi.stubEnv("AZERA_TURN_CREDENTIAL", ""); vi.stubEnv("AZERA_TURN_SECRET", "")
    expect(callIceServers()).toHaveLength(1)
    vi.stubEnv("AZERA_TURN_SECRET", "test-only-shared-secret")
    expect(callIceServers()[1]).toMatchObject({ username: expect.stringMatching(/^\d+:azera$/), credential: expect.any(String), urls: expect.any(Array) })
    expect(JSON.stringify(callIceServers())).not.toContain("test-only-shared-secret")
    vi.unstubAllEnvs()
  })
})
