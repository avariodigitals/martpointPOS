"use client"

import { useEffect, useState, Suspense } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, RefreshCw, Search, Trash2 } from "lucide-react"
import { CREATOR_REPLY_FILTERS, isCreatorReplyFilter, type CreatorQuestionSummary } from "@/lib/creator-question-summary"
import { CreatorQuestionStatus } from "@/components/admin/creator-question-status"

interface ApplicationRow {
  id: string
  referenceNumber: string
  fullName: string
  email: string
  state: string | null
  primaryCategory: string
  status: string
  primaryPlatform?: string | null
  aiScore?: number | null
  aiRecommendation?: string | null
  submittedAt: string
  questionSummary: CreatorQuestionSummary
}

const STATUSES = [
  "SUBMITTED", "AI_REVIEWED", "MANUAL_REVIEW", "INTERVIEW_REQUESTED",
  "INTERVIEW_SCHEDULED", "APPROVED", "WAITLISTED", "REJECTED", "SUSPENDED",
]

const STATUS_LABEL: Record<string, string> = {
  SUBMITTED: "Submitted",
  AI_REVIEWED: "AI Reviewed",
  MANUAL_REVIEW: "Manual Review",
  INTERVIEW_REQUESTED: "Interview Requested",
  INTERVIEW_SCHEDULED: "Interview Scheduled",
  APPROVED: "Approved",
  WAITLISTED: "Waitlisted",
  REJECTED: "Rejected",
  SUSPENDED: "Suspended",
}

const REC_LABEL: Record<string, string> = {
  STRONG_CANDIDATE: "Strong",
  REVIEW: "Review",
  FURTHER_VERIFICATION: "Verify",
}

const REC_CLASS: Record<string, string> = {
  STRONG_CANDIDATE: "bg-green-100 text-green-700",
  REVIEW: "bg-amber-100 text-amber-700",
  FURTHER_VERIFICATION: "bg-orange-100 text-orange-700",
}

function ApplicationsList() {
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [applications, setApplications] = useState<ApplicationRow[]>([])
  const [status, setStatus] = useState(searchParams.get("status") || "")
  const [q, setQ] = useState("")
  const [response, setResponse] = useState(() => {
    const value = searchParams.get("response")
    return isCreatorReplyFilter(value) ? value : ""
  })
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [pageSize, setPageSize] = useState(25)
  const [loadError, setLoadError] = useState("")
  const [refreshKey, setRefreshKey] = useState(0)
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState("")

  async function removeApplication(id: string) {
    setDeletingId(id)
    setDeleteError("")
    try {
      const res = await fetch(`/api/admin/creators/applications/${id}`, { method: "DELETE" })
      if (res.ok) {
        setRefreshKey((value) => value + 1)
      } else {
        const d = await res.json().catch(() => ({}))
        setDeleteError(d.error || "Delete failed.")
      }
    } finally {
      setConfirmDeleteId(null)
      setDeletingId(null)
    }
  }

  useEffect(() => {
    let active = true
    let inFlight = false
    let controller: AbortController | null = null
    const params = new URLSearchParams()
    if (status) params.set("status", status)
    if (q) params.set("q", q)
    if (response) params.set("response", response)
    params.set("page", String(page))
    const load = async (initial = false) => {
      if (inFlight || document.visibilityState === "hidden") return
      inFlight = true
      controller = new AbortController()
      if (initial) setLoading(true)
      try {
        const res = await fetch(`/api/admin/creators/applications?${params}`, { cache: "no-store", signal: controller.signal })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "Could not load applications")
        if (!active) return
        setApplications(data.applications || [])
        setTotal(data.total || 0)
        setPageSize(data.pageSize || 25)
        setLoadError("")
        setUpdatedAt(new Date().toISOString())
        const lastPage = Math.max(1, Math.ceil((data.total || 0) / (data.pageSize || 25)))
        if (page > lastPage) setPage(lastPage)
      } catch (error) {
        if (active && !(error instanceof Error && error.name === "AbortError")) setLoadError("Could not refresh application tracking. The last loaded results may be out of date.")
      } finally {
        inFlight = false
        if (active) setLoading(false)
      }
    }
    const start = window.setTimeout(() => { void load(true) }, 250)
    const poll = window.setInterval(() => { void load() }, 30_000)
    const resume = () => { void load() }
    window.addEventListener("focus", resume)
    document.addEventListener("visibilitychange", resume)
    return () => {
      active = false
      controller?.abort()
      window.clearTimeout(start)
      window.clearInterval(poll)
      window.removeEventListener("focus", resume)
      document.removeEventListener("visibilitychange", resume)
    }
  }, [status, q, response, page, refreshKey])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
        <h2 className="text-2xl font-bold tracking-tight">Creator Applications</h2>
        <p className="text-muted-foreground">Track applications, question delivery and replies in one place.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => { setResponse("needs_review"); setPage(1) }}>Review replies</Button>
          <Button variant="outline" disabled={loading} onClick={() => setRefreshKey((value) => value + 1)}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1) }}
            placeholder="Search name, email, reference…"
            aria-label="Search applications"
            className="rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm w-full sm:w-72"
          />
        </div>
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1) }}
          aria-label="Application status"
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
        <select value={response} onChange={(e) => { setResponse(e.target.value); setPage(1) }} aria-label="Question reply status" className="max-w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
          <option value="">All question replies</option>
          {CREATOR_REPLY_FILTERS.map((filter) => <option key={filter.value} value={filter.value}>{filter.label}</option>)}
        </select>
      </div>
      <p className="text-xs text-muted-foreground">Question replies are separate from application approval. A reply needs review until you mark it reviewed. Updates every 30 seconds while this page is visible{updatedAt ? ` · Last checked ${new Date(updatedAt).toLocaleTimeString("en-GB", { timeZone: "Africa/Lagos" })} WAT` : ""}.</p>
      {loadError && <p role="alert" className="rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-900">{loadError} <button className="font-semibold underline" onClick={() => setRefreshKey((value) => value + 1)}>Retry</button></p>}

      {deleteError && (
        <p className="rounded-md bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300 px-4 py-2 text-sm">{deleteError}</p>
      )}

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : applications.length === 0 ? (
        <Card><CardContent className="p-10 text-center text-muted-foreground">{loadError ? "Application tracking is unavailable. Please retry." : "No applications match these filters."}</CardContent></Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="p-4">Reference</th>
                  <th className="p-4">Applicant</th>
                  <th className="p-4">Category</th>
                  <th className="p-4">Platform</th>
                  <th className="p-4">State</th>
                  <th className="p-4">AI</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Question replies</th>
                  <th className="p-4">Application received</th>
                  <th className="p-4"></th>
                </tr>
              </thead>
              <tbody>
                {applications.map((a) => (
                  <tr key={a.id} className="border-b last:border-0 hover:bg-muted/40">
                    <td className="p-4 font-mono text-xs">{a.referenceNumber}</td>
                    <td className="p-4">
                      <p className="font-medium">{a.fullName}</p>
                      <p className="text-xs text-muted-foreground">{a.email}</p>
                    </td>
                    <td className="p-4 text-xs">{a.primaryCategory}</td>
                    <td className="p-4 text-xs">{a.primaryPlatform || "—"}</td>
                    <td className="p-4 text-xs">{a.state || "—"}</td>
                    <td className="p-4">
                      {a.aiScore != null ? (
                        <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${REC_CLASS[a.aiRecommendation || ""] || "bg-muted"}`}>
                          {a.aiScore} · {REC_LABEL[a.aiRecommendation || ""] || a.aiRecommendation}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="p-4">
                      <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
                        {STATUS_LABEL[a.status] || a.status}
                      </span>
                    </td>
                    <td className="p-4"><CreatorQuestionStatus summary={a.questionSummary} applicationId={a.id} /></td>
                    <td className="p-4 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(a.submittedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-2">
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/admin/creators/applications/${a.id}`}>Review</Link>
                        </Button>
                        {confirmDeleteId === a.id ? (
                          <span className="flex items-center gap-1">
                            <Button
                              size="sm" variant="outline" className="bg-red-600 text-white hover:bg-red-700 border-red-600"
                              disabled={deletingId === a.id}
                              onClick={() => removeApplication(a.id)}
                            >
                              {deletingId === a.id ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                              Confirm delete
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setConfirmDeleteId(null)}>Cancel</Button>
                          </span>
                        ) : (
                          a.status === "APPROVED" ? null : (
                            <Button
                              size="sm" variant="ghost" className="text-red-600 hover:text-red-700"
                              title="Delete application"
                              onClick={() => setConfirmDeleteId(a.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
      {!loading && !loadError && <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <p className="text-muted-foreground">{total ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} of ${total} applications` : "0 applications"}</p>
        <div className="flex items-center gap-3">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</Button>
          <span>Page {page} of {Math.max(1, Math.ceil(total / pageSize))}</span>
          <Button size="sm" variant="outline" disabled={page * pageSize >= total} onClick={() => setPage((value) => value + 1)}>Next</Button>
        </div>
      </div>}
    </div>
  )
}

export default function CreatorApplicationsPage() {
  return (
    <Suspense fallback={<div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>}>
      <ApplicationsList />
    </Suspense>
  )
}
