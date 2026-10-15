import { describe, it, expect } from "vitest"
import { positionForElapsed, computeConnectionStatus } from "@/lib/client-checkins"
import { founderReplyTo, buildSignatureBlock, DEFAULT_CLIENT_CHECKIN_CONFIG } from "@/lib/automations"
import { EMAIL_TEMPLATES } from "@/lib/email-templates"

const DAY = 86_400_000

describe("positionForElapsed", () => {
  const anchor = Date.UTC(2026, 0, 1)
  const at = (days: number) => anchor + days * DAY
  const milestones = DEFAULT_CLIENT_CHECKIN_CONFIG.milestoneDays // [30,60,90,120,180,270,365]

  it("schedules the 30-day check-in for a fresh client", () => {
    const pos = positionForElapsed(anchor, at(5), milestones)
    expect(pos.step).toBe(1)
    expect(new Date(pos.scheduledFor).getTime()).toBe(at(30))
  })

  it("positions a legacy client at the next unreached milestone", () => {
    const pos = positionForElapsed(anchor, at(95), milestones)
    expect(pos.step).toBe(4)
    expect(new Date(pos.scheduledFor).getTime()).toBe(at(120))
  })

  it("places a half-year-old client on the 180-day check-in", () => {
    const pos = positionForElapsed(anchor, at(130), milestones)
    expect(pos.step).toBe(5)
    expect(new Date(pos.scheduledFor).getTime()).toBe(at(180))
  })

  it("positions a past-120-day client on the 1-year thank-you", () => {
    const pos = positionForElapsed(anchor, at(300), milestones)
    expect(pos.step).toBe(7)
    expect(new Date(pos.scheduledFor).getTime()).toBe(at(365))
  })

  it("makes the final milestone due now for very old clients", () => {
    const pos = positionForElapsed(anchor, at(400), milestones)
    expect(pos.step).toBe(7)
    expect(pos.scheduledFor).toBe(new Date(at(400)).toISOString())
  })
})

describe("founderReplyTo", () => {
  it("builds a Reply-To header from the default founder config", () => {
    expect(founderReplyTo(DEFAULT_CLIENT_CHECKIN_CONFIG)).toBe("Ralph at MartPoint <ralph@martpoint.com.ng>")
  })

  it("falls back to the founder address when the configured email is invalid", () => {
    const header = founderReplyTo({ ...DEFAULT_CLIENT_CHECKIN_CONFIG, founderEmail: "evil\r\nX-Injected: 1" })
    expect(header).toBe("Ralph at MartPoint <ralph@martpoint.com.ng>")
  })

  it("strips angle brackets from the founder name", () => {
    const header = founderReplyTo({ ...DEFAULT_CLIENT_CHECKIN_CONFIG, founderName: "Ra<lph>here" })
    expect(header).toBe("Ralphhere at MartPoint <ralph@martpoint.com.ng>")
  })
})

describe("buildSignatureBlock", () => {
  it("renders nothing when no signature image is configured", () => {
    expect(buildSignatureBlock(DEFAULT_CLIENT_CHECKIN_CONFIG)).toBe("")
  })

  it("renders the hosted signature image with a sanitised alt name", () => {
    const html = buildSignatureBlock({
      ...DEFAULT_CLIENT_CHECKIN_CONFIG,
      founderName: 'Ra<l>ph"',
      signatureImageUrl: "https://example.com/sign.png",
    })
    expect(html).toContain('src="https://example.com/sign.png"')
    expect(html).toContain('alt="Ralph"')
  })
})

describe("computeConnectionStatus", () => {
  const now = Date.UTC(2026, 9, 15)
  const at = (daysAgo: number) => new Date(now - daysAgo * DAY).toISOString()

  it("marks installs that never checked in as not connected", () => {
    expect(computeConnectionStatus(null, now)).toBe("not_connected")
  })

  it("marks recent POS usage as recently active", () => {
    expect(computeConnectionStatus(at(5), now)).toBe("recently_active")
  })

  it("treats exactly 30 days as the last recently-active moment", () => {
    expect(computeConnectionStatus(at(30), now)).toBe("recently_active")
  })

  it("flags 31+ days of silence for the quiet review list", () => {
    expect(computeConnectionStatus(at(31), now)).toBe("no_checkin_30d")
  })
})

describe("dormancy safety defaults", () => {
  it("keeps automatic dormancy emails OFF until the owner enables them", () => {
    expect(DEFAULT_CLIENT_CHECKIN_CONFIG.dormantEnabled).toBe(false)
  })
})

describe("client_dormant wording", () => {
  const tpl = EMAIL_TEMPLATES.find((t) => t.key === "client_dormant")
  const all = `${tpl?.subject || ""} ${tpl?.text || ""} ${tpl?.html || ""}`.toLowerCase()

  it("exists and carries the founder card", () => {
    expect(tpl).toBeTruthy()
    expect(tpl?.html).toContain("founder-card-flowers.png")
  })

  it("asks about a missing check-in instead of accusing the client", () => {
    expect(all).toContain("received a recent check-in")
    expect(all).not.toMatch(/stopped using|hasn.t opened|last opened|we've missed you|goes quiet/)
  })
})
