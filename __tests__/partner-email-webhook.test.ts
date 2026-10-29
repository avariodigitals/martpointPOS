import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const m = vi.hoisted(() => ({ partner: vi.fn(), lead: vi.fn(), support: vi.fn() }))
vi.mock("@/lib/supabase", () => ({ isSupabaseConfigured: () => true }))
vi.mock("@/lib/lead-emails-inbound", () => ({ fileInboundLeadEmail: m.lead }))
vi.mock("@/lib/support-email-inbound", () => ({ fileInboundSupportEmail: m.support }))
vi.mock("@/lib/partner-emails-inbound", () => ({
  fileInboundPartnerEmail: m.partner,
  isPartnerMailbox: (to: string) => to === "partners@martpoint.com.ng"
}))
import { POST } from "@/app/api/webhooks/email/route"

function request(secret = "test-secret") {
  return new Request("http://localhost/api/webhooks/email", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-webhook-secret": secret },
    body: JSON.stringify({ from: "partner@example.test", to: "partners@martpoint.com.ng", text: "Hello" })
  })
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv("INBOUND_EMAIL_WEBHOOK_SECRET", "test-secret")
})
afterEach(() => { vi.unstubAllEnvs() })

describe("partner inbound webhook", () => {
  it("files authenticated partner mail without putting it into lead or support history", async () => {
    m.partner.mockResolvedValue(true)
    const response = await POST(request())
    expect(response.status).toBe(200)
    expect((await response.json()).matched).toBe(1)
    expect(m.partner).toHaveBeenCalledWith(expect.objectContaining({ provider: "webhook", text: "Hello" }))
    expect(m.lead).not.toHaveBeenCalled()
    expect(m.support).not.toHaveBeenCalled()
  })
  it("rejects a wrong secret before filing any correspondence", async () => {
    expect((await POST(request("wrong"))).status).toBe(401)
    expect(m.partner).not.toHaveBeenCalled()
  })
  it("requires authentication to be configured before accepting partner correspondence", async () => {
    vi.stubEnv("INBOUND_EMAIL_WEBHOOK_SECRET", "")
    expect((await POST(request())).status).toBe(503)
    expect(m.partner).not.toHaveBeenCalled()
  })
  it("returns a retryable failure when partner history cannot be saved", async () => {
    m.partner.mockRejectedValue(new Error("temporarily unavailable"))
    expect((await POST(request())).status).toBe(500)
  })
})
