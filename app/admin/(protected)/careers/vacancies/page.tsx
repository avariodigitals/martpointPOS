"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, FileText, Plus, ExternalLink } from "lucide-react"
import { VACANCY_STATUS_LABELS, EMPLOYMENT_TYPE_LABELS, type CareerVacancy, type VacancyStatus } from "@/lib/careers"

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  SCHEDULED: "bg-indigo-50 text-indigo-700",
  PUBLISHED: "bg-green-50 text-green-700",
  PAUSED: "bg-amber-50 text-amber-700",
  CLOSED: "bg-red-50 text-red-700",
  ARCHIVED: "bg-gray-200 text-gray-500",
}

export default function VacanciesPage() {
  const [loading, setLoading] = useState(true)
  const [vacancies, setVacancies] = useState<CareerVacancy[]>([])
  const [status, setStatus] = useState("")
  const [q, setQ] = useState("")

  useEffect(() => {
    void Promise.resolve().then(() => {
      setLoading(true)
      const params = new URLSearchParams()
      if (status) params.set("status", status)
      if (q) params.set("q", q)
      fetch(`/api/admin/careers/vacancies?${params.toString()}`)
        .then((r) => r.json())
        .then((d) => setVacancies(d.vacancies || []))
        .catch(() => {})
        .finally(() => setLoading(false))
    })
  }, [status, q])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Vacancies</h2>
          <p className="text-muted-foreground">Create, publish and manage job vacancies.</p>
        </div>
        <Button asChild>
          <Link href="/admin/careers/vacancies/new"><Plus className="w-4 h-4" /> New Vacancy</Link>
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-md border border-input bg-background px-2 py-1.5 text-sm">
          <option value="">All statuses</option>
          {Object.entries(VACANCY_STATUS_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title…" className="rounded-md border border-input bg-background px-3 py-1.5 text-sm w-56" />
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : vacancies.length === 0 ? (
            <div className="py-12 text-center">
              <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No vacancies found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-muted-foreground border-b border-border">
                    <th className="py-3 px-4">Vacancy</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Location</th>
                    <th className="py-3 px-4">Deadline</th>
                    <th className="py-3 px-4">Applications</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4"></th>
                  </tr>
                </thead>
                <tbody>
                  {vacancies.map((v) => {
                    const loc = v.locations?.find((l) => l.is_primary) || v.locations?.[0]
                    return (
                      <tr key={v.id} className="border-b border-border hover:bg-muted/30">
                        <td className="py-3 px-4">
                          <Link href={`/admin/careers/vacancies/${v.id}`} className="font-medium text-retail hover:underline">
                            {v.title}
                          </Link>
                          <p className="text-xs text-muted-foreground">{v.reference_number}</p>
                        </td>
                        <td className="py-3 px-4 text-xs">{EMPLOYMENT_TYPE_LABELS[v.employment_type]}</td>
                        <td className="py-3 px-4 text-xs">{[loc?.city, loc?.state].filter(Boolean).join(", ") || "—"}</td>
                        <td className="py-3 px-4 text-xs text-muted-foreground">
                          {v.application_closes_at ? new Date(v.application_closes_at).toLocaleDateString() : "—"}
                        </td>
                        <td className="py-3 px-4">{v.application_count ?? 0}</td>
                        <td className="py-3 px-4">
                          <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded font-medium ${STATUS_COLORS[v.status]}`}>
                            {VACANCY_STATUS_LABELS[v.status]}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {(v.status === "PUBLISHED" || v.status === "PAUSED" || v.status === "CLOSED") && (
                            <Link href={`/careers/jobs/${v.slug}`} target="_blank" className="text-xs text-muted-foreground hover:text-retail inline-flex items-center gap-1">
                              <ExternalLink className="w-3 h-3" /> View
                            </Link>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
