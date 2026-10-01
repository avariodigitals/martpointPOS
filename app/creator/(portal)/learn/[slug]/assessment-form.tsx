"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, CheckCircle2, XCircle } from "lucide-react"

interface Question {
  id: string
  question: string
  type: "SINGLE" | "TRUE_FALSE" | "MULTI"
  options: { key: string; text: string }[]
}

interface AssessmentData {
  questions: Question[]
  attempts: { attemptNo: number; score: number | null; passed: boolean | null }[]
  passingScore: number
  maxAttempts: number
  attemptsLeft: number
}

interface Result {
  score: number
  passed: boolean
  attemptsLeft: number
  incorrectQuestionIds: string[] | null
}

const TRUE_FALSE_OPTIONS = [
  { key: "true", text: "True" },
  { key: "false", text: "False" },
]

export function AssessmentForm({ contentId }: { contentId: string }) {
  const router = useRouter()
  const [data, setData] = useState<AssessmentData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [answers, setAnswers] = useState<Record<string, string[]>>({})
  const [result, setResult] = useState<Result | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetch(`/api/creator/learn/assessment?contentId=${contentId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.error) setError(d.error)
        else setData(d)
      })
      .catch(() => setError("Could not load assessment"))
  }, [contentId])

  function choose(q: Question, key: string) {
    setAnswers((prev) => {
      if (q.type === "MULTI") {
        const cur = prev[q.id] || []
        return { ...prev, [q.id]: cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key] }
      }
      return { ...prev, [q.id]: [key] }
    })
  }

  async function submit() {
    if (!data) return
    setSubmitting(true)
    const res = await fetch("/api/creator/learn/assessment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contentId, answers }),
    })
    const body = await res.json()
    setSubmitting(false)
    if (body.error) {
      setError(body.error)
      return
    }
    setResult(body)
    router.refresh()
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-sm text-red-600">{error}</CardContent>
      </Card>
    )
  }
  if (!data) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (result) {
    return (
      <Card className={result.passed ? "border-green-300" : "border-amber-300"}>
        <CardContent className="p-8 text-center space-y-3">
          {result.passed ? (
            <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto" />
          ) : (
            <XCircle className="h-12 w-12 text-amber-500 mx-auto" />
          )}
          <p className="text-2xl font-bold">{result.score}%</p>
          <p className="text-sm text-muted-foreground">
            {result.passed
              ? "You passed — nice work."
              : `Passing score is ${data.passingScore}%. ${result.attemptsLeft} attempt${result.attemptsLeft === 1 ? "" : "s"} left.`}
          </p>
          {!result.passed && result.attemptsLeft > 0 && (
            <Button variant="outline" onClick={() => { setResult(null); setAnswers({}) }}>
              Try again
            </Button>
          )}
        </CardContent>
      </Card>
    )
  }

  const allAnswered = data.questions.every((q) => (answers[q.id] || []).length > 0)

  return (
    <div className="space-y-4">
      {data.attemptsLeft <= 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            You have used all {data.maxAttempts} attempts. Contact the MartPoint team if you
            believe this is a mistake.
          </CardContent>
        </Card>
      ) : (
        <>
          {data.questions.map((q, i) => {
            const options = q.type === "TRUE_FALSE" ? TRUE_FALSE_OPTIONS : q.options
            return (
              <Card key={q.id}>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">
                    {i + 1}. {q.question}
                    {q.type === "MULTI" && (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">(select all that apply)</span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {options.map((o) => {
                    const selected = (answers[q.id] || []).includes(o.key)
                    return (
                      <button
                        key={o.key}
                        type="button"
                        onClick={() => choose(q, o.key)}
                        className={`w-full text-left rounded-lg border px-4 py-2.5 text-sm transition-colors ${
                          selected
                            ? "border-retail bg-retail-soft/40 font-medium"
                            : "border-border hover:bg-muted/50"
                        }`}
                      >
                        {o.text}
                      </button>
                    )
                  })}
                </CardContent>
              </Card>
            )
          })}
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Attempt {data.attempts.length + 1} of {data.maxAttempts} · passing score {data.passingScore}%
            </p>
            <Button onClick={submit} disabled={!allAnswered || submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit answers
            </Button>
          </div>
        </>
      )}

      {data.attempts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Previous attempts</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {data.attempts.map((a) => (
              <p key={a.attemptNo} className="text-xs text-muted-foreground">
                Attempt {a.attemptNo}: {a.score}% — {a.passed ? "Passed" : "Not passed"}
              </p>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
