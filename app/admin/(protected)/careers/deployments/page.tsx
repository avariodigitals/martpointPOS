"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, MapPin, Plus } from "lucide-react"
import { DEPLOYMENT_STATUSES } from "@/lib/careers"
import { STATES } from "@/lib/locations"
import { enumLabel } from "@/lib/utils"

interface Deployment {
  id: string; name: string; project_client: string | null
  vacancy_title?: string; team_lead_name?: string
  state: string | null; city: string | null
  start_date: string | null; end_date: string | null
  status: string; created_at: string
}
interface VacancyOpt { id: string; title: string }

export default function DeploymentsPage() {
  const [loading, setLoading] = useState(true)
  const [deployments, setDeployments] = useState<Deployment[]>([])
  const [vacancies, setVacancies] = useState<VacancyOpt[]>([])
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState({ name: "", project_client: "", vacancy_id: "", state: "", lga: "", city: "", site_address: "", start_date: "", end_date: "", daily_rate: "", transport_allowance: "", feeding_arrangement: "", expected_daily_target: "", notes: "" })
  const [msg, setMsg] = useState("")

  const load = useCallback(() => {
    fetch("/api/admin/careers/deployments").then((r) => r.json())
      .then((d) => setDeployments(d.deployments || []))
      .finally(() => setLoading(false))
  }, [])

  useEffect(load, [load])
  useEffect(() => {
    fetch("/api/admin/careers/vacancies").then((r) => r.json()).then((d) => setVacancies(d.vacancies || []))
  }, [])

  async function create() {
    setMsg("")
    const res = await fetch("/api/admin/careers/deployments", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        project_client: form.project_client || null,
        vacancy_id: form.vacancy_id || null,
        state: form.state || null,
        lga: form.lga || null,
        city: form.city || null,
        site_address: form.site_address || null,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        daily_rate_kobo: form.daily_rate ? Math.round(Number(form.daily_rate) * 100) : null,
        transport_allowance_kobo: form.transport_allowance ? Math.round(Number(form.transport_allowance) * 100) : null,
        feeding_arrangement: form.feeding_arrangement || null,
        expected_daily_target: form.expected_daily_target ? Number(form.expected_daily_target) : null,
        notes: form.notes || null,
      }),
    })
    const d = await res.json()
    if (res.ok) { setShowNew(false); load() } else setMsg(d.error || "Failed")
  }

  const inputCls = "rounded-md border border-input bg-background px-3 py-1.5 text-sm w-full"

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2"><MapPin className="w-5 h-5" /> Deployments</h2>
          <p className="text-muted-foreground">Field worker deployments — attendance, output and performance.</p>
        </div>
        <Button onClick={() => setShowNew((s) => !s)}><Plus className="w-4 h-4" /> New deployment</Button>
      </div>

      {showNew && (
        <Card><CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input className={inputCls} placeholder="Deployment name *" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            <input className={inputCls} placeholder="Project / client" value={form.project_client} onChange={(e) => setForm((f) => ({ ...f, project_client: e.target.value }))} />
            <select className={inputCls} value={form.vacancy_id} onChange={(e) => setForm((f) => ({ ...f, vacancy_id: e.target.value }))}>
              <option value="">Linked vacancy (optional)</option>
              {vacancies.map((v) => <option key={v.id} value={v.id}>{v.title}</option>)}
            </select>
            <select className={inputCls} value={form.state} onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}>
              <option value="">State</option>
              {STATES["Nigeria"].map((s) => <option key={s}>{s}</option>)}
            </select>
            <input className={inputCls} placeholder="LGA" value={form.lga} onChange={(e) => setForm((f) => ({ ...f, lga: e.target.value }))} />
            <input className={inputCls} placeholder="City / town" value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
            <input className={inputCls} type="date" value={form.start_date} onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))} />
            <input className={inputCls} type="date" value={form.end_date} onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))} />
            <input className={inputCls} type="number" placeholder="Daily rate (₦)" value={form.daily_rate} onChange={(e) => setForm((f) => ({ ...f, daily_rate: e.target.value }))} />
            <input className={inputCls} type="number" placeholder="Transport allowance (₦)" value={form.transport_allowance} onChange={(e) => setForm((f) => ({ ...f, transport_allowance: e.target.value }))} />
            <input className={inputCls} placeholder="Feeding arrangement" value={form.feeding_arrangement} onChange={(e) => setForm((f) => ({ ...f, feeding_arrangement: e.target.value }))} />
            <input className={inputCls} type="number" placeholder="Expected daily target" value={form.expected_daily_target} onChange={(e) => setForm((f) => ({ ...f, expected_daily_target: e.target.value }))} />
            <input className={inputCls + " md:col-span-2"} placeholder="Site address" value={form.site_address} onChange={(e) => setForm((f) => ({ ...f, site_address: e.target.value }))} />
            <textarea className={inputCls} rows={2} placeholder="Notes" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </div>
          <div className="flex items-center gap-3">
            <Button size="sm" onClick={create}>Create</Button>
            {msg && <p className="text-xs text-red-600">{msg}</p>}
          </div>
        </CardContent></Card>
      )}

      <Card><CardContent className="p-0">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : deployments.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">No deployments yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs uppercase text-muted-foreground border-b border-border">
              <th className="py-3 px-4">Deployment</th><th className="py-3 px-4">Client / Vacancy</th><th className="py-3 px-4">Location</th>
              <th className="py-3 px-4">Dates</th><th className="py-3 px-4">Team lead</th><th className="py-3 px-4">Status</th>
            </tr></thead>
            <tbody>
              {deployments.map((d) => (
                <tr key={d.id} className="border-b border-border hover:bg-muted/30">
                  <td className="py-3 px-4"><Link href={`/admin/careers/deployments/${d.id}`} className="font-medium text-retail hover:underline">{d.name}</Link></td>
                  <td className="py-3 px-4 text-xs">{d.project_client || d.vacancy_title || "—"}</td>
                  <td className="py-3 px-4 text-xs">{[d.city, d.state].filter(Boolean).join(", ") || "—"}</td>
                  <td className="py-3 px-4 text-xs text-muted-foreground">{[d.start_date, d.end_date].filter(Boolean).join(" – ") || "—"}</td>
                  <td className="py-3 px-4 text-xs">{d.team_lead_name || "—"}</td>
                  <td className="py-3 px-4"><span className="text-[10px] uppercase px-1.5 py-0.5 rounded font-medium bg-muted">{enumLabel(d.status)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent></Card>
    </div>
  )
}
