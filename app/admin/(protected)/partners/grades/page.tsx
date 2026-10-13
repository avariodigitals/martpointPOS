"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Award } from "lucide-react"
import { useToast } from "@/components/admin/admin-toast"
import { REFERRAL_GRADES, REFERRAL_GRADE_LABELS, type ReferralGrade } from "@/lib/partner-grades"

type Sheet = {
  partner: { id: string; code: string; name: string; currentGrade: string; lastReview: string | null; status: string }
  metrics: Record<string, unknown>
  observedAt: string
  inactiveMonths: number
  proposal: { grade: ReferralGrade; label: string; reasons: string[] }
  protections: { grade: ReferralGrade; demoted: boolean; blockedFromPromotion: boolean }
  history: Record<string, unknown>[]
  can: { decide: boolean }
}

const inputCls = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm"

const GRADE_TONE: Record<ReferralGrade, string> = {
  SILVER: "bg-slate-100 text-slate-700",
  GOLD: "bg-amber-100 text-amber-800",
  PLATINUM: "bg-sky-100 text-sky-800",
  DIAMOND: "bg-violet-100 text-violet-800",
}

function gradeChip(grade: string | null) {
  const key = (grade || "").toUpperCase() as ReferralGrade
  const known = (REFERRAL_GRADES as readonly string[]).includes(key)
  return (
    <span className={`text-[10px] uppercase px-2 py-0.5 rounded font-medium ${known ? GRADE_TONE[key] : "bg-muted text-muted-foreground"}`}>
      {known ? REFERRAL_GRADE_LABELS[key] : "Not graded"}
    </span>
  )
}

function dateOnly(value: unknown) {
  if (!value) return "—"
  const d = new Date(String(value))
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString("en-NG")
}

function number(value: unknown, suffix = "") {
  const n = Number(value)
  if (!Number.isFinite(n)) return "—"
  return `${n.toLocaleString()}${suffix}`
}

export default function PartnerGradesPage() {
  const { toast } = useToast()
  const [partners, setPartners] = useState<Record<string, unknown>[]>([])
  const [loadingList, setLoadingList] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [sheet, setSheet] = useState<Sheet | null>(null)
  const [loadingSheet, setLoadingSheet] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const [form, setForm] = useState({
    grade: "SILVER" as ReferralGrade,
    reason: "",
    reviewPeriod: "",
    strategicContribution: false,
    managementApproved: false,
    complianceBreach: false,
    consecutiveMissedQuarters: 0,
    approvedException: false,
  })

  const load = useCallback(async () => {
    setLoadingList(true)
    try {
      const res = await fetch("/api/admin/partners")
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || "Could not load partners")
        return
      }
      setPartners(((json.partners || []) as Record<string, unknown>[]).filter((p) => p.partner_type === "REFERRAL"))
    } finally {
      setLoadingList(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function open(id: string) {
    setLoadingSheet(true)
    setSheet(null)
    setError("")
    try {
      const res = await fetch(`/api/admin/partners/${id}/grade`)
      const json = (await res.json()) as Sheet & { error?: string }
      if (!res.ok) {
        setError(json.error || "Could not open this review sheet")
        return
      }
      setSheet(json)
      setForm((f) => ({
        ...f,
        grade: (json.proposal.grade as ReferralGrade) ?? "SILVER",
        reason: "",
        reviewPeriod: `${new Date().getFullYear()}-Q${Math.floor(new Date().getMonth() / 3) + 1}`,
      }))
    } finally {
      setLoadingSheet(false)
    }
  }

  async function decide() {
    if (!sheet || !selectedId) return
    if (form.reason.trim().length < 5) {
      toast({ title: "A written reason is required", description: "It is stored in the grade history and printed on the confirmation document.", variant: "warning" })
      return
    }
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/partners/${selectedId}/grade`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast({ title: "Decision rejected", description: json.error || "The server refused this decision", variant: "error", duration: 0 })
        return
      }
      toast({
        title: "Grade recorded",
        description: `${sheet.partner.name} — ${REFERRAL_GRADE_LABELS[json.grade as ReferralGrade]}. Confirmation document issued.`,
        variant: "success",
      })
      await Promise.all([load(), open(selectedId)])
    } finally {
      setBusy(false)
    }
  }

  const missingDiamond = form.grade === "DIAMOND" && !(form.strategicContribution && form.managementApproved)

  const rows = useMemo(
    () =>
      [...partners].sort((a, b) => {
        const an = String(a.grade_review_date || "")
        const bn = String(b.grade_review_date || "")
        return an.localeCompare(bn)
      }),
    [partners]
  )

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Award className="w-5 h-5" /> Partner Grades
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Quarterly grade review for Referral Partners. A grade recognises performance only — it never changes commission,
          access or exclusivity unless a signed Commission Schedule says so.
        </p>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="grid md:grid-cols-2 gap-4 items-start">
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">Referral partners</CardTitle></CardHeader>
          <CardContent className="p-0">
            {loadingList ? (
              <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            ) : rows.length === 0 ? (
              <p className="text-sm text-muted-foreground p-4">No Referral Partners yet.</p>
            ) : (
              <div className="divide-y divide-border">
                {rows.map((p) => {
                  const id = String(p.id)
                  return (
                    <button
                      key={id}
                      onClick={() => { setSelectedId(id); void open(id) }}
                      className={`w-full text-left px-4 py-3 hover:bg-muted ${selectedId === id ? "bg-muted" : ""}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{String(p.business_name || p.display_name || "—")}</p>
                          <p className="text-[11px] font-mono text-muted-foreground truncate">{String(p.partner_id)}</p>
                        </div>
                        {gradeChip(p.current_grade ? String(p.current_grade) : null)}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1">Last review {dateOnly(p.grade_review_date)}</p>
                    </button>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">Review sheet</CardTitle></CardHeader>
          <CardContent>
            {loadingSheet ? (
              <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            ) : !sheet ? (
              <p className="text-sm text-muted-foreground">Choose a partner to load the counters MartPoint holds for them.</p>
            ) : (
              <div className="space-y-5">
                <div>
                  <p className="text-sm font-medium">{sheet.partner.name}</p>
                  <p className="text-[11px] font-mono text-muted-foreground">{sheet.partner.code}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Current grade {sheet.partner.currentGrade} · last reviewed {dateOnly(sheet.partner.lastReview)} · read {new Date(sheet.observedAt).toLocaleString("en-NG")}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <Fact label="Accepted referrals (6 months)" value={number(sheet.metrics.acceptedReferrals6m)} />
                  <Fact label="Accepted referrals (12 months)" value={number(sheet.metrics.acceptedReferrals12m)} />
                  <Fact label="Paid conversions (6 months)" value={number(sheet.metrics.paidConversions6m)} />
                  <Fact label="Paid conversions (12 months)" value={number(sheet.metrics.paidConversions12m)} />
                  <Fact label="Valid submission rate" value={number(sheet.metrics.validSubmissionRate, "%")} />
                  <Fact label="Refund / credit rate" value={number(sheet.metrics.refundRate, "%")} />
                  <Fact label="Consecutive passing reviews" value={number(sheet.metrics.consecutivePassingReviews)} />
                  <Fact label="Months since last activity" value={number(sheet.inactiveMonths)} />
                </div>

                <div className="rounded-md border border-border p-3 space-y-2">
                  <p className="text-xs text-muted-foreground">MartPoint&apos;s computed proposal</p>
                  <div className="flex items-center gap-2">
                    {gradeChip(sheet.proposal.grade)}
                    {sheet.protections.blockedFromPromotion && (
                      <span className="text-[10px] uppercase px-2 py-0.5 rounded font-medium bg-red-50 text-red-700">
                        Protection applies → {REFERRAL_GRADE_LABELS[sheet.protections.grade]}
                      </span>
                    )}
                  </div>
                  <ul className="text-[11px] text-muted-foreground list-disc pl-4 space-y-1">
                    {sheet.proposal.reasons.map((r) => <li key={r}>{r}</li>)}
                  </ul>
                </div>

                {sheet.can.decide ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <label className="block">
                        <span className="text-xs text-muted-foreground">Recorded grade</span>
                        <select className={inputCls} value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value as ReferralGrade })}>
                          {REFERRAL_GRADES.map((g) => <option key={g} value={g}>{REFERRAL_GRADE_LABELS[g]}</option>)}
                        </select>
                      </label>
                      <label className="block">
                        <span className="text-xs text-muted-foreground">Review period</span>
                        <input className={inputCls} value={form.reviewPeriod} onChange={(e) => setForm({ ...form, reviewPeriod: e.target.value })} placeholder="2026-Q4" />
                      </label>
                    </div>

                    <label className="block">
                      <span className="text-xs text-muted-foreground">Reason (required — stored in history and on the document)</span>
                      <textarea
                        className={`${inputCls} min-h-[76px]`}
                        value={form.reason}
                        onChange={(e) => setForm({ ...form, reason: e.target.value })}
                        placeholder="Why this grade, in plain terms the partner can read."
                      />
                    </label>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <Check label="Documented strategic contribution" checked={form.strategicContribution} onChange={(v) => setForm({ ...form, strategicContribution: v })} />
                      <Check label="Management approved (for Diamond)" checked={form.managementApproved} onChange={(v) => setForm({ ...form, managementApproved: v })} />
                      <Check label="Compliance breach this period" checked={form.complianceBreach} onChange={(v) => setForm({ ...form, complianceBreach: v })} />
                      <Check label="Approved inactivity exception" checked={form.approvedException} onChange={(v) => setForm({ ...form, approvedException: v })} />
                    </div>

                    <label className="block">
                      <span className="text-xs text-muted-foreground">Consecutive missed quarters</span>
                      <input
                        type="number"
                        min={0}
                        max={8}
                        className={inputCls}
                        value={form.consecutiveMissedQuarters}
                        onChange={(e) => setForm({ ...form, consecutiveMissedQuarters: Number(e.target.value) || 0 })}
                      />
                    </label>

                    {missingDiamond && (
                      <p className="text-xs text-amber-700">
                        Diamond needs both a documented strategic contribution and management approval — without them the server keeps the previous grade.
                      </p>
                    )}

                    <Button onClick={decide} disabled={busy} className="w-full">
                      {busy ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Recording…</> : "Record grade and issue confirmation"}
                    </Button>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Only Management can record a grade decision. You can read the sheet, not decide it.</p>
                )}

                <div>
                  <p className="text-xs text-muted-foreground mb-2">History</p>
                  {sheet.history.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No grades recorded yet.</p>
                  ) : (
                    <div className="divide-y divide-border rounded-md border border-border">
                      {sheet.history.map((h) => (
                        <div key={String(h.id)} className="px-3 py-2">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs">
                              {h.previous_grade ? `${String(h.previous_grade)} → ` : ""}
                              <span className="font-medium">{String(h.new_grade)}</span>
                              <span className="text-muted-foreground"> · {String(h.review_period || "")}</span>
                            </p>
                            <p className="text-[11px] text-muted-foreground">{dateOnly(h.effective_from)}</p>
                          </div>
                          {h.decision_reason ? <p className="text-[11px] text-muted-foreground mt-0.5">{String(h.decision_reason)}</p> : null}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border px-3 py-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  )
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-start gap-2 text-xs">
      <input type="checkbox" className="mt-0.5" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  )
}
