"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, ArrowLeft, Send, BellRing, Trash2 } from "lucide-react"
import { DEPLOYMENT_STATUSES, ATTENDANCE_STATUSES } from "@/lib/careers"

interface Deployment {
  id: string; name: string; reference_number: string; project_client: string | null
  vacancy_title?: string; vacancy_id: string | null
  state: string | null; lga: string | null; city: string | null; site_address: string | null
  start_date: string | null; end_date: string | null
  team_lead_candidate_id: string | null
  team_lead: { id: string; full_name: string; reference_number: string } | null
  daily_rate_kobo: number | null; transport_allowance_kobo: number | null
  feeding_arrangement: string | null; expected_daily_target: number | null
  status: string; notes: string | null
}
interface Worker {
  id: string; candidate_id: string; role: string; status: string
  daily_rate_kobo: number | null
  candidate: { id: string; full_name: string; reference_number: string; phone: string | null; email: string | null; verification_status: string; city: string | null } | null
}
interface Att { id: string; candidate_id: string; work_date: string; status: string; notes: string | null }
interface Perf {
  id: string; candidate_id: string; work_date: string
  products_captured: number; verified_products: number; errors: number
  supervisor_rating: number | null; candidate_name?: string
}
interface PoolCandidate { id: string; full_name: string; reference_number: string; city: string | null; verification_status: string; team_lead_eligible: boolean }

const fmtNaira = (kobo: number | null) => (kobo != null ? `₦${(kobo / 100).toLocaleString()}` : "—")
const inputCls = "rounded-md border border-input bg-background px-2 py-1 text-sm"

function workDates(start: string | null, end: string | null): string[] {
  if (!start) return []
  const out: string[] = []
  const d = new Date(start + "T00:00:00")
  const last = end ? new Date(end + "T00:00:00") : new Date(start + "T00:00:00")
  while (d <= last && out.length < 31) {
    out.push(d.toISOString().slice(0, 10))
    d.setDate(d.getDate() + 1)
  }
  return out
}

export default function DeploymentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [loading, setLoading] = useState(true)
  const [dep, setDep] = useState<Deployment | null>(null)
  const [workers, setWorkers] = useState<Worker[]>([])
  const [attendance, setAttendance] = useState<Att[]>([])
  const [performance, setPerformance] = useState<Perf[]>([])
  const [pool, setPool] = useState<PoolCandidate[]>([])
  const [addCandidateId, setAddCandidateId] = useState("")
  const [attDate, setAttDate] = useState("")
  const [attStatus, setAttStatus] = useState<Record<string, string>>({})
  const [perfDate, setPerfDate] = useState("")
  const [perfRows, setPerfRows] = useState<Record<string, { captured: string; verified: string; errors: string; rating: string }>>({})
  const [msg, setMsg] = useState("")

  const load = useCallback(() => {
    Promise.all([
      fetch(`/api/admin/careers/deployments/${id}`).then((r) => r.json()),
      fetch("/api/admin/careers/talent-pool").then((r) => r.json()),
    ]).then(([d, p]) => {
      setDep(d.deployment || null)
      setWorkers(d.workers || [])
      setAttendance(d.attendance || [])
      setPerformance(d.performance || [])
      setPool(p.candidates || [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [id])

  useEffect(load, [load])

  const dates = useMemo(() => workDates(dep?.start_date ?? null, dep?.end_date ?? null), [dep])
  const assignedIds = new Set(workers.map((w) => w.candidate_id))
  const attKey = (cid: string, date: string) => `${cid}|${date}`

  async function req(url: string, init: RequestInit) {
    setMsg("")
    const res = await fetch(url, init)
    const d = await res.json().catch(() => ({}))
    setMsg(res.ok ? "Saved." : d.error || "Failed")
    if (res.ok) load()
  }

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
  if (!dep) return <p className="text-sm text-muted-foreground">Deployment not found.</p>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <Link href="/admin/careers/deployments" className="text-xs text-muted-foreground hover:text-retail inline-flex items-center gap-1 mb-1">
            <ArrowLeft className="w-3 h-3" /> Back to deployments
          </Link>
          <h2 className="text-2xl font-bold tracking-tight">{dep.name}</h2>
          <p className="text-muted-foreground">
            <span className="font-mono">{dep.reference_number}</span> · {[dep.city, dep.state].filter(Boolean).join(", ")}
            {dep.start_date ? ` · ${dep.start_date} – ${dep.end_date || "?"}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select className={inputCls} value={dep.status}
            onChange={(e) => req(`/api/admin/careers/deployments/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: e.target.value }) })}>
            {DEPLOYMENT_STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
          <Button size="sm" variant="outline" onClick={() => req(`/api/admin/careers/deployments/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "invite_workers" }) })}>
            <Send className="w-3.5 h-3.5" /> Invite workers
          </Button>
          <Button size="sm" variant="outline" onClick={() => req(`/api/admin/careers/deployments/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "remind_workers" }) })}>
            <BellRing className="w-3.5 h-3.5" /> Remind
          </Button>
        </div>
      </div>

      {/* Summary */}
      <Card><CardContent className="p-4 grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
        <div><p className="text-[11px] uppercase text-muted-foreground">Daily rate</p><p>{fmtNaira(dep.daily_rate_kobo)}</p></div>
        <div><p className="text-[11px] uppercase text-muted-foreground">Transport</p><p>{fmtNaira(dep.transport_allowance_kobo)}</p></div>
        <div><p className="text-[11px] uppercase text-muted-foreground">Feeding</p><p>{dep.feeding_arrangement || "—"}</p></div>
        <div><p className="text-[11px] uppercase text-muted-foreground">Daily target</p><p>{dep.expected_daily_target ?? "—"}</p></div>
        <div><p className="text-[11px] uppercase text-muted-foreground">Team lead</p>
          <p>{dep.team_lead?.full_name || "—"}</p>
        </div>
      </CardContent></Card>
      {dep.site_address && <p className="text-xs text-muted-foreground">Site: {dep.site_address}</p>}
      {msg && <p className="text-xs text-muted-foreground">{msg}</p>}

      {/* Workers */}
      <Card>
        <CardHeader><CardTitle className="text-base">Workers ({workers.length})</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2 items-center">
            <select className={inputCls} value={addCandidateId} onChange={(e) => setAddCandidateId(e.target.value)}>
              <option value="">Assign from Talent Pool…</option>
              {pool.filter((c) => !assignedIds.has(c.id)).map((c) => (
                <option key={c.id} value={c.id}>{c.full_name} ({c.reference_number}){c.city ? ` — ${c.city}` : ""}</option>
              ))}
            </select>
            <Button size="sm" disabled={!addCandidateId} onClick={() => {
              req(`/api/admin/careers/deployments/${id}/workers`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ candidateId: addCandidateId }),
              })
              setAddCandidateId("")
            }}>Assign</Button>
            {/* Set team lead */}
            <select className={inputCls} value={dep.team_lead_candidate_id || ""}
              onChange={(e) => req(`/api/admin/careers/deployments/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ team_lead_candidate_id: e.target.value || null }) })}>
              <option value="">No team lead</option>
              {workers.map((w) => <option key={w.candidate_id} value={w.candidate_id}>{w.candidate?.full_name}</option>)}
            </select>
          </div>
          {workers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No workers assigned.</p>
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase text-muted-foreground border-b border-border">
                <th className="py-2 pr-3">Worker</th><th className="py-2 pr-3">Role</th><th className="py-2 pr-3">Verification</th>
                <th className="py-2 pr-3">Status</th><th className="py-2 pr-3"></th>
              </tr></thead>
              <tbody>
                {workers.map((w) => (
                  <tr key={w.id} className="border-b border-border">
                    <td className="py-2 pr-3">
                      <Link href={`/admin/careers/talent-pool/${w.candidate_id}`} className="text-retail hover:underline">{w.candidate?.full_name}</Link>
                      <p className="text-xs text-muted-foreground font-mono">{w.candidate?.reference_number}</p>
                    </td>
                    <td className="py-2 pr-3 text-xs">{w.role}{w.candidate_id === dep.team_lead_candidate_id ? " ★" : ""}</td>
                    <td className="py-2 pr-3 text-xs">{w.candidate?.verification_status?.replace(/_/g, " ")}</td>
                    <td className="py-2 pr-3">
                      <select className={inputCls + " text-xs"} value={w.status}
                        onChange={(e) => req(`/api/admin/careers/deployments/${id}/workers`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ candidateId: w.candidate_id, status: e.target.value }) })}>
                        {["ASSIGNED", "INVITED", "CONFIRMED", "ACTIVE", "COMPLETED", "REMOVED"].map((s) => <option key={s}>{s}</option>)}
                      </select>
                    </td>
                    <td className="py-2 pr-3">
                      <button className="text-muted-foreground hover:text-red-600" onClick={() => {
                        if (window.confirm(`Remove ${w.candidate?.full_name} from this deployment?`))
                          req(`/api/admin/careers/deployments/${id}/workers?candidateId=${w.candidate_id}`, { method: "DELETE" })
                      }}><Trash2 className="w-3.5 h-3.5" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Attendance */}
      <Card>
        <CardHeader><CardTitle className="text-base">Attendance</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2 items-center">
            <input type="date" className={inputCls} value={attDate} onChange={(e) => setAttDate(e.target.value)} />
            {attDate && workers.length > 0 && (
              <Button size="sm" variant="outline" onClick={() => {
                const all: Record<string, string> = {}
                workers.forEach((w) => { all[w.candidate_id] = "PRESENT" })
                setAttStatus(all)
              }}>Mark all present</Button>
            )}
          </div>
          {attDate && workers.length > 0 && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {workers.map((w) => {
                  const existing = attendance.find((a) => a.candidate_id === w.candidate_id && a.work_date === attDate)
                  return (
                    <div key={w.candidate_id} className="flex items-center justify-between gap-2 border border-border rounded-md px-2.5 py-1.5">
                      <span className="text-sm truncate">{w.candidate?.full_name}</span>
                      <select className={inputCls + " text-xs"}
                        value={attStatus[w.candidate_id] ?? existing?.status ?? ""}
                        onChange={(e) => setAttStatus((s) => ({ ...s, [w.candidate_id]: e.target.value }))}>
                        <option value="">—</option>
                        {ATTENDANCE_STATUSES.map((s) => <option key={s}>{s.replace(/_/g, " ")}</option>)}
                      </select>
                    </div>
                  )
                })}
              </div>
              <Button size="sm" onClick={() => req(`/api/admin/careers/deployments/${id}/attendance`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  records: workers.filter((w) => attStatus[w.candidate_id]).map((w) => ({
                    candidateId: w.candidate_id, workDate: attDate, status: attStatus[w.candidate_id],
                  })),
                }),
              })}>Save attendance for {attDate}</Button>
            </>
          )}

          {/* Attendance summary */}
          {attendance.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs mt-2">
                <thead><tr className="text-left uppercase text-muted-foreground border-b border-border">
                  <th className="py-2 pr-3">Worker</th>
                  {dates.map((d) => <th key={d} className="py-2 pr-3">{d.slice(5)}</th>)}
                </tr></thead>
                <tbody>
                  {workers.map((w) => (
                    <tr key={w.candidate_id} className="border-b border-border">
                      <td className="py-2 pr-3">{w.candidate?.full_name}</td>
                      {dates.map((d) => {
                        const a = attendance.find((x) => attKey(x.candidate_id, x.work_date) === attKey(w.candidate_id, d))
                        return <td key={d} className="py-2 pr-3">{a ? a.status.slice(0, 1) : "·"}</td>
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Performance */}
      <Card>
        <CardHeader><CardTitle className="text-base">Daily output & quality</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <input type="date" className={inputCls} value={perfDate} onChange={(e) => {
            setPerfDate(e.target.value)
            // Pre-fill existing rows for that date
            const rows: Record<string, { captured: string; verified: string; errors: string; rating: string }> = {}
            performance.filter((p) => p.work_date === e.target.value).forEach((p) => {
              rows[p.candidate_id] = { captured: String(p.products_captured), verified: String(p.verified_products), errors: String(p.errors), rating: p.supervisor_rating != null ? String(p.supervisor_rating) : "" }
            })
            setPerfRows(rows)
          }} />
          {perfDate && workers.length > 0 && (
            <>
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs uppercase text-muted-foreground border-b border-border">
                  <th className="py-2 pr-3">Worker</th><th className="py-2 pr-3">Captured</th><th className="py-2 pr-3">Verified</th>
                  <th className="py-2 pr-3">Errors</th><th className="py-2 pr-3">Rating (1–5)</th>
                </tr></thead>
                <tbody>
                  {workers.map((w) => {
                    const r = perfRows[w.candidate_id] || { captured: "", verified: "", errors: "", rating: "" }
                    const setRow = (k: keyof typeof r, v: string) => setPerfRows((s) => ({ ...s, [w.candidate_id]: { ...r, [k]: v } }))
                    return (
                      <tr key={w.candidate_id} className="border-b border-border">
                        <td className="py-2 pr-3">{w.candidate?.full_name}</td>
                        {(["captured", "verified", "errors", "rating"] as const).map((k) => (
                          <td key={k} className="py-2 pr-3">
                            <input type="number" min={0} className="w-20 rounded-md border border-input bg-background px-2 py-1 text-sm"
                              value={r[k]} onChange={(e) => setRow(k, e.target.value)} />
                          </td>
                        ))}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <Button size="sm" onClick={() => req(`/api/admin/careers/deployments/${id}/performance`, {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  records: Object.entries(perfRows)
                    .filter(([, r]) => r.captured || r.verified || r.errors || r.rating)
                    .map(([candidateId, r]) => ({
                      candidateId, workDate: perfDate,
                      productsCaptured: r.captured, verifiedProducts: r.verified,
                      errors: r.errors, supervisorRating: r.rating || null,
                    })),
                }),
              })}>Save output for {perfDate}</Button>
            </>
          )}

          {performance.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm mt-2">
                <thead><tr className="text-left text-xs uppercase text-muted-foreground border-b border-border">
                  <th className="py-2 pr-3">Date</th><th className="py-2 pr-3">Worker</th><th className="py-2 pr-3">Captured</th>
                  <th className="py-2 pr-3">Verified</th><th className="py-2 pr-3">Errors</th><th className="py-2 pr-3">Rating</th>
                </tr></thead>
                <tbody>
                  {performance.slice(0, 50).map((p) => (
                    <tr key={p.id} className="border-b border-border">
                      <td className="py-2 pr-3 text-xs">{p.work_date}</td>
                      <td className="py-2 pr-3 text-xs">{p.candidate_name}</td>
                      <td className="py-2 pr-3">{p.products_captured}</td>
                      <td className="py-2 pr-3">{p.verified_products}</td>
                      <td className="py-2 pr-3">{p.errors}</td>
                      <td className="py-2 pr-3">{p.supervisor_rating ?? "—"}</td>
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
