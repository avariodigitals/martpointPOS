"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { VacancyForm } from "../vacancy-form"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2 } from "lucide-react"
import { APPLICATION_STATUS_LABELS, type CareerVacancy, applicationStatusLabel } from "@/lib/careers"

interface AppRow {
  id: string; reference_number: string; full_name: string; email: string
  status: string; review_score: number | null; submitted_at: string
}
interface AuditEvent {
  id: string; action: string; actor_name: string | null; created_at: string
  metadata: Record<string, unknown> | null
}

export default function VacancyDetailPage() {
  const params = useParams<{ id: string }>()
  const id = params.id
  const [loading, setLoading] = useState(true)
  const [vacancy, setVacancy] = useState<CareerVacancy | null>(null)
  const [meta, setMeta] = useState<{ departments: { id: string; name: string }[]; categories: { id: string; name: string }[]; admins: { id: string; name: string; role: string }[] }>({ departments: [], categories: [], admins: [] })
  const [applications, setApplications] = useState<AppRow[]>([])
  const [activity, setActivity] = useState<AuditEvent[]>([])
  const [tab, setTab] = useState<"edit" | "applicants" | "activity">("edit")

  const load = useCallback(() => {
    Promise.all([
      fetch(`/api/admin/careers/vacancies/${id}`).then((r) => r.json()),
      fetch("/api/admin/careers/settings").then((r) => r.json()),
      fetch(`/api/admin/careers/applications?vacancyId=${id}`).then((r) => r.json()),
      fetch(`/api/admin/careers/vacancies/${id}/activity`).then((r) => r.json()),
    ]).then(([v, m, a, act]) => {
      setVacancy(v.vacancy || null)
      setMeta({ departments: m.departments || [], categories: m.categories || [], admins: m.admins || [] })
      setApplications(a.applications || [])
      setActivity(act.events || [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [id])

  useEffect(load, [load])

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
  if (!vacancy) return <p className="text-sm text-muted-foreground">Vacancy not found.</p>

  const tabs = [
    { key: "edit" as const, label: "Details & Questions" },
    { key: "applicants" as const, label: `Applicants (${applications.length})` },
    { key: "activity" as const, label: "Activity" },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{vacancy.title}</h2>
        <p className="text-muted-foreground">{vacancy.reference_number} · {vacancy.status}</p>
      </div>

      <div className="flex gap-1 border-b border-border">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === t.key ? "border-retail text-retail" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "edit" && (
        <VacancyForm vacancy={vacancy} departments={meta.departments} categories={meta.categories} admins={meta.admins} />
      )}

      {tab === "applicants" && (
        <Card><CardContent className="p-0">
          {applications.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No applications yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-muted-foreground border-b border-border">
                  <th className="py-3 px-4">Applicant</th>
                  <th className="py-3 px-4">Reference</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Score</th>
                  <th className="py-3 px-4">Submitted</th>
                </tr>
              </thead>
              <tbody>
                {applications.map((a) => (
                  <tr key={a.id} className="border-b border-border hover:bg-muted/30">
                    <td className="py-3 px-4">
                      <Link href={`/admin/careers/applications/${a.id}`} className="font-medium text-retail hover:underline">{a.full_name}</Link>
                      <p className="text-xs text-muted-foreground">{a.email}</p>
                    </td>
                    <td className="py-3 px-4 font-mono text-xs">{a.reference_number}</td>
                    <td className="py-3 px-4 text-xs">{applicationStatusLabel(a.status)}</td>
                    <td className="py-3 px-4 text-xs">{a.review_score ?? "—"}</td>
                    <td className="py-3 px-4 text-xs text-muted-foreground">{new Date(a.submitted_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent></Card>
      )}

      {tab === "activity" && (
        <Card>
          <CardHeader><CardTitle className="text-base">Vacancy activity</CardTitle></CardHeader>
          <CardContent>
            {activity.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity recorded.</p>
            ) : (
              <ul className="space-y-3">
                {activity.map((e) => (
                  <li key={e.id} className="text-sm border-b border-border pb-3 last:border-0">
                    <span className="font-medium">{e.action.replace(/_/g, " ").toLowerCase()}</span>
                    <span className="text-muted-foreground"> — {e.actor_name || "System"} · {new Date(e.created_at).toLocaleString()}</span>
                    {e.metadata && Object.keys(e.metadata).length > 0 && (
                      <p className="text-xs text-muted-foreground mt-0.5">{JSON.stringify(e.metadata)}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
