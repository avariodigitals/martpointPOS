import { describe, it, expect } from "vitest"
import { positionForElapsed } from "@/lib/client-checkins"
import { founderReplyTo, DEFAULT_CLIENT_CHECKIN_CONFIG } from "@/lib/automations"

const DAY = 86_400_000

describe("positionForElapsed", () => {
  const anchor = Date.UTC(2026, 0, 1)
  const at = (days: number) => anchor + days * DAY

  it("schedules the 30-day check-in for a fresh client", () => {
    const pos = positionForElapsed(anchor, at(5), 4)
    expect(pos.step).toBe(1)
    expect(new Date(pos.scheduledFor).getTime()).toBe(at(30))
  })

  it("positions a legacy client at the next unreached milestone", () => {
    const pos = positionForElapsed(anchor, at(95), 4)
    expect(pos.step).toBe(4)
    expect(new Date(pos.scheduledFor).getTime()).toBe(at(120))
  })

  it("makes the final milestone due now for very old clients", () => {
    const pos = positionForElapsed(anchor, at(400), 4)
    expect(pos.step).toBe(4)
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
