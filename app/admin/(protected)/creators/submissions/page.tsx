"use client"

import { useCallback, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, ClipboardCheck, ExternalLink, AlertTriangle } from "lucide-react"
import { enumLabel } from "@/lib/utils"

interface SubmissionRow {
  id: string; challengeId: string; challengeName: string
  creatorId: string; creatorName: string; creatorCode: string
  platform: string; contentUrl: string; trackingToken: string
  caption: string | null; status: string; quarantined: boolean
  publishedAt: string | null; submittedAt: string
  reviewFeedback: string | null; openFlags: number
  metrics: { views: number | null; source: string; verified: boolean } | null
}

const STATUS_CLASS: Record<string, string> = {
  SUBMITTED: "bg-blue-100 text-blue-700", UNDER_REVIEW: "bg-amber-100 text-amber-700",
  APPROVED: "bg-green-100 text-green-700", NEEDS_CORRECTION: "bg-orange-100 text-orange-700",
  REJECTED: "bg-red-100 text-red-700", DISQUALIFIED: "bg-red-200 text-red-800",
}

export default function CreatorSubmissionsAdminPage() {
  const focus = useSearchParams().get("focus")
  const [rows, setRows] = useState<SubmissionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState("")
  const [feedback, setFeedback] = useState<Record<string, { review: string; internal: string }>>({})

  const load = useCallback(() => {
    fetch(`/api/admin/creators/submissions${statusFilter ? `?status=${statusFilter}` : ""}`)
      .then((r) => r.json())
      .then((d) => setRows(d.submissions ?? []))
      .finally(() => setLoading(false))
  }, [statusFilter])
  useEffect(() => { load() }, [load])

  const setF = (id: string, k: "review" | "internal", v: string) =>
    setFeedback((f) => ({ ...f, [id]: { review: f[id]?.review ?? "", internal: f[id]?.internal ?? "", [k]: v } }))

  const review = async (subId: string, action: string) => {
    const f = feedback[subId] ?? { review: "", internal: "" }
    const res = await fetch(`/api/admin/creators/submissions/${subId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reviewFeedback: f.review || null, decisionReason: f.internal || null }),
    })
    const data = await res.json()
    if (!res.ok) alert(data.error ?? "Failed")
    else load()
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5" /> Submissions
          </h2>
          <p className="text-muted-foreground text-sm">Review published content submitted for challenges.</p>
        </div>
        <select className="rounded-md border border-input bg-background px-3 py-2 text-sm" value={statusFilter} onChange={(e) => { setLoading(true); setStatusFilter(e.target.value) }}>
          <option value="">All statuses</option>
          {["SUBMITTED", "UNDER_REVIEW", "APPROVED", "NEEDS_CORRECTION", "REJECTED", "DISQUALIFIED"].map((s) => (
            <option key={s} value={s}>{enumLabel(s)}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="p-10 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" /></div>
      ) : rows.length === 0 ? (
        <Card><CardContent className="p-10 text-center text-muted-foreground">No submissions{statusFilter ? ` with status "${enumLabel(statusFilter)}"` : ""}.</CardContent></Card>
      ) : (
        rows.map((s) => (
          <Card key={s.id} className={focus === s.id ? "ring-2 ring-retail" : ""}>
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <p className="font-medium text-sm">
                    <Link className="text-retail hover:underline" href={`/admin/creators/creators/${s.creatorId}`}>{s.creatorName}</Link>
                    <span className="font-mono text-xs text-muted-foreground ml-1">{s.creatorCode}</span>
                    <span className="text-xs text-muted-foreground"> · </span>
                    <Link className="text-retail hover:underline text-xs" href={`/admin/creators/challenges/${s.challengeId}`}>{s.challengeName}</Link>
                  </p>
                  <a href={s.contentUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-retail hover:underline break-all inline-flex items-center gap-1">
                    {s.contentUrl} <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                  {s.caption && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{s.caption}</p>}
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {enumLabel(s.platform)} · submitted {new Date(s.submittedAt).toLocaleString("en-GB")}
                    {s.metrics && <span> · {Number(s.metrics.views ?? 0).toLocaleString()} views ({s.metrics.source}{s.metrics.verified ? ", verified" : ", unverified"})</span>}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {s.openFlags > 0 && <span className="flex items-center gap-1 rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-xs font-medium"><AlertTriangle className="w-3 h-3" />{s.openFlags}</span>}
                  {s.quarantined && <span className="rounded-full bg-red-200 text-red-800 px-2 py-0.5 text-xs font-medium">Quarantined</span>}
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_CLASS[s.status] ?? "bg-muted"}`}>{enumLabel(s.status)}</span>
                </div>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                <input className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs" placeholder="Creator-visible feedback"
                  value={feedback[s.id]?.review ?? ""} onChange={(e) => setF(s.id, "review", e.target.value)} />
                <input className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs" placeholder="Internal reason (required for reject/disqualify)"
                  value={feedback[s.id]?.internal ?? ""} onChange={(e) => setF(s.id, "internal", e.target.value)} />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={() => review(s.id, "approve")}>Approve</Button>
                <Button size="sm" variant="outline" onClick={() => review(s.id, "request_correction")}>Correction</Button>
                <Button size="sm" variant="outline" onClick={() => review(s.id, "reject")}>Reject</Button>
                <Button size="sm" variant="outline" onClick={() => review(s.id, "disqualify")}>Disqualify</Button>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}
