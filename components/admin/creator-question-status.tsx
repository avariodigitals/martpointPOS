import Link from "next/link"
import type { CreatorQuestionSummary } from "@/lib/creator-question-summary"

export function CreatorQuestionStatus({ summary, applicationId }: { summary: CreatorQuestionSummary; applicationId: string }) {
  if (!summary.total) return <span className="text-xs text-muted-foreground">No questions sent</span>
  return (
    <div className="min-w-44 space-y-1.5 text-xs">
      {summary.needsReview > 0 && <p className="font-semibold text-amber-800">{summary.needsReview} {summary.needsReview === 1 ? "reply needs" : "replies need"} review</p>}
      {summary.awaiting > 0 && <p className="text-slate-700">{summary.awaiting} awaiting a reply · {summary.opened} opened</p>}
      {summary.reviewed > 0 && <p className="text-green-800">{summary.reviewed} reviewed</p>}
      {summary.emailFailed > 0 && <p className="text-red-700">{summary.emailFailed} initial {summary.emailFailed === 1 ? "email failed" : "emails failed"}</p>}
      {summary.lastSubmittedAt && <p className="text-muted-foreground">Last reply {new Date(summary.lastSubmittedAt).toLocaleString("en-GB", { timeZone: "Africa/Lagos", dateStyle: "medium", timeStyle: "short" })} WAT</p>}
      <Link className="inline-flex font-medium text-retail underline underline-offset-2" href={`/admin/creators/applications/${applicationId}#questions`}>
        {summary.needsReview > 0 || summary.reviewed > 0 ? "View answers" : "Track questions"}
      </Link>
    </div>
  )
}
