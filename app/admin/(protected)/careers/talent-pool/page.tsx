"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Users, Plus } from "lucide-react"
import { VERIFICATION_STATUSES, CANDIDATE_STATUSES } from "@/lib/careers"
import { STATES } from "@/lib/locations"

interface Candidate {
  id: string; reference_number: string; full_name: string; email: string
  phone: string | null; state: string | null; lga: string | null; city: string | null
  qualified_roles: string[]; skills: string[]; status: string
  verification_status: string; team_lead_eligible: boolean
  consent_talent_pool: boolean; last_contacted_at: string | null; created_at: string
}

export default function TalentPoolPage() {
  const [loading, setLoading] = useState(true)
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ fullName: "", email: "", phone: "", state: "", city: "", lga: "", qualifiedRoles: "", availabilityNotes: "", consentTalentPool: false })
  const [addMsg, setAddMsg] = useState("")
  const [filters, setFilters] = useState({ state: "", city: "", lga: "", verification: "", status: "", teamLead: "", skill: "", q: "" })

  const load = useCallback(() => {
    setLoading(true)
    const p = new URLSearchParams()
    Object.entries(filters).forEach(([k, v]) => v && p.set(k, v))
    fetch(`/api/admin/careers/talent-pool?${p}`).then((r) => r.json())
      .then((d) => setCandidates(d.candidates || []))
      .finally(() => setLoading(false))
  }, [filters])

  useEffect(() => {
    void Promise.resolve().then(load)
  }, [load])

  async function addCandidate() {
    setAddMsg("")
    const res = await fetch("/api/admin/careers/talent-pool", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        qualifiedRoles: form.qualifiedRoles.split(",").map((s) => s.trim()).filter(Boolean),
      }),
    })
    const d = await res.json()
    setAddMsg(res.ok ? `Added (${d.reference})` : d.error || "Failed")
    if (res.ok) { setShowAdd(false); setForm({ fullName: "", email: "", phone: "", state: "", city: "", lga: "", qualifiedRoles: "", availabilityNotes: "", consentTalentPool: false }); load() }
  }

  const inputCls = "rounded-md border border-input bg-background px-3 py-1.5 text-sm w-full"

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2"><Users className="w-5 h-5" /> Talent Pool</h2>
          <p className="text-muted-foreground">Reusable verified worker profiles — the on-call field network.</p>
        </div>
        <Button onClick={() => setShowAdd((s) => !s)}><Plus className="w-4 h-4" /> Add candidate</Button>
      </div>

      {showAdd && (
        <Card><CardContent className="p-4 space-y-3">
          <p className="text-sm font-medium">Add candidate manually</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input className={inputCls} placeholder="Full name *" value={form.fullName} onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))} />
            <input className={inputCls} placeholder="Email *" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            <input className={inputCls} placeholder="Phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            <select className={inputCls} value={form.state} onChange={(e) => setForm((f) => ({ ...f, state: e.target.value }))}>
              <option value="">State</option>
              {STATES["Nigeria"].map((s) => <option key={s}>{s}</option>)}
            </select>
            <input className={inputCls} placeholder="LGA" value={form.lga} onChange={(e) => setForm((f) => ({ ...f, lga: e.target.value }))} />
            <input className={inputCls} placeholder="City" value={form.city} onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))} />
            <input className={inputCls + " md:col-span-2"} placeholder="Qualified roles (comma-separated)" value={form.qualifiedRoles} onChange={(e) => setForm((f) => ({ ...f, qualifiedRoles: e.target.value }))} />
            <input className={inputCls} placeholder="Availability notes" value={form.availabilityNotes} onChange={(e) => setForm((f) => ({ ...f, availabilityNotes: e.target.value }))} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="accent-retail" checked={form.consentTalentPool}
              onChange={(e) => setForm((f) => ({ ...f, consentTalentPool: e.target.checked }))} />
            Candidate consented to join the Talent Pool (recorded with today&apos;s date)
          </label>
          <div className="flex items-center gap-3">
            <Button size="sm" onClick={addCandidate}>Save candidate</Button>
            {addMsg && <p className="text-xs text-muted-foreground">{addMsg}</p>}
          </div>
        </CardContent></Card>
      )}

      <div className="flex flex-wrap gap-2">
        <select className="rounded-md border border-input bg-background px-2 py-1.5 text-sm" value={filters.state}
          onChange={(e) => setFilters((f) => ({ ...f, state: e.target.value }))}>
          <option value="">All states</option>
          {STATES["Nigeria"].map((s) => <option key={s}>{s}</option>)}
        </select>
        <input className="rounded-md border border-input bg-background px-3 py-1.5 text-sm w-28" placeholder="City"
          value={filters.city} onChange={(e) => setFilters((f) => ({ ...f, city: e.target.value }))} />
        <input className="rounded-md border border-input bg-background px-3 py-1.5 text-sm w-28" placeholder="LGA"
          value={filters.lga} onChange={(e) => setFilters((f) => ({ ...f, lga: e.target.value }))} />
        <select className="rounded-md border border-input bg-background px-2 py-1.5 text-sm" value={filters.verification}
          onChange={(e) => setFilters((f) => ({ ...f, verification: e.target.value }))}>
          <option value="">Verification</option>
          {VERIFICATION_STATUSES.map((s) => <option key={s}>{s.replace(/_/g, " ")}</option>)}
        </select>
        <select className="rounded-md border border-input bg-background px-2 py-1.5 text-sm" value={filters.status}
          onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
          <option value="">Status</option>
          {CANDIDATE_STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <select className="rounded-md border border-input bg-background px-2 py-1.5 text-sm" value={filters.teamLead}
          onChange={(e) => setFilters((f) => ({ ...f, teamLead: e.target.value }))}>
          <option value="">Team lead?</option>
          <option value="true">Eligible</option>
        </select>
        <input className="rounded-md border border-input bg-background px-3 py-1.5 text-sm w-32" placeholder="Skill"
          value={filters.skill} onChange={(e) => setFilters((f) => ({ ...f, skill: e.target.value }))} />
        <input className="rounded-md border border-input bg-background px-3 py-1.5 text-sm w-56" placeholder="Search name/email/ref…"
          value={filters.q} onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))} />
      </div>

      <Card><CardContent className="p-0">
        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : candidates.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">No candidates match.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-muted-foreground border-b border-border">
                  <th className="py-3 px-4">Candidate</th>
                  <th className="py-3 px-4">Location</th>
                  <th className="py-3 px-4">Qualified roles</th>
                  <th className="py-3 px-4">Skills</th>
                  <th className="py-3 px-4">Verification</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Lead</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((c) => (
                  <tr key={c.id} className="border-b border-border hover:bg-muted/30">
                    <td className="py-3 px-4">
                      <Link href={`/admin/careers/talent-pool/${c.id}`} className="font-medium text-retail hover:underline">{c.full_name}</Link>
                      <p className="text-xs text-muted-foreground font-mono">{c.reference_number}</p>
                    </td>
                    <td className="py-3 px-4 text-xs">{[c.city, c.state].filter(Boolean).join(", ") || "—"}</td>
                    <td className="py-3 px-4 text-xs max-w-40 truncate">{c.qualified_roles?.join(", ") || "—"}</td>
                    <td className="py-3 px-4 text-xs max-w-40 truncate">{c.skills?.join(", ") || "—"}</td>
                    <td className="py-3 px-4">
                      <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded font-medium ${c.verification_status === "VERIFIED" ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-600"}`}>
                        {c.verification_status?.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs">{c.status}</td>
                    <td className="py-3 px-4 text-xs">{c.team_lead_eligible ? "Yes" : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent></Card>
    </div>
  )
}
