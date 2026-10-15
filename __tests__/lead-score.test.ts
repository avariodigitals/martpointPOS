import { describe, it, expect } from "vitest"
import { computeLeadScore, type LeadScoreInput } from "../lib/lead-score"

const NOW = new Date("2026-10-14T12:00:00Z")

const base: LeadScoreInput = {
  status: "New",
  branches: "1",
  staffSize: "1-5",
  productInterest: "retail",
  source: "website",
  email: "a@b.com",
  phone: "08012345678",
  submittedAt: "2026-10-12T10:00:00Z",
}

describe("computeLeadScore", () => {
  it("rates a small single-branch lead cold", () => {
    const s = computeLeadScore(base, NOW)
    expect(s.bucket).toBe("cold")
    expect(s.score).toBeLessThan(35)
  })

  it("rates a multi-branch ERP lead with estimate and questionnaire hot", () => {
    const s = computeLeadScore(
      {
        ...base,
        branches: "4-6",
        staffSize: "16-30",
        productInterest: "erp",
        estimate: { retail: { planName: "X" } },
        challenge: "stock keeps running out",
        message: "we need this before December",
        questionnaireStatus: "Submitted",
        source: "explee",
      },
      NOW,
    )
    expect(s.bucket).toBe("hot")
    expect(s.score).toBeGreaterThanOrEqual(60)
    expect(s.reasons.length).toBeGreaterThanOrEqual(8)
  })

  it("short-circuits Won and Lost", () => {
    expect(computeLeadScore({ ...base, status: "Won" }, NOW).bucket).toBe("won")
    expect(computeLeadScore({ ...base, status: "Lost" }, NOW)).toMatchObject({ score: 0, bucket: "lost" })
  })

  it("caps at 100", () => {
    const huge = computeLeadScore(
      { ...base, branches: "10+", staffSize: "50+", productInterest: "erp", estimate: {}, challenge: "x", message: "y", questionnaireStatus: "Reviewed", source: "explee" },
      NOW,
    )
    expect(huge.score).toBeLessThanOrEqual(100)
  })

  it("penalises staleness (no recency points after 30 days)", () => {
    const old = computeLeadScore({ ...base, submittedAt: "2026-01-01T00:00:00Z" }, NOW)
    const fresh = computeLeadScore(base, NOW)
    expect(fresh.score - old.score).toBe(6)
    expect(old.reasons.some((r) => r.includes("Fresh"))).toBe(false)
  })

  it("ignores unknown option values without crashing", () => {
    const s = computeLeadScore(
      { ...base, branches: "banana", staffSize: "?", productInterest: "", source: "usenet" },
      NOW,
    )
    expect(s.score).toBeGreaterThanOrEqual(0)
    expect(s.reasons.some((r) => r.includes("banana"))).toBe(false)
  })

  it("requires meaningful challenge/message text (>2 chars)", () => {
    const s = computeLeadScore({ ...base, challenge: "hi", message: "" }, NOW)
    expect(s.reasons.some((r) => r.includes("challenge"))).toBe(false)
  })
})
