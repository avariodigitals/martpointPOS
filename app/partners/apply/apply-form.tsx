"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Loader2, Check, ArrowRight, ArrowLeft, Upload, X, CheckCircle2 } from "lucide-react"

type PartnerType = "REFERRAL" | "CHANNEL" | "IMPLEMENTATION" | "CHANNEL_IMPLEMENTATION" | "TECHNOLOGY" | "PAYMENT"

const PARTNER_OPTIONS: { value: PartnerType; label: string; desc: string }[] = [
  { value: "REFERRAL", label: "Referral Partner", desc: "Introduce businesses to MartPoint." },
  { value: "CHANNEL", label: "Channel Partner", desc: "Sales & first-line usage guidance." },
  { value: "IMPLEMENTATION", label: "Implementation Partner", desc: "Configure, onboard and train customers." },
  { value: "CHANNEL_IMPLEMENTATION", label: "Channel + Implementation", desc: "Both sales and implementation." },
  { value: "TECHNOLOGY", label: "Technology Partner", desc: "Integrate compatible hardware/software." },
  { value: "PAYMENT", label: "Payment Partner", desc: "Enable approved payment services." },
]

const STEPS = ["Applicant", "Partnership", "Capability", "Information", "Documents", "Review"]

const inputCls = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
const labelCls = "block text-sm font-medium mb-1"

interface DocFile {
  file: File
  type: string
}

export function PartnerApplicationForm() {
  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState<{ reference: string } | null>(null)

  const [form, setForm] = useState({
    applicantType: "COMPANY" as "INDIVIDUAL" | "COMPANY",
    requestedPartnerType: "REFERRAL" as PartnerType,
    fullName: "",
    businessName: "",
    email: "",
    phone: "",
    whatsapp: "",
    country: "",
    state: "",
    city: "",
    businessAddress: "",
    website: "",
    linkedin: "",
    socialProfile: "",
    registrationNumber: "",
    yearEstablished: "",
    teamSize: "",
    estimatedCustomerBase: "",
    industriesServed: [] as string[],
    geographicCoverage: [] as string[],
    currentProductsServices: "",
    reasonForApplying: "",
    relevantExperience: "",
    expectedMonthlyOpportunities: "",
    additionalAnswers: {} as Record<string, string>,
    declaration: false,
  })

  const [docs, setDocs] = useState<DocFile[]>([])
  const [industryInput, setIndustryInput] = useState("")
  const [geoInput, setGeoInput] = useState("")

  const set = (k: keyof typeof form, v: unknown) => setForm((p) => ({ ...p, [k]: v }))

  const addIndustry = () => {
    const v = industryInput.trim()
    if (v && !form.industriesServed.includes(v)) set("industriesServed", [...form.industriesServed, v])
    setIndustryInput("")
  }
  const addGeo = () => {
    const v = geoInput.trim()
    if (v && !form.geographicCoverage.includes(v)) set("geographicCoverage", [...form.geographicCoverage, v])
    setGeoInput("")
  }

  const onFiles = (files: FileList | null) => {
    if (!files) return
    const next = [...docs]
    for (const f of Array.from(files)) {
      if (next.length >= 6) break
      next.push({ file: f, type: "other" })
    }
    setDocs(next)
  }

  const validateStep = (): string | null => {
    if (step === 0) {
      if (!form.fullName.trim()) return "Full name is required"
      if (!form.email.trim()) return "Email is required"
      if (!form.phone.trim()) return "Phone is required"
      if (!form.country.trim()) return "Country is required"
    }
    if (step === 3 && form.reasonForApplying.trim().length < 10) return "Please tell us why you want to partner with MartPoint (min 10 characters)"
    if (step === 5 && !form.declaration) return "You must confirm the declaration to submit"
    return null
  }

  const next = () => {
    const err = validateStep()
    if (err) { setError(err); return }
    setError("")
    setStep((s) => Math.min(s + 1, STEPS.length - 1))
  }
  const back = () => { setError(""); setStep((s) => Math.max(s - 1, 0)) }

  const submit = async () => {
    const err = validateStep()
    if (err) { setError(err); return }
    setSubmitting(true)
    setError("")
    try {
      const fd = new FormData()
      fd.append("data", JSON.stringify(form))
      const docTypes: Record<string, string> = {}
      for (const d of docs) docTypes[d.file.name] = d.type
      fd.append("documentTypes", JSON.stringify(docTypes))
      for (const d of docs) fd.append("documents", d.file)

      const res = await fetch("/api/partners/apply", { method: "POST", body: fd })
      const data = await res.json()
      if (data.success && data.reference) {
        setSuccess({ reference: data.reference })
      } else {
        setError(data.error || "Submission failed. Please try again.")
      }
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="rounded-xl border border-border bg-background p-8 text-center">
        <CheckCircle2 className="w-12 h-12 mx-auto text-green-600 mb-4" />
        <h2 className="text-xl font-bold">Application Received</h2>
        <p className="text-muted-foreground mt-2">Thank you for applying to become a MartPoint partner.</p>
        <div className="my-6 inline-block rounded-lg bg-muted px-6 py-3">
          <p className="text-xs uppercase text-muted-foreground">Your Application Reference</p>
          <p className="text-lg font-bold tracking-wider">{success.reference}</p>
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          Save this reference. You can check your application status anytime.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild><Link href="/partners/application-status">Check Application Status</Link></Button>
          <Button asChild variant="outline"><Link href="/partners">Back to Partners</Link></Button>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-background p-6 md:p-8">
      {/* Progress */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {STEPS.map((label, i) => (
            <div key={label} className="flex-1 flex items-center">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${i < step ? "bg-green-600 text-white" : i === step ? "bg-retail text-white" : "bg-muted text-muted-foreground"}`}>
                {i < step ? <Check className="w-4 h-4" /> : i + 1}
              </div>
              {i < STEPS.length - 1 && <div className={`flex-1 h-0.5 mx-1 ${i < step ? "bg-green-600" : "bg-border"}`} />}
            </div>
          ))}
        </div>
        <div className="flex justify-between mt-2">
          {STEPS.map((label, i) => (
            <span key={label} className={`text-[10px] ${i === step ? "text-foreground font-medium" : "text-muted-foreground"}`}>{label}</span>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-500 mb-4">{error}</p>}

      {/* Step 0: Applicant */}
      {step === 0 && (
        <div className="space-y-4">
          <div>
            <label className={labelCls}>Applicant type</label>
            <div className="flex gap-3">
              {(["INDIVIDUAL", "COMPANY"] as const).map((t) => (
                <button key={t} type="button" onClick={() => set("applicantType", t)}
                  className={`flex-1 rounded-md border px-4 py-2 text-sm font-medium ${form.applicantType === t ? "border-retail bg-retail/10 text-retail" : "border-input bg-background"}`}>
                  {t === "INDIVIDUAL" ? "Individual" : "Company"}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className={labelCls}>Full name *</label><input className={inputCls} value={form.fullName} onChange={(e) => set("fullName", e.target.value)} /></div>
            <div><label className={labelCls}>Business name</label><input className={inputCls} value={form.businessName} onChange={(e) => set("businessName", e.target.value)} /></div>
            <div><label className={labelCls}>Email *</label><input type="email" className={inputCls} value={form.email} onChange={(e) => set("email", e.target.value)} /></div>
            <div><label className={labelCls}>Phone *</label><input className={inputCls} value={form.phone} onChange={(e) => set("phone", e.target.value)} /></div>
            <div><label className={labelCls}>WhatsApp</label><input className={inputCls} value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} /></div>
            <div><label className={labelCls}>Country *</label><input className={inputCls} value={form.country} onChange={(e) => set("country", e.target.value)} /></div>
            <div><label className={labelCls}>State</label><input className={inputCls} value={form.state} onChange={(e) => set("state", e.target.value)} /></div>
            <div><label className={labelCls}>City</label><input className={inputCls} value={form.city} onChange={(e) => set("city", e.target.value)} /></div>
          </div>
          <div><label className={labelCls}>Business address</label><input className={inputCls} value={form.businessAddress} onChange={(e) => set("businessAddress", e.target.value)} /></div>
        </div>
      )}

      {/* Step 1: Partnership */}
      {step === 1 && (
        <div className="space-y-3">
          <label className={labelCls}>Choose your partnership type</label>
          {PARTNER_OPTIONS.map((opt) => (
            <button key={opt.value} type="button" onClick={() => set("requestedPartnerType", opt.value)}
              className={`w-full text-left rounded-lg border p-4 transition-colors ${form.requestedPartnerType === opt.value ? "border-retail bg-retail/10" : "border-input hover:bg-muted/40"}`}>
              <p className="text-sm font-semibold">{opt.label}</p>
              <p className="text-xs text-muted-foreground">{opt.desc}</p>
            </button>
          ))}
        </div>
      )}

      {/* Step 2: Capability */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className={labelCls}>Registration number</label><input className={inputCls} value={form.registrationNumber} onChange={(e) => set("registrationNumber", e.target.value)} /></div>
            <div><label className={labelCls}>Year established</label><input className={inputCls} value={form.yearEstablished} onChange={(e) => set("yearEstablished", e.target.value)} /></div>
            <div><label className={labelCls}>Team size</label><input className={inputCls} value={form.teamSize} onChange={(e) => set("teamSize", e.target.value)} /></div>
            <div><label className={labelCls}>Approx. customer base</label><input className={inputCls} value={form.estimatedCustomerBase} onChange={(e) => set("estimatedCustomerBase", e.target.value)} /></div>
          </div>
          <div>
            <label className={labelCls}>Industries served</label>
            <div className="flex gap-2">
              <input className={inputCls} value={industryInput} onChange={(e) => setIndustryInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addIndustry())} placeholder="e.g. Retail, Pharmacy" />
              <Button type="button" size="sm" variant="outline" onClick={addIndustry}>Add</Button>
            </div>
            {form.industriesServed.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {form.industriesServed.map((i) => (
                  <span key={i} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs">{i}
                    <button type="button" onClick={() => set("industriesServed", form.industriesServed.filter((x) => x !== i))}><X className="w-3 h-3" /></button>
                  </span>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className={labelCls}>Geographic coverage</label>
            <div className="flex gap-2">
              <input className={inputCls} value={geoInput} onChange={(e) => setGeoInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addGeo())} placeholder="e.g. Lagos, Abuja" />
              <Button type="button" size="sm" variant="outline" onClick={addGeo}>Add</Button>
            </div>
            {form.geographicCoverage.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {form.geographicCoverage.map((i) => (
                  <span key={i} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs">{i}
                    <button type="button" onClick={() => set("geographicCoverage", form.geographicCoverage.filter((x) => x !== i))}><X className="w-3 h-3" /></button>
                  </span>
                ))}
              </div>
            )}
          </div>
          <div><label className={labelCls}>Current products / services</label><textarea className={inputCls} rows={3} value={form.currentProductsServices} onChange={(e) => set("currentProductsServices", e.target.value)} /></div>
        </div>
      )}

      {/* Step 3: Information */}
      {step === 3 && (
        <div className="space-y-4">
          <div><label className={labelCls}>Why do you want to partner with MartPoint? *</label><textarea className={inputCls} rows={4} value={form.reasonForApplying} onChange={(e) => set("reasonForApplying", e.target.value)} /></div>
          <div><label className={labelCls}>Relevant experience</label><textarea className={inputCls} rows={4} value={form.relevantExperience} onChange={(e) => set("relevantExperience", e.target.value)} /></div>
          <div><label className={labelCls}>Expected monthly opportunities</label><input className={inputCls} value={form.expectedMonthlyOpportunities} onChange={(e) => set("expectedMonthlyOpportunities", e.target.value)} placeholder="e.g. 5-10 introductions per month" /></div>
        </div>
      )}

      {/* Step 4: Documents */}
      {step === 4 && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Upload only documents relevant to your selected partnership type. Max 6 files, 10 MB each. PDF, PNG, JPEG, WEBP, DOC, DOCX.</p>
          <label className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-lg p-8 cursor-pointer hover:bg-muted/40">
            <Upload className="w-8 h-8 text-muted-foreground mb-2" />
            <span className="text-sm font-medium">Click to upload documents</span>
            <input type="file" multiple className="hidden" accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx" onChange={(e) => onFiles(e.target.files)} />
          </label>
          {docs.length > 0 && (
            <div className="space-y-2">
              {docs.map((d, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-md border border-border bg-muted/10">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{d.file.name}</p>
                    <p className="text-xs text-muted-foreground">{(d.file.size / 1024).toFixed(0)} KB</p>
                  </div>
                  <select className="rounded-md border border-input bg-background px-2 py-1 text-xs mr-2" value={d.type} onChange={(e) => setDocs(docs.map((x, idx) => idx === i ? { ...x, type: e.target.value } : x))}>
                    <option value="other">Other</option>
                    <option value="registration">Registration</option>
                    <option value="profile">Company profile</option>
                    <option value="identification">Identification</option>
                    <option value="portfolio">Portfolio</option>
                  </select>
                  <button type="button" onClick={() => setDocs(docs.filter((_, idx) => idx !== i))}><X className="w-4 h-4 text-muted-foreground hover:text-red-500" /></button>
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-muted-foreground">Documents are optional at this stage. You may be asked to provide more information later.</p>
        </div>
      )}

      {/* Step 5: Review */}
      {step === 5 && (
        <div className="space-y-4">
          <h3 className="font-semibold">Review your application</h3>
          <div className="rounded-lg border border-border bg-muted/10 p-4 space-y-2 text-sm">
            <Row label="Applicant" value={`${form.fullName}${form.businessName ? ` — ${form.businessName}` : ""}`} />
            <Row label="Email" value={form.email} />
            <Row label="Phone" value={form.phone} />
            <Row label="Location" value={[form.city, form.state, form.country].filter(Boolean).join(", ")} />
            <Row label="Partnership type" value={PARTNER_OPTIONS.find((p) => p.value === form.requestedPartnerType)?.label || form.requestedPartnerType} />
            <Row label="Industries" value={form.industriesServed.join(", ") || "—"} />
            <Row label="Coverage" value={form.geographicCoverage.join(", ") || "—"} />
            <Row label="Documents" value={`${docs.length} file(s)`} />
          </div>
          <label className="flex items-start gap-3">
            <input type="checkbox" checked={form.declaration} onChange={(e) => set("declaration", e.target.checked)} className="w-4 h-4 rounded border-border mt-0.5" />
            <span className="text-sm text-muted-foreground">I confirm that the information provided is accurate and complete. I understand that submitting this application does not make me an authorised MartPoint partner.</span>
          </label>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between mt-8">
        <Button variant="outline" onClick={back} disabled={step === 0 || submitting}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={next}>Next <ArrowRight className="w-4 h-4 ml-1" /></Button>
        ) : (
          <Button onClick={submit} disabled={submitting}>
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Submit Application
          </Button>
        )}
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-muted-foreground w-32 shrink-0">{label}:</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}
