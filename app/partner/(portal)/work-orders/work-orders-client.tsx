"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Check, Play, Loader2, Upload, FileEdit } from "lucide-react"

export function WorkOrderActionButton({
  workOrderId,
  action,
  label,
}: {
  workOrderId: string
  action: "accept" | "start"
  label: string
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run() {
    setBusy(true)
    setError(null)
    const res = await fetch(`/api/partner/work-orders/${workOrderId}/actions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (res.ok) router.refresh()
    else setError(data.error || "Action failed")
  }

  const Icon = action === "accept" ? Check : Play
  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button size="sm" onClick={run} disabled={busy}>
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Icon className="w-3.5 h-3.5 mr-1" />}
        {label}
      </Button>
      {error && <span className="text-[10px] text-red-600">{error}</span>}
    </span>
  )
}

export function EvidenceForm({ milestoneId }: { milestoneId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [evidenceText, setEvidenceText] = useState("")
  const [evidenceUrl, setEvidenceUrl] = useState("")

  async function submit() {
    setBusy(true)
    setError(null)
    const res = await fetch(`/api/partner/work-orders/milestones/${milestoneId}/evidence`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ evidenceText, evidenceUrl }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (res.ok) {
      setOpen(false)
      setEvidenceText("")
      setEvidenceUrl("")
      router.refresh()
    } else {
      setError(data.error || "Submission failed")
    }
  }

  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Upload className="w-3.5 h-3.5 mr-1" /> Submit evidence
      </Button>
    )
  }

  return (
    <div className="mt-3 space-y-2 rounded-lg border border-border p-3 bg-muted/30">
      <textarea
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        rows={3}
        placeholder="Describe what was delivered and how it meets the acceptance criteria"
        value={evidenceText}
        onChange={(e) => setEvidenceText(e.target.value)}
      />
      <input
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        placeholder="Evidence link (optional) — e.g. a shared file URL"
        value={evidenceUrl}
        onChange={(e) => setEvidenceUrl(e.target.value)}
      />
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={submit} disabled={busy}>
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
          Submit for review
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
          Cancel
        </Button>
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    </div>
  )
}

export function ChangeOrderForm({ workOrderId }: { workOrderId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [description, setDescription] = useState("")
  const [reason, setReason] = useState("")
  const [impactFee, setImpactFee] = useState("")
  const [impactSchedule, setImpactSchedule] = useState("")

  async function submit() {
    setBusy(true)
    setError(null)
    const res = await fetch(`/api/partner/work-orders/${workOrderId}/actions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "request-change",
        description,
        reason,
        impactFee: impactFee === "" ? null : Number(impactFee),
        impactSchedule,
      }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (res.ok) {
      setOpen(false)
      router.refresh()
    } else {
      setError(data.error || "Request failed")
    }
  }

  if (!open) {
    return (
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <FileEdit className="w-3.5 h-3.5 mr-1" /> Request change
      </Button>
    )
  }

  return (
    <div className="mt-3 space-y-2 rounded-lg border border-border p-3 bg-muted/30">
      <textarea
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        rows={3}
        placeholder="Requested change to scope, dates or fees (required)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <input
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        placeholder="Reason (optional)"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          placeholder="Fee impact (optional)"
          value={impactFee}
          onChange={(e) => setImpactFee(e.target.value)}
        />
        <input
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          placeholder="Schedule impact (optional)"
          value={impactSchedule}
          onChange={(e) => setImpactSchedule(e.target.value)}
        />
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={submit} disabled={busy}>
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
          Submit request
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
          Cancel
        </Button>
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    </div>
  )
}
