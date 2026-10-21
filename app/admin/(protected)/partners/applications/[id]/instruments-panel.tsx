"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2, ShieldCheck, FileSignature, ListChecks, Landmark, BadgeCheck } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/admin/admin-toast"
import { InstrumentsPreviewModal } from "@/components/admin/instruments-preview-modal"

/* ───────────────────────────  Signed instruments panel  ───────────────────────────
 * Drives the Agreement and Commission Schedule lifecycle. The rates, protection
 * window, holding period and payout timing typed here become the signed schedule
 * the commission engine reads — they are never decided in code.
 */

type Status = { id: string; reference: string; status: string; version: number; next: string[]; title?: string; executedAt?: string | null; documentId?: string | null; previewUrl?: string | null }
type Schedule = Status & {
  firstYearRate: number
  firstRenewalRate: number
  protectionDays: number
  holdingDays: number
  payoutDaysAfterMonthEnd: number
  approvedSplit: string
  effectiveFrom: string | null
  notes: string
  revenueBasis: string
  renewalRule: string
}
type Profile = {
  bankName: string
  accountName: string
  accountLast4: string
  taxReference: string
  taxDetailsVerified: boolean
  verificationStatus: string
  contactEmail: string
  verifiedAt: string | null
} | null

type Detail = {
  isReferral: boolean
  application: Record<string, unknown>
  partner: Record<string, unknown> | null
  gates: { ready: boolean; missing: string[] }
  agreements: Status[]
  schedules: Schedule[]
  payoutProfile: Profile
  stamps: { orientationCompletedAt: string | null; conductAcknowledgedAt: string | null }
  standardTerms: {
    firstYearRatePercent: number
    firstRenewalRatePercent: number
    holdingDays: number
    protectionDays: number
    payoutDaysAfterMonthEnd: number
  }
  can: { agreementReview: boolean; scheduleApprove: boolean; bankApprove: boolean; activate: boolean }
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  LEGAL_REVIEW: "Legal review",
  COMMERCIAL_REVIEW: "Commercial review",
  APPROVED_FOR_SIGNATURE: "Approved for signature",
  SENT_FOR_SIGNATURE: "Sent for signature",
  PARTIALLY_SIGNED: "Partially signed",
  EXECUTED: "Executed",
  ACTIVE: "Active",
  SUSPENDED: "Suspended",
  SUPERSEDED: "Superseded",
  TERMINATED: "Terminated",
  EXPIRED: "Expired",
}

const ACTION_LABELS: Record<string, string> = {
  LEGAL_REVIEW: "Send to legal review",
  COMMERCIAL_REVIEW: "Send to commercial review",
  APPROVED_FOR_SIGNATURE: "Approve for signature",
  SENT_FOR_SIGNATURE: "Send for signature",
  PARTIALLY_SIGNED: "Mark partially signed",
  EXECUTED: "Record as executed",
  ACTIVE: "Bring into force",
  DRAFT: "Return to draft",
}

function label(status: string) {
  return STATUS_LABELS[status] || status
}

function statusTone(status: string) {
  if (status === "EXECUTED" || status === "ACTIVE") return "bg-emerald-100 text-emerald-800"
  if (status === "SUPERSEDED" || status === "TERMINATED" || status === "EXPIRED") return "bg-gray-100 text-gray-600"
  if (status === "DRAFT") return "bg-amber-100 text-amber-800"
  return "bg-blue-100 text-blue-800"
}

function Input({
  label: text,
  value,
  onChange,
  type = "text",
  placeholder,
  disabled,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
  disabled?: boolean
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium mb-1">{text}</span>
      <input
        type={type}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-60"
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  )
}

export function InstrumentsPanel({ applicationId }: { applicationId: string }) {
  const { toast } = useToast()
  const [detail, setDetail] = useState<Detail | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState("")
  const [preview, setPreview] = useState<{ url: string; type: "agreement" | "schedule" } | null>(null)

  const [terms, setTerms] = useState({ firstYear: "10", renewal: "5", protection: "90", holding: "30", payout: "14", split: "", justification: "" })
  const [profile, setProfile] = useState({ bankName: "", accountNumber: "", accountName: "", contactName: "", contactEmail: "", contactPhone: "", taxReference: "" })
  const [verifyNotes, setVerifyNotes] = useState("")

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/partners/applications/${applicationId}/instruments`)
    if (!res.ok) {
      setLoading(false)
      return
    }
    const json = (await res.json()) as Detail
    setDetail(json)
    setTerms((t) => ({
      ...t,
      firstYear: String(json.standardTerms.firstYearRatePercent),
      renewal: String(json.standardTerms.firstRenewalRatePercent),
      protection: String(json.standardTerms.protectionDays),
      holding: String(json.standardTerms.holdingDays),
      payout: String(json.standardTerms.payoutDaysAfterMonthEnd),
    }))
    setProfile((p) => ({
      ...p,
      accountName: json.payoutProfile?.accountName || p.accountName,
      contactEmail: json.payoutProfile?.contactEmail || p.contactEmail,
      taxReference: json.payoutProfile?.taxReference || p.taxReference,
    }))
    setLoading(false)
  }, [applicationId])

  useEffect(() => {
    // This effect intentionally starts the request; load owns its loading state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  async function act(
    key: string,
    body: Record<string, unknown>,
    previewRequest?: { type: "agreement" | "schedule"; recordId: string },
  ) {
    setBusy(key)
    try {
      const res = await fetch(`/api/admin/partners/applications/${applicationId}/instruments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const json = (await res.json()) as { error?: string; detail?: Detail }
      if (!res.ok) {
        toast({ title: json.error || "That action was refused", variant: "warning" })
        return
      }
      if (json.detail) {
        setDetail(json.detail)
        if (previewRequest) {
          const rows = previewRequest.type === "agreement" ? json.detail.agreements : json.detail.schedules
          const generated = rows.find((row) => row.id === previewRequest.recordId)
          if (generated?.previewUrl) setPreview({ url: generated.previewUrl, type: previewRequest.type })
        }
      }
      toast({ title: "Recorded", variant: "success" })
    } catch {
      toast({ title: "Could not reach the server", variant: "error" })
    } finally {
      setBusy("")
    }
  }

  const standard = detail?.standardTerms
  const nonStandard = useMemo(() => {
    if (!standard) return false
    return (
      Number(terms.firstYear) !== standard.firstYearRatePercent ||
      Number(terms.renewal) !== standard.firstRenewalRatePercent ||
      Number(terms.protection) !== standard.protectionDays ||
      Number(terms.holding) !== standard.holdingDays ||
      Number(terms.payout) !== standard.payoutDaysAfterMonthEnd ||
      Boolean(terms.split.trim())
    )
  }, [standard, terms])

  if (loading) {
    return (
      <Card>
        <CardContent className="p-4 text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading signed instruments…
        </CardContent>
      </Card>
    )
  }
  if (!detail || !detail.isReferral) return null

  const inForce = (rows: Status[]) => rows.some((r) => r.status === "EXECUTED" || r.status === "ACTIVE")
  const agreementLive = inForce(detail.agreements)
  const scheduleLive = inForce(detail.schedules)

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <ListChecks className="w-4 h-4" /> Activation readiness
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Chip ok={Boolean(detail.partner)} text={detail.partner ? `Partner record ${String(detail.partner.partner_id || "")}` : "Partner record"} />
            <Chip ok={agreementLive} text="Executed Agreement" />
            <Chip ok={scheduleLive} text="Executed Commission Schedule" />
            <Chip ok={detail.payoutProfile?.verificationStatus === "VERIFIED"} text="Verified payout and tax details" />
            <Chip ok={Boolean(detail.stamps.orientationCompletedAt)} text="Orientation" />
            <Chip ok={Boolean(detail.stamps.conductAcknowledgedAt)} text="Conduct acknowledgement" />
          </div>
          <p className="text-xs text-muted-foreground">
            {detail.gates.ready
              ? "Every gate is cleared — this Referral Partner can be activated from the panel below."
              : `Still missing: ${detail.gates.missing.join(", ")}. A Referral Partner cannot be activated while any gate is open.`}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <FileSignature className="w-4 h-4" /> Referral Partner Agreement
          </CardTitle>
          {detail.can.agreementReview && !agreementLive && (
            <Button
              size="sm"
              variant="outline"
              disabled={busy === "agr-new"}
              onClick={() => act("agr-new", { action: "add_agreement" })}
            >
              {busy === "agr-new" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null} Create draft
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {detail.agreements.length === 0 ? (
            <p className="text-sm text-muted-foreground">No agreement record yet — create the draft, then take it through review and signature.</p>
          ) : (
            detail.agreements.map((a) => (
              <div key={a.id} className="border border-border rounded-md p-3 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium">{a.reference}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusTone(a.status)}`}>{label(a.status)}</span>
                  {a.executedAt && <span className="text-xs text-muted-foreground">executed {new Date(a.executedAt).toLocaleDateString()}</span>}
                </div>
                {a.title && <p className="text-xs text-muted-foreground">{a.title}</p>}
                <div className="flex flex-wrap gap-2">
                  {a.previewUrl ? (
                    <Button size="sm" variant="outline" onClick={() => setPreview({ url: a.previewUrl!, type: "agreement" })}>Preview document</Button>
                  ) : detail.can.agreementReview && detail.partner && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy === a.id + "document"}
                      onClick={() => act(a.id + "document", { action: "issue_agreement_document", agreementId: a.id }, { type: "agreement", recordId: a.id })}
                    >
                      {busy === a.id + "document" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null} Generate preview
                    </Button>
                  )}
                  {detail.can.agreementReview && a.next
                      .filter((to) => to !== "SUPERSEDED")
                      .map((to) => (
                        <Button
                          key={to}
                          size="sm"
                          variant="outline"
                          disabled={busy === a.id + to}
                          onClick={() => act(a.id + to, { action: "transition_agreement", agreementId: a.id, to })}
                        >
                          {busy === a.id + to ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null} {ACTION_LABELS[to] || label(to)}
                        </Button>
                      ))}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <ShieldCheck className="w-4 h-4" /> Commission Schedule
          </CardTitle>
          {detail.can.scheduleApprove && (
            <Button size="sm" variant="outline" disabled={busy === "sch-new"} onClick={() => act("sch-new", { action: "add_schedule", ...scheduleBody(terms) })}>
              {busy === "sch-new" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null} Draft new version
            </Button>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {detail.schedules.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing signed yet. Until a schedule is executed, referral earnings are read against the standard approved rules — never a silent custom rate.
            </p>
          ) : (
            detail.schedules.map((s) => (
              <div key={s.id} className="border border-border rounded-md p-3 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium">{s.reference}</span>
                  <span className="text-xs text-muted-foreground">v{s.version}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusTone(s.status)}`}>{label(s.status)}</span>
                  {s.effectiveFrom && <span className="text-xs text-muted-foreground">effective {s.effectiveFrom}</span>}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                  <Fact label="First-year rate" value={`${s.firstYearRate}%`} />
                  <Fact label="First renewal" value={`${s.firstRenewalRate}%`} />
                  <Fact label="Protection" value={`${s.protectionDays} days`} />
                  <Fact label="Holding" value={`${s.holdingDays} days`} />
                  <Fact label="Payout due" value={`${s.payoutDaysAfterMonthEnd} days after month-end`} />
                </div>
                <p className="text-xs text-muted-foreground">
                  Basis: {s.revenueBasis} · Renewal rule: {s.renewalRule}
                  {s.approvedSplit ? ` · Approved split: ${s.approvedSplit}` : ""}
                </p>
                {s.notes && <p className="text-xs text-amber-800">{s.notes}</p>}
                <div className="flex flex-wrap gap-2">
                  {s.previewUrl ? (
                    <Button size="sm" variant="outline" onClick={() => setPreview({ url: s.previewUrl!, type: "schedule" })}>Preview document</Button>
                  ) : detail.can.scheduleApprove && detail.partner && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy === s.id + "document"}
                      onClick={() => act(s.id + "document", { action: "issue_schedule_document", scheduleId: s.id }, { type: "schedule", recordId: s.id })}
                    >
                      {busy === s.id + "document" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null} Generate preview
                    </Button>
                  )}
                  {detail.can.scheduleApprove && s.next
                      .filter((to) => to !== "SUPERSEDED")
                      .map((to) => (
                        <Button
                          key={to}
                          size="sm"
                          variant="outline"
                          disabled={busy === s.id + to}
                          onClick={() => act(s.id + to, { action: "transition_schedule", scheduleId: s.id, to })}
                        >
                          {busy === s.id + to ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null} {ACTION_LABELS[to] || label(to)}
                        </Button>
                      ))}
                </div>
              </div>
            ))
          )}

          {detail.can.scheduleApprove && (
            <div className="space-y-3 rounded-md border border-dashed border-border p-3">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Terms for the next version</p>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <Input label="First-year %" value={terms.firstYear} onChange={(v) => setTerms({ ...terms, firstYear: v })} type="number" />
                <Input label="First renewal %" value={terms.renewal} onChange={(v) => setTerms({ ...terms, renewal: v })} type="number" />
                <Input label="Protection days" value={terms.protection} onChange={(v) => setTerms({ ...terms, protection: v })} type="number" />
                <Input label="Holding days" value={terms.holding} onChange={(v) => setTerms({ ...terms, holding: v })} type="number" />
                <Input label="Payout days after month-end" value={terms.payout} onChange={(v) => setTerms({ ...terms, payout: v })} type="number" />
              </div>
              <Input label="Approved split (leave empty for a single partner)" value={terms.split} onChange={(v) => setTerms({ ...terms, split: v })} />
              {nonStandard && (
                <label className="block">
                  <span className="block text-xs font-medium mb-1">
                    Justification for non-standard terms (stored on the signed schedule)
                  </span>
                  <textarea
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    rows={2}
                    value={terms.justification}
                    onChange={(e) => setTerms({ ...terms, justification: e.target.value })}
                  />
                </label>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Landmark className="w-4 h-4" /> Payout and tax details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {detail.payoutProfile ? (
            <p className="text-sm">
              {detail.payoutProfile.bankName || "—"} · account ••••{detail.payoutProfile.accountLast4 || "0000"} ·{" "}
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${detail.payoutProfile.verificationStatus === "VERIFIED" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                {detail.payoutProfile.verificationStatus}
              </span>
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">No payout profile recorded.</p>
          )}

          {detail.can.bankApprove && detail.payoutProfile?.verificationStatus !== "VERIFIED" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input label="Bank name" value={profile.bankName} onChange={(v) => setProfile({ ...profile, bankName: v })} />
              <Input label="Account number" value={profile.accountNumber} onChange={(v) => setProfile({ ...profile, accountNumber: v })} />
              <Input label="Account name" value={profile.accountName} onChange={(v) => setProfile({ ...profile, accountName: v })} />
              <Input label="Tax reference" value={profile.taxReference} onChange={(v) => setProfile({ ...profile, taxReference: v })} />
              <Input label="Payout contact name" value={profile.contactName} onChange={(v) => setProfile({ ...profile, contactName: v })} />
              <Input label="Payout contact email" value={profile.contactEmail} onChange={(v) => setProfile({ ...profile, contactEmail: v })} />
              <Input label="Payout contact phone" value={profile.contactPhone} onChange={(v) => setProfile({ ...profile, contactPhone: v })} />
              <div className="flex items-end">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy === "profile" || !profile.bankName.trim() || !profile.accountNumber.trim()}
                  onClick={() => act("profile", { action: "save_payout_profile", ...profile })}
                >
                  {busy === "profile" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null} Save payout details
                </Button>
              </div>
            </div>
          )}

          {detail.can.bankApprove && detail.payoutProfile?.verificationStatus !== "VERIFIED" && (
            <div className="space-y-2">
              <label className="block">
                <span className="block text-xs font-medium mb-1">How were these details verified? (required)</span>
                <textarea
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  rows={2}
                  value={verifyNotes}
                  onChange={(e) => setVerifyNotes(e.target.value)}
                  placeholder="e.g. NUBAN confirmed on a call to the bank, VAT receipt checked"
                />
              </label>
              <Button size="sm" disabled={busy === "verify" || verifyNotes.trim().length < 5} onClick={() => act("verify", { action: "verify_payout_profile", notes: verifyNotes })}>
                {busy === "verify" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BadgeCheck className="w-3.5 h-3.5" />} Mark verified
              </Button>
              <p className="text-xs text-muted-foreground">
                Once verified, these details cannot be edited here — a change needs a bank change request with reverification and a second approver.
              </p>
            </div>
          )}

          {detail.can.activate && (
            <div className="flex flex-wrap gap-2 pt-1">
              <Button size="sm" variant="outline" disabled={busy === "orientation" || Boolean(detail.stamps.orientationCompletedAt)} onClick={() => act("orientation", { action: "record_stamp", kind: "orientation" })}>
                {detail.stamps.orientationCompletedAt ? "Orientation recorded" : "Record orientation"}
              </Button>
              <Button size="sm" variant="outline" disabled={busy === "conduct" || Boolean(detail.stamps.conductAcknowledgedAt)} onClick={() => act("conduct", { action: "record_stamp", kind: "conduct" })}>
                {detail.stamps.conductAcknowledgedAt ? "Conduct acknowledged" : "Record conduct acknowledgement"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      <InstrumentsPreviewModal
        open={Boolean(preview)}
        onClose={() => setPreview(null)}
        previewUrl={preview?.url || null}
        type={preview?.type || "agreement"}
      />
    </div>
  )
}

function Chip({ ok, text }: { ok: boolean; text: string }) {
  return (
    <span className={`text-xs px-2 py-1 rounded-full border ${ok ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-amber-300 bg-amber-50 text-amber-800"}`}>
      {ok ? "✓ " : "○ "}
      {text}
    </span>
  )
}

function Fact({ label: text, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted px-2 py-1.5">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{text}</p>
      <p className="font-medium">{value}</p>
    </div>
  )
}

function scheduleBody(terms: { firstYear: string; renewal: string; protection: string; holding: string; payout: string; split: string; justification: string }) {
  return {
    firstYearRatePercent: Number(terms.firstYear) || 0,
    firstRenewalRatePercent: Number(terms.renewal) || 0,
    protectionDays: Number(terms.protection) || 0,
    holdingDays: Number(terms.holding) || 0,
    payoutDaysAfterMonthEnd: Number(terms.payout) || 0,
    approvedSplit: terms.split,
    justification: terms.justification,
  }
}
