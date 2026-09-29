"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Plus, AlertCircle } from "lucide-react"
import type { PipelineStageOwner, PipelineHandover } from "@/lib/careers-pipeline"

const inputCls = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
const labelCls = "block text-sm font-medium mb-1.5"

const ACCEPTANCE_COLORS: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-700",
  ACCEPTED: "bg-green-50 text-green-700",
  DECLINED: "bg-red-50 text-red-700",
}

interface LeadOption { id: string; businessName: string; fullName: string }

export default function PipelinePage() {
  const [loading, setLoading] = useState(true)
  const [stages, setStages] = useState<PipelineStageOwner[]>([])
  const [handovers, setHandovers] = useState<PipelineHandover[]>([])
  const [leads, setLeads] = useState<LeadOption[]>([])
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [form, setForm] = useState({
    pipeline_stage: "", new_owner: "", subject_label: "", lead_id: "",
    required_action: "", deadline: "", notes: "",
  })

  function load() {
    setLoading(true)
    Promise.all([
      fetch("/api/admin/careers/pipeline").then((r) => r.json()),
      fetch("/api/admin/leads").then((r) => r.json()).catch(() => ({})),
    ]).then(([p, l]) => {
      setStages(p.stages || [])
      setHandovers(p.handovers || [])
      setLeads(Array.isArray(l.leads) ? l.leads : [])
    }).catch(() => {}).finally(() => setLoading(false))
  }
  useEffect(load, [])

  async function saveOwner(stageKey: string, role: string) {
    await fetch("/api/admin/careers/pipeline", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage_key: stageKey, responsible_role: role }),
    })
    load()
  }

  async function recordHandover() {
    setError("")
    setSaving(true)
    try {
      const res = await fetch("/api/admin/careers/pipeline/handovers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pipeline_stage: form.pipeline_stage,
          new_owner: form.new_owner,
          lead_id: form.lead_id || null,
          subject_label: form.subject_label || null,
          required_action: form.required_action || null,
          deadline: form.deadline ? new Date(form.deadline).toISOString() : null,
          notes: form.notes || null,
        }),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || "Failed to record handover")
      setShowForm(false)
      setForm({ pipeline_stage: "", new_owner: "", subject_label: "", lead_id: "", required_action: "", deadline: "", notes: "" })
      load()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record handover")
    } finally {
      setSaving(false)
    }
  }

  async function setAcceptance(id: string, status: string) {
    await fetch(`/api/admin/careers/pipeline/handovers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ acceptance_status: status }),
    })
    load()
  }

  const stageLabel = (key: string) => stages.find((s) => s.stage_key === key)?.label || key

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Conversion Pipeline</h2>
          <p className="text-muted-foreground">Which workforce role owns each stage, and the handover ledger between owners.</p>
        </div>
        <Button onClick={() => setShowForm((s) => !s)}><Plus className="w-4 h-4" /> Record handover</Button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 flex items-start gap-2 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
        </div>
      )}

      {/* Stage ownership */}
      <Card>
        <CardHeader><CardTitle className="text-base">Stage ownership</CardTitle></CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-muted-foreground border-b border-border">
                  <th className="py-3 px-4">Stage</th>
                  <th className="py-3 px-4">Responsible role</th>
                  <th className="py-3 px-4"></th>
                </tr>
              </thead>
              <tbody>
                {stages.map((s) => (
                  <StageRow key={s.id} stage={s} onSave={saveOwner} />
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* New handover */}
      {showForm && (
        <Card>
          <CardHeader><CardTitle className="text-base">Record handover</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className={labelCls}>Pipeline stage *</label>
              <select className={inputCls} value={form.pipeline_stage} onChange={(e) => setForm((p) => ({ ...p, pipeline_stage: e.target.value }))}>
                <option value="">Select stage</option>
                {stages.map((s) => <option key={s.stage_key} value={s.stage_key}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Lead / customer</label>
              <select className={inputCls} value={form.lead_id} onChange={(e) => setForm((p) => ({ ...p, lead_id: e.target.value }))}>
                <option value="">Select lead (or label below)</option>
                {leads.map((l) => <option key={l.id} value={l.id}>{l.businessName} — {l.fullName}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Subject label (if no lead selected)</label>
              <input className={inputCls} value={form.subject_label} onChange={(e) => setForm((p) => ({ ...p, subject_label: e.target.value }))} />
            </div>
            <div>
              <label className={labelCls}>New owner *</label>
              <input className={inputCls} value={form.new_owner} onChange={(e) => setForm((p) => ({ ...p, new_owner: e.target.value }))} placeholder="e.g. Demo Specialist — Ada" />
            </div>
            <div>
              <label className={labelCls}>Required action</label>
              <input className={inputCls} value={form.required_action} onChange={(e) => setForm((p) => ({ ...p, required_action: e.target.value }))} />
            </div>
            <div>
              <label className={labelCls}>Deadline</label>
              <input type="datetime-local" className={inputCls} value={form.deadline} onChange={(e) => setForm((p) => ({ ...p, deadline: e.target.value }))} />
            </div>
            <div className="md:col-span-3">
              <label className={labelCls}>Notes</label>
              <textarea rows={2} className={inputCls} value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
            </div>
            <div className="md:col-span-3">
              <Button onClick={recordHandover} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Record handover
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Handover log */}
      <Card>
        <CardHeader><CardTitle className="text-base">Handover log</CardTitle></CardHeader>
        <CardContent className="p-0">
          {handovers.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No handovers recorded yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-muted-foreground border-b border-border">
                  <th className="py-3 px-4">When</th>
                  <th className="py-3 px-4">Stage</th>
                  <th className="py-3 px-4">From → To</th>
                  <th className="py-3 px-4">Required action</th>
                  <th className="py-3 px-4">Deadline</th>
                  <th className="py-3 px-4">Acceptance</th>
                  <th className="py-3 px-4"></th>
                </tr>
              </thead>
              <tbody>
                {handovers.map((h) => (
                  <tr key={h.id} className="border-b border-border">
                    <td className="py-3 px-4 text-xs text-muted-foreground">{new Date(h.handed_at).toLocaleString()}</td>
                    <td className="py-3 px-4 text-xs">{stageLabel(h.pipeline_stage)}</td>
                    <td className="py-3 px-4 text-xs">
                      {h.previous_owner || "—"} → <span className="font-medium">{h.new_owner}</span>
                      {h.subject_label && <div className="text-muted-foreground">{h.subject_label}</div>}
                    </td>
                    <td className="py-3 px-4 text-xs">{h.required_action || "—"}</td>
                    <td className="py-3 px-4 text-xs">{h.deadline ? new Date(h.deadline).toLocaleDateString() : "—"}</td>
                    <td className="py-3 px-4">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${ACCEPTANCE_COLORS[h.acceptance_status] || ""}`}>
                        {h.acceptance_status}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {h.acceptance_status === "PENDING" && (
                        <div className="flex gap-1.5 justify-end">
                          <Button size="sm" variant="outline" onClick={() => setAcceptance(h.id, "ACCEPTED")}>Accept</Button>
                          <Button size="sm" variant="outline" onClick={() => setAcceptance(h.id, "DECLINED")}>Decline</Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function StageRow({ stage, onSave }: { stage: PipelineStageOwner; onSave: (key: string, role: string) => void }) {
  const [role, setRole] = useState(stage.responsible_role)
  const dirty = role !== stage.responsible_role
  return (
    <tr className="border-b border-border">
      <td className="py-3 px-4">
        <span className="font-medium">{stage.label}</span>
        <span className="block text-xs text-muted-foreground">{stage.stage_key}</span>
      </td>
      <td className="py-3 px-4">
        <input className={inputCls} value={role} onChange={(e) => setRole(e.target.value)} />
      </td>
      <td className="py-3 px-4">
        {dirty && <Button size="sm" variant="outline" onClick={() => onSave(stage.stage_key, role)}>Save</Button>}
      </td>
    </tr>
  )
}
