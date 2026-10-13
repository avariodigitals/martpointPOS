"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertCircle, CheckCircle2, Clock, Loader2 } from "lucide-react"
import type { AssessmentQuestion, AssessmentQuestionType } from "@/lib/partner-assessments"

const INPUT = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm"

interface PaperState {
  title: string
  tierName?: string
  description?: string
  instructions?: string
  timeLimitMinutes: number
  passingScore: number
  conditionalScore: number
  maxAttempts: number
  attemptsUsed: number
  attemptsLeft: number
  canStart: boolean
  inProgress?: boolean
  status?: string
  questions?: AssessmentQuestion[]
  answers?: Record<string, string[] | string>
  deadlineAt?: string
  serverNow?: string
  secondsLeft?: number
  attemptNo?: number
  completed?: boolean
  awaitingReview?: boolean
  bestPercent?: number | null
  finalOutcome?: string | null
  result?: { percent: number | null; outcome: string | null } | null
  waived?: boolean
  cancelled?: boolean
  message?: string
}

interface SubmitOutcome {
  percent: number | null
  outcome: string | null
  awaitingReview: boolean
  attemptsLeft: number
  canRetry: boolean
}

function formatClock(seconds: number): string {
  const safe = Math.max(0, seconds)
  const m = Math.floor(safe / 60)
  const s = safe % 60
  return `${m}:${String(s).padStart(2, "0")}`
}

/**
 * Server-authoritative countdown. The offset between the server clock and this
 * browser is measured once at load, so refreshing the page cannot buy time.
 */
function useCountdown(deadlineAt: string | undefined, serverNow: string | undefined, initialSeconds: number | undefined) {
  const offsetRef = useRef<number | null>(null)
  if (offsetRef.current === null && deadlineAt && serverNow) {
    offsetRef.current = Date.now() - new Date(serverNow).getTime()
  }
  const [left, setLeft] = useState(initialSeconds ?? 0)

  useEffect(() => {
    if (!deadlineAt) return
    const target = new Date(deadlineAt).getTime()
    const tick = () => {
      const now = Date.now() - (offsetRef.current ?? 0)
      setLeft(Math.max(0, Math.floor((target - now) / 1000)))
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [deadlineAt])

  return left
}

function AnswerInput({
  type,
  options,
  value,
  help,
  onChange,
}: {
  type: AssessmentQuestionType
  options: { key: string; text: string }[]
  value: string[] | string | undefined
  help?: string
  onChange: (next: string[] | string) => void
}) {
  if (type === "SHORT_TEXT") {
    return <input className={INPUT} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} placeholder={help || "Your answer"} />
  }
  if (type === "LONG_TEXT") {
    return <textarea className={INPUT} rows={5} value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} placeholder={help || "Answer in your own words"} />
  }
  if (type === "MULTI") {
    const chosen = Array.isArray(value) ? value : []
    return (
      <div className="space-y-2">
        {options.map((o) => (
          <label key={o.key} className="flex items-start gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={chosen.includes(o.key)}
              onChange={(e) => onChange(e.target.checked ? [...chosen, o.key] : chosen.filter((k) => k !== o.key))}
              className="mt-1"
            />
            <span>{o.text}</span>
          </label>
        ))}
      </div>
    )
  }
  if (type === "DROPDOWN") {
    const single = Array.isArray(value) ? value[0] ?? "" : String(value ?? "")
    return (
      <select className={INPUT} value={single} onChange={(e) => onChange(e.target.value ? [e.target.value] : [])}>
        <option value="">Choose an answer</option>
        {options.map((o) => <option key={o.key} value={o.key}>{o.text}</option>)}
      </select>
    )
  }
  const single = Array.isArray(value) ? value[0] ?? "" : String(value ?? "")
  return (
    <div className="space-y-2">
      {options.map((o) => (
        <label key={o.key} className="flex items-start gap-2 text-sm cursor-pointer">
          <input type="radio" checked={single === o.key} onChange={() => onChange([o.key])} className="mt-1" />
          <span>{o.text}</span>
        </label>
      ))}
    </div>
  )
}

export function AssessmentRunner({
  loadUrl,
  startUrl,
  submitUrl,
  onBack,
  wide = false,
}: {
  loadUrl: string
  startUrl: string
  submitUrl: string
  onBack?: () => void
  /** Portal pages already sit inside the app frame; the public link does not. */
  wide?: boolean
}) {
  const [paper, setPaper] = useState<PaperState | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [answers, setAnswers] = useState<Record<string, string[] | string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [outcome, setOutcome] = useState<SubmitOutcome | null>(null)
  const [autoSubmitted, setAutoSubmitted] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const res = await fetch(loadUrl)
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "This assessment link is no longer available.")
        return
      }
      setPaper(data as PaperState)
      setAnswers((data.answers || {}) as Record<string, string[] | string>)
    } catch {
      setError("Could not reach MartPoint. Please check your connection and try again.")
    } finally {
      setLoading(false)
    }
  }, [loadUrl])

  useEffect(() => {
    load()
  }, [load])

  const inProgress = Boolean(paper?.inProgress && paper.questions?.length)
  const secondsLeft = useCountdown(
    inProgress ? paper?.deadlineAt : undefined,
    inProgress ? paper?.serverNow : undefined,
    inProgress ? paper?.secondsLeft : undefined
  )

  async function begin() {
    setError("")
    setSubmitting(true)
    try {
      const res = await fetch(startUrl, { method: "POST" })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Could not start the assessment.")
        return
      }
      setPaper((prev) => prev ? {
        ...prev,
        inProgress: true,
        questions: data.questions,
        attemptNo: data.attemptNo,
        deadlineAt: data.deadlineAt,
        serverNow: data.serverNow,
        secondsLeft: data.secondsLeft,
      } : prev)
      setAnswers({})
    } finally {
      setSubmitting(false)
    }
  }

  const submit = useCallback(async () => {
    setSubmitting(true)
    setError("")
    try {
      const res = await fetch(submitUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Could not submit your answers.")
        return
      }
      setOutcome({
        percent: data.percent ?? null,
        outcome: data.outcome ?? null,
        awaitingReview: Boolean(data.awaitingReview),
        attemptsLeft: data.attemptsLeft ?? 0,
        canRetry: Boolean(data.canRetry),
      })
    } catch {
      setError("Could not reach MartPoint. Your answers are still on this page — please try again.")
    } finally {
      setSubmitting(false)
    }
  }, [answers, submitUrl])

  // Time is server-set, so at zero the attempt is already overdue: submit what
  // is on screen rather than leaving the applicant stuck on a dead page.
  const submittedRef = useRef(false)
  useEffect(() => {
    if (!inProgress || submittedRef.current) return
    if (secondsLeft > 0) return
    submittedRef.current = true
    setAutoSubmitted(true)
    submit()
  }, [inProgress, secondsLeft, submit])

  const answeredCount = useMemo(
    () => (paper?.questions || []).filter((q) => {
      const a = answers[q.id]
      return Array.isArray(a) ? a.length > 0 : String(a ?? "").trim().length > 0
    }).length,
    [paper?.questions, answers]
  )

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <Loader2 className="w-7 h-7 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error && !paper) {
    return (
      <Shell wide={wide} title="Assessment unavailable">
        <div className="flex items-start gap-3 py-4">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm">{error}</p>
        </div>
      </Shell>
    )
  }

  if (outcome) {
    return (
      <Shell wide={wide} title={paper?.title || "Assessment"}>
        <div className="py-4 space-y-4 text-center">
          <CheckCircle2 className="w-10 h-10 text-green-600 mx-auto" />
          {outcome.awaitingReview ? (
            <>
              <h2 className="text-lg font-semibold">Submitted</h2>
              <p className="text-sm text-muted-foreground">
                Your written answers need to be read by the MartPoint Partner Team. You will hear from them shortly.
              </p>
            </>
          ) : (
            <>
              <h2 className="text-lg font-semibold">
                {outcome.outcome || "Submitted"} · {outcome.percent ?? 0}%
              </h2>
              <p className="text-sm text-muted-foreground">
                {autoSubmitted
                  ? "Time ran out, so the answers on your screen were submitted."
                  : "Your answers have been recorded against your application."}
              </p>
              {outcome.canRetry && outcome.attemptsLeft > 0 && (
                <p className="text-sm">You have {outcome.attemptsLeft} attempt{outcome.attemptsLeft === 1 ? "" : "s"} left.</p>
              )}
            </>
          )}
          {outcome.canRetry && outcome.attemptsLeft > 0 && (
            <Button
              onClick={() => {
                submittedRef.current = false
                setOutcome(null)
                setAutoSubmitted(false)
                load()
              }}
            >
              Try again
            </Button>
          )}
        </div>
      </Shell>
    )
  }

  if (!paper) {
    return <Shell wide={wide} title="Assessment unavailable"><p className="text-sm py-4">{error || "This link is no longer available."}</p></Shell>
  }

  if (paper.waived || paper.cancelled) {
    return (
      <Shell wide={wide} title={paper.title}>
        <p className="text-sm py-4">{paper.message}</p>
      </Shell>
    )
  }

  if (!inProgress) {
    const done = paper.completed || paper.status === "GRADED" || paper.status === "SUBMITTED"
    const noAttemptsLeft = !paper.canStart && !done
    return (
      <Shell wide={wide} title={paper.title}>
        <div className="space-y-4 py-2">
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-muted px-2.5 py-1">{paper.timeLimitMinutes} minutes</span>
            <span className="rounded-full bg-muted px-2.5 py-1">Pass {paper.passingScore}%</span>
            <span className="rounded-full bg-muted px-2.5 py-1">
              Attempt {Math.min(paper.attemptsUsed + 1, paper.maxAttempts)} of {paper.maxAttempts}
            </span>
          </div>

          {paper.description && <p className="text-sm text-muted-foreground">{paper.description}</p>}

          {paper.awaitingReview && (
            <p className="text-sm text-amber-700">Your last submission is being reviewed by the Partner Team.</p>
          )}
          {paper.result && (
            <p className="text-sm">
              Last result: {paper.result.percent ?? 0}% — {paper.result.outcome || "recorded"}
            </p>
          )}
          {!paper.result && done && !paper.awaitingReview && paper.bestPercent !== null && paper.bestPercent !== undefined && (
            <p className="text-sm">Best score on record: {paper.bestPercent}%</p>
          )}

          {paper.instructions && (
            <div className="rounded-md border border-border p-3">
              <p className="text-xs font-medium mb-1">Before you begin</p>
              <p className="text-sm whitespace-pre-wrap">{paper.instructions}</p>
            </div>
          )}

          <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
            <p>The clock starts as soon as you begin and does not pause — including if you close this page.</p>
            <p>Answer every question in your own words where writing is asked for.</p>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          {done ? (
            <p className="text-sm">This assessment is complete. Nothing further is needed here.</p>
          ) : noAttemptsLeft ? (
            <p className="text-sm">
              All {paper.maxAttempts} attempts have been used. Please contact the MartPoint Partner Team.
            </p>
          ) : (
            <Button onClick={begin} disabled={submitting} className="w-full sm:w-auto">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Begin the assessment
            </Button>
          )}
          {onBack && (
            <Button variant="outline" onClick={onBack} className="w-full sm:w-auto ml-2">Back</Button>
          )}
        </div>
      </Shell>
    )
  }

  const questions = paper.questions || []
  const urgent = secondsLeft <= 60

  return (
    <Shell
      wide={wide}
      title={paper.title}
      badge={
        <span className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${urgent ? "bg-red-100 text-red-700" : "bg-muted"}`}>
          <Clock className="w-4 h-4" /> {formatClock(secondsLeft)}
        </span>
      }
    >
      <div className="space-y-4 py-2">
        <p className="text-xs text-muted-foreground">
          Attempt {paper.attemptNo} of {paper.maxAttempts} · {answeredCount}/{questions.length} answered
        </p>

        {questions.map((q, i) => (
          <div key={q.id} className="rounded-lg border border-border p-4 space-y-3">
            <p className="text-sm font-medium">
              <span className="text-muted-foreground mr-1">{i + 1}.</span>
              {q.prompt}
              {q.required && <span className="text-red-600 ml-1">*</span>}
            </p>
            {q.helpText && <p className="text-xs text-muted-foreground">{q.helpText}</p>}
            <AnswerInput
              type={q.type}
              options={q.options}
              help={q.helpText}
              value={answers[q.id]}
              onChange={(next) => setAnswers((prev) => ({ ...prev, [q.id]: next }))}
            />
          </div>
        ))}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <Button onClick={submit} disabled={submitting}>
            {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Submit answers
          </Button>
          <p className="text-xs text-muted-foreground">
            {urgent ? "Time is nearly up." : "Submit before the clock reaches zero."}
          </p>
        </div>
      </div>
    </Shell>
  )
}

function Shell({ title, badge, wide, children }: { title: string; badge?: React.ReactNode; wide?: boolean; children: React.ReactNode }) {
  return (
    <main className={wide ? "py-2" : "min-h-screen bg-muted/30 py-10 px-4 flex items-start justify-center"}>
      <Card className="w-full max-w-2xl">
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="text-lg">{title}</CardTitle>
            {!wide && <p className="text-xs text-muted-foreground mt-1">MartPoint Partner Assessment</p>}
          </div>
          {badge}
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </main>
  )
}
