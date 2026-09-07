"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Plus, X, UserPlus, Send, Trash2, LayoutGrid, List } from "lucide-react"
import { COUNTRIES, getStatesForCountry, getCitiesForState } from "@/lib/locations"

type ProspectStatus =
  | "NEW_LEAD" | "CONTACTED" | "INTERESTED" | "INVITED_TO_APPLY" | "APPLICATION_SUBMITTED" | "CONVERTED" | "NOT_INTERESTED" | "DISQUALIFIED"

interface Prospect {
  id: string
  referenceNumber: string
  source: string | null
  fullName: string
  businessName: string | null
  email: string | null
  phone: string | null
  country: string | null
  state: string | null
  city: string | null
  interestedPartnerType: string | null
  owner: string | null
  status: ProspectStatus
  notes: string | null
  nextFollowUp: string | null
  inviteToken: string | null
  invitedAt: string | null
  linkedApplicationId: string | null
  createdAt: string
  updatedAt: string
}

type KanbanStage = "NEW_LEAD" | "CONTACTED" | "INTERESTED" | "INVITED_TO_APPLY" | "APPLICATION_SUBMITTED" | "CONVERTED"

const KANBAN_STAGES: KanbanStage[] = ["NEW_LEAD", "CONTACTED", "INTERESTED", "INVITED_TO_APPLY", "APPLICATION_SUBMITTED", "CONVERTED"]

const KANBAN_LABELS: Record<KanbanStage, string> = {
  NEW_LEAD: "New Lead",
  CONTACTED: "Contacted",
  INTERESTED: "Interested",
  INVITED_TO_APPLY: "Invited to Apply",
  APPLICATION_SUBMITTED: "Application Submitted",
  CONVERTED: "Converted",
}

const KANBAN_BG: Record<KanbanStage, string> = {
  NEW_LEAD: "bg-sky-50 border-sky-200",
  CONTACTED: "bg-amber-50 border-amber-200",
  INTERESTED: "bg-blue-50 border-blue-200",
  INVITED_TO_APPLY: "bg-violet-50 border-violet-200",
  APPLICATION_SUBMITTED: "bg-indigo-50 border-indigo-200",
  CONVERTED: "bg-emerald-50 border-emerald-200",
}

const CLOSED_STATUSES: ProspectStatus[] = ["NOT_INTERESTED", "DISQUALIFIED"]

const PARTNER_TYPE_OPTIONS = [
  "Not Applicable",
  "Referral Partner",
  "Channel Partner",
  "Implementation Partner",
  "Channel + Implementation",
  "Technology Partner",
  "Payment Partner",
]

const inputCls = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
const labelCls = "block text-sm font-medium mb-1"

export default function PartnerProspectsPage() {
  const [prospects, setProspects] = useState<Prospect[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState("")
  const [viewMode, setViewMode] = useState<"kanban" | "list">("list")
  const [showAdd, setShowAdd] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    fullName: "",
    businessName: "",
    email: "",
    phone: "",
    source: "",
    country: "",
    state: "",
    city: "",
    interestedPartnerType: "Not Applicable",
    owner: "",
    notes: "",
    nextFollowUp: "",
  })

  const load = async () => {
    try {
      const res = await fetch("/api/admin/partner-prospects")
      const data = await res.json()
      setProspects(data.prospects || [])
    } catch {
      setMessage("Failed to load prospects")
    } finally {
      setLoading(false)
    }
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [])

  const update = async (prospect: Prospect, updates: Partial<Prospect>) => {
    const res = await fetch("/api/admin/partner-prospects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: prospect.id, ...updates }),
    })
    const data = await res.json()
    if (res.ok && data.prospect) {
      setProspects((prev) => prev.map((p) => (p.id === prospect.id ? data.prospect : p)))
      setMessage("")
    } else {
      setMessage(data.error || "Update failed")
    }
  }

  const invite = async (prospect: Prospect) => {
    const res = await fetch("/api/admin/partner-prospects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: prospect.id, action: "invite" }),
    })
    const data = await res.json()
    if (res.ok && data.prospect) {
      setProspects((prev) => prev.map((p) => (p.id === prospect.id ? data.prospect : p)))
      setMessage(`Invite sent: ${data.inviteLink}`)
    } else {
      setMessage(data.error || "Invite failed")
    }
  }

  const remove = async (prospect: Prospect) => {
    if (!confirm(`Delete ${prospect.fullName}?`)) return
    const res = await fetch("/api/admin/partner-prospects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: prospect.id, action: "delete" }),
    })
    if (res.ok) {
      setProspects((prev) => prev.filter((p) => p.id !== prospect.id))
    } else {
      const data = await res.json()
      setMessage(data.error || "Delete failed")
    }
  }

  const countries = useMemo(() => COUNTRIES.map((c) => c.name), [])
  const formStates = useMemo(() => getStatesForCountry(form.country), [form.country])
  const formCities = useMemo(() => getCitiesForState(form.country, form.state), [form.country, form.state])

  const create = async () => {
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setMessage("A valid email is required")
      return
    }
    if (!form.phone.trim()) {
      setMessage("Phone is required")
      return
    }
    setSaving(true)
    const res = await fetch("/api/admin/partner-prospects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "create", ...form }),
    })
    const data = await res.json()
    if (res.ok && data.prospect) {
      setProspects((prev) => [data.prospect, ...prev])
      setShowAdd(false)
      setForm({ fullName: "", businessName: "", email: "", phone: "", source: "", country: "", state: "", city: "", interestedPartnerType: "Not Applicable", owner: "", notes: "", nextFollowUp: "" })
    } else {
      setMessage(data.error || "Failed to create")
    }
    setSaving(false)
  }

  const activeProspects = useMemo(() => prospects.filter((p) => !CLOSED_STATUSES.includes(p.status)), [prospects])
  const closedProspects = useMemo(() => prospects.filter((p) => CLOSED_STATUSES.includes(p.status)), [prospects])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            Partner Prospects
          </h2>
          <p className="text-muted-foreground">Capture and track people who want to become MartPoint partners.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-md border border-border">
            <Button variant={viewMode === "list" ? "default" : "outline"} size="sm" className="rounded-r-none border-0" onClick={() => setViewMode("list")}>
              <List className="w-3.5 h-3.5 mr-1" /> List
            </Button>
            <Button variant={viewMode === "kanban" ? "default" : "outline"} size="sm" className="rounded-l-none border-0" onClick={() => setViewMode("kanban")}>
              <LayoutGrid className="w-3.5 h-3.5 mr-1" /> Kanban
            </Button>
          </div>
          <Button size="sm" onClick={() => setShowAdd(true)}>
            <Plus className="w-4 h-4 mr-1" /> Add Prospect
          </Button>
        </div>
      </div>

      {message && (
        <p className={`text-sm ${message.includes("sent") || message.includes("success") ? "text-green-600" : "text-red-500"}`}>
          {message}
        </p>
      )}

      {viewMode === "kanban" && (
      <div className="overflow-x-auto pb-2">
        <div className="flex gap-3 min-w-max">
          {KANBAN_STAGES.map((stage) => {
            const stageProspects = activeProspects.filter((p) => p.status === stage)
            return (
              <div key={stage} className={`w-72 shrink-0 rounded-lg border p-3 ${KANBAN_BG[stage]}`}>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold uppercase">{KANBAN_LABELS[stage]}</p>
                  <span className="text-xs text-muted-foreground">{stageProspects.length}</span>
                </div>
                <div className="space-y-2 min-h-[80px]">
                  {stageProspects.map((p) => (
                    <div key={p.id} className="rounded-md bg-background border border-border p-3 space-y-2 shadow-sm text-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium">{p.fullName}</p>
                          <p className="text-xs text-muted-foreground">{p.businessName || "—"}</p>
                        </div>
                        <button onClick={() => remove(p)} className="text-muted-foreground hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                      <p className="text-xs text-muted-foreground">{[p.interestedPartnerType, [p.city, p.state, p.country].filter(Boolean).join(", ")].filter(Boolean).join(" · ")}</p>
                      <p className="text-xs text-muted-foreground">Source: {p.source || "—"} · Owner: {p.owner || "—"}</p>
                      {p.nextFollowUp && <p className="text-[10px] text-muted-foreground">Next follow-up: {p.nextFollowUp.split("T")[0]}</p>}
                      {p.notes && <p className="text-[10px] text-muted-foreground line-clamp-2">{p.notes}</p>}
                      {p.inviteToken && <p className="text-[10px] text-violet-600">Invited {p.invitedAt ? p.invitedAt.split("T")[0] : ""}</p>}
                      <div className="flex gap-2 pt-1">
                        {stage !== "CONVERTED" && (
                          <select
                            value={p.status}
                            onChange={(e) => update(p, { status: e.target.value as ProspectStatus })}
                            className="flex-1 text-[10px] rounded border border-input bg-background px-1.5 py-1"
                          >
                            {KANBAN_STAGES.map((s) => <option key={s} value={s}>{KANBAN_LABELS[s]}</option>)}
                            <option value="NOT_INTERESTED">Not Interested</option>
                            <option value="DISQUALIFIED">Disqualified</option>
                          </select>
                        )}
                        {p.email && !p.inviteToken && p.status !== "CONVERTED" && (
                          <Button size="sm" className="h-6 text-[10px] px-2" onClick={() => invite(p)}><Send className="w-3 h-3" /></Button>
                        )}
                      </div>
                    </div>
                  ))}
                  {stageProspects.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No prospects</p>}
                </div>
              </div>
            )
          })}
        </div>
      </div>
      )}

      {viewMode === "list" && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs uppercase text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Prospect</th>
                    <th className="px-4 py-3 font-medium">Contact</th>
                    <th className="px-4 py-3 font-medium">Source</th>
                    <th className="px-4 py-3 font-medium">Owner</th>
                    <th className="px-4 py-3 font-medium">Follow-up</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium w-24">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {prospects.map((p) => (
                    <tr key={p.id} className="border-b last:border-0 hover:bg-muted/40">
                      <td className="px-4 py-3">
                        <p className="font-medium">{p.fullName}</p>
                        <p className="text-xs text-muted-foreground">{p.businessName || "—"} · <span className="font-mono">{p.referenceNumber}</span></p>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <p>{p.email || "—"}</p>
                        <p className="text-muted-foreground">{p.phone || ""}</p>
                      </td>
                      <td className="px-4 py-3">{p.source || "—"}</td>
                      <td className="px-4 py-3">{p.owner || "—"}</td>
                      <td className="px-4 py-3 text-xs">{p.nextFollowUp ? p.nextFollowUp.split("T")[0] : "—"}</td>
                      <td className="px-4 py-3">
                        <select
                          value={p.status}
                          onChange={(e) => update(p, { status: e.target.value as ProspectStatus })}
                          className="text-xs rounded border border-input bg-background px-2 py-1.5"
                        >
                          {KANBAN_STAGES.map((s) => <option key={s} value={s}>{KANBAN_LABELS[s]}</option>)}
                          <option value="NOT_INTERESTED">Not Interested</option>
                          <option value="DISQUALIFIED">Disqualified</option>
                        </select>
                        {p.inviteToken && <p className="text-[10px] text-violet-600 mt-1">Invited {p.invitedAt ? p.invitedAt.split("T")[0] : ""}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {p.email && !p.inviteToken && p.status !== "CONVERTED" && (
                            <button onClick={() => invite(p)} title="Send application invite" className="p-1.5 rounded-md text-muted-foreground hover:text-violet-600 hover:bg-violet-50">
                              <Send className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button onClick={() => remove(p)} title="Delete" className="p-1.5 rounded-md text-muted-foreground hover:text-red-600 hover:bg-red-50">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {prospects.length === 0 && (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No prospects yet. Add one to get started.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {closedProspects.length > 0 && viewMode === "kanban" && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Closed Prospects</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {closedProspects.map((p) => (
                <div key={p.id} className="p-3 rounded-md border border-border bg-muted/10 text-sm">
                  <p className="font-medium">{p.fullName}</p>
                  <p className="text-xs text-muted-foreground">{p.status} · {p.notes ? p.notes.slice(0, 60) : "—"}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-lg bg-background p-6 shadow-lg space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Add Partner Prospect</h3>
              <button onClick={() => setShowAdd(false)} className="text-muted-foreground hover:text-foreground"><X className="w-5 h-5" /></button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className={labelCls}>Full name *</label><input required className={inputCls} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></div>
              <div><label className={labelCls}>Business name</label><input className={inputCls} value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} /></div>
              <div><label className={labelCls}>Email *</label><input type="email" required className={inputCls} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div><label className={labelCls}>Phone *</label><input required className={inputCls} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div><label className={labelCls}>Source</label>
                <select className={inputCls} value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })}>
                  <option value="">Select source</option>
                  <option>Website</option>
                  <option>WhatsApp</option>
                  <option>Referral</option>
                  <option>Event</option>
                  <option>Outbound</option>
                  <option>Other</option>
                </select>
              </div>
              <div><label className={labelCls}>Interested partner type</label>
                <select className={inputCls} value={form.interestedPartnerType} onChange={(e) => setForm({ ...form, interestedPartnerType: e.target.value })}>
                  {PARTNER_TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div><label className={labelCls}>Country</label>
                <select className={inputCls} value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value, state: "", city: "" })}>
                  <option value="">Select country</option>
                  {countries.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div><label className={labelCls}>State</label>
                {formStates.length > 0 ? (
                  <select className={inputCls} value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value, city: "" })}>
                    <option value="">Select state</option>
                    {formStates.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                ) : (
                  <input className={inputCls} value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} placeholder="State / Region" />
                )}
              </div>
              <div><label className={labelCls}>City</label>
                {formCities.length > 0 ? (
                  <select className={inputCls} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })}>
                    <option value="">Select city</option>
                    {formCities.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                ) : (
                  <input className={inputCls} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="City" />
                )}
              </div>
              <div><label className={labelCls}>Owner</label><input className={inputCls} value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} /></div>
              <div><label className={labelCls}>Next follow-up</label><input type="datetime-local" className={inputCls} value={form.nextFollowUp} onChange={(e) => setForm({ ...form, nextFollowUp: e.target.value })} /></div>
            </div>
            <div><label className={labelCls}>Notes</label><textarea className={inputCls} rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}></textarea></div>
            <Button onClick={create} disabled={saving || !form.fullName.trim() || !form.email.trim() || !form.phone.trim()}>{saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null} Save Prospect</Button>
          </div>
        </div>
      )}
    </div>
  )
}
