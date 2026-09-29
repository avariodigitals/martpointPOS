"use client"

import { useRef, useState, type FormEvent } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Check, Loader2, AlertCircle, Users } from "lucide-react"
import { CaptchaField, type CaptchaState, type CaptchaFieldHandle } from "@/components/captcha-field"
import { STATES } from "@/lib/locations"

const inputCls =
  "w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-retail/30"
const errCls = "text-xs text-red-500 mt-1"

const ROLE_OPTIONS = [
  "Inventory Officer",
  "Inventory Team Lead",
  "Field Data Capture",
  "Retail Support",
  "Customer Success",
  "Sales",
  "Engineering",
  "Other",
]
const ENGAGEMENT_OPTIONS = ["Permanent", "Contract", "Temporary", "Internship", "Project-based", "On-call field work"]
const QUALIFICATIONS = ["SSCE/WAEC", "OND/NCE", "HND", "Bachelor's Degree", "Master's Degree", "Doctorate", "Other"]

export function TalentPoolForm() {
  const [form, setForm] = useState({
    fullName: "", email: "", phone: "", whatsapp: "",
    state: "", lga: "", city: "", residentialArea: "",
    otherCities: "", earliestAvailableDate: "", availabilityNotes: "",
    highestQualification: "", fieldOfStudy: "", yearsExperience: "",
    skills: "",
    ownsAndroid: false, hasMobileData: false, ownsLaptop: false, ownsPowerBank: false,
    transportation: "",
    consentTalentPool: false, consentNotifications: false,
  })
  const [roles, setRoles] = useState<string[]>([])
  const [engagements, setEngagements] = useState<string[]>([])
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState("")
  const [done, setDone] = useState<string | null>(null)
  const captchaRef = useRef<CaptchaFieldHandle>(null)
  const [captcha, setCaptcha] = useState<CaptchaState>({ configured: false, token: null })

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }))
  const toggle = (list: string[], v: string, setter: (l: string[]) => void) =>
    setter(list.includes(v) ? list.filter((x) => x !== v) : [...list, v])

  const renderField = (id: string, label: string, required: boolean, children: React.ReactNode) => (
    <div key={id}>
      <label className="block text-sm font-medium text-foreground mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {errors[id] && <p className={errCls}>{errors[id]}</p>}
    </div>
  )

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitError("")
    const errs: Record<string, string> = {}
    if (!form.fullName.trim()) errs.fullName = "Full name is required"
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = "Valid email is required"
    if (!form.state) errs.state = "Select your state"
    if (!form.city.trim()) errs.city = "City/town is required"
    if (!form.consentTalentPool) errs.consent = "Consent is required to join the Talent Pool"
    setErrors(errs)
    if (Object.keys(errs).length > 0) return

    setSubmitting(true)
    const captchaToken = (await captchaRef.current?.execute()) ?? null
    if (captcha.configured && !captchaToken) {
      setSubmitting(false)
      setSubmitError("Please complete the security check before submitting.")
      return
    }

    try {
      const res = await fetch("/api/careers/talent-pool", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          captchaToken,
          fullName: form.fullName, email: form.email, phone: form.phone, whatsapp: form.whatsapp,
          state: form.state, lga: form.lga, city: form.city, residentialArea: form.residentialArea,
          otherCities: form.otherCities, earliestAvailableDate: form.earliestAvailableDate,
          availabilityNotes: form.availabilityNotes,
          highestQualification: form.highestQualification, fieldOfStudy: form.fieldOfStudy,
          yearsExperience: form.yearsExperience,
          skills: form.skills,
          qualifiedRoles: roles,
          employmentPreferences: { engagements },
          equipment: {
            owns_android: form.ownsAndroid,
            has_mobile_data: form.hasMobileData,
            owns_laptop: form.ownsLaptop,
            owns_power_bank: form.ownsPowerBank,
            transportation: form.transportation || null,
          },
          consentTalentPool: form.consentTalentPool,
          consentNotifications: form.consentNotifications,
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        if (data.errors) setErrors(data.errors)
        throw new Error(data.error || "Submission failed")
      }
      setDone(data.reference)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
          <Check className="w-7 h-7 text-green-600" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">You are in the Talent Pool</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Your talent pool reference is <span className="font-mono font-semibold text-foreground">{done}</span>.
          We will contact you when a matching role or deployment opens.
        </p>
        <div className="mt-6">
          <Button asChild variant="retail">
            <Link href="/careers">Browse opportunities</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-border bg-card p-6 md:p-8 space-y-5">
      {submitError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{submitError}</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {renderField("fullName", "Full name", true, <>
          <input className={inputCls} value={form.fullName} onChange={(e) => set("fullName", e.target.value)} />
        </>)}
        {renderField("email", "Email address", true, <>
          <input type="email" className={inputCls} value={form.email} onChange={(e) => set("email", e.target.value)} />
        </>)}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {renderField("phone", "Phone number", false, <>
          <input type="tel" className={inputCls} value={form.phone} onChange={(e) => set("phone", e.target.value)} />
        </>)}
        {renderField("whatsapp", "WhatsApp number", false, <>
          <input type="tel" className={inputCls} value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} />
        </>)}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {renderField("state", "State", true, <>
          <select className={inputCls} value={form.state} onChange={(e) => set("state", e.target.value)}>
            <option value="">Select</option>
            {STATES["Nigeria"].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </>)}
        {renderField("lga", "LGA", false, <>
          <input className={inputCls} value={form.lga} onChange={(e) => set("lga", e.target.value)} />
        </>)}
        {renderField("city", "City / town", true, <>
          <input className={inputCls} value={form.city} onChange={(e) => set("city", e.target.value)} />
        </>)}
      </div>
      {renderField("residentialArea", "Residential area", false, <>
        <input className={inputCls} value={form.residentialArea} onChange={(e) => set("residentialArea", e.target.value)} />
      </>)}
      {renderField("otherCities", "Other cities where you can work", false, <>
        <input className={inputCls} value={form.otherCities} onChange={(e) => set("otherCities", e.target.value)} />
      </>)}

      <div>
        <p className="text-sm font-medium text-foreground mb-2">Roles you are qualified for</p>
        <div className="flex flex-wrap gap-2">
          {ROLE_OPTIONS.map((r) => (
            <button type="button" key={r} onClick={() => toggle(roles, r, setRoles)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${roles.includes(r) ? "border-retail bg-retail-soft text-retail" : "border-border text-muted-foreground hover:bg-muted/50"}`}>
              {r}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-sm font-medium text-foreground mb-2">Preferred engagement types</p>
        <div className="flex flex-wrap gap-2">
          {ENGAGEMENT_OPTIONS.map((r) => (
            <button type="button" key={r} onClick={() => toggle(engagements, r, setEngagements)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${engagements.includes(r) ? "border-retail bg-retail-soft text-retail" : "border-border text-muted-foreground hover:bg-muted/50"}`}>
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {renderField("earliestAvailableDate", "Earliest available date", false, <>
          <input type="date" className={inputCls} value={form.earliestAvailableDate} onChange={(e) => set("earliestAvailableDate", e.target.value)} />
        </>)}
        {renderField("yearsExperience", "Years of experience", false, <>
          <input type="number" min="0" step="0.5" className={inputCls} value={form.yearsExperience} onChange={(e) => set("yearsExperience", e.target.value)} />
        </>)}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {renderField("highestQualification", "Highest qualification", false, <>
          <select className={inputCls} value={form.highestQualification} onChange={(e) => set("highestQualification", e.target.value)}>
            <option value="">Select</option>
            {QUALIFICATIONS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </>)}
        {renderField("fieldOfStudy", "Field of study", false, <>
          <input className={inputCls} value={form.fieldOfStudy} onChange={(e) => set("fieldOfStudy", e.target.value)} />
        </>)}
      </div>
      {renderField("skills", "Skills", false, <>
        <input className={inputCls} value={form.skills} onChange={(e) => set("skills", e.target.value)} placeholder="e.g. inventory counting, data entry, Excel" />
      </>)}
      {renderField("availabilityNotes", "Availability notes", false, <>
        <textarea rows={3} className={inputCls} value={form.availabilityNotes} onChange={(e) => set("availabilityNotes", e.target.value)} placeholder="e.g. weekdays only, available at short notice" />
      </>)}

      <div>
        <p className="text-sm font-medium text-foreground mb-2">Equipment you own</p>
        <div className="grid grid-cols-2 gap-2">
          {([
            ["ownsAndroid", "Android smartphone"],
            ["hasMobileData", "Reliable mobile data"],
            ["ownsLaptop", "Laptop"],
            ["ownsPowerBank", "Power bank"],
          ] as const).map(([key, label]) => (
            <label key={key} className="inline-flex items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" className="accent-retail" checked={form[key]} onChange={(e) => set(key, e.target.checked)} />
              {label}
            </label>
          ))}
        </div>
      </div>
      {renderField("transportation", "Means of transportation", false, <>
        <input className={inputCls} value={form.transportation} onChange={(e) => set("transportation", e.target.value)} />
      </>)}

      <div className="space-y-4 border-t border-border pt-5">
        <label className="flex items-start gap-3 text-sm text-foreground">
          <input type="checkbox" className="mt-0.5 accent-retail" checked={form.consentTalentPool}
            onChange={(e) => set("consentTalentPool", e.target.checked)} />
          <span>
            I consent to MartPoint storing my details in the Talent Pool and contacting me about roles and deployments, as described in the{" "}
            <Link href="/careers/privacy" target="_blank" className="text-retail underline underline-offset-2">recruitment privacy notice</Link>.{" "}
            <span className="text-red-500">*</span>
          </span>
        </label>
        {errors.consent && <p className={errCls}>{errors.consent}</p>}
        <label className="flex items-start gap-3 text-sm text-muted-foreground">
          <input type="checkbox" className="mt-0.5 accent-retail" checked={form.consentNotifications}
            onChange={(e) => set("consentNotifications", e.target.checked)} />
          <span>Email me about future vacancies that match my profile. <em>(optional)</em></span>
        </label>
      </div>

      <CaptchaField ref={captchaRef} onChange={setCaptcha} className="flex justify-center" />

      <Button type="submit" variant="retail" size="lg" className="w-full" disabled={submitting}>
        {submitting ? (
          <><Loader2 className="w-4 h-4 animate-spin" /> Joining...</>
        ) : (
          <><Users className="w-4 h-4" /> Join the Talent Pool</>
        )}
      </Button>
    </form>
  )
}
