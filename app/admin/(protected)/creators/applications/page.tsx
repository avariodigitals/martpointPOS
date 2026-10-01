"use client"

import { useEffect, useState, Suspense } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Search } from "lucide-react"

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

  useEffect(() => {
    const params = new URLSearchParams()
    if (status) params.set("status", status)
    if (q) params.set("q", q)
    fetch(`/api/admin/creators/applications?${params}`)
      .then((r) => r.json())
      .then((d) => setApplications(d.applications || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [status, q])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Creator Applications</h2>
        <p className="text-muted-foreground">Review and manage Creator Network applications.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, email, reference…"
            className="rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm w-72"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : applications.length === 0 ? (
        <Card><CardContent className="p-10 text-center text-muted-foreground">No applications match.</CardContent></Card>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                  <th className="p-4">Reference</th>
                  <th className="p-4">Applicant</th>
                  <th className="p-4">Category</th>
                  <th className="p-4">Platform</th>
                  <th className="p-4">State</th>
                  <th className="p-4">AI</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Submitted</th>
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
                    <td className="p-4 text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(a.submittedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                    </td>
                    <td className="p-4">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/admin/creators/applications/${a.id}`}>Review</Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
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
