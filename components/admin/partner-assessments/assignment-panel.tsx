"use client"

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, X, Copy, Mail, Ban, Check } from "lucide-react"
import { useToast } from "@/components/admin/admin-toast"
import { enumLabel } from "@/lib/utils"
import {
  OBJECTIVE_TYPES,
  OUTCOME_LABELS,
  type AnswerGrade,
  type AssessmentAssignment,
  type AssessmentAttempt,
  type AssessmentQuestion,
  type AssignmentStatus,
} from "@/lib/partner-assessments"

const INPUT = "rounded-md border border-input bg-background px-3 py-2 text-sm"

const STATUS_TINT: Record<AssignmentStatus, string> = {
  PENDING: "bg-muted text-muted-foreground",
  IN_PROGRESS: "bg-blue-100 text-blue-800",
  SUBMITTED: "bg-amber-100 text-amber-800",
  GRADED: "bg-emerald-100 text-emerald-800",
  EXPIRED: "bg-red-100 text-red-800",
  WAIVED: "bg-violet-100 text-violet-800",
  CANCELLED: "bg-muted text-muted-foreground line-through",
}

const FILTERS: { label: string; status?: AssignmentStatus; needsReview?: boolean }[] = [
  { label: "All" },
  { label: "Awaiting review", needsReview: true },
  { label: "Not started", status: "PENDING" },
  { label: "In progress", status: "IN_PROGRESS" },
  { label: "Submitted", status: "SUBMITTED" },
  { label: "Graded", status: "GRADED" },
]

function formatWhen(iso: string | null): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
}

function answerText(q: AssessmentQuestion, answer: string[] | string | undefined): string {
  if (answer === undefined) return "— no answer —"
  if (OBJECTIVE_TYPES.includes(q.type)) {
    const keys = Array.isArray(answer) ? answer : [answer]
    if (keys.length === 0) return "— no answer —"
    return keys
      .map((k) => q.options.find((o) => o.key === k)?.text || k)
      .join(", ")
  }
  return String(answer).trim() || "— no answer —"
}

export function AssignmentPanel() {
  const { toast } = useToast()
  const [assignments, setAssignments] = useState<AssessmentAssignment[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState(0)
  const [openId, setOpenId] = useState<string | null>(null)
  const [detail, setDetail] = useState<{
    assignment: AssessmentAssignment
    attempts: AssessmentAttempt[]
    questions: AssessmentQuestion[]
  } | null>(null)
  const [waiveId, setWaiveId] = useState<string | null>(null)
  const [waiveReason, setWaiveReason] = useState("")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      const f = FILTERS[filter]
      if (f.status) params.set("status", f.status)
      if (f.needsReview) params.set("needsReview", "1")
      const res = await fetch(`/api/admin/partner-assessments/assignments?${params.toString()}`)
      const data = await res.json()
      setAssignments((data.assignments || []) as AssessmentAssignment[])
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    load()
  }, [load])

  async function openDetail(id: string) {
    setOpenId(id)
    const res = await fetch(`/api/admin/partner-assessments/assignments/${encodeURIComponent(id)}`)
    const data = await res.json()
    if (!res.ok) {
      toast({ title: data.error || "Could not open this assignment", variant: "error" })
      setOpenId(null)
      return
    }
    setDetail(data)
  }

  function copyLink(token: string) {
    const url = `${window.location.origin}/partners/assessment/${token}`
    navigator.clipboard.writeText(url).then(
      () => toast({ title: "Link copied", variant: "success" }),
      () => toast({ title: url, description: "Copy this link manually", variant: "info", duration: 0 })
    )
  }

  async function act(id: string, action: "waive" | "cancel" | "resend", reason?: string) {
    const res = await fetch(`/api/admin/partner-assessments/assignments/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...(reason ? { reason } : {}) }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      toast({ title: data.error || "That action did not go through", variant: "error" })
      return false
    }
    toast({
      title: action === "waive" ? "Requirement waived" : action === "cancel" ? "Assignment cancelled" : "Link emailed again",
      variant: "success",
    })
    await load()
    if (openId === id && detail) await openDetail(id)
    return true
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm font-medium">Assigned papers</CardTitle>
          <div className="flex flex-wrap gap-1">
            {FILTERS.map((f, i) => (
              <button
                key={f.label}
                onClick={() => setFilter(i)}
                className={`rounded-md px-2.5 py-1 text-xs ${i === filter ? "bg-retail text-white" : "border border-border hover:bg-muted"}`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          {loading && <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />}
          {!loading && assignments.length === 0 && (
            <p className="text-sm text-muted-foreground">Nothing here. Assign a paper from an application or a partner record.</p>
          )}
          <div className="space-y-2">
            {assignments.map((a) => (
              <div key={a.id} className="rounded-lg border border-border p-3 space-y-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {a.assigneeName} <span className="text-muted-foreground">· {a.assigneeEmail}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {a.tier.name} — {a.template.name} · {enumLabel(a.audience)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Assigned by {a.assignedByName || "—"} on {formatWhen(a.assignedAt)}
                      {a.dueAt && ` · due ${formatWhen(a.dueAt)}`}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <span className={`rounded-full px-2 py-0.5 text-xs ${STATUS_TINT[a.status]}`}>{enumLabel(a.status)}</span>
                    {a.bestPercent !== null && (
                      <span className="text-xs">
                        {a.bestPercent}% · {a.finalOutcome ? OUTCOME_LABELS[a.finalOutcome] : "ungraded"}
                      </span>
                    )}
                    {a.attemptsUsed > 0 && (
                      <button onClick={() => openDetail(a.id)} className="text-xs text-retail hover:underline">
                        View attempts ({a.attemptsUsed})
                      </button>
                    )}
                  </div>
                </div>
                {a.waivedReason && <p className="text-xs text-violet-700">Waived: {a.waivedReason}</p>}
                <div className="flex flex-wrap gap-1 pt-1">
                  <Button size="sm" variant="outline" onClick={() => copyLink(a.token)}>
                    <Copy className="w-3.5 h-3.5 mr-1" /> Link
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => act(a.id, "resend")}>
                    <Mail className="w-3.5 h-3.5 mr-1" /> Resend
                  </Button>
                  {a.status !== "WAIVED" && a.status !== "CANCELLED" && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => act(a.id, "cancel")}>
                        <Ban className="w-3.5 h-3.5 mr-1" /> Cancel
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => { setWaiveId(a.id); setWaiveReason("") }}>
                        <Check className="w-3.5 h-3.5 mr-1" /> Waive
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {waiveId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setWaiveId(null)}>
          <div className="w-full max-w-md rounded-lg bg-background p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-medium">Waive this requirement</p>
            <p className="text-xs text-muted-foreground">
              The applicant clears this tier without taking the paper. The reason is written to their history.
            </p>
            <textarea
              value={waiveReason}
              onChange={(e) => setWaiveReason(e.target.value)}
              placeholder="Why is this being waived?"
              rows={3}
              className={`w-full ${INPUT}`}
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={!waiveReason.trim()}
                onClick={async () => {
                  if (await act(waiveId, "waive", waiveReason.trim())) setWaiveId(null)
                }}
              >
                Waive
              </Button>
              <Button size="sm" variant="outline" onClick={() => setWaiveId(null)}>Cancel</Button>
            </div>
          </div>
        </div>
      )}

      {openId && detail && detail.assignment.id === openId && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto" onClick={() => { setOpenId(null); setDetail(null) }}>
          <div className="w-full max-w-3xl rounded-lg bg-background p-5 space-y-4 my-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">{detail.assignment.template.name}</p>
                <p className="text-xs text-muted-foreground">{detail.assignment.assigneeName} · {detail.assignment.tier.name}</p>
              </div>
              <button onClick={() => { setOpenId(null); setDetail(null) }} className="text-muted-foreground hover:text-foreground" aria-label="Close">
                <X className="w-5 h-5" />
              </button>
            </div>
            {detail.attempts.map((att) => (
              <AttemptCard key={att.id} attempt={att} assignment={detail.assignment} questions={detail.questions} onGraded={async () => {
                await load()
                await openDetail(detail.assignment.id)
              }} />
            ))}
          </div>
        </div>
      )}
    </>
  )
}

function AttemptCard({
  attempt,
  assignment,
  questions,
  onGraded,
}: {
  attempt: AssessmentAttempt
  assignment: AssessmentAssignment
  questions: AssessmentQuestion[]
  onGraded: () => Promise<void>
}) {
  const { toast } = useToast()
  const [marks, setMarks] = useState<Record<string, { awarded: number; note?: string }>>({})
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)

  const pending = questions.filter((q) => attempt.grading[q.id]?.needsReview)
  const canMark = attempt.outcome === "PENDING_REVIEW" && pending.length > 0

  async function submitMarks() {
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/partner-assessments/attempts/${encodeURIComponent(attempt.id)}/grade`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marks, ...(notes.trim() ? { notes: notes.trim() } : {}) }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast({ title: data.error || "Could not save the marks", variant: "error" })
        return
      }
      toast({ title: "Marks saved", variant: "success" })
      await onGraded()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-lg border border-border p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium">Attempt {attempt.attemptNo}</p>
        <p className="text-xs text-muted-foreground">
          {attempt.percent !== null ? `${attempt.score}/${attempt.maxScore} · ${attempt.percent}%` : "not scored"}
          {attempt.outcome && ` · ${OUTCOME_LABELS[attempt.outcome]}`}
        </p>
      </div>
      <p className="text-xs text-muted-foreground">
        Started {formatWhen(attempt.startedAt)} · submitted {formatWhen(attempt.submittedAt)}
      </p>

      <div className="space-y-2">
        {questions.map((q) => {
          const grade: AnswerGrade | undefined = attempt.grading[q.id]
          const answer = attempt.answers[q.id]
          const isPending = grade?.needsReview
          return (
            <div key={q.id} className="rounded-md border border-border p-2 space-y-1">
              <p className="text-xs font-medium">{q.prompt}</p>
              <p className="text-xs">Answer: {answerText(q, answer)}</p>
              {grade && (
                <p className={`text-xs ${grade.correct ? "text-emerald-700" : isPending ? "text-amber-700" : "text-red-700"}`}>
                  {isPending ? "Awaiting a marker" : `${grade.awarded}/${grade.max} point${grade.max === 1 ? "" : "s"}`}
                  {grade.source === "KEYWORD" && " · matched by keywords"}
                  {grade.source === "MANUAL" && " · marked by hand"}
                </p>
              )}
              {isPending && canMark && (
                <div className="flex items-center gap-2 pt-1">
                  <label className="text-xs flex items-center gap-1">
                    Points
                    <input
                      type="number"
                      min={0}
                      max={q.points}
                      value={marks[q.id]?.awarded ?? 0}
                      onChange={(e) => setMarks({
                        ...marks,
                        [q.id]: { awarded: Number(e.target.value), note: marks[q.id]?.note },
                      })}
                      className={`w-16 ${INPUT}`}
                    />
                    <span className="text-muted-foreground">of {q.points}</span>
                  </label>
                  <input
                    placeholder="Note (optional)"
                    value={marks[q.id]?.note ?? ""}
                    onChange={(e) => setMarks({ ...marks, [q.id]: { awarded: marks[q.id]?.awarded ?? 0, note: e.target.value } })}
                    className={`flex-1 ${INPUT}`}
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {attempt.reviewNotes && <p className="text-xs text-muted-foreground">Marker notes: {attempt.reviewNotes}</p>}

      {canMark && (
        <div className="space-y-2 pt-2 border-t border-border">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes for the applicant's file (optional)"
            rows={2}
            className={`w-full ${INPUT}`}
          />
          <p className="text-xs text-muted-foreground">
            Mark the {pending.length} written answer{pending.length === 1 ? "" : "s"} above. Any you leave unmarked stay in the queue.
          </p>
          <Button size="sm" onClick={submitMarks} disabled={saving || Object.keys(marks).length === 0}>
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
            Save marks and score
          </Button>
        </div>
      )}
    </div>
  )
}
