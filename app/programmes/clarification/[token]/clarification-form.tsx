"use client"

import { useEffect, useState } from "react"
import { CheckCircle2, Loader2 } from "lucide-react"

export function ClarificationForm({ token }: { token: string }) {
  const [questions, setQuestions] = useState<string[]>([])
  const [answers, setAnswers] = useState<string[]>([])
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  useEffect(() => {
    fetch(`/api/programmes/clarification/${encodeURIComponent(token)}`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(data.error || "This link is invalid or expired.")
        const list = Array.isArray(data.questions) ? data.questions.map(String) : []
        setQuestions(list)
        setAnswers(list.map(() => ""))
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "This link is invalid or expired."))
      .finally(() => setLoading(false))
  }, [token])
  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError("")
    try {
      const response = await fetch(`/api/programmes/clarification/${encodeURIComponent(token)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ responses: answers }) })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || "Your responses could not be saved.")
      setDone(true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Your responses could not be saved.")
    } finally {
      setSaving(false)
    }
  }
  if (loading) return <p className="mt-6 text-sm text-slate-600">Loading questions…</p>
  if (done) return <div className="mt-6 rounded-xl bg-emerald-50 p-5 text-emerald-900"><CheckCircle2 className="mb-2 h-6 w-6" /><p className="font-semibold">Responses received</p><p className="mt-1 text-sm">Your application will be reassessed. This is not a selection notice.</p></div>
  if (!questions.length) return <p className="mt-6 text-sm text-red-700">{error || "This clarification link is invalid or expired."}</p>
  return <form onSubmit={submit} className="mt-6 space-y-5">{questions.map((question, index) => <label key={index} className="block text-sm font-medium">{question}<textarea required maxLength={1200} rows={4} value={answers[index] || ""} onChange={(event) => setAnswers((current) => current.map((value, i) => i === index ? event.target.value : value))} className="mt-2 w-full rounded-xl border border-slate-300 p-3 font-normal" /></label>)}{error && <p role="alert" className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}<button disabled={saving} className="inline-flex min-h-11 items-center rounded-lg bg-retail px-5 py-2 font-semibold text-white disabled:opacity-60">{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{saving ? "Saving…" : "Send responses"}</button></form>
}
