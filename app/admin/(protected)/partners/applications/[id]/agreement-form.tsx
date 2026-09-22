"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, FileText, Download, Plus, Trash2 } from "lucide-react"
import { COUNTRIES, STATES } from "@/lib/locations"

const inputCls = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
const labelCls = "block text-xs font-medium mb-1"

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
  eligibleRevenueDefinition: string
  exclusions: string
  attributionRule: string
  trigger: string
  holdingDays: string
  holdingStartEvent: string
  renewalRule: string
  reversalRule: string
  statementCycle: string
  payoutTiming: string
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
  eligibleRevenueDefinition: "",
  exclusions: "",
  attributionRule: "",
  trigger: "",
  holdingDays: "",
  holdingStartEvent: "",
  renewalRule: "",
  reversalRule: "",
  statementCycle: "",
  payoutTiming: "",
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

function Field({ label, value, onChange, textarea, placeholder, type }: {
  label: string
  value: string
  onChange: (v: string) => void
  textarea?: boolean
  placeholder?: string
  type?: string
}) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      {textarea ? (
        <textarea className={inputCls} rows={2} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      ) : (
        <input className={inputCls} type={type || "text"} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
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
  const [generatable, setGeneratable] = useState(false)
  const [partnerTypeLabel, setPartnerTypeLabel] = useState("")
  const [partnerType, setPartnerType] = useState("")
  const [agreements, setAgreements] = useState<GeneratedDoc[]>([])
  const [open, setOpen] = useState(false)
  const [msg, setMsg] = useState("")

  const [form, setForm] = useState<Record<string, string>>({
    effectiveDate: "", initialTermMonths: "12", renewalRule: "", noticeDays: "30",
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
        gradeByType: "",
        additionalProhibitions: "None beyond the Common Terms and the applicable Partner Type Schedule.",
        martpointOwnerName: "",
        martpointOwnerEmail: "",
        ...(d.appointment || {}),
      })
      setCommercials((data.earningBases || []).map(emptyCommercial))
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
        setMsg(`Agreement ${data.agreementId} generated (${data.includedSchedules.length} sections).`)
        if (data.document?.signedUrl) window.open(data.document.signedUrl, "_blank")
        load()
        onGenerated()
      } else {
        setMsg(data.error || "Generation failed")
      }
    } catch {
      setMsg("Network error. Please try again.")
    } finally {
      setGenerating(false)
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

        {agreements.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Generated agreements</p>
            {agreements.map((d) => (
              <div key={d.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                <span className="truncate">{d.fileName} <span className="text-xs text-muted-foreground">· {new Date(d.uploadedAt).toLocaleDateString("en-NG")} · {d.status.replace(/_/g, " ")}</span></span>
                {d.signedUrl && (
                  <a href={d.signedUrl} target="_blank" rel="noreferrer" className="text-retail inline-flex items-center gap-1 text-xs shrink-0 ml-2">
                    <Download className="w-3.5 h-3.5" /> View
                  </a>
                )}
              </div>
            ))}
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
                <Field label="Initial term (months)" value={form.initialTermMonths} onChange={set("initialTermMonths")} />
                <Field label="Termination notice (days)" value={form.noticeDays} onChange={set("noticeDays")} />
                <Field label="Statement dispute window (days)" value={form.disputeDays} onChange={set("disputeDays")} />
                <Field label="Security incident notice (hours)" value={form.securityNoticeHours} onChange={set("securityNoticeHours")} />
                <div>
                  <Field label="Liability floor amount" value={form.liabilityFloor} onChange={set("liabilityFloor")} placeholder="e.g. NGN 5,000,000" />
                  <p className="text-[11px] text-muted-foreground mt-0.5">Minimum liability cap — each party&apos;s liability is capped at the greater of trailing-12-month fees or this amount. Default comes from Settings → MartPoint Legal Entity.</p>
                </div>
                {["REFERRAL", "CHANNEL", "CHANNEL_IMPLEMENTATION"].includes(partnerType) && (
                  <Field label="Referral protection (days)" value={form.referralProtectionDays} onChange={set("referralProtectionDays")} />
                )}
                <div className="sm:col-span-2">
                  <Field label="Renewal rule" textarea value={form.renewalRule} onChange={set("renewalRule")} placeholder="Blank = renews automatically for successive 12-month periods unless either Party gives 30 days' notice of non-renewal" />
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
                <Field label="Operating level" value={appt.levelByType || ""} onChange={apptField("levelByType")} />
                <Field label="Starting grade" value={appt.gradeByType || ""} onChange={apptField("gradeByType")} placeholder="e.g. Silver" />
                <Field label="Required insurance" value={appt.insurance || ""} onChange={apptField("insurance")} />
                <Field label="MartPoint owner name" value={appt.martpointOwnerName || ""} onChange={apptField("martpointOwnerName")} />
                <Field label="MartPoint owner email" value={appt.martpointOwnerEmail || ""} onChange={apptField("martpointOwnerEmail")} />
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
              {commercials.map((c, i) => (
                <div key={i} className="rounded-md border border-border p-4 space-y-3">
                  <p className="text-sm font-medium">{c.earningCategory} <span className="text-xs text-muted-foreground">· {c.partnerTypeLabel}</span></p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <Field label="Eligible products / services" value={c.eligibleItems} onChange={setComm(i, "eligibleItems")} />
                    <Field label="Rate or fixed fee" value={c.rateOrFee} onChange={setComm(i, "rateOrFee")} placeholder="e.g. 10% of Eligible Revenue" />
                    <Field label="Eligible revenue definition" value={c.eligibleRevenueDefinition} onChange={setComm(i, "eligibleRevenueDefinition")} placeholder="Blank = Eligible Revenue per clause 2" />
                    <Field label="Excluded amounts" value={c.exclusions} onChange={setComm(i, "exclusions")} />
                    <Field label="Attribution requirement" value={c.attributionRule} onChange={setComm(i, "attributionRule")} />
                    <Field label="Statement cycle" value={c.statementCycle} onChange={setComm(i, "statementCycle")} placeholder="e.g. Monthly" />
                    <Field label="Payout timing" value={c.payoutTiming} onChange={setComm(i, "payoutTiming")} placeholder="e.g. Within 15 days of statement" />
                    <Field label="Currency and taxes" value={c.currencyAndTaxRule} onChange={setComm(i, "currencyAndTaxRule")} placeholder="e.g. NGN, exclusive of VAT and WHT" />
                    <Field label="Holding period (days)" value={c.holdingDays} onChange={setComm(i, "holdingDays")} />
                    <Field label="Holding starts from" value={c.holdingStartEvent} onChange={setComm(i, "holdingStartEvent")} placeholder="e.g. licence activation" />
                    <Field label="Renewal eligibility" value={c.renewalRule} onChange={setComm(i, "renewalRule")} />
                    <Field label="Refund / chargeback treatment" value={c.reversalRule} onChange={setComm(i, "reversalRule")} />
                    <Field label="Split / non-stacking rule" value={c.splitRule} onChange={setComm(i, "splitRule")} />
                    <Field label="Finance approver" value={c.financeApprover} onChange={setComm(i, "financeApprover")} />
                    <Field label="Management approver" value={c.managementApprover} onChange={setComm(i, "managementApprover")} />
                  </div>
                  <Field label="Payment and activation trigger" textarea value={c.trigger} onChange={setComm(i, "trigger")} />
                </div>
              ))}
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
                Generate Agreement PDF
              </Button>
              <Button variant="outline" onClick={() => setOpen(false)} disabled={generating}>Cancel</Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Generating moves an approved application to Agreement Pending and stores the PDF in the private documents vault.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
