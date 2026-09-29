import { describe, it, expect } from "vitest"
import { decideCommissionEligibility } from "@/lib/partner-ops"

const base = {
  paymentStatus: "CONFIRMED",
  businessStatus: "ACTIVE",
  partnerStatus: "ACTIVE",
  earnedAt: "2026-09-01T00:00:00.000Z",
  holdDays: 0,
  nowMs: new Date("2026-09-15T00:00:00.000Z").getTime(),
}

describe("commission eligibility gates", () => {
  it("promotes when payment confirmed, business live, partner active and hold elapsed", () => {
    expect(decideCommissionEligibility(base)).toBe("PROMOTE")
  })

  it("reverses when the payment was refunded, reversed or failed", () => {
    for (const paymentStatus of ["REFUNDED", "REVERSED", "FAILED", "PARTIALLY_REFUNDED"]) {
      const outcome = decideCommissionEligibility({ ...base, paymentStatus })
      expect(["REVERSE", "HOLD"]).toContain(outcome)
    }
    expect(decideCommissionEligibility({ ...base, paymentStatus: "REFUNDED" })).toBe("REVERSE")
    expect(decideCommissionEligibility({ ...base, paymentStatus: "REVERSED" })).toBe("REVERSE")
  })

  it("holds while the payment is still unconfirmed", () => {
    expect(decideCommissionEligibility({ ...base, paymentStatus: "PENDING" })).toBe("HOLD")
  })

  it("holds while the customer business is not live", () => {
    for (const businessStatus of ["ONBOARDING", "PARTNER_COMPLETED", "SUSPENDED", "CHURNED", null]) {
      expect(decideCommissionEligibility({ ...base, businessStatus })).toBe("HOLD")
    }
    expect(decideCommissionEligibility({ ...base, businessStatus: "GO_LIVE_APPROVED" })).toBe("PROMOTE")
  })

  it("holds when the partner is suspended or terminated", () => {
    expect(decideCommissionEligibility({ ...base, partnerStatus: "SUSPENDED" })).toBe("HOLD")
    expect(decideCommissionEligibility({ ...base, partnerStatus: "TERMINATED" })).toBe("HOLD")
  })

  it("holds until the clawback holding period elapses", () => {
    expect(decideCommissionEligibility({ ...base, holdDays: 30 })).toBe("HOLD")
    expect(
      decideCommissionEligibility({ ...base, holdDays: 30, nowMs: new Date("2026-10-02T00:00:00.000Z").getTime() })
    ).toBe("PROMOTE")
  })

  it("promotes milestone fees with no linked payment once other gates pass", () => {
    expect(decideCommissionEligibility({ ...base, paymentStatus: null })).toBe("PROMOTE")
  })
})
