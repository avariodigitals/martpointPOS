"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, FileText, Download } from "lucide-react"
import { APPLICATION_STATUSES, APPLICATION_STATUS_LABELS, applicationStatusLabel } from "@/lib/careers"
import { STATES } from "@/lib/locations"

interface ApplicationRow {
  id: string; reference_number: string; vacancy_id: string; vacancy_title?: string
  full_name: string; email: string; phone: string | null
  state: string | null; city: string | null
  status: string; review_score: number | null; screening_score: number | null
  consent_talent_pool: boolean; submitted_at: string
}
interface VacancyOpt { id: string; title: string }

const STATUS_COLORS: Record<string, string> = {
  NEW: "bg-blue-50 text-blue-700",
  SHORTLISTED: "bg-purple-50 text-purple-700",
  SELECTED: "bg-teal-50 text-teal-700",
  VERIFIED: "bg-teal-50 text-teal-700",
  DEPLOYED: "bg-green-50 text-green-700",
  COMPLETED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-50 text-red-700",
  BLACKLISTED: "bg-red-100 text-red-800",
  WITHDRAWN: "bg-gray-100 text-gray-500",
}

export default function ApplicationsPage() {
  const [loading, setLoading] = useState(true)
  const [applications, setApplications] = useState<ApplicationRow[]>([])
  const [vacancies, setVacancies] = useState<VacancyOpt[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [bulkStatus, setBulkStatus] = useState("")
  const [busy, setBusy] = useState(false)
  const [filters, setFilters] = useState({ status: "", vacancyId: "", state: "", q: "" })

  const load = useCallback(() => {
    setLoading(true)
    const p = new URLSearchParams()
    Object.entries(filters).forEach(([k, v]) => v && p.set(k, v))
    fetch(`/api/admin/careers/applications?${p}`)
      .then((r) => r.json())
      .then((d) => setApplications(d.applications || []))
      .finally(() => setLoading(false))
  }, [filters])

  useEffect(() => {
    void Promise.resolve().then(load)
  }, [load])
  useEffect(() => {
    fetch("/api/admin/careers/vacancies").then((r) => r.json()).then((d) => setVacancies(d.vacancies || []))
  }, [])

  const toggle = (id: string) =>
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })

  async function bulkMove() {
    if (!bulkStatus || selected.size === 0) return
    const notify = window.confirm("Send status notification emails to affected applicants?\n\nOK = change status and email them\nCancel = change status only")
    setBusy(true)
    await fetch("/api/admin/careers/applications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [...selected], status: bulkStatus, notify }),
    })
    setSelected(new Set())
    setBulkStatus("")
    setBusy(false)
    load()
  }

  const exportUrl = `/api/admin/careers/applications/export?${new URLSearchParams(
    Object.entries(filters).filter(([, v]) => v)
  )}`

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Applications</h2>
          <p className="text-muted-foreground">Review, score and move candidates through the pipeline.</p>
        </div>
        <Button variant="outline" asChild>
          <a href={exportUrl}><Download className="w-4 h-4" /> Export CSV</a>
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <select className="rounded-md border border-input bg-background px-2 py-1.5 text-sm" value={filters.status}
          onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
          <option value="">All statuses</option>
          {APPLICATION_STATUSES.map((s) => <option key={s} value={s}>{APPLICATION_STATUS_LABELS[s]}</option>)}
        </select>
        <select className="rounded-md border border-input bg-background px-2 py-1.5 text-sm max-w-60" value={filters.vacancyId}
          onChange={(e) => setFilters((f) => ({ ...f, vacancyId: e.target.value }))}>
          <option value="">All vacancies</option>
          {vacancies.map((v) => <option key={v.id} value={v.id}>{v.title}</option>)}
        </select>
        <select className="rounded-md border border-input bg-background px-2 py-1.5 text-sm" value={filters.state}
          onChange={(e) => setFilters((f) => ({ ...f, state: e.target.value }))}>
          <option value="">All states</option>
          {STATES["Nigeria"].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <input className="rounded-md border border-input bg-background px-3 py-1.5 text-sm w-64" placeholder="Search name, email, reference…"
          value={filters.q} onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))} />
      </div>

      {/* Bulk bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-retail/30 bg-retail/5 px-4 py-2.5">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <select className="rounded-md border border-input bg-background px-2 py-1 text-sm" value={bulkStatus}
            onChange={(e) => setBulkStatus(e.target.value)}>
            <option value="">Move to…</option>
            {APPLICATION_STATUSES.map((s) => <option key={s} value={s}>{APPLICATION_STATUS_LABELS[s]}</option>)}
          </select>
          <Button size="sm" onClick={bulkMove} disabled={!bulkStatus || busy}>
            {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />} Apply
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : applications.length === 0 ? (
            <div className="py-12 text-center">
              <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No applications match these filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-muted-foreground border-b border-border">
                    <th className="py-3 px-4 w-8"></th>
                    <th className="py-3 px-4">Applicant</th>
                    <th className="py-3 px-4">Vacancy</th>
                    <th className="py-3 px-4">Location</th>
                    <th className="py-3 px-4">Screening</th>
                    <th className="py-3 px-4">Score</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {applications.map((a) => (
                    <tr key={a.id} className="border-b border-border hover:bg-muted/30">
                      <td className="py-3 px-4">
                        <input type="checkbox" className="accent-retail" checked={selected.has(a.id)} onChange={() => toggle(a.id)} />
                      </td>
                      <td className="py-3 px-4">
                        <Link href={`/admin/careers/applications/${a.id}`} className="font-medium text-retail hover:underline">{a.full_name}</Link>
                        <p className="text-xs text-muted-foreground font-mono">{a.reference_number}</p>
                      </td>
                      <td className="py-3 px-4 text-xs max-w-45 truncate">{a.vacancy_title || "—"}</td>
                      <td className="py-3 px-4 text-xs">{[a.city, a.state].filter(Boolean).join(", ") || "—"}</td>
                      <td className="py-3 px-4 text-xs">
                        {a.screening_score != null ? `${a.screening_score}%` : "—"}
                      </td>
                      <td className="py-3 px-4 text-xs">{a.review_score ?? "—"}</td>
                      <td className="py-3 px-4">
                        <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded font-medium ${STATUS_COLORS[a.status] || "bg-gray-100 text-gray-600"}`}>
                          {applicationStatusLabel(a.status)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(a.submitted_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
