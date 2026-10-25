import { beforeEach, describe, expect, it, vi } from "vitest"
type Query = { table: string; select: ReturnType<typeof vi.fn>; eq: ReturnType<typeof vi.fn>; is: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn>; insert: ReturnType<typeof vi.fn>; maybeSingle: ReturnType<typeof vi.fn> }
const mocks = vi.hoisted(() => ({ session: vi.fn(), settings: vi.fn(), from: vi.fn(), rows: [] as { data: Record<string, unknown> | null; error?: unknown }[],
  api: { room: { createRoom: vi.fn(), deleteRoom: vi.fn(), listParticipants: vi.fn() }, sip: { createSipParticipant: vi.fn() } }, queries: [] as Query[] }))
vi.mock("@/lib/admin-auth", () => ({ getSession: mocks.session, hasPermission: () => true }))
vi.mock("@/lib/settings", () => ({ getSettings: mocks.settings }))
vi.mock("@/lib/supabase", () => ({ isSupabaseConfigured: () => true, supabase: { from: mocks.from } }))
vi.mock("livekit-server-sdk", () => ({
  LiveKitAPI: class { constructor() { return mocks.api } },
  AccessToken: class { addGrant = vi.fn(); toJwt = vi.fn(async () => "scoped-test-token") },
}))
import { TrackType } from "@livekit/protocol"
import { GET as readiness, POST as prepare } from "@/app/api/azera/calls/outbound/route"
import { GET, POST as dial, DELETE as hangup } from "@/app/api/azera/calls/[id]/outbound/route"
import { normalizeOutboundPhone } from "@/lib/azera-outbound"

const config = { serverUrl: "https://voice.example.test", publicUrl: "wss://voice.example.test", apiKey: "test-key", apiSecret: "test-secret", sipHostname: "sip.example.test", sipUsername: "test-login", sipPassword: "test-password", sipNumber: "+2348000000000", destinationCountry: "NG" }
const record = { id: "call-1", agent_user_id: "agent-1", sip_provider: "livekit", direction: "outbound", status: "ringing", sip_call_sid: null, webrtc_room: "azera-out-call-1", sip_to_number: "+2348000000001", started_at: new Date().toISOString(), answered_at: null }
const context = { params: Promise.resolve({ id: "call-1" }) }
const req = (method: string, body?: object) => new Request("https://example.test/api/azera/calls/call-1/outbound", { method, ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}) })
beforeEach(() => {
  vi.clearAllMocks(); mocks.rows.length = 0; mocks.queries.length = 0
  mocks.session.mockResolvedValue({ userId: "agent-1", name: "Test Agent", role: "ADMIN" })
  mocks.settings.mockResolvedValue({ livekit: config })
  mocks.api.room.createRoom.mockResolvedValue({}); mocks.api.room.deleteRoom.mockResolvedValue({})
  mocks.api.room.listParticipants.mockResolvedValue([{ identity: "agent-agent-1", tracks: [{ type: TrackType.AUDIO, muted: false }] }])
  mocks.api.sip.createSipParticipant.mockResolvedValue({ sipCallId: "provider-call", participantId: "sip-participant" })
  mocks.from.mockImplementation((table) => {
    const query = { table } as Query
    for (const key of ["select", "eq", "is", "update"] as const) query[key] = vi.fn(() => query)
    query.insert = vi.fn(async () => ({ error: null }))
    query.maybeSingle = vi.fn(async () => mocks.rows.length ? mocks.rows.shift() : ({ data: { ...record }, error: null }))
    mocks.queries.push(query); return query
  })
})

describe("Omnichannel browser-to-phone endpoints", () => {
  it("requires authorization and only reports configuration presence, never secrets", async () => {
    const response = await readiness()
    expect(await response.json()).toEqual({ ready: true, setupUrl: "/admin/integrations" })
    mocks.session.mockResolvedValue(null)
    expect((await prepare(req("POST", { conversationId: "conversation-1" }))).status).toBe(403)
    expect(mocks.api.sip.createSipParticipant).not.toHaveBeenCalled()
  })
  it("does not write or dial when credentials are missing", async () => {
    mocks.settings.mockResolvedValue({ livekit: { ...config, apiKey: "" } })
    expect((await prepare(req("POST", { conversationId: "conversation-1" }))).status).toBe(503)
    expect(mocks.from).not.toHaveBeenCalled()
  })
  it("prepares a private room and call history using only the stored contact number, without dialing", async () => {
    mocks.rows.push({ data: { id: "conversation-1", business_id: "business-1", customer_phone: "08000000001", customer_name: "Customer" } })
    const response = await prepare(req("POST", { conversationId: "conversation-1", phone: "+19999999999" }))
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ phone: "+2348000000001", token: "scoped-test-token", url: config.publicUrl })
    expect(mocks.queries.find((query) => query.table === "azera_calls")!.insert).toHaveBeenCalledWith(expect.objectContaining({ customer_phone: "+2348000000001", agent_user_id: "agent-1", sip_provider: "livekit" }))
    expect(mocks.api.sip.createSipParticipant).not.toHaveBeenCalled()
  })
  it("does not dial until the owning agent has published live audio", async () => {
    mocks.api.room.listParticipants.mockResolvedValue([{ identity: "agent-agent-1", tracks: [{ type: TrackType.VIDEO, muted: false }] }])
    expect((await dial(req("POST"), context)).status).toBe(409)
    expect(mocks.api.sip.createSipParticipant).not.toHaveBeenCalled()
  })
  it("atomically claims the telephone leg so repeated requests cannot dial twice", async () => {
    mocks.rows.push({ data: record }, { data: null })
    expect((await dial(req("POST"), context)).status).toBe(200)
    expect(mocks.api.sip.createSipParticipant).not.toHaveBeenCalled()
    expect(mocks.queries[1].is).toHaveBeenCalledWith("sip_call_sid", null)
  })
  it("uses the configured SIP caller ID and trunk through LiveKit", async () => {
    expect((await dial(req("POST"), context)).status).toBe(200)
    expect(mocks.api.sip.createSipParticipant).toHaveBeenCalledWith("", record.sip_to_number, record.webrtc_room,
      expect.objectContaining({ fromNumber: config.sipNumber, ringingTimeout: 60, maxCallDuration: 3600, waitUntilAnswered: false }),
      expect.objectContaining({ hostname: config.sipHostname, authUsername: config.sipUsername }))
  })
  it("denies another agent access and scopes every lookup to the logged-in owner", async () => {
    mocks.rows.push({ data: null })
    expect((await hangup(req("DELETE"), context)).status).toBe(403)
    expect(mocks.queries[0].eq).toHaveBeenCalledWith("agent_user_id", "agent-1")
    expect(mocks.api.room.deleteRoom).not.toHaveBeenCalled()
  })
  it("deletes the whole room on hangup, not merely the browser participant", async () => {
    mocks.rows.push({ data: record }, { data: { status: "ended" } })
    const response = await hangup(req("DELETE"), context)
    expect(await response.json()).toEqual({ status: "ended" })
    expect(mocks.api.room.deleteRoom).toHaveBeenCalledWith(record.webrtc_room)
  })
  it("can finish a call whose room has already been deleted", async () => {
    mocks.api.room.deleteRoom.mockRejectedValue({ code: "not_found" })
    mocks.rows.push({ data: record }, { data: { status: "ended" } })
    expect((await hangup(req("DELETE"), context)).status).toBe(200)
  })
  it("reports active only when the SIP participant actually answers", async () => {
    mocks.rows.push({ data: { ...record, sip_call_sid: "provider-call" } }, { data: { status: "active" } })
    mocks.api.room.listParticipants.mockResolvedValue([{ identity: "phone-call-1", attributes: { "sip.callStatus": "active" } }])
    expect(await (await GET(req("GET"), context)).json()).toEqual({ status: "active" })
  })
  it("bounds supported phone formats and rejects injected or malformed destinations", () => {
    expect(normalizeOutboundPhone("0800 000 0001")).toBe("+2348000000001")
    expect(normalizeOutboundPhone("+44 20 1234 5678")).toBe("+442012345678")
    expect(normalizeOutboundPhone("0800;dial=attacker")).toBeNull()
    expect(normalizeOutboundPhone("++2348000000001")).toBeNull()
    expect(normalizeOutboundPhone("123")).toBeNull()
  })
})
