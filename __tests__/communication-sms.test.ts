import { beforeEach, describe, expect, it, vi } from "vitest"
const m = vi.hoisted(() => ({ settings: vi.fn(), fetch: vi.fn(), upsert: vi.fn() }))
vi.mock("@/lib/settings", () => ({ readSettings: m.settings }))
vi.mock("@/lib/africa-browser-voice", () => ({ africaBrowserConfig: async () => ({ apiKey: "africa-key", username: "app" }) }))
vi.mock("@/lib/supabase", () => ({ supabase: { from: () => ({ upsert: m.upsert }) } }))
import { getCommunicationSmsConfig, recordCommunicationSmsOptOut, sendCommunicationSms } from "@/lib/communication-sms"
beforeEach(() => {
  vi.clearAllMocks(); vi.stubGlobal("fetch", m.fetch)
  m.settings.mockResolvedValue({ communications: { sms: { provider: "bulksmsnigeria", sender: "MartPoint", apiKey: "private-token" } } })
  m.upsert.mockResolvedValue({ error: null })
})
describe("direct SMS provider delivery", () => {
  it("uses the PHP provider by default", async () => {
    m.settings.mockResolvedValue({})
    expect((await getCommunicationSmsConfig()).provider).toBe("bulksmsnigeria")
  })
  it("uses BulkSMSNigeria v2 bearer auth and body, without an application wallet", async () => {
    m.fetch.mockResolvedValue(new Response(JSON.stringify({ data: { status: "success", message_id: "sms-1" } })))
    expect(await sendCommunicationSms("08031234567", "Hi Ada")).toMatchObject({ status: "accepted", providerId: "sms-1" })
    const [url, init] = m.fetch.mock.calls[0]
    expect(url).toBe("https://www.bulksmsnigeria.com/api/v2/sms")
    expect(init.headers.Authorization).toBe("Bearer private-token")
    expect(JSON.parse(init.body)).toEqual({ from: "MartPoint", to: "2348031234567", body: "Hi Ada" })
  })
  it("recognizes HTTP 200 provider errors as failures", async () => {
    m.fetch.mockResolvedValue(new Response(JSON.stringify({ status: "error" })))
    expect((await sendCommunicationSms("08031234567", "Hello")).status).toBe("failed")
  })
  it("holds timeout and malformed outcomes for review rather than retrying", async () => {
    m.fetch.mockRejectedValueOnce(new Error("timeout"))
    expect((await sendCommunicationSms("08031234567", "Hello")).status).toBe("unknown")
    m.fetch.mockResolvedValue(new Response("not JSON"))
    expect((await sendCommunicationSms("08031234567", "Hello")).status).toBe("unknown")
    expect(m.fetch).toHaveBeenCalledTimes(2)
  })
  it("does not contact providers for invalid or oversized messages", async () => {
    expect((await sendCommunicationSms("bad", "Hi")).status).toBe("failed")
    expect((await sendCommunicationSms("08031234567", "x".repeat(481))).status).toBe("failed")
    expect(m.fetch).not.toHaveBeenCalled()
  })
  it("requires Africa's Talking to accept the recipient, not just the HTTP request", async () => {
    m.settings.mockResolvedValue({ communications: { sms: { provider: "africastalking", sender: "MartPoint" } } })
    m.fetch.mockResolvedValue(new Response(JSON.stringify({ SMSMessageData: { Recipients: [{ statusCode: 101, messageId: "africa-1" }] } })))
    expect((await sendCommunicationSms("08031234567", "Hi")).providerId).toBe("africa-1")
  })
  it("records STOP against the normalized phone and reports persistence failures", async () => {
    expect(await recordCommunicationSmsOptOut("08031234567", " stop ")).toBe(true)
    expect(m.upsert).toHaveBeenCalledWith(expect.objectContaining({ channel: "sms", address: "+2348031234567" }))
    expect(await recordCommunicationSmsOptOut("08031234567", "Hello")).toBe(false)
    m.upsert.mockResolvedValue({ error: { message: "offline" } })
    await expect(recordCommunicationSmsOptOut("08031234567", "STOP")).rejects.toThrow("opt-out")
  })
})
