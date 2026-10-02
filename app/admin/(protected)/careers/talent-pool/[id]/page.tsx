"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, ArrowLeft } from "lucide-react"
import { VERIFICATION_STATUSES, CANDIDATE_STATUSES, APPLICATION_STATUS_LABELS, applicationStatusLabel } from "@/lib/careers"
import { enumLabel } from "@/lib/utils"

interface Candidate {
  id: string; reference_number: string; full_name: string; email: string
  phone: string | null; whatsapp: string | null
  state: string | null; lga: string | null; city: string | null; residential_area: string | null
  qualified_roles: string[]; skills: string[]; status: string
  verification_status: string; team_lead_eligible: boolean
  performance_rating: number | null; accuracy_rating: number | null
  supervisor_comments: string | null; availability_notes: string | null
  earliest_available_date: string | null; other_work_cities: string | null
  highest_qualification: string | null; years_experience: number | null
  equipment: Record<string, unknown> | null
  consent_talent_pool: boolean; consent_at: string | null; last_contacted_at: string | null
  source: string; created_at: string
  applications: { id: string; reference_number: string; status: string; submitted_at: string; career_vacancies: { title?: string } | null }[]
  deployments: { id: string; role: string; status: string; deployment: { id?: string; name?: string; status?: string; city?: string; state?: string; start_date?: string; end_date?: string } | null }[]
  performance: { work_date: string; products_captured: number; verified_products: number; errors: number; supervisor_rating: number | null; deployment_name?: string }[]
  availability: { available_date?: string; day_of_week?: number; notes?: string }[]
}

const inputCls = "rounded-md border border-input bg-background px-3 py-1.5 text-sm w-full"

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === "") return null
  return (
    <div>
      <p className="text-[11px] uppercase text-muted-foreground">{label}</p>
      <p className="text-sm">{value}</p>
    </div>
  )
}

export default function TalentPoolDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [loading, setLoading] = useState(true)
  const [c, setC] = useState<Candidate | null>(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<Record<string, unknown>>({})
  const [msg, setMsg] = useState("")

  const load = useCallback(() => {
    fetch(`/api/admin/careers/talent-pool/${id}`).then((r) => r.json())
      .then((d) => {
        setC(d.candidate || null)
        if (d.candidate) {
          setForm({
            full_name: d.candidate.full_name, phone: d.candidate.phone || "", whatsapp: d.candidate.whatsapp || "",
            state: d.candidate.state || "", lga: d.candidate.lga || "", city: d.candidate.city || "",
            residential_area: d.candidate.residential_area || "",
            qualified_roles: (d.candidate.qualified_roles || []).join(", "),
            availability_notes: d.candidate.availability_notes || "",
            earliest_available_date: d.candidate.earliest_available_date || "",
            other_work_cities: d.candidate.other_work_cities || "",
            highest_qualification: d.candidate.highest_qualification || "",
            years_experience: d.candidate.years_experience ?? "",
            performance_rating: d.candidate.performance_rating ?? "",
            accuracy_rating: d.candidate.accuracy_rating ?? "",
            team_lead_eligible: d.candidate.team_lead_eligible,
            verification_status: d.candidate.verification_status,
            status: d.candidate.status,
            supervisor_comments: d.candidate.supervisor_comments || "",
            consent_talent_pool: d.candidate.consent_talent_pool,
          })
        }
        setLoading(false)
      }).catch(() => setLoading(false))
  }, [id])

  useEffect(load, [load])

  async function save() {
    setMsg("")
    const res = await fetch(`/api/admin/careers/talent-pool/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        qualified_roles: String(form.qualified_roles || "").split(",").map((s) => s.trim()).filter(Boolean),
        years_experience: form.years_experience === "" ? null : Number(form.years_experience),
        performance_rating: form.performance_rating === "" ? null : Number(form.performance_rating),
        accuracy_rating: form.accuracy_rating === "" ? null : Number(form.accuracy_rating),
      }),
    })
    const d = await res.json()
    setMsg(res.ok ? "Saved." : d.error || "Failed")
    if (res.ok) { setEditing(false); load() }
  }

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
  if (!c) return <p className="text-sm text-muted-foreground">Candidate not found.</p>

  const set = (k: string, v: unknown) => setForm((f) => ({ ...f, [k]: v }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <Link href="/admin/careers/talent-pool" className="text-xs text-muted-foreground hover:text-retail inline-flex items-center gap-1 mb-1">
            <ArrowLeft className="w-3 h-3" /> Back to Talent Pool
          </Link>
          <h2 className="text-2xl font-bold tracking-tight">{c.full_name}</h2>
          <p className="text-muted-foreground"><span className="font-mono">{c.reference_number}</span> · {c.status} · {enumLabel(c.verification_status)}</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => {
            fetch(`/api/admin/careers/talent-pool/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ last_contacted_at: new Date().toISOString() }) }).then(load)
          }}>Mark contacted</Button>
          <Button size="sm" onClick={() => setEditing((e) => !e)}>{editing ? "Cancel edit" : "Edit profile"}</Button>
        </div>
      </div>

      {editing && (
        <Card><CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input className={inputCls} value={String(form.full_name || "")} onChange={(e) => set("full_name", e.target.value)} placeholder="Full name" />
            <input className={inputCls} value={String(form.phone || "")} onChange={(e) => set("phone", e.target.value)} placeholder="Phone" />
            <input className={inputCls} value={String(form.whatsapp || "")} onChange={(e) => set("whatsapp", e.target.value)} placeholder="WhatsApp" />
            <input className={inputCls} value={String(form.state || "")} onChange={(e) => set("state", e.target.value)} placeholder="State" />
            <input className={inputCls} value={String(form.lga || "")} onChange={(e) => set("lga", e.target.value)} placeholder="LGA" />
            <input className={inputCls} value={String(form.city || "")} onChange={(e) => set("city", e.target.value)} placeholder="City" />
            <input className={inputCls} value={String(form.residential_area || "")} onChange={(e) => set("residential_area", e.target.value)} placeholder="Area" />
            <input className={inputCls} value={String(form.qualified_roles || "")} onChange={(e) => set("qualified_roles", e.target.value)} placeholder="Qualified roles (comma)" />
            <input className={inputCls} value={String(form.other_work_cities || "")} onChange={(e) => set("other_work_cities", e.target.value)} placeholder="Other cities" />
            <input className={inputCls} value={String(form.highest_qualification || "")} onChange={(e) => set("highest_qualification", e.target.value)} placeholder="Qualification" />
            <input className={inputCls} type="number" value={String(form.years_experience ?? "")} onChange={(e) => set("years_experience", e.target.value)} placeholder="Years exp" />
            <input className={inputCls} type="date" value={String(form.earliest_available_date || "")} onChange={(e) => set("earliest_available_date", e.target.value)} />
            <select className={inputCls} value={String(form.verification_status)} onChange={(e) => set("verification_status", e.target.value)}>
              {VERIFICATION_STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
            <select className={inputCls} value={String(form.status)} onChange={(e) => set("status", e.target.value)}>
              {CANDIDATE_STATUSES.map((s) => <option key={s}>{s}</option>)}
            </select>
            <input className={inputCls} type="number" step="0.1" min="0" max="5" value={String(form.performance_rating ?? "")} onChange={(e) => set("performance_rating", e.target.value)} placeholder="Perf rating (0–5)" />
            <input className={inputCls} type="number" step="0.1" min="0" max="5" value={String(form.accuracy_rating ?? "")} onChange={(e) => set("accuracy_rating", e.target.value)} placeholder="Accuracy (0–5)" />
            <textarea className={inputCls + " md:col-span-2"} rows={2} value={String(form.supervisor_comments || "")} onChange={(e) => set("supervisor_comments", e.target.value)} placeholder="Supervisor comments" />
            <textarea className={inputCls} rows={2} value={String(form.availability_notes || "")} onChange={(e) => set("availability_notes", e.target.value)} placeholder="Availability notes" />
          </div>
          <div className="flex gap-5 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" className="accent-retail" checked={Boolean(form.team_lead_eligible)} onChange={(e) => set("team_lead_eligible", e.target.checked)} /> Team-lead eligible</label>
            <label className="flex items-center gap-2"><input type="checkbox" className="accent-retail" checked={Boolean(form.consent_talent_pool)} onChange={(e) => set("consent_talent_pool", e.target.checked)} /> Talent-pool consent</label>
          </div>
          <div className="flex items-center gap-3">
            <Button size="sm" onClick={save}>Save</Button>
            {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
          </div>
        </CardContent></Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-base">Profile</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <Field label="Email" value={c.email} />
            <Field label="Phone" value={c.phone} />
            <Field label="Location" value={[c.residential_area, c.city, c.lga, c.state].filter(Boolean).join(", ")} />
            <Field label="Qualified roles" value={c.qualified_roles?.join(", ")} />
            <Field label="Skills" value={c.skills?.join(", ")} />
            <Field label="Qualification" value={c.highest_qualification} />
            <Field label="Experience" value={c.years_experience != null ? `${c.years_experience} yrs` : null} />
            <Field label="Earliest availability" value={c.earliest_available_date ? new Date(c.earliest_available_date).toLocaleDateString() : null} />
            <Field label="Other cities" value={c.other_work_cities} />
            <Field label="Performance rating" value={c.performance_rating} />
            <Field label="Accuracy rating" value={c.accuracy_rating} />
            <Field label="Team-lead eligible" value={c.team_lead_eligible ? "Yes" : null} />
            <Field label="Consent" value={`Talent pool: ${c.consent_talent_pool ? "Yes" : "No"}${c.consent_at ? ` (${new Date(c.consent_at).toLocaleDateString()})` : ""}`} />
            <Field label="Last contacted" value={c.last_contacted_at ? new Date(c.last_contacted_at).toLocaleString() : "Never"} />
            <Field label="Source" value={c.source} />
            {c.supervisor_comments && (
              <div className="col-span-2"><p className="text-[11px] uppercase text-muted-foreground">Supervisor comments</p><p className="text-sm whitespace-pre-wrap">{c.supervisor_comments}</p></div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Applications ({c.applications.length})</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {c.applications.length === 0 ? <p className="text-sm text-muted-foreground">None.</p> :
                c.applications.map((a) => (
                  <div key={a.id} className="text-sm flex items-center justify-between">
                    <Link href={`/admin/careers/applications/${a.id}`} className="font-mono text-xs text-retail hover:underline">{a.reference_number}</Link>
                    <span className="text-xs text-muted-foreground">{a.career_vacancies?.title} — {applicationStatusLabel(a.status)}</span>
                  </div>
                ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Deployments ({c.deployments.length})</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {c.deployments.length === 0 ? <p className="text-sm text-muted-foreground">None.</p> :
                c.deployments.map((d) => (
                  <div key={d.id} className="text-sm flex items-center justify-between">
                    <span>{d.deployment?.name || "—"}</span>
                    <span className="text-xs text-muted-foreground">{d.role} · {d.status} · {[d.deployment?.city, d.deployment?.state].filter(Boolean).join(", ")}</span>
                  </div>
                ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {c.performance.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Performance history</CardTitle></CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase text-muted-foreground border-b border-border">
                <th className="py-2 px-4">Date</th><th className="py-2 px-4">Deployment</th><th className="py-2 px-4">Captured</th><th className="py-2 px-4">Verified</th><th className="py-2 px-4">Errors</th><th className="py-2 px-4">Rating</th>
              </tr></thead>
              <tbody>
                {c.performance.map((p, i) => (
                  <tr key={i} className="border-b border-border">
                    <td className="py-2 px-4 text-xs">{new Date(p.work_date).toLocaleDateString()}</td>
                    <td className="py-2 px-4 text-xs">{p.deployment_name}</td>
                    <td className="py-2 px-4">{p.products_captured}</td>
                    <td className="py-2 px-4">{p.verified_products}</td>
                    <td className="py-2 px-4">{p.errors}</td>
                    <td className="py-2 px-4">{p.supervisor_rating ?? "—"}</td>
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
