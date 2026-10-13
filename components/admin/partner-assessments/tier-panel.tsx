"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Plus, Trash2, X, Pencil } from "lucide-react"
import { useToast } from "@/components/admin/admin-toast"
import type { AssessmentAudience, AssessmentTier } from "@/lib/partner-assessments"

const AUDIENCE_LABELS: Record<AssessmentAudience, string> = {
  APPLICANT: "Applicants only",
  PARTNER: "Partners only",
  BOTH: "Applicants and partners",
}

interface Draft {
  id?: string
  code: string
  name: string
  description: string
  level: number
  audience: AssessmentAudience
  requiredForApproval: boolean
  active: boolean
}

const EMPTY: Draft = {
  code: "",
  name: "",
  description: "",
  level: 1,
  audience: "APPLICANT",
  requiredForApproval: true,
  active: true,
}

export function TierPanel({
  tiers,
  selectedId,
  onSelect,
  onChanged,
}: {
  tiers: AssessmentTier[]
  selectedId: string | null
  onSelect: (id: string) => void
  onChanged: () => void
}) {
  const { toast } = useToast()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  function openNew() {
    setConfirmDelete(null)
    setDraft({ ...EMPTY, level: tiers.length + 1 })
  }

  function openEdit(tier: AssessmentTier) {
    setConfirmDelete(null)
    setDraft({ ...tier })
  }

  async function save() {
    if (!draft) return
    if (!draft.name.trim()) {
      toast({ title: "Give the tier a name", variant: "warning" })
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/admin/partner-assessments/tiers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ title: data.error || "Could not save the tier", variant: "error" })
        return
      }
      toast({ title: "Tier saved", variant: "success" })
      setDraft(null)
      onChanged()
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: string) {
    const res = await fetch(`/api/admin/partner-assessments/tiers?id=${encodeURIComponent(id)}`, { method: "DELETE" })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      toast({ title: data.error || "Could not delete the tier", variant: "error" })
      return
    }
    toast({ title: "Tier deleted", variant: "success" })
    setConfirmDelete(null)
    onChanged()
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-medium">Tiers</CardTitle>
        {!draft && (
          <Button size="sm" variant="outline" onClick={openNew}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Add tier
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {draft && (
          <div className="rounded-lg border border-border p-3 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium">{draft.id ? "Edit tier" : "New tier"}</p>
              <button onClick={() => setDraft(null)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                placeholder="Name"
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <input
                placeholder="Code (e.g. APPLICANT_T1)"
                value={draft.code}
                onChange={(e) => setDraft({ ...draft, code: e.target.value })}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <textarea
              placeholder="What this tier proves"
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              rows={2}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <label className="flex items-center gap-2 text-xs">
                Order
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={draft.level}
                  onChange={(e) => setDraft({ ...draft, level: Number(e.target.value) })}
                  className="w-20 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                />
              </label>
              <select
                value={draft.audience}
                onChange={(e) => setDraft({ ...draft, audience: e.target.value as AssessmentAudience })}
                className="rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {(Object.keys(AUDIENCE_LABELS) as AssessmentAudience[]).map((a) => (
                  <option key={a} value={a}>{AUDIENCE_LABELS[a]}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={draft.requiredForApproval}
                  onChange={(e) => setDraft({ ...draft, requiredForApproval: e.target.checked })}
                />
                Required before approval
              </label>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={draft.active}
                  onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
                />
                Active
              </label>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={save} disabled={saving}>
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Save tier"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setDraft(null)}>Cancel</Button>
            </div>
          </div>
        )}

        {tiers.length === 0 && !draft && (
          <p className="text-sm text-muted-foreground">No tiers yet. Add one to start building papers.</p>
        )}

        <div className="space-y-1">
          {tiers.map((t) => {
            const selected = t.id === selectedId
            return (
              <div
                key={t.id}
                className={`rounded-lg border p-3 space-y-1 cursor-pointer transition-colors ${
                  selected ? "border-retail bg-retail/5" : "border-border hover:bg-muted/40"
                }`}
                onClick={() => onSelect(t.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {t.level}. {t.name}
                      {!t.active && <span className="ml-2 text-xs text-muted-foreground">(inactive)</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {AUDIENCE_LABELS[t.audience]} · {t.requiredForApproval ? "required for approval" : "optional"}
                    </p>
                    {t.description && <p className="text-xs text-muted-foreground mt-1">{t.description}</p>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); openEdit(t) }}
                      className="text-muted-foreground hover:text-foreground"
                      aria-label="Edit tier"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirmDelete(confirmDelete === t.id ? null : t.id) }}
                      className="text-muted-foreground hover:text-red-600"
                      aria-label="Delete tier"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                {confirmDelete === t.id && (
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-border">
                    <p className="text-xs">Delete “{t.name}”? Templates must be moved or deleted first.</p>
                    <div className="flex gap-1">
                      <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setConfirmDelete(null) }}>Keep</Button>
                      <Button size="sm" onClick={(e) => { e.stopPropagation(); remove(t.id) }}>Delete</Button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
