import { describe, it, expect } from "vitest"
import {
  isTicketVisibleToPartner,
  addBusinessMinutes,
} from "@/lib/support"
import { canPartnerAccessSupportCategory, isSensitiveSupportCategory } from "@/lib/support-permissions"

describe("partner ticket visibility", () => {
  const baseTicket: any = {
    id: "t1",
    business_id: "b1",
    category: "SOFTWARE",
    assigned_partner_id: "p1",
    complained_about_partner_id: null,
  }

  it("allows assigned partner to view non-sensitive ticket", () => {
    expect(isTicketVisibleToPartner(baseTicket, "p1")).toBe(true)
  })

  it("blocks a different partner from viewing the ticket", () => {
    expect(isTicketVisibleToPartner(baseTicket, "p2")).toBe(false)
  })

  it("blocks a partner from viewing sensitive categories", () => {
    const sensitive = { ...baseTicket, category: "BILLING" }
    expect(isTicketVisibleToPartner(sensitive, "p1")).toBe(false)
    expect(canPartnerAccessSupportCategory("SECURITY")).toBe(false)
  })

  it("blocks the complained-about partner from viewing the complaint", () => {
    const complaint = { ...baseTicket, category: "PARTNER_COMPLAINT", complained_about_partner_id: "p1" }
    expect(isTicketVisibleToPartner(complaint, "p1")).toBe(false)
    // Another partner may be assigned, but the complaint is MartPoint-only
    expect(isTicketVisibleToPartner({ ...complaint, assigned_partner_id: "p2" }, "p2")).toBe(false)
  })
})

describe("business-hours SLA calculation", () => {
  const hours = {
    id: "h1",
    timezone: "Africa/Lagos",
    working_days: [1, 2, 3, 4, 5],
    opening_time: "09:00:00",
    closing_time: "17:00:00",
    active: true,
  }

  // Monday 11:00 WAT => add 60 minutes => same day 12:00 WAT => 11:00 UTC
  it("adds minutes within working hours", () => {
    const start = new Date("2026-01-05T10:00:00.000Z")
    const result = addBusinessMinutes(start, 60, hours)
    const hour = result.getUTCHours()
    const minutes = result.getUTCMinutes()
    expect(hour).toBe(11)
    expect(minutes).toBe(0)
  })

  // Monday 18:00 WAT => crosses to Tuesday 09:00 + 60 min = 10:00
  it("rolls over when starting after close", () => {
    const start = new Date("2026-01-05T18:00:00.000Z") // 19:00 WAT = after 17:00
    const result = addBusinessMinutes(start, 60, hours)
    const day = result.getUTCDay()
    const hour = result.getUTCHours()
    // Next working day is Tuesday 6th; 10:00 WAT = 09:00 UTC
    expect(day).toBe(2)
    expect(hour).toBe(9)
  })

  // Friday after 17:00 -> Monday 09:00 + 60 min
  it("skips weekend for Friday after hours", () => {
    const start = new Date("2026-01-09T18:00:00.000Z") // Friday 19:00 WAT
    const result = addBusinessMinutes(start, 60, hours)
    const day = result.getUTCDay()
    const hour = result.getUTCHours()
    expect(day).toBe(1)
    expect(hour).toBe(9)
  })

  // Saturday -> Monday 09:00 + 60 min
  it("skips weekend when starting on Saturday", () => {
    const start = new Date("2026-01-10T12:00:00.000Z") // Saturday
    const result = addBusinessMinutes(start, 60, hours)
    const day = result.getUTCDay()
    expect(day).toBe(1)
  })

  // Opened during working hours, long enough to cross close
  it("pauses at close and resumes next day", () => {
    const start = new Date("2026-01-05T16:00:00.000Z") // 17:00 WAT close
    const result = addBusinessMinutes(start, 120, hours)
    const day = result.getUTCDay()
    const hour = result.getUTCHours()
    // 17:00 close + 120 min next day 09:00-11:00 WAT => 10:00 UTC
    expect(day).toBe(2)
    expect(hour).toBe(10)
  })
})
