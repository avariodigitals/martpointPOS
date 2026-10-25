import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({ from: vi.fn(), fetch: vi.fn(), settings: vi.fn(), inbound: {} as Record<string, unknown>, config: {} as Record<string, unknown> }))
vi.mock("@/lib/supabase", () => ({ supabase: { from: mocks.from } }))
vi.mock("@/lib/settings", () => ({ getSettings: mocks.settings }))
import { dispatchChannelText } from "@/lib/azera-channel-delivery"
import { validSocialSignature, validSharedWebhookSecret } from "@/lib/azera-social-webhook"
import { createHmac } from "node:crypto"
const conversation = { id: "conversation-1", business_id: "business-1", channel: "whatsapp", external_id: "+2348000000001" }
beforeEach(() => {
  vi.clearAllMocks(); mocks.inbound = { created_at: new Date().toISOString() }; mocks.config = { whatsapp_phone_number_id: "12345", whatsapp_access_token: "test-token", messenger_page_id: "5678", messenger_page_access_token: "test-messenger", instagram_account_id: "9876", instagram_access_token: "test-instagram" }
  mocks.from.mockImplementation(table => { const q = { select: () => q, eq: () => q, order: () => q, limit: () => q, maybeSingle: async () => ({ data: table === "azera_messages" ? mocks.inbound : mocks.config, error: null }) }; return q })
  mocks.fetch.mockResolvedValue(Response.json({ messages: [{ id: "provider-message-1" }] })); vi.stubGlobal("fetch", mocks.fetch)
  mocks.settings.mockResolvedValue({ whatsapp: { apiKey: "test-360-key", baseUrl: "https://waba-v2.360dialog.io", phoneNumber: "+2348000000000" } })
})
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })
describe("Social channel dispatch", () => {
  it("does not call a social provider for website chat", async () => {
    expect(await dispatchChannelText({ ...conversation, channel: "website" }, "Hi")).toEqual({ status: "not_required" })
    expect(fetch).not.toHaveBeenCalled()
  })
  it("sends WhatsApp through Cloud API and requires a provider message ID", async () => {
    expect(await dispatchChannelText(conversation, "Hello")).toEqual({ status: "accepted", providerId: "provider-message-1" })
    expect(mocks.fetch).toHaveBeenCalledWith(expect.stringContaining("/12345/messages"), expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer test-token" }) }))
    expect(JSON.parse(mocks.fetch.mock.calls[0][1].body)).toMatchObject({ to: "2348000000001", text: { body: "Hello" } })
  })
  it("supports the existing 360dialog sender when Cloud credentials are absent", async () => {
    vi.stubEnv("WHATSAPP_ACCESS_TOKEN", ""); vi.stubEnv("WHATSAPP_PHONE_NUMBER_ID", ""); mocks.config = { whatsapp_phone_number: "+2348000000000" }
    expect((await dispatchChannelText(conversation, "Hello")).status).toBe("accepted")
    expect(mocks.fetch).toHaveBeenCalledWith("https://waba-v2.360dialog.io/messages", expect.objectContaining({ headers: expect.objectContaining({ "D360-API-KEY": "test-360-key" }) }))
  })
  it.each(["messenger", "instagram"])("routes %s to its own account and scoped recipient", async channel => {
    mocks.fetch.mockResolvedValue(Response.json({ message_id: "social-id" }))
    expect((await dispatchChannelText({ ...conversation, channel, external_id: `${channel}:123456` }, "Hello")).providerId).toBe("social-id")
    expect(JSON.parse(mocks.fetch.mock.calls[0][1].body).recipient.id).toBe("123456")
  })
  it("refuses expired reply windows based on inbound activity, not the last agent reply", async () => {
    mocks.inbound = { created_at: new Date(Date.now() - 25 * 3_600_000).toISOString() }
    expect((await dispatchChannelText(conversation, "Hello")).status).toBe("failed"); expect(fetch).not.toHaveBeenCalled()
  })
  it("distinguishes known rejection from uncertain network and server outcomes", async () => {
    mocks.fetch.mockResolvedValueOnce(Response.json({}, { status: 403 })).mockResolvedValueOnce(Response.json({}, { status: 503 })).mockRejectedValueOnce(new Error("timeout"))
    expect((await dispatchChannelText(conversation, "Hello")).status).toBe("failed")
    expect((await dispatchChannelText(conversation, "Hello")).status).toBe("unknown")
    expect((await dispatchChannelText(conversation, "Hello")).status).toBe("unknown")
  })
  it("does not pretend a successful HTTP response without a message ID proves delivery", async () => {
    mocks.fetch.mockResolvedValue(Response.json({}))
    expect((await dispatchChannelText(conversation, "Hello")).status).toBe("unknown")
  })
  it("blocks excessive messages and malformed recipients without provider requests", async () => {
    expect((await dispatchChannelText(conversation, "x".repeat(4097))).status).toBe("failed")
    expect((await dispatchChannelText({ ...conversation, external_id: "bad;recipient" }, "Hello")).status).toBe("failed")
    expect(fetch).not.toHaveBeenCalled()
  })
})
describe("Provider webhook authentication", () => {
  it("supports a configured 360dialog webhook secret header, without allowing a missing secret", () => {
    expect(validSharedWebhookSecret("test-only-secret", "test-only-secret")).toBe(true)
    expect(validSharedWebhookSecret("wrong", "test-only-secret")).toBe(false)
    expect(validSharedWebhookSecret(null, "test-only-secret")).toBe(false)
    expect(validSharedWebhookSecret("", "")).toBe(false)
  })
  it("requires a matching HMAC over the original body, never an absent or malformed secret", () => {
    const raw = '{"entry":[]}', signature = `sha256=${createHmac("sha256", "test-secret").update(raw).digest("hex")}`
    expect(validSocialSignature(raw, signature, "test-secret")).toBe(true)
    expect(validSocialSignature(`${raw} `, signature, "test-secret")).toBe(false)
    expect(validSocialSignature(raw, null, "test-secret")).toBe(false)
    expect(validSocialSignature(raw, signature, "")).toBe(false)
  })
})
