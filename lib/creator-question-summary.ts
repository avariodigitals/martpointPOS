/** Public-to-admin tracking metadata only; never include answer tokens or files. */
export interface CreatorQuestionTrackingRow {
  status: string
  submitted_at: string | null
  first_viewed_at: string | null
  initial_email_status: string
  next_reminder_at: string | null
}

export interface CreatorQuestionSummary {
  total: number
  awaiting: number
  needsReview: number
  reviewed: number
  opened: number
  notOpened: number
  emailFailed: number
  lastSubmittedAt: string | null
  nextReminderAt: string | null
}

export const CREATOR_REPLY_FILTERS = [
  { value: "needs_review", label: "Replies needing review" },
  { value: "awaiting_response", label: "Awaiting a reply" },
  { value: "opened", label: "Link opened, no reply" },
  { value: "not_opened", label: "Link not opened" },
  { value: "email_failed", label: "Initial email failed" },
  { value: "reviewed", label: "Reviewed replies" },
  { value: "not_sent", label: "No questions sent" },
] as const
export type CreatorReplyFilter = typeof CREATOR_REPLY_FILTERS[number]["value"]

export function isCreatorReplyFilter(value: unknown): value is CreatorReplyFilter {
  return CREATOR_REPLY_FILTERS.some((filter) => filter.value === value)
}

export function summarizeCreatorQuestions(rounds: CreatorQuestionTrackingRow[]): CreatorQuestionSummary {
  const awaiting = rounds.filter((round) => round.status === "Sent")
  const submissions = rounds.map((round) => round.submitted_at).filter((date): date is string => Boolean(date)).sort()
  const reminders = awaiting.map((round) => round.next_reminder_at).filter((date): date is string => Boolean(date)).sort()
  return {
    total: rounds.length,
    awaiting: awaiting.length,
    needsReview: rounds.filter((round) => round.status === "Submitted").length,
    reviewed: rounds.filter((round) => round.status === "Reviewed").length,
    opened: awaiting.filter((round) => round.first_viewed_at).length,
    notOpened: awaiting.filter((round) => !round.first_viewed_at).length,
    emailFailed: awaiting.filter((round) => round.initial_email_status === "FAILED").length,
    lastSubmittedAt: submissions.at(-1) || null,
    nextReminderAt: reminders[0] || null,
  }
}
