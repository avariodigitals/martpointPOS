"use client"

import { useCallback, useEffect, useState } from "react"
import { Award, Download, Loader2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/admin/admin-toast"
import { GRADED_PARTNER_TYPES, GRADED_PARTNER_TYPE_LABEL, gradeRank, partnerTypesFor, type GradedPartnerType } from "@/lib/partner-performance-grading"

type Partner = { id: string; partner_id: string; business_name: string; partner_type: string; current_grade?: string }
type TrackCriteria = { silverOutcomes: number; goldOutcomes: number; platinumOutcomes: number; silverMinDays: number; goldMinDays: number; platinumMinDays: number; assessmentWindowDays: number }
const defaultTrackCriteria = (): Record<GradedPartnerType, TrackCriteria> => Object.fromEntries(GRADED_PARTNER_TYPES.map(type => [type, { silverOutcomes: 1, goldOutcomes: 10, platinumOutcomes: 25, silverMinDays: 90, goldMinDays: 183, platinumMinDays: 365, assessmentWindowDays: 365 }])) as Record<GradedPartnerType, TrackCriteria>
type Review = { partner: Partner; track: { currentGrade: string; qualifyingOutcomes: number; partnershipDays: number; activeAgreement: boolean; onboardingComplete: boolean; complianceClear: boolean; policyStatus: string; outcomeReferences: { reference: string; verifiedAt: string }[] }; history: Record<string, unknown>[] }
const inputClass = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm"

export default function PartnerPerformanceAdminPage() {
  const { toast } = useToast()
  const [partners, setPartners] = useState<Partner[]>([])
  const [partnerId, setPartnerId] = useState("")
  const [partnerType, setPartnerType] = useState<GradedPartnerType>("CHANNEL")
  const [review, setReview] = useState<Review | null>(null)
  const [grade, setGrade] = useState("UNGRADED")
  const [reason, setReason] = useState("")
  const [authorizedReview, setAuthorizedReview] = useState(false)
  const [busy, setBusy] = useState(false)
  const [policy, setPolicy] = useState<Record<string, unknown> | null>(null)
  const [policyReason, setPolicyReason] = useState("")
  const [policyBusy, setPolicyBusy] = useState(false)
  const [approvedPolicy, setApprovedPolicy] = useState<Record<string, unknown> | null>(null)
  const [trackCriteria, setTrackCriteria] = useState<Record<GradedPartnerType, TrackCriteria>>(defaultTrackCriteria)
  const [policyTypes, setPolicyTypes] = useState<GradedPartnerType[]>(GRADED_PARTNER_TYPES)

  const loadReview = useCallback(async (id = partnerId, type = partnerType) => {
    if (!id) { setReview(null); return }
    const res = await fetch(`/api/admin/partners/${id}/performance-grade?partnerType=${type}`)
    const data = await res.json()
    if (!res.ok) { setReview(null); return }
    setReview(data)
    setGrade(data.track.currentGrade)
    setAuthorizedReview(false)
    setReason("")
  }, [partnerId, partnerType])
  const applyPolicySettings = useCallback((active: Record<string, unknown> | null) => {
    setPolicy(active)
    if (!active) return
    const defaults = defaultTrackCriteria()
    const criteria = (active.criteria || {}) as { trackCriteria?: Partial<Record<GradedPartnerType, Partial<TrackCriteria>>>; partnerTypes?: GradedPartnerType[] }
    const configured = criteria.trackCriteria || {}
    for (const type of GRADED_PARTNER_TYPES) {
      const row = configured[type] || {}
      defaults[type] = {
        silverOutcomes: Number(row.silverOutcomes ?? active.silver_outcomes ?? 1),
        goldOutcomes: Number(row.goldOutcomes ?? active.gold_outcomes ?? 10),
        platinumOutcomes: Number(row.platinumOutcomes ?? active.platinum_outcomes ?? 25),
        silverMinDays: Number(row.silverMinDays ?? active.silver_min_days ?? 90),
        goldMinDays: Number(row.goldMinDays ?? active.gold_min_days ?? 183),
        platinumMinDays: Number(row.platinumMinDays ?? active.platinum_min_days ?? 365),
        assessmentWindowDays: Number(row.assessmentWindowDays ?? active.rolling_window_days ?? 365),
      }
    }
    setTrackCriteria(defaults)
    if (Array.isArray(criteria.partnerTypes)) setPolicyTypes(criteria.partnerTypes)
  }, [])
  const refreshPolicies = useCallback(async () => {
    const data = await fetch("/api/admin/partners/grading-policy").then(r => r.json())
    const policies = Array.isArray(data.policies) ? data.policies as Record<string, unknown>[] : []
    const approved = policies.filter(item => item.status === "APPROVED").sort((a, b) => new Date(String(b.effective_at || b.created_at || 0)).getTime() - new Date(String(a.effective_at || a.created_at || 0)).getTime())[0] || null
    const draft = policies.find(item => item.status === "DRAFT") || null
    setApprovedPolicy(approved)
    applyPolicySettings(draft || approved)
  }, [applyPolicySettings])
  useEffect(() => {
    fetch("/api/admin/partners").then(r => r.json()).then(d => setPartners(d.partners || []))
    void refreshPolicies()
  }, [refreshPolicies])
  useEffect(() => {
    const timer = window.setTimeout(() => { void loadReview() }, 0)
    return () => window.clearTimeout(timer)
  }, [loadReview])

  const isReduction = review && gradeRank(grade) < gradeRank(review.track.currentGrade)
  async function createPolicyDraft() {
    if (policyReason.trim().length < 8) return
    setPolicyBusy(true)
    try {
      const res = await fetch("/api/admin/partners/grading-policy", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create_draft", reason: policyReason }) })
      const data = await res.json()
      if (!res.ok) { toast({ title: "Policy revision not created", description: data.error || "Request failed", variant: "error", duration: 0 }); return }
      applyPolicySettings(data.policy)
      toast({ title: "Policy revision ready", description: `Version ${data.policy.version} is a draft. The approved policy remains in force until the revision is published.`, variant: "success" })
      setPolicyReason("")
    } finally { setPolicyBusy(false) }
  }
  async function save() {
    if (!review) return
    setBusy(true)
    try {
      const res = await fetch(`/api/admin/partners/${partnerId}/performance-grade`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ partnerType, grade, reason, managementApproved: true, authorizedReview }) })
      const data = await res.json()
      if (!res.ok) { toast({ title: "Grade review not saved", description: data.error || "Request failed", variant: "error", duration: 0 }); return }
      toast({ title: "Grade decision recorded", description: `${review.partner.business_name}: ${partnerType} ${data.previous} → ${data.grade}`, variant: "success" })
      await loadReview()
    } finally { setBusy(false) }
  }
  async function publishPolicy() {
    if (policyReason.trim().length < 8) return
    setPolicyBusy(true)
    try {
      const draftRes = await fetch("/api/admin/partners/grading-policy", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "update_draft", reason: policyReason, partnerTypes: policyTypes, trackCriteria }) })
      const draftData = await draftRes.json()
      if (!draftRes.ok) { toast({ title: "Policy draft not saved", description: draftData.error || "Request failed", variant: "error", duration: 0 }); return }
      const res = await fetch("/api/admin/partners/grading-policy", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "publish", reason: policyReason }) })
      const data = await res.json()
      if (!res.ok) { toast({ title: "Policy not published", description: data.error || "Request failed", variant: "error", duration: 0 }); return }
      toast({ title: "Grading policy published", description: `Effective ${new Date(data.effectiveAt).toLocaleDateString("en-NG")}. Partners were notified.`, variant: "success" })
      await refreshPolicies()
    } finally { setPolicyBusy(false) }
  }
  async function savePolicyDraft() {
    if (policyReason.trim().length < 8) return
    setPolicyBusy(true)
    try {
      const res = await fetch("/api/admin/partners/grading-policy", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "update_draft", reason: policyReason, partnerTypes: policyTypes, trackCriteria }) })
      const data = await res.json()
      if (!res.ok) { toast({ title: "Draft policy not saved", description: data.error || "Request failed", variant: "error", duration: 0 }); return }
      toast({ title: "Draft policy updated", description: "The versioned change record has been saved.", variant: "success" })
      await refreshPolicies()
    } finally { setPolicyBusy(false) }
  }
  const typesForSelected = partnerId ? partnerTypesFor(partners.find(p => p.id === partnerId)?.partner_type || "") : []
  const gradeOptions = ["UNGRADED", "SILVER", "GOLD", "PLATINUM"]
  const hasDraftPolicy = policy?.status === "DRAFT"
  const approvedCriteria = (approvedPolicy?.criteria || {}) as { partnerTypes?: GradedPartnerType[]; trackCriteria?: Partial<Record<GradedPartnerType, Partial<TrackCriteria>>> }
  const approvedTracks = approvedCriteria.partnerTypes || GRADED_PARTNER_TYPES
  const approvedTrackCriteria = (type: GradedPartnerType): TrackCriteria => {
    const row = approvedCriteria.trackCriteria?.[type] || {}
    return {
      silverOutcomes: Number(row.silverOutcomes ?? approvedPolicy?.silver_outcomes ?? 1),
      goldOutcomes: Number(row.goldOutcomes ?? approvedPolicy?.gold_outcomes ?? 10),
      platinumOutcomes: Number(row.platinumOutcomes ?? approvedPolicy?.platinum_outcomes ?? 25),
      silverMinDays: Number(row.silverMinDays ?? approvedPolicy?.silver_min_days ?? 90),
      goldMinDays: Number(row.goldMinDays ?? approvedPolicy?.gold_min_days ?? 183),
      platinumMinDays: Number(row.platinumMinDays ?? approvedPolicy?.platinum_min_days ?? 365),
      assessmentWindowDays: Number(row.assessmentWindowDays ?? approvedPolicy?.rolling_window_days ?? 365),
    }
  }

  return <div className="mx-auto max-w-5xl space-y-6">
    <header><h1 className="flex items-center gap-2 text-2xl font-bold"><Award className="h-5 w-5" /> Partner Performance &amp; Grade Reviews</h1><p className="mt-1 text-sm text-muted-foreground">Separate grades for each approved Referral, Channel, Implementation, Technology and Payment track. Existing awards can be reduced only through a documented, evidence-based Management review. No automatic batch downgrade occurs.</p></header>
    <Card>
      <CardHeader><CardTitle className="text-sm">Partner grading policy</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {approvedPolicy ? <>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-emerald-200 bg-emerald-50 p-3">
            <div>
              <p className="font-semibold">Current approved policy v{String(approvedPolicy.version)} · APPROVED</p>
              <p className="mt-1 text-xs text-muted-foreground">Effective {approvedPolicy.effective_at ? new Date(String(approvedPolicy.effective_at)).toLocaleString("en-NG") : "date not recorded"}</p>
            </div>
            <a href="/api/admin/partners/grading-policy/document" download>
              <Button type="button" variant="outline" size="sm"><Download className="mr-2 h-4 w-4" />Download current policy PDF</Button>
            </a>
          </div>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead><tr className="border-b bg-muted/50"><th className="p-3">Partner Type track</th><th className="p-3">Silver</th><th className="p-3">Gold</th><th className="p-3">Platinum</th><th className="p-3">Assessment window</th></tr></thead>
              <tbody>{approvedTracks.map(type => { const row = approvedTrackCriteria(type); return <tr key={type} className="border-b last:border-0"><td className="p-3 font-medium">{GRADED_PARTNER_TYPE_LABEL[type]}</td><td className="p-3">{row.silverOutcomes} outcomes · {row.silverMinDays} days</td><td className="p-3">{row.goldOutcomes} outcomes · {row.goldMinDays} days</td><td className="p-3">{row.platinumOutcomes} outcomes · {row.platinumMinDays} days</td><td className="p-3">{row.assessmentWindowDays} days</td></tr> })}</tbody>
            </table>
          </div>
        </> : <p className="text-sm text-muted-foreground">No approved grading policy is recorded.</p>}

        {hasDraftPolicy ? <>
          <p className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm">Editing draft v{String(policy?.version)}. The current approved version remains effective until this draft is published.</p>
          <fieldset className="space-y-2"><legend className="text-sm font-medium">Partner Type tracks covered by this draft</legend><div className="grid gap-2 sm:grid-cols-2">{GRADED_PARTNER_TYPES.map(type => <label key={type} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={policyTypes.includes(type)} onChange={e => setPolicyTypes(current => e.target.checked ? [...current, type] : current.filter(item => item !== type))} />{GRADED_PARTNER_TYPE_LABEL[type]}</label>)}</div></fieldset>
          <div className="space-y-4">{GRADED_PARTNER_TYPES.map(type => <fieldset key={type} className="rounded-md border p-3"><legend className="px-1 text-sm font-semibold">{GRADED_PARTNER_TYPE_LABEL[type]}</legend><div className="grid gap-3 sm:grid-cols-4">{([ ["silverOutcomes","Silver outcomes"], ["silverMinDays","Silver minimum days"], ["goldOutcomes","Gold outcomes"], ["goldMinDays","Gold minimum days"], ["platinumOutcomes","Platinum outcomes"], ["platinumMinDays","Platinum minimum days"], ["assessmentWindowDays","Assessment window (days)"] ] as const).map(([key,label]) => <label className="text-sm" key={key}>{label}<input className={`${inputClass} mt-1`} type="number" min="1" value={trackCriteria[type][key]} onChange={e => setTrackCriteria(current => ({ ...current, [type]: { ...current[type], [key]: Number(e.target.value) } }))} /></label>)}</div></fieldset>)}</div>
          <label className="block text-sm">Change or approval reason<textarea className={`${inputClass} mt-1 min-h-20`} value={policyReason} onChange={e => setPolicyReason(e.target.value)} placeholder="Record Management's reason. Draft changes are versioned and audited." /></label>
          <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={policyBusy || policyReason.trim().length < 8 || policyTypes.length === 0} onClick={() => void savePolicyDraft()}>Save draft policy</Button><Button disabled={policyBusy || policyReason.trim().length < 8} onClick={() => void publishPolicy()}>{policyBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Approve and publish policy</Button></div>
        </> : approvedPolicy && <>
          <p className="text-sm text-muted-foreground">Approved versions are locked. Create a new version to make proposed changes; the current policy stays in force until Management approves the revision.</p>
          <label className="block text-sm">Reason for revision<textarea className={`${inputClass} mt-1 min-h-20`} value={policyReason} onChange={e => setPolicyReason(e.target.value)} placeholder="Record why Management is opening a new policy revision." /></label>
          <Button disabled={policyBusy || policyReason.trim().length < 8} onClick={() => void createPolicyDraft()}>{policyBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create editable policy revision</Button>
        </>}
      </CardContent>
    </Card>
    <Card><CardHeader><CardTitle className="text-sm">Review partner</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2">
      <label className="text-sm">Partner<select className={`${inputClass} mt-1`} value={partnerId} onChange={e => { const id = e.target.value; setPartnerId(id); const types = partnerTypesFor(partners.find(p => p.id === id)?.partner_type || ""); setPartnerType(current => types.includes(current) ? current : types[0] || "CHANNEL") }}><option value="">Select partner</option>{partners.filter(p => partnerTypesFor(p.partner_type).length > 0).map(p => <option key={p.id} value={p.id}>{p.business_name} · {p.partner_id}</option>)}</select></label>
      <label className="text-sm">Partner Type<select className={`${inputClass} mt-1`} value={partnerType} onChange={e => setPartnerType(e.target.value as GradedPartnerType)}>{GRADED_PARTNER_TYPES.map(type => <option key={type} value={type} disabled={!typesForSelected.includes(type)}>{GRADED_PARTNER_TYPE_LABEL[type]}</option>)}</select></label>
    </CardContent></Card>
    {review && <div className="grid gap-4 lg:grid-cols-2">
      <Card><CardHeader><CardTitle className="text-sm">Verified eligibility evidence</CardTitle></CardHeader><CardContent className="space-y-3 text-sm"><p><b>{review.partner.business_name}</b> · {partnerType}</p><p>Current grade: <b>{review.track.currentGrade}</b></p><p>Qualifying verified outcomes: <b>{review.track.qualifyingOutcomes}</b></p><p>Partnership duration: <b>{review.track.partnershipDays} days</b></p><p>Active agreement: {review.track.activeAgreement ? "Yes" : "No"} · Onboarding: {review.track.onboardingComplete ? "Complete" : "Incomplete"} · Compliance: {review.track.complianceClear ? "Satisfactory" : "Needs review"}</p><p>Policy status: <b>{review.track.policyStatus}</b> · Draft policy thresholds cannot be used for new grade awards.</p><div><p className="mb-1 font-medium">Evidence references</p>{review.track.outcomeReferences.length ? <ul className="list-inside list-disc text-xs text-muted-foreground">{review.track.outcomeReferences.map(o => <li key={o.reference}>{o.reference} · {new Date(o.verifiedAt).toLocaleDateString("en-NG")}</li>)}</ul> : <p className="text-xs text-muted-foreground">No qualifying outcome is recorded.</p>}</div><div className="border-t pt-3"><p className="mb-2 font-medium">Decision history</p>{review.history.length ? review.history.slice(0, 8).map((h, i) => <p className="border-t py-1 text-xs text-muted-foreground" key={String(h.id || i)}>{String(h.previous_grade)} → {String(h.new_grade)} · {String(h.decision)} · {String(h.reason)}</p>) : <p className="text-xs text-muted-foreground">No per-type decisions recorded yet.</p>}</div></CardContent></Card>
      <Card><CardHeader><CardTitle className="text-sm">Record a review decision</CardTitle></CardHeader><CardContent className="space-y-3"><label className="block text-sm">New grade<select className={`${inputClass} mt-1`} value={grade} onChange={e => setGrade(e.target.value)}>{gradeOptions.map(g => <option key={g}>{g}</option>)}</select></label><label className="block text-sm">Review reason<textarea className={`${inputClass} mt-1 min-h-24`} value={reason} onChange={e => setReason(e.target.value)} placeholder="Explain the performance gap, evidence reviewed and decision rationale." /></label>{isReduction && <label className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"><input type="checkbox" checked={authorizedReview} onChange={e => setAuthorizedReview(e.target.checked)} className="mt-1" /><span>I confirm this reduction follows a separate review, the partner has been assessed against the approved policy, and the reason and supporting evidence are recorded.</span></label>}<p className="text-xs text-muted-foreground">A downgrade affects grade recognition only; it does not cancel commission or implementation fees already earned under signed terms.</p><Button disabled={busy || reason.trim().length < 8 || (Boolean(isReduction) && !authorizedReview)} onClick={() => void save()}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Record Management decision</Button></CardContent></Card>
    </div>}
  </div>
}
