"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, BarChart3, Download } from "lucide-react"
import { APPLICATION_STATUS_LABELS, applicationStatusLabel } from "@/lib/careers"
import { enumLabel } from "@/lib/utils"

interface Reports {
  funnel: { status: string; count: number }[]
  byVacancy: { name: string; count: number }[]
  byLocation: { name: string; count: number }[]
  bySource: { name: string; count: number }[]
  screeningPassRate: number | null
  avgDaysToShortlist: number | null
  verifiedWorkers: { name: string; count: number }[]
  attendanceSummary: { status: string; count: number }[]
  workerPerformance: { candidateId: string; productsCaptured: number; verifiedProducts: number; errors: number; errorRate: number; avgRating: number | null }[]
}

function Bar({ label, value, max }: { label: string; value: number; max: number }) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-40 truncate text-muted-foreground">{label}</span>
      <div className="flex-1 h-4 bg-muted rounded overflow-hidden">
        <div className="h-full bg-retail" style={{ width: `${max > 0 ? (value / max) * 100 : 0}%` }} />
      </div>
      <span className="w-10 text-right font-medium">{value}</span>
    </div>
  )
}

export default function CareersReportsPage() {
  const [loading, setLoading] = useState(true)
  const [r, setR] = useState<Reports | null>(null)

  useEffect(() => {
    fetch("/api/admin/careers/reports").then((res) => res.json()).then(setR).catch(() => {}).finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
  if (!r) return <p className="text-sm text-muted-foreground">No data.</p>

  const maxFunnel = Math.max(1, ...r.funnel.map((f) => f.count))
  const maxVac = Math.max(1, ...r.byVacancy.map((v) => v.count))
  const maxLoc = Math.max(1, ...r.byLocation.map((v) => v.count))
  const maxSrc = Math.max(1, ...r.bySource.map((v) => v.count))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2"><BarChart3 className="w-5 h-5" /> Recruitment Reports</h2>
          <p className="text-muted-foreground">Funnel, sourcing, screening and deployment analytics.</p>
        </div>
        <Button variant="outline" onClick={() => window.open("/api/admin/careers/applications/export", "_blank")}>
          <Download className="w-4 h-4" /> Export applications CSV
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-4"><p className="text-[11px] uppercase text-muted-foreground">Screening pass rate</p>
          <p className="text-2xl font-bold">{r.screeningPassRate != null ? `${r.screeningPassRate}%` : "—"}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-[11px] uppercase text-muted-foreground">Avg days to shortlist</p>
          <p className="text-2xl font-bold">{r.avgDaysToShortlist ?? "—"}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-[11px] uppercase text-muted-foreground">Verified workers</p>
          <p className="text-2xl font-bold">{r.verifiedWorkers.reduce((a, b) => a + b.count, 0)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-[11px] uppercase text-muted-foreground">Attendance records</p>
          <p className="text-2xl font-bold">{r.attendanceSummary.reduce((a, b) => a + b.count, 0)}</p></CardContent></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Recruitment funnel</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {r.funnel.map((f) => <Bar key={f.status} label={applicationStatusLabel(f.status)} value={f.count} max={maxFunnel} />)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Applications by vacancy</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {r.byVacancy.length === 0 ? <p className="text-sm text-muted-foreground">No data.</p> :
              r.byVacancy.map((v) => <Bar key={v.name} label={v.name} value={v.count} max={maxVac} />)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Applications by location</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {r.byLocation.length === 0 ? <p className="text-sm text-muted-foreground">No data.</p> :
              r.byLocation.slice(0, 12).map((v) => <Bar key={v.name} label={v.name} value={v.count} max={maxLoc} />)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Application source</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {r.bySource.length === 0 ? <p className="text-sm text-muted-foreground">No data.</p> :
              r.bySource.map((v) => <Bar key={v.name} label={v.name} value={v.count} max={maxSrc} />)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Verified workers by state</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {r.verifiedWorkers.length === 0 ? <p className="text-sm text-muted-foreground">No verified workers yet.</p> :
              r.verifiedWorkers.map((v) => <Bar key={v.name} label={v.name} value={v.count} max={Math.max(1, ...r.verifiedWorkers.map((x) => x.count))} />)}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Deployment attendance</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {r.attendanceSummary.length === 0 ? <p className="text-sm text-muted-foreground">No attendance records.</p> :
              r.attendanceSummary.map((v) => (
                <div key={v.status} className="flex items-center justify-between text-sm">
                  <span>{enumLabel(v.status)}</span><span className="font-medium">{v.count}</span>
                </div>
              ))}
          </CardContent>
        </Card>
      </div>

      {r.workerPerformance.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Worker performance</CardTitle></CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase text-muted-foreground border-b border-border">
                <th className="py-2 px-4">Candidate</th><th className="py-2 px-4">Captured</th><th className="py-2 px-4">Verified</th>
                <th className="py-2 px-4">Errors</th><th className="py-2 px-4">Error rate</th><th className="py-2 px-4">Avg rating</th>
              </tr></thead>
              <tbody>
                {r.workerPerformance.map((w) => (
                  <tr key={w.candidateId} className="border-b border-border">
                    <td className="py-2 px-4 font-mono text-xs">{w.candidateId.slice(0, 8)}</td>
                    <td className="py-2 px-4">{w.productsCaptured}</td>
                    <td className="py-2 px-4">{w.verifiedProducts}</td>
                    <td className="py-2 px-4">{w.errors}</td>
                    <td className="py-2 px-4">{w.errorRate}%</td>
                    <td className="py-2 px-4">{w.avgRating ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
