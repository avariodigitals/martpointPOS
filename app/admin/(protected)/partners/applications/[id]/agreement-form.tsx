"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, FileText, Download, Plus, Trash2 } from "lucide-react"
import { COUNTRIES, STATES } from "@/lib/locations"
import { enumLabel } from "@/lib/utils"

const inputCls = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
const labelCls = "block text-xs font-medium mb-1"

function agreementStatusLabel(status: string) {
  const labels: Record<string, string> = {
    AWAITING_PARTNER: "Awaiting partner signature",
    EXECUTED: "Signed by both parties",
    SUPERSEDED: "Superseded by newer agreement",
    EXPIRED: "Expired",
    UNDER_REVIEW: "Awaiting internal review",
  }
  return labels[status] || enumLabel(status)
}

interface EarningBasis {
  earningCategory: string
  partnerTypeLabel: string
  defaults?: Record<string, string>
}

interface CommercialForm {
  earningCategory: string
  partnerTypeLabel: string
  eligibleItems: string
  rateOrFee: string
  rateUnit: string
  eligibleRevenueDefinition: string
  exclusions: string
  attributionRule: string
  trigger: string
  holdingDays: string
  holdingStartEvent: string
  renewalRule: string
  renewalRate: string
  renewalDuration: string
  reversalRule: string
  statementCycle: string
  payoutTiming: string
  minimumPayoutThreshold: string
  currencyAndTaxRule: string
  splitRule: string
  financeApprover: string
  managementApprover: string
}

const emptyCommercial = (basis: EarningBasis): CommercialForm => ({
  earningCategory: basis.earningCategory,
  partnerTypeLabel: basis.partnerTypeLabel,
  eligibleItems: "",
  rateOrFee: "",
  rateUnit: "",
  eligibleRevenueDefinition: "",
  exclusions: "",
  attributionRule: "",
  trigger: "",
  holdingDays: "",
  holdingStartEvent: "",
  renewalRule: "",
  renewalRate: "",
  renewalDuration: "",
  reversalRule: "",
  statementCycle: "",
  payoutTiming: "",
  minimumPayoutThreshold: "",
  currencyAndTaxRule: "",
  splitRule: "",
  financeApprover: "",
  managementApprover: "",
  ...(basis.defaults || {}),
})

interface GeneratedDoc {
  id: string
  fileName: string
  status: string
  uploadedAt: string
  signedUrl: string | null
}

interface PendingDraft {
  id: string
  agreementId: string
  createdAt: string
  previewUrl: string | null
}

interface AssignedUser {
  id: string
  name: string
  username: string
  email: string | null
  role: string
}

function SelectField({ label, value, onChange, options, placeholder = "Select…", disabled = false }: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  placeholder?: string
  disabled?: boolean
}) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <select className={inputCls} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
        <option value="">{placeholder}</option>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </div>
  )
}

function Field({ label, value, onChange, textarea, placeholder, type, readOnly = false }: {
  label: string
  value: string
  onChange: (v: string) => void
  textarea?: boolean
  placeholder?: string
  type?: string
  readOnly?: boolean
}) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      {textarea ? (
        <textarea className={inputCls} rows={2} value={value} readOnly={readOnly} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      ) : (
        <input className={inputCls} type={type || "text"} value={value} readOnly={readOnly} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      )}
    </div>
  )
}

export function AgreementForm({ applicationId, onGenerated }: {
  applicationId: string
  onGenerated: () => void
}) {
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [resendingAgreementId, setResendingAgreementId] = useState("")
  const [generatable, setGeneratable] = useState(false)
  const [partnerTypeLabel, setPartnerTypeLabel] = useState("")
  const [partnerType, setPartnerType] = useState("")
  const [agreements, setAgreements] = useState<GeneratedDoc[]>([])
  const [pendingDraft, setPendingDraft] = useState<PendingDraft | null>(null)
  const [assignedUsers, setAssignedUsers] = useState<AssignedUser[]>([])
  const [open, setOpen] = useState(false)
  const [msg, setMsg] = useState("")
  const [signingUrl, setSigningUrl] = useState("")
  const [authorizeCompanySignature, setAuthorizeCompanySignature] = useState(false)

  const [form, setForm] = useState<Record<string, string>>({
    effectiveDate: "", initialTermMonths: "3", renewalRule: "", noticeDays: "30",
    disputeDays: "30", securityNoticeHours: "4", referralProtectionDays: "90", liabilityFloor: "",
  })
  const [mp, setMp] = useState<Record<string, string>>({})
  const [pt, setPt] = useState<Record<string, string>>({})
  const [appt, setAppt] = useState<Record<string, string>>({})
  const [tech, setTech] = useState({ solutionName: "", solutionVersion: "", approvedUseCase: "" })
  const [commercials, setCommercials] = useState<CommercialForm[]>([])
  const [extraSchedules, setExtraSchedules] = useState<{ title: string; body: string }[]>([])
  const [availableCoverage, setAvailableCoverage] = useState<string[]>([])
  const [selectedCoverage, setSelectedCoverage] = useState<string[]>([])
  const [territoryCountry, setTerritoryCountry] = useState("")
  const [territoryStates, setTerritoryStates] = useState<string[]>([])
  const [customOperatingLevel, setCustomOperatingLevel] = useState(false)
  const [martpointOwnerUserId, setMartpointOwnerUserId] = useState("")

  /* Territory is stored as a composed string. The picker drives it: states selected
   * under a country are written as "State, Country"; applicant coverage entries are
   * toggled on/off as free-text rows. The composed value still lands in the
   * territory field, which remains editable for one-off wording. */
  function composeTerritory(country: string, states: string[], extras: string[]): string {
    const parts = [...states.map((s) => (country ? `${s}, ${country}` : s)), ...extras]
    if (parts.length === 0 && country) return country
    return parts.join("; ")
  }

  function toggleTerritoryState(state: string) {
    setTerritoryStates((prev) => {
      const next = prev.includes(state) ? prev.filter((s) => s !== state) : [...prev, state]
      setAppt((a) => ({ ...a, territory: composeTerritory(territoryCountry, next, selectedCoverage) }))
      return next
    })
  }

  function toggleCoverageArea(area: string) {
    setSelectedCoverage((prev) => {
      const next = prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]
      setAppt((a) => ({ ...a, territory: composeTerritory(territoryCountry, territoryStates, next) }))
      return next
    })
  }

  const set = (k: string) => (v: string) => setForm((p) => ({ ...p, [k]: v }))
  const mpField = (k: string) => (v: string) => setMp((p) => ({ ...p, [k]: v }))
  const ptField = (k: string) => (v: string) => setPt((p) => ({ ...p, [k]: v }))
  const apptField = (k: string) => (v: string) => setAppt((p) => ({ ...p, [k]: v }))
  const setComm = (i: number, k: keyof CommercialForm) => (v: string) =>
    setCommercials((p) => p.map((c, j) => (j === i ? { ...c, [k]: v } : c)))

  async function load() {
    try {
      const res = await fetch(`/api/admin/partners/applications/${applicationId}/agreement`)
      const data = await res.json()
      if (!res.ok) { setMsg(data.error || "Failed to load agreement defaults"); return }
      setGeneratable(data.generatable)
      setPartnerType(data.partnerType)
      setPartnerTypeLabel(data.partnerTypeLabel)
      setAgreements(data.agreements || [])
      setPendingDraft(data.pendingDraft || null)
      setAssignedUsers(data.assignedUsers || [])
      const d = data.defaults || {}
      setForm((p) => ({
        ...p,
        effectiveDate: d.effectiveDate || p.effectiveDate,
        liabilityFloor: d.liabilityFloor || p.liabilityFloor,
      }))
      setAvailableCoverage(d.coverage || [])
      setSelectedCoverage(d.coverage || [])
      setTerritoryCountry(d.country || "")
      setMp(d.martpoint || {})
      setPt(d.partner || {})
      setAppt({
        levelByType: "Standard",
        additionalProhibitions: "None beyond the Common Terms and the applicable Partner Type Schedule.",
        martpointOwnerName: "",
        martpointOwnerEmail: "",
        ...(d.appointment || {}),
        gradeByType: d.appointment?.gradeByType || "Ungraded — subject to verified business delivery and performance assessment",
        publicDirectoryStatus: d.appointment?.publicDirectoryStatus || "Not yet eligible — subject to successful business delivery and MartPoint approval",
      })
      setCustomOperatingLevel(Boolean(d.appointment?.levelByType && d.appointment.levelByType !== "Standard"))
      setMartpointOwnerUserId((data.assignedUsers || []).find((u: AssignedUser) => u.email && u.email === d.appointment?.martpointOwnerEmail)?.id || "")
      const earningBases = (data.earningBases || []) as EarningBasis[]
      setCommercials(earningBases.map(emptyCommercial))
      if (data.pendingDraft?.payload) {
        const saved = data.pendingDraft.payload
        setForm((current) => ({ ...current, ...saved }))
        setMp(saved.martpoint || d.martpoint || {})
        setPt(saved.partner || d.partner || {})
        setAppt({ ...(saved.appointment || d.appointment || {}), gradeByType: "Ungraded — subject to verified business delivery and performance assessment", publicDirectoryStatus: "Not yet eligible — subject to successful business delivery and MartPoint approval" })
        setTech(saved.technology || { solutionName: "", solutionVersion: "", approvedUseCase: "" })
        setCommercials((saved.commercials || []).map((section: CommercialForm) => {
          if (section.partnerTypeLabel !== "Channel Partner" || !section.earningCategory.toLowerCase().includes("commission")) return section
          const policy = earningBases.find((basis) => basis.partnerTypeLabel === section.partnerTypeLabel)?.defaults || {}
          return {
            ...section,
            rateUnit: policy.rateUnit || section.rateUnit,
            rateOrFee: policy.rateOrFee || section.rateOrFee,
            eligibleItems: policy.eligibleItems || section.eligibleItems,
            renewalRule: policy.renewalRule || section.renewalRule,
            renewalRate: policy.renewalRate || section.renewalRate,
            renewalDuration: policy.renewalDuration || section.renewalDuration,
          }
        }))
        setExtraSchedules(saved.additionalSchedules || [])
        setCustomOperatingLevel(Boolean(saved.appointment?.levelByType && saved.appointment.levelByType !== "Standard"))
      }
    } catch {
      setMsg("Failed to load agreement defaults")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function generate() {
    if (customOperatingLevel && !appt.levelByType?.trim()) {
      setMsg("Enter the custom operating level before generating the agreement.")
      return
    }
    setGenerating(true)
    setMsg("")
    try {
      const res = await fetch(`/api/admin/partners/applications/${applicationId}/agreement`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          martpoint: mp,
          partner: pt,
          appointment: appt,
          technology: partnerType === "TECHNOLOGY" ? tech : undefined,
          commercials,
          additionalSchedules: extraSchedules.filter((s) => s.title.trim() && s.body.trim()),
        }),
      })
      const data = await res.json()
      if (data.success) {
        setPendingDraft({ id: data.draft.id, agreementId: data.agreementId, createdAt: new Date().toISOString(), previewUrl: data.draft.previewUrl || null })
        setAuthorizeCompanySignature(false)
        setMsg(`Draft ${data.agreementId} is ready. Review the PDF before approving it for signature and sending.`)
        setOpen(false)
        if (data.draft.previewUrl) window.open(data.draft.previewUrl, "_blank")
        void load()
      } else {
        setMsg(data.error || "Generation failed")
      }
    } catch {
      setMsg("Network error. Please try again.")
    } finally {
      setGenerating(false)
    }
  }

  async function issueDraft() {
    if (!pendingDraft || !authorizeCompanySignature) return
    setGenerating(true)
    setMsg("")
    setSigningUrl("")
    try {
      const res = await fetch(`/api/admin/partners/applications/${applicationId}/agreement/issue`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draftId: pendingDraft.id, authorizeCompanySignature }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setMsg(data.error || "Agreement could not be issued")
        return
      }
      setPendingDraft(null)
      setAuthorizeCompanySignature(false)
      setSigningUrl(data.signingUrl || "")
      setMsg(data.emailSent
        ? `Agreement ${data.agreementId} was signed by MartPoint and emailed with the reviewed PDF attached and a secure signing link.`
        : `Agreement ${data.agreementId} was issued, but the partner email and PDF attachment could not be sent. Use the secure signing link below.`)
      if (data.document?.previewUrl) window.open(data.document.previewUrl, "_blank")
      await load()
      onGenerated()
    } catch {
      setMsg("Network error. Please try again.")
    } finally {
      setGenerating(false)
    }
  }

  async function resendIssuedAgreement(documentId: string) {
    setResendingAgreementId(documentId)
    setMsg("")
    setSigningUrl("")
    try {
      const res = await fetch(`/api/admin/partners/applications/${applicationId}/agreement/resend`, { method: "POST" })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setMsg(data.error || "Agreement email could not be resent")
        return
      }
      setSigningUrl(data.emailSent ? "" : data.signingUrl || "")
      setMsg(data.emailSent
        ? `Agreement ${data.agreementId || ""} was resent with the PDF attached and a refreshed signing link. The previous link has been replaced.`
        : "The agreement email could not be sent. The refreshed link is available below to copy and share securely.")
      await load()
    } catch {
      setMsg("Network error. Please try again.")
    } finally {
      setResendingAgreementId("")
    }
  }

  if (loading) {
    return <Card><CardContent className="py-6 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></CardContent></Card>
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <FileText className="w-4 h-4" /> Partner Agreement
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {msg && <p className={`text-sm ${msg.toLowerCase().includes("fail") || msg.toLowerCase().includes("error") ? "text-red-500" : "text-green-600"}`}>{msg}</p>}
        {signingUrl && <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm">
          <p className="font-medium text-amber-900">Email delivery failed</p>
          <a className="mt-1 block break-all text-retail underline" href={signingUrl} target="_blank" rel="noreferrer">Open secure signing link</a>
          <button type="button" className="mt-2 text-xs underline" onClick={() => void navigator.clipboard.writeText(signingUrl)}>Copy signing link</button>
        </div>}

        {agreements.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Generated agreements</p>
            {agreements.map((d) => (
              <div key={d.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                <span className="truncate">{d.fileName} <span className="text-xs text-muted-foreground">· {new Date(d.uploadedAt).toLocaleDateString("en-NG")} · {agreementStatusLabel(d.status)}</span></span>
                {d.signedUrl && (
                  <a href={d.signedUrl} target="_blank" rel="noreferrer" className="text-retail inline-flex items-center gap-1 text-xs shrink-0 ml-2">
                    <Download className="w-3.5 h-3.5" /> View
                  </a>
                )}
                {d.status === "AWAITING_PARTNER" && (
                  <Button type="button" variant="outline" size="sm" className="ml-2 shrink-0" disabled={Boolean(resendingAgreementId)} onClick={() => void resendIssuedAgreement(d.id)}>
                    {resendingAgreementId === d.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Resend PDF + link"}
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        {pendingDraft && !open && (
          <div className="space-y-3 rounded-md border border-amber-300 bg-amber-50 p-4">
            <div>
              <p className="font-medium text-amber-950">Draft awaiting your review · {pendingDraft.agreementId}</p>
              <p className="mt-1 text-xs text-amber-900">The partner has not been emailed. Open and review the PDF before approving it for signature.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {pendingDraft.previewUrl && <a className="inline-flex items-center gap-1 rounded-md border border-amber-400 bg-white px-3 py-2 text-sm text-amber-950" href={pendingDraft.previewUrl} target="_blank" rel="noreferrer"><Download className="h-4 w-4" />Review draft PDF</a>}
              <Button variant="outline" onClick={() => { setOpen(true); setMsg("") }}>Edit and generate a new draft</Button>
            </div>
            <label className="flex items-start gap-2 rounded-md border border-amber-300 bg-white p-3 text-sm">
              <input type="checkbox" checked={authorizeCompanySignature} onChange={(e) => setAuthorizeCompanySignature(e.target.checked)} />
              <span>I reviewed this agreement, confirm it is approved for issue, and authorize the configured MartPoint signatory to sign it electronically.</span>
            </label>
            <Button onClick={issueDraft} disabled={generating || !authorizeCompanySignature}>
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              Approve, sign and send to partner
            </Button>
          </div>
        )}

        {!generatable ? (
          <p className="text-sm text-muted-foreground">
            A partner agreement can be generated once the application is approved. The generated copy contains only the
            schedules for the approved partner type ({partnerTypeLabel || "—"}) — internal template content is never included.
          </p>
        ) : !open ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Generate the signing copy for <strong>{partnerTypeLabel}</strong>. It includes the Common Terms, Appointment
              Summary, the matching Partner Type Schedule(s), Commercial Terms and the Signature Page — unused schedules
              and all internal template sections are excluded.
            </p>
            <Button variant="outline" onClick={() => setOpen(true)}>
              <FileText className="w-4 h-4" /> New Agreement
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Agreement basics */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Agreement</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Effective date" type="date" value={form.effectiveDate} onChange={set("effectiveDate")} />
                <SelectField label="Initial term (months)" value={form.initialTermMonths} onChange={set("initialTermMonths")} options={[
                  { value: "3", label: "3 months (90 days)" }, { value: "6", label: "6 months" }, { value: "12", label: "12 months" },
                ]} />
                <SelectField label="Termination notice (days)" value={form.noticeDays} onChange={set("noticeDays")} options={[
                  { value: "7", label: "7 days" }, { value: "14", label: "14 days" }, { value: "30", label: "30 days" }, { value: "60", label: "60 days" }, { value: "90", label: "90 days" },
                ]} />
                <SelectField label="Statement dispute window (days)" value={form.disputeDays} onChange={set("disputeDays")} options={[
                  { value: "7", label: "7 days" }, { value: "14", label: "14 days" }, { value: "30", label: "30 days" }, { value: "60", label: "60 days" },
                ]} />
                <SelectField label="Security incident notice (hours)" value={form.securityNoticeHours} onChange={set("securityNoticeHours")} options={[
                  { value: "1", label: "1 hour" }, { value: "4", label: "4 hours" }, { value: "12", label: "12 hours" }, { value: "24", label: "24 hours" },
                ]} />
                <div>
                  <Field label="Liability floor amount" value={form.liabilityFloor} onChange={set("liabilityFloor")} placeholder="e.g. NGN 5,000,000" />
                  <p className="text-[11px] text-muted-foreground mt-0.5">Minimum liability cap — each party&apos;s liability is capped at the greater of trailing-12-month fees or this amount. Default comes from Settings → MartPoint Legal Entity.</p>
                </div>
                {["REFERRAL", "CHANNEL", "CHANNEL_IMPLEMENTATION"].includes(partnerType) && (
                  <SelectField label="Referral protection (days)" value={form.referralProtectionDays} onChange={set("referralProtectionDays")} options={[
                    { value: "30", label: "30 days" }, { value: "60", label: "60 days" }, { value: "90", label: "90 days" }, { value: "180", label: "180 days" },
                  ]} />
                )}
                <div className="sm:col-span-2">
                  <Field label="Renewal rule" textarea value={form.renewalRule} onChange={set("renewalRule")} placeholder="State the approved renewal rule. Do not leave blank or assume automatic 12-month renewal." />
                </div>
              </div>
            </div>

            {/* MartPoint entity */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">MartPoint entity</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Registered legal name" value={mp.legalName || ""} onChange={mpField("legalName")} />
                <Field label="Registration number" value={mp.registrationNo || ""} onChange={mpField("registrationNo")} />
                <div className="sm:col-span-2"><Field label="Registered address" value={mp.registeredAddress || ""} onChange={mpField("registeredAddress")} /></div>
                <Field label="Notice email" value={mp.noticeEmail || ""} onChange={mpField("noticeEmail")} />
                <Field label="Signatory name" value={mp.signatoryName || ""} onChange={mpField("signatoryName")} />
                <Field label="Signatory title" value={mp.signatoryTitle || ""} onChange={mpField("signatoryTitle")} />
                <Field label="Signatory email" value={mp.signatoryEmail || ""} onChange={mpField("signatoryEmail")} />
              </div>
            </div>

            {/* Partner entity */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Partner entity</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label="Legal name" value={pt.legalName || ""} onChange={ptField("legalName")} />
                <Field label="Registration number" value={pt.registrationNo || ""} onChange={ptField("registrationNo")} />
                <div className="sm:col-span-2"><Field label="Registered address" value={pt.registeredAddress || ""} onChange={ptField("registeredAddress")} /></div>
                <Field label="Notice email" value={pt.noticeEmail || ""} onChange={ptField("noticeEmail")} />
                <Field label="Operational contact name" value={pt.operationsContactName || ""} onChange={ptField("operationsContactName")} />
                <Field label="Operational contact email" value={pt.operationsContactEmail || ""} onChange={ptField("operationsContactEmail")} />
                <Field label="Signatory name" value={pt.signatoryName || ""} onChange={ptField("signatoryName")} />
                <Field label="Signatory title" value={pt.signatoryTitle || ""} onChange={ptField("signatoryTitle")} placeholder="e.g. Managing Director" />
                <Field label="Signatory email" value={pt.signatoryEmail || ""} onChange={ptField("signatoryEmail")} />
              </div>
            </div>

            {/* Appointment */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Appointment</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2 rounded-md border border-border p-3 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Territory country</label>
                      <select
                        className={inputCls}
                        value={territoryCountry}
                        onChange={(e) => {
                          setTerritoryCountry(e.target.value)
                          setTerritoryStates([])
                          setAppt((a) => ({ ...a, territory: composeTerritory(e.target.value, [], selectedCoverage) }))
                        }}
                      >
                        <option value="">Select country…</option>
                        {COUNTRIES.map((c) => <option key={c.code} value={c.name}>{c.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>States / regions {territoryCountry ? `in ${territoryCountry}` : ""} (multi-select)</label>
                      <div className="max-h-32 overflow-y-auto rounded-md border border-input bg-background p-2 space-y-1">
                        {!territoryCountry ? (
                          <p className="text-xs text-muted-foreground px-1">Select a country first.</p>
                        ) : (STATES[territoryCountry] || []).map((s) => (
                          <label key={s} className="flex items-center gap-2 text-sm px-1 py-0.5 rounded hover:bg-muted cursor-pointer">
                            <input type="checkbox" checked={territoryStates.includes(s)} onChange={() => toggleTerritoryState(s)} />
                            {s}
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                  {availableCoverage.length > 0 && (
                    <div>
                      <p className={labelCls}>Applicant&apos;s stated coverage — click to include/exclude:</p>
                      <div className="flex flex-wrap gap-1.5">
                        {availableCoverage.map((area) => {
                          const on = selectedCoverage.includes(area)
                          return (
                            <button
                              key={area}
                              type="button"
                              onClick={() => toggleCoverageArea(area)}
                              className={`text-xs px-2 py-1 rounded-full border ${on ? "bg-retail text-white border-retail" : "bg-muted text-muted-foreground border-border line-through"}`}
                            >
                              {area}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                  <Field label="Territory / service area (as written into the agreement)" textarea value={appt.territory || ""} onChange={apptField("territory")} />
                </div>
                <SelectField label="Operating level" value={customOperatingLevel ? "CUSTOM" : appt.levelByType || ""} onChange={(v) => {
                  setCustomOperatingLevel(v === "CUSTOM")
                  apptField("levelByType")(v === "CUSTOM" ? "" : v)
                }} options={[
                  { value: "Standard", label: "Standard" }, { value: "CUSTOM", label: "Other (specify)" },
                ]} />
                {customOperatingLevel && (
                  <Field label="Custom operating level" value={appt.levelByType || ""} onChange={apptField("levelByType")} placeholder="Enter operating level" />
                )}
                <div className="sm:col-span-2 rounded-md border border-border bg-muted/30 p-3 text-sm">
                  <p className={labelCls}>Starting grade and directory status</p>
                  <p className="text-muted-foreground">Ungraded. A grade and directory listing require verified qualifying delivery, published criteria, and separate MartPoint management approval. Standard is an operating level, not a grade. The 90-day activation/activity framework is monitored separately.</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <div><p className={labelCls}>Starting grade</p><p>Ungraded — subject to verified business delivery and performance assessment</p></div>
                    <div><p className={labelCls}>Public Directory status</p><p>Not yet eligible — subject to successful business delivery and MartPoint approval</p></div>
                  </div>
                </div>
                <Field label="Insurance requirement" value={appt.insurance || ""} onChange={apptField("insurance")} />
                <p className="sm:col-span-2 -mt-2 text-xs text-muted-foreground">No policy is required for standard partner appointment. Any project-specific requirement must be stated and accepted in the applicable Work Order.</p>
                <SelectField label="MartPoint owner" value={martpointOwnerUserId} onChange={(id) => {
                  const user = assignedUsers.find((u) => u.id === id)
                  setMartpointOwnerUserId(id)
                  setAppt((p) => ({ ...p, martpointOwnerName: user?.name || "", martpointOwnerEmail: user?.email || "" }))
                }} options={assignedUsers.filter((u) => ["Admin", "Sales"].includes(u.role) && Boolean(u.email)).map((u) => ({ value: u.id, label: `${u.name || u.username} · ${u.role}` }))} placeholder="Select an Admin or Sales user with email" />
                <div className="sm:col-span-2"><Field label="Permitted activities" textarea value={appt.permittedActivities || ""} onChange={apptField("permittedActivities")} /></div>
                <div className="sm:col-span-2"><Field label="Express prohibitions" textarea value={appt.additionalProhibitions || ""} onChange={apptField("additionalProhibitions")} /></div>
              </div>
            </div>

            {/* Technology schedule fields */}
            {partnerType === "TECHNOLOGY" && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Approved solution (Technology Schedule)</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Field label="Solution name *" value={tech.solutionName} onChange={(v) => setTech((p) => ({ ...p, solutionName: v }))} />
                  <Field label="Version / model" value={tech.solutionVersion} onChange={(v) => setTech((p) => ({ ...p, solutionVersion: v }))} />
                  <Field label="Approved use case" value={tech.approvedUseCase} onChange={(v) => setTech((p) => ({ ...p, approvedUseCase: v }))} />
                </div>
              </div>
            )}

            {/* Commercial Terms — one section per earning basis */}
            <div className="space-y-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Commercial Terms (one section per earning basis)</p>
              {commercials.map((c, i) => {
                const fixedChannelTerms = c.partnerTypeLabel === "Channel Partner" && c.earningCategory.toLowerCase().includes("commission")
                return (
                <div key={i} className="rounded-md border border-border p-4 space-y-3">
                  <p className="text-sm font-medium">{c.earningCategory} <span className="text-xs text-muted-foreground">· {c.partnerTypeLabel}</span></p>
                  {fixedChannelTerms && <p className="text-xs text-muted-foreground">Approved Channel commission policy: 10% on the initial qualifying subscription, then 5% on no more than two subsequent annual renewals, subject to the listed eligibility conditions.</p>}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="Eligible products / services" value={c.eligibleItems} onChange={setComm(i, "eligibleItems")} readOnly={fixedChannelTerms} />
                    <SelectField label="Rate unit" value={c.rateUnit} onChange={setComm(i, "rateUnit")} disabled={fixedChannelTerms} options={[
                      { value: "PERCENTAGE", label: "Percentage of Eligible Revenue" },
                      { value: "FIXED", label: "Fixed amount" },
                      { value: "WORK_ORDER", label: "Agreed per Work Order" },
                      { value: "OTHER", label: "Other (describe below)" },
                    ]} />
                    <Field label={fixedChannelTerms ? "Initial acquisition rate" : "Rate or fixed fee"} value={c.rateOrFee} onChange={setComm(i, "rateOrFee")} readOnly={fixedChannelTerms} placeholder={c.rateUnit === "PERCENTAGE" ? "e.g. 10" : c.rateUnit === "WORK_ORDER" ? "Agreed per approved Work Order" : "Enter approved amount and basis"} />
                    <Field label="Eligible revenue definition" value={c.eligibleRevenueDefinition} onChange={setComm(i, "eligibleRevenueDefinition")} placeholder="Blank = Eligible Revenue per clause 2" />
                    <Field label="Excluded amounts" value={c.exclusions} onChange={setComm(i, "exclusions")} />
                    <Field label="Attribution requirement" value={c.attributionRule} onChange={setComm(i, "attributionRule")} />
                    <SelectField label="Statement cycle" value={c.statementCycle} onChange={setComm(i, "statementCycle")} options={[
                      { value: "Monthly", label: "Monthly" }, { value: "Quarterly", label: "Quarterly" },
                    ]} />
                    <Field label="Payout timing (approved term)" value={c.payoutTiming} onChange={setComm(i, "payoutTiming")} placeholder="Enter the approved payment deadline and conditions" />
                    <Field label="Minimum payout threshold (approved term)" value={c.minimumPayoutThreshold} onChange={setComm(i, "minimumPayoutThreshold")} placeholder="Enter amount or 'No minimum payout threshold'" />
                    <Field label="Currency and taxes (approved term)" value={c.currencyAndTaxRule} onChange={setComm(i, "currencyAndTaxRule")} placeholder="State currency and the approved VAT, withholding and other tax treatment" />
                    <SelectField label="Holding period (days)" value={c.holdingDays} onChange={setComm(i, "holdingDays")} options={[
                      { value: "0", label: "No holding period" }, { value: "7", label: "7 days" }, { value: "14", label: "14 days" },
                      { value: "30", label: "30 days" }, { value: "60", label: "60 days" }, { value: "90", label: "90 days" }, { value: "180", label: "180 days" },
                    ]} />
                    <Field label="Holding starts from" value={c.holdingStartEvent} onChange={setComm(i, "holdingStartEvent")} placeholder="e.g. licence activation" />
                    <Field label="Renewal eligibility" value={c.renewalRule} onChange={setComm(i, "renewalRule")} readOnly={fixedChannelTerms} />
                    <Field label={fixedChannelTerms ? "Annual renewal rate" : "Renewal rate (if approved)"} value={c.renewalRate} onChange={setComm(i, "renewalRate")} readOnly={fixedChannelTerms} placeholder="Not approved / none, or approved percentage" />
                    <Field label={fixedChannelTerms ? "Maximum renewal period" : "Renewal duration (if approved)"} value={c.renewalDuration} onChange={setComm(i, "renewalDuration")} readOnly={fixedChannelTerms} placeholder="None, or approved duration" />
                    <Field label="Refund / chargeback treatment" value={c.reversalRule} onChange={setComm(i, "reversalRule")} />
                    <Field label="Split / non-stacking rule" value={c.splitRule} onChange={setComm(i, "splitRule")} />
                    <SelectField label="Finance approver" value={assignedUsers.find((u) => u.name === c.financeApprover && ["Admin", "Finance"].includes(u.role))?.id || ""} onChange={(id) => setComm(i, "financeApprover")(assignedUsers.find((u) => u.id === id)?.name || "")} options={assignedUsers.filter((u) => ["Admin", "Finance"].includes(u.role)).map((u) => ({ value: u.id, label: `${u.name || u.username} · ${u.role}` }))} placeholder="Select Finance or Admin user" />
                    <SelectField label="Management approver" value={assignedUsers.find((u) => u.name === c.managementApprover && u.role === "Admin")?.id || ""} onChange={(id) => setComm(i, "managementApprover")(assignedUsers.find((u) => u.id === id)?.name || "")} options={assignedUsers.filter((u) => u.role === "Admin").map((u) => ({ value: u.id, label: `${u.name || u.username} · ${u.role}` }))} placeholder="Select an Admin user" />
                  </div>
                  <Field label="Payment and activation trigger" textarea value={c.trigger} onChange={setComm(i, "trigger")} />
                </div>
              )})}
            </div>

            {/* Additional conditional schedules */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                Conditional schedules (only if triggered — never generate empty)
              </p>
              {extraSchedules.map((s, i) => (
                <div key={i} className="rounded-md border border-border p-3 mb-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <input className={inputCls} placeholder="Schedule title (e.g. Data Processing Addendum)" value={s.title}
                      onChange={(e) => setExtraSchedules((p) => p.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))} />
                    <button type="button" className="text-red-500 shrink-0" onClick={() => setExtraSchedules((p) => p.filter((_, j) => j !== i))}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <textarea className={inputCls} rows={4} placeholder="Completed schedule text — approved wording only" value={s.body}
                    onChange={(e) => setExtraSchedules((p) => p.map((x, j) => (j === i ? { ...x, body: e.target.value } : x)))} />
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => setExtraSchedules((p) => [...p, { title: "", body: "" }])}>
                <Plus className="w-3.5 h-3.5" /> Add conditional schedule
              </Button>
            </div>

            <div className="flex gap-2">
              <Button onClick={generate} disabled={generating}>
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                Generate draft for review
              </Button>
              <Button variant="outline" onClick={() => setOpen(false)} disabled={generating}>Cancel</Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Draft generation does not sign or email the agreement. Review the PDF first; partner delivery happens only after approval in the review panel.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
