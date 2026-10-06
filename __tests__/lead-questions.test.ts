import { describe, it, expect } from "vitest"
import { buildQuestionRoundPublicUrl, mapQuestionRound } from "@/lib/lead-questions"

describe("mapQuestionRound", () => {
  it("maps a stored row to an additional-questions round", () => {
    const round = mapQuestionRound({
      id: "round-1",
      lead_id: "lead-1",
      token: "token-1",
      title: "Additional Questions",
      status: "Submitted",
      fields: [{ name: "q_delivery", label: "Delivery requirements", type: "text" }],
      responses: { q_delivery: "Weekly" },
      sent_at: "2026-10-01T10:00:00Z",
      submitted_at: "2026-10-01T11:00:00Z",
      reviewed_at: null,
      created_at: "2026-10-01T09:59:00Z",
    })

    expect(round).toEqual({
      id: "round-1",
      leadId: "lead-1",
      token: "token-1",
      title: "Additional Questions",
      status: "Submitted",
      fields: [{ name: "q_delivery", label: "Delivery requirements", type: "text" }],
      responses: { q_delivery: "Weekly" },
      sentAt: "2026-10-01T10:00:00Z",
      submittedAt: "2026-10-01T11:00:00Z",
      reviewedAt: null,
      createdAt: "2026-10-01T09:59:00Z",
    })
  })

  it("falls back to safe defaults when columns are empty", () => {
    const round = mapQuestionRound({ id: "round-2", lead_id: "lead-2", token: "token-2" })

    expect(round.title).toBe("Additional Questions")
    expect(round.status).toBe("Sent")
    expect(round.fields).toEqual([])
    expect(round.responses).toEqual({})
    expect(round.sentAt).toBeNull()
    expect(round.submittedAt).toBeNull()
    expect(round.reviewedAt).toBeNull()
  })
})

describe("buildQuestionRoundPublicUrl", () => {
  it("builds the /questions link and strips a trailing slash from the base", () => {
    const previous = process.env.NEXT_PUBLIC_BASE_URL
    process.env.NEXT_PUBLIC_BASE_URL = "https://martpoint.com.ng/"
    try {
      expect(buildQuestionRoundPublicUrl("abc123")).toBe("https://martpoint.com.ng/questions/abc123")
    } finally {
      if (previous === undefined) delete process.env.NEXT_PUBLIC_BASE_URL
      else process.env.NEXT_PUBLIC_BASE_URL = previous
    }
  })
})
