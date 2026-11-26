"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"

export function GradingPolicyCard({ status, version, acknowledgedAt }: { status: string; version: string; acknowledgedAt: string | null }) {
  const [acknowledged, setAcknowledged] = useState(Boolean(acknowledgedAt))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  async function acknowledge() {
    setBusy(true); setError("")
    try {
      const res = await fetch("/api/partner/grading-policy/acknowledge", { method: "POST" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Could not record acknowledgement")
      setAcknowledged(true)
    } catch (e) { setError(e instanceof Error ? e.message : "Could not record acknowledgement") }
    finally { setBusy(false) }
  }
  return <div className="rounded-xl border border-border bg-background p-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="font-semibold">Partner Performance, Grading &amp; Progression Policy</p><p className="mt-1 text-xs text-muted-foreground">MP-POL-PGP-001 · Version {version} · {status === "APPROVED" ? "Current approved policy" : "Proposed policy; not yet effective"}</p></div>
      {status === "APPROVED" && <a href="/api/partner/grading-policy/document"><Button variant="outline" size="sm">Download approved PDF</Button></a>}
    </div>
    {status === "APPROVED" && <div className="mt-3 flex flex-wrap items-center gap-3"><Button size="sm" variant={acknowledged ? "outline" : "default"} disabled={busy || acknowledged} onClick={() => void acknowledge()}>{acknowledged ? `Acknowledged v${version}` : busy ? "Recording…" : "Acknowledge policy"}</Button>{error && <span className="text-xs text-red-600">{error}</span>}{!acknowledged && <span className="text-xs text-muted-foreground">Download and review the approved PDF before acknowledging.</span>}</div>}
    {status !== "APPROVED" && <p className="mt-2 text-xs text-muted-foreground">The thresholds are proposed and do not govern grade awards until Management approves the policy.</p>}
  </div>
}
