import { describe, expect, it } from "vitest"
import { renderToStaticMarkup } from "react-dom/server"
import { isCreatorReplyFilter, summarizeCreatorQuestions, type CreatorQuestionTrackingRow } from "@/lib/creator-question-summary"
import { CreatorQuestionStatus } from "@/components/admin/creator-question-status"

const round = (changes: Partial<CreatorQuestionTrackingRow> = {}): CreatorQuestionTrackingRow => ({ status: "Sent", submitted_at: null, first_viewed_at: null, initial_email_status: "SENT", next_reminder_at: null, ...changes })

describe("Creator reply tracking summary", () => {
  it("distinguishes no questions from unanswered questions", () => {
    expect(summarizeCreatorQuestions([])).toMatchObject({ total: 0, awaiting: 0, needsReview: 0 })
    expect(summarizeCreatorQuestions([round()])).toMatchObject({ total: 1, awaiting: 1, notOpened: 1, needsReview: 0 })
  })
  it("tracks mixed rounds without treating reviewed replies as still unanswered", () => {
    expect(summarizeCreatorQuestions([
      round({ first_viewed_at: "2026-10-20T09:00:00Z", next_reminder_at: "2026-10-29T09:00:00Z" }),
      round({ initial_email_status: "FAILED", next_reminder_at: "2026-10-27T09:00:00Z" }),
      round({ status: "Submitted", submitted_at: "2026-10-26T10:00:00Z" }),
      round({ status: "Reviewed", submitted_at: "2026-10-22T10:00:00Z", next_reminder_at: "2026-10-01T09:00:00Z" }),
    ])).toEqual({ total: 4, awaiting: 2, opened: 1, notOpened: 1, emailFailed: 1, needsReview: 1, reviewed: 1, lastSubmittedAt: "2026-10-26T10:00:00Z", nextReminderAt: "2026-10-27T09:00:00Z" })
  })
  it("accepts only known reply filters", () => {
    expect(isCreatorReplyFilter("needs_review")).toBe(true)
    expect(isCreatorReplyFilter("not_sent")).toBe(true)
    expect(isCreatorReplyFilter("Submitted")).toBe(false)
    expect(isCreatorReplyFilter(null)).toBe(false)
  })
  it("links received answers directly to the question panel and uses a readable status", () => {
    const html = renderToStaticMarkup(<CreatorQuestionStatus applicationId="application-1" summary={summarizeCreatorQuestions([round({ status: "Submitted", submitted_at: "2026-10-26T10:00:00Z" })])} />)
    expect(html).toContain("1 reply needs review")
    expect(html).toContain("/admin/creators/applications/application-1#questions")
    expect(html).toContain("View answers")
    expect(html).toContain("11:00")
    expect(html).toContain("WAT")
  })
  it("does not label email acceptance or link opening as an answer", () => {
    const html = renderToStaticMarkup(<CreatorQuestionStatus applicationId="a" summary={summarizeCreatorQuestions([round({ first_viewed_at: "2026-10-26T10:00:00Z" })])} />)
    expect(html).toContain("1 awaiting a reply · 1 opened")
    expect(html).toContain("Track questions")
    expect(html).not.toContain("View answers")
  })
})
