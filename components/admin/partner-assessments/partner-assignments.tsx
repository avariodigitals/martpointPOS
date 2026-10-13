"use client"

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Copy } from "lucide-react"
import { useToast } from "@/components/admin/admin-toast"
import { enumLabel } from "@/lib/utils"
import type { AssessmentAssignment, AssessmentTemplate } from "@/lib/partner-assessments"

const INPUT = "rounded-md border border-input bg-background px-3 py-2 text-sm"

/** Assign and track knowledge papers for an existing partner. */
export function PartnerAssignments({ partnerId }: { partnerId: string }) {
  const { toast } = useToast()
  const [assignments, setAssignments] = useState<AssessmentAssignment[]>([])
  const [templates, setTemplates] = useState<AssessmentTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [templateId, setTemplateId] = useState("")
  const [dueAt, setDueAt] = useState("")
  const [assigning, setAssigning] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [rows, tpl] = await Promise.all([
        fetch(`/api/admin/partner-assessments/assignments?partnerId=${encodeURIComponent(partnerId)}`).then((r) => r.json()),
        fetch("/api/admin/partner-assessments/templates?status=ACTIVE").then((r) => r.json()),
      ])
      setAssignments((rows.assignments || []) as AssessmentAssignment[])
      setTemplates((tpl.templates || []) as AssessmentTemplate[])
    } finally {
      setLoading(false)
    }
  }, [partnerId])

  useEffect(() => {
    load()
  }, [load])

  async function assign() {
    if (!templateId) {
      toast({ title: "Choose a paper first", variant: "warning" })
      return
    }
    setAssigning(true)
    try {
      const res = await fetch("/api/admin/partner-assessments/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId,
          partnerId,
          audience: "PARTNER",
          dueAt: dueAt ? new Date(dueAt).toISOString() : null,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast({ title: data.error || "Could not assign the paper", variant: "error" })
        return
      }
      toast({
        title: data.emailSent ? "Link emailed to the partner" : "Assigned — email failed, the link is listed below",
        variant: data.emailSent ? "success" : "warning",
      })
      setTemplateId("")
      setDueAt("")
      await load()
    } finally {
      setAssigning(false)
    }
  }

  function copyLink(token: string) {
    const url = `${window.location.origin}/partners/assessment/${token}`
    navigator.clipboard.writeText(url).then(
      () => toast({ title: "Link copied", variant: "success" }),
      () => toast({ title: url, description: "Copy this link manually", variant: "info", duration: 0 })
    )
  }

  if (loading) return <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Assign a knowledge paper</CardTitle>
          <p className="text-xs text-muted-foreground">
            The partner can also open it from their portal. Timing and marking are handled the same way as for applicants.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {templates.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No papers are active yet. Build one under Partners → Partner Assessments and set it to active.
            </p>
          ) : (
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-xs space-y-1 block flex-1 min-w-[220px]">
                <span className="text-muted-foreground">Paper</span>
                <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} className={`w-full ${INPUT}`}>
                  <option value="">Choose a paper</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.timeLimitMinutes} min)
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs space-y-1 block">
                <span className="text-muted-foreground">Due by (optional)</span>
                <input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} className={INPUT} />
              </label>
              <Button size="sm" onClick={assign} disabled={assigning}>
                {assigning ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                Assign and email
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Papers for this partner</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {assignments.length === 0 && <p className="text-sm text-muted-foreground">Nothing assigned yet.</p>}
          {assignments.map((a) => (
            <div key={a.id} className="rounded-lg border border-border p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{a.template.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {a.tier.name} · {a.template.timeLimitMinutes} min · pass {a.template.passingScore}% · {a.attemptsUsed}/{a.template.maxAttempts} attempts used
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Assigned {new Date(a.assignedAt).toLocaleDateString()} by {a.assignedByName || "—"}
                    {a.dueAt && ` · due ${new Date(a.dueAt).toLocaleDateString()}`}
                  </p>
                  {a.waivedReason && <p className="text-xs text-violet-700 mt-1">Waived: {a.waivedReason}</p>}
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span className="text-xs font-medium">{enumLabel(a.status)}</span>
                  {a.bestPercent !== null && (
                    <span className="text-xs text-muted-foreground">
                      best {a.bestPercent}%{a.finalOutcome ? ` · ${enumLabel(a.finalOutcome)}` : ""}
                    </span>
                  )}
                  <Button size="sm" variant="outline" onClick={() => copyLink(a.token)}>
                    <Copy className="w-3.5 h-3.5 mr-1" /> Link
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
