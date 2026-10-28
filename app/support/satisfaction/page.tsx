"use client"

import { Suspense, useState } from "react"
import { useSearchParams } from "next/navigation"

function SatisfactionForm() {
  const params = useSearchParams()
  const ticketId = params.get("ticket") || ""
  const token = params.get("token") || ""
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle")
  const [error, setError] = useState("")

  async function submit(response: "satisfied" | "not_satisfied") {
    setState("sending"); setError("")
    try {
      const result = await fetch("/api/support/satisfaction", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId, token, response }),
      })
      const data = await result.json()
      if (!result.ok) throw new Error(data.error || "We could not save your response.")
      setState("done")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "We could not save your response.")
      setState("error")
    }
  }

  return <main className="mx-auto mt-16 max-w-lg rounded-2xl border bg-white p-8 text-center shadow-sm">
    <h1 className="text-2xl font-semibold">How did we do?</h1>
    {state === "done" ? <p className="mt-4 text-sm text-slate-600">Thank you for your feedback. We’ve updated your support request.</p> : <>
      <p className="mt-3 text-sm text-slate-600">Are you satisfied with the resolution of your support request?</p>
      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button disabled={state === "sending" || !ticketId || !token} onClick={() => void submit("satisfied")} className="rounded-lg bg-green-600 px-4 py-3 font-medium text-white disabled:opacity-50">Yes, it’s resolved</button>
        <button disabled={state === "sending" || !ticketId || !token} onClick={() => void submit("not_satisfied")} className="rounded-lg border border-red-200 px-4 py-3 font-medium text-red-700 disabled:opacity-50">No, I still need help</button>
      </div>
      {state === "sending" && <p className="mt-3 text-sm text-slate-500">Saving your response…</p>}
      {(state === "error" || !ticketId || !token) && <p role="alert" className="mt-3 text-sm text-red-600">{error || "This feedback link is incomplete."}</p>}
    </>}
  </main>
}

export default function SupportSatisfactionPage() {
  return <div className="min-h-screen bg-slate-50 px-4"><Suspense fallback={<div className="mx-auto mt-16 max-w-lg rounded-2xl border bg-white p-8 text-center">Loading…</div>}><SatisfactionForm /></Suspense></div>
}
