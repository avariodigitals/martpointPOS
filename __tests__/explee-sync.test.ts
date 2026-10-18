import { describe, it, expect } from "vitest"
import { buildExpleeLeadInput, mapExpleeMessage, type ExpleeHotLead, type ExpleeThreadMessage } from "@/lib/explee"

function hotLead(partial: Partial<ExpleeHotLead> = {}): ExpleeHotLead {
  return {
    person_id: "per_123",
    campaign_id: 7,
    name: "Ada Obi",
    email: "ada@acme.com",
    job_title: "Head of Operations",
    company_name: "Acme Ltd",
    company_domain: "acme.com",
    linkedin_url: "https://linkedin.com/in/ada",
    country: "NG",
    phone: "+2348012345678",
    why_hot: "We need POS for 4 branches, send pricing.",
    became_hot_at: "2026-10-12T09:30:00Z",
    ...partial,
  }
}

function threadMessage(partial: Partial<ExpleeThreadMessage> = {}): ExpleeThreadMessage {
  return {
    type: "sent",
    from_email: "sales@martpoint.com.ng",
    to_email: "ada@acme.com",
    subject: "MartPoint for Acme",
    body_text: "Hello Ada,",
    message_id: "<msg-1@explee>",
    status: "delivered",
    ts: "2026-10-12T08:00:00Z",
    ...partial,
  }
}

describe("buildExpleeLeadInput", () => {
  it("maps a full hot lead onto the shared lead intake fields", () => {
    const input = buildExpleeLeadInput(hotLead())
    expect(input).not.toBeNull()
    expect(input).toMatchObject({
      fullName: "Ada Obi",
      businessName: "Acme Ltd",
      email: "ada@acme.com",
      phone: "+2348012345678",
      source: "leadsrite",
      externalId: "explee:per_123",
    })
    expect(input!.message).toContain("campaign 7")
    expect(input!.message).toContain("Role: Head of Operations")
    expect(input!.message).toContain("Website: acme.com")
    expect(input!.message).toContain("LinkedIn: https://linkedin.com/in/ada")
    expect(input!.message).toContain("Country: NG")
    expect(input!.message).toContain("We need POS for 4 branches, send pricing.")
  })

  it("skips leads without an email address", () => {
    expect(buildExpleeLeadInput(hotLead({ email: null }))).toBeNull()
    expect(buildExpleeLeadInput(hotLead({ email: "   " }))).toBeNull()
  })

  it("falls back to sensible placeholders when fields are missing", () => {
    const input = buildExpleeLeadInput(
      hotLead({ name: null, company_name: null, job_title: null, why_hot: null, campaign_id: null, phone: null }),
    )
    expect(input!.fullName).toBe("ada@acme.com")
    expect(input!.businessName).toBe("Not provided")
    expect(input!.message).not.toContain("campaign")
    expect(input!.message).not.toContain("Their reply")
  })
})

describe("mapExpleeMessage", () => {
  it("maps an outbound message to a sent thread row", () => {
    const row = mapExpleeMessage(threadMessage(), "per_123", 0)
    expect(row).toMatchObject({
      direction: "outbound",
      status: "sent",
      provider: "explee",
      provider_message_id: "<msg-1@explee>",
      created_at: "2026-10-12T08:00:00Z",
    })
  })

  it("maps a reply to a received thread row", () => {
    const row = mapExpleeMessage(threadMessage({ type: "reply", status: null }), "per_123", 0)
    expect(row).toMatchObject({ direction: "inbound", status: "received" })
  })

  it("marks failed outbound deliveries as failed", () => {
    const row = mapExpleeMessage(threadMessage({ status: "bounced" }), "per_123", 0)
    expect(row.status).toBe("failed")
  })

  it("falls back to a stable dedupe key when the message has no id", () => {
    const row = mapExpleeMessage(threadMessage({ message_id: null }), "per_123", 4)
    expect(row.provider_message_id).toBe("explee:per_123:2026-10-12T08:00:00Z")

    const noTs = mapExpleeMessage(threadMessage({ message_id: null, ts: null }), "per_123", 4)
    expect(noTs.provider_message_id).toBe("explee:per_123:4")
    expect(noTs).not.toHaveProperty("created_at")
  })
})
