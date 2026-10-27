"use client"

import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"

type SourceType = "lead_quote" | "finance_quote"
type TargetStatus = "SENT" | "DECLINED" | "EXPIRED"
type CorrectionRequest = {
  id: string
  source_type: SourceType
  quote_id: string
  quote_number: string
  to_status: TargetStatus
  reason: string
  status: string
  requested_by_name: string
  requested_by_role: string
  requested_at: string
  decision_note?: string | null
}

export function QuoteStatusCorrectionButton({ sourceType, quoteId, quoteNumber, disabled = false }: {
  sourceType: SourceType; quoteId: string; quoteNumber: string; disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [targetStatus, setTargetStatus] = useState<TargetStatus>("SENT")
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")

  async function submit() {
    setBusy(true); setMessage("")
    try {
      const response = await fetch("/api/admin/quote-status-corrections", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceType, quoteId, targetStatus, reason }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Could not submit correction")
      setMessage(data.corrected ? `Corrected ${quoteNumber} to ${targetStatus}.` : `Approval request sent to an Admin for ${quoteNumber}.`)
      setReason("")
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not submit correction") }
    finally { setBusy(false) }
  }

  return <>
    <Button size="sm" variant="outline" disabled={disabled} onClick={() => { setMessage(""); setOpen(true) }}>Correct status</Button>
    {open && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false) }}>
      <section role="dialog" aria-modal="true" aria-labelledby="quote-correction-title" className="w-full max-w-md space-y-4 rounded-xl border bg-background p-5 shadow-xl">
        <div><h2 id="quote-correction-title" className="font-semibold">Correct accepted quote</h2><p className="mt-1 text-sm text-muted-foreground">{quoteNumber} · record why its acceptance needs correcting.</p></div>
        <label className="block space-y-1 text-sm"><span>New status</span><select className="h-10 w-full rounded-md border bg-background px-3" value={targetStatus} onChange={(event) => setTargetStatus(event.target.value as TargetStatus)}><option value="SENT">Sent — awaiting response</option><option value="DECLINED">Declined</option><option value="EXPIRED">Expired</option></select></label>
        <label className="block space-y-1 text-sm"><span>Reason (required)</span><textarea className="min-h-24 w-full rounded-md border bg-background p-3" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Explain why the accepted status is incorrect…" /></label>
        {message && <p className="text-sm" role="status">{message}</p>}
        <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setOpen(false)}>Close</Button><Button disabled={busy || reason.trim().length < 8} onClick={() => void submit()}>{busy ? "Submitting…" : "Submit correction"}</Button></div>
      </section>
    </div>}
  </>
}

export function QuoteStatusCorrectionInbox() {
  const [requests, setRequests] = useState<CorrectionRequest[]>([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [busyId, setBusyId] = useState("")
  const [note, setNote] = useState("")
  const [error, setError] = useState("")
  const refresh = useCallback(async () => {
    const response = await fetch("/api/admin/quote-status-corrections", { cache: "no-store" })
    if (!response.ok) return
    const data = await response.json()
    setRequests(data.requests || []); setIsAdmin(Boolean(data.isAdmin))
  }, [])
  useEffect(() => {
    const timer = window.setTimeout(() => { void refresh() }, 0)
    return () => window.clearTimeout(timer)
  }, [refresh])

  async function decide(item: CorrectionRequest, decision: "approve" | "reject") {
    setBusyId(item.id); setError("")
    try {
      const response = await fetch(`/api/admin/quote-status-corrections/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision, decisionNote: note }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Could not process request")
      setNote(""); await refresh()
    } catch (e) { setError(e instanceof Error ? e.message : "Could not process request") }
    finally { setBusyId("") }
  }

  if (!requests.length) return null
  const pending = requests.filter((item) => item.status === "PENDING")
  const history = requests.filter((item) => item.status !== "PENDING").slice(0, 4)
  return <div className="space-y-3">
    {isAdmin && pending.length > 0 && <div className="rounded-lg border border-amber-300 bg-amber-50/70 p-4 dark:bg-amber-950/20"><h2 className="font-semibold">Quote status approvals <span className="text-sm font-normal text-muted-foreground">({pending.length} pending)</span></h2>{error && <p className="mt-2 text-sm text-red-600">{error}</p>}<div className="mt-3 space-y-3">{pending.map((item) => <article key={item.id} className="rounded-md border bg-background p-3 text-sm"><div className="flex flex-wrap items-center justify-between gap-2"><strong>{item.quote_number}</strong><span>{item.source_type === "finance_quote" ? "Partner / Finance quote" : "Lead quote"}: Accepted → {item.to_status}</span></div><p className="mt-2">{item.reason}</p><p className="mt-1 text-xs text-muted-foreground">Requested by {item.requested_by_name} ({item.requested_by_role}) · {new Date(item.requested_at).toLocaleString()}</p><div className="mt-3 flex flex-wrap items-center gap-2"><input className="h-9 min-w-48 flex-1 rounded-md border bg-background px-3 text-sm" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Decision note (required to reject)" /><Button size="sm" disabled={Boolean(busyId)} onClick={() => void decide(item, "approve")}>{busyId === item.id ? "Saving…" : "Approve"}</Button><Button size="sm" variant="outline" disabled={Boolean(busyId) || note.trim().length < 4} onClick={() => void decide(item, "reject")}>Reject</Button></div></article>)}</div></div>}
    {!isAdmin && pending.length > 0 && <div className="rounded-md border bg-muted/30 px-4 py-3 text-sm">Your quote correction request{pending.length === 1 ? " is" : "s are"} awaiting Admin approval: {pending.map((item) => item.quote_number).join(", ")}.</div>}
    {history.length > 0 && <details className="rounded-md border px-4 py-3"><summary className="cursor-pointer text-sm font-medium">Recent quote correction requests ({history.length})</summary><div className="mt-3 space-y-2">{history.map((item) => <p key={item.id} className="text-sm text-muted-foreground"><strong className="text-foreground">{item.quote_number}</strong> · {item.status.toLowerCase()} · {item.to_status}{item.decision_note ? ` — ${item.decision_note}` : ""}</p>)}</div></details>}
  </div>
}
