"use client"

import { useMemo, useRef, useState, type FormEvent } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Upload, Check, Loader2, AlertCircle, ChevronLeft, ChevronRight, Copy } from "lucide-react"
import { CaptchaField, type CaptchaState, type CaptchaFieldHandle } from "@/components/captcha-field"
import { STATES } from "@/lib/locations"

const inputCls =
  "w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-retail/30"
const errCls = "text-xs text-red-500 mt-1"

interface Question {
  id: string
  question_text: string
  answer_type: string
  required: boolean
  options: string[]
}

interface Props {
  vacancyId: string
  vacancySlug: string
  cvRequired: boolean
  coverLetterRequired: boolean
  portfolioEnabled: boolean
  equipmentFields: Record<string, boolean>
  questions: Question[]
  workingHoursLabel: string | null
  durationLabel: string | null
  locationLabel: string | null
}

type YesNo = "yes" | "no" | ""

interface FormState {
  fullName: string
  email: string
  phone: string
  whatsapp: string
  state: string
  lga: string
  city: string
  residentialArea: string
  employmentStatus: string
  earliestAvailableDate: string
  availableWorkingHours: YesNo
  availableFullDuration: YesNo
  canTravel: YesNo
  requiresAccommodation: YesNo
  otherCities: string
  highestQualification: string
  fieldOfStudy: string
  currentOccupation: string
  yearsExperience: string
  workHistory: string
  skills: string
  excelProficiency: string
  inventorySoftwareExperience: string
  ownsAndroid: YesNo
  smartphoneModel: string
  hasMobileData: YesNo
  ownsLaptop: YesNo
  ownsPowerBank: YesNo
  transportation: string
  linkedin: string
  portfolioUrl: string
  consentAccuracy: boolean
  consentPrivacy: boolean
  consentTalentPool: boolean
  consentNotifications: boolean
}

const initialForm: FormState = {
  fullName: "", email: "", phone: "", whatsapp: "",
  state: "", lga: "", city: "", residentialArea: "",
  employmentStatus: "", earliestAvailableDate: "", availableWorkingHours: "", availableFullDuration: "",
  canTravel: "", requiresAccommodation: "", otherCities: "",
  highestQualification: "", fieldOfStudy: "", currentOccupation: "", yearsExperience: "",
  workHistory: "", skills: "", excelProficiency: "", inventorySoftwareExperience: "",
  ownsAndroid: "", smartphoneModel: "", hasMobileData: "", ownsLaptop: "", ownsPowerBank: "", transportation: "",
  linkedin: "", portfolioUrl: "",
  consentAccuracy: false, consentPrivacy: false, consentTalentPool: false, consentNotifications: false,
}

interface AnswerValue {
  text: string
  options: string[]
  file: File | null
}

const EMPLOYMENT_STATUSES = ["Employed", "Self-employed", "Unemployed", "Student", "Contract/Freelance", "Other"]
const QUALIFICATIONS = ["SSCE/WAEC", "OND/NCE", "HND", "Bachelor's Degree", "Master's Degree", "Doctorate", "Other"]
const EXCEL_LEVELS = ["None", "Basic", "Intermediate", "Advanced"]

function validateFile(file: File | null): string | null {
  if (!file) return null
  if (file.size > 5 * 1024 * 1024) return "File must be under 5MB"
  const ok = [
    "application/pdf", "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "image/png", "image/jpeg", "image/webp",
  ]
  if (!ok.includes(file.type)) return "PDF, Word or image files only"
  return null
}

/* Field components live at module scope — defining them inside the form
 * makes React remount them on every keystroke, losing input focus. */
function Field({ label, required, error, children, hint }: {
  label: string; required?: boolean; error?: string; children: React.ReactNode; hint?: string
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
      {error && <p className={errCls}>{error}</p>}
    </div>
  )
}

function YesNoField({ name, value, onChange, label, error }: {
  name: string; value: YesNo; onChange: (v: YesNo) => void; label: string; error?: string
}) {
  return (
    <div>
      <p className="text-sm font-medium text-foreground mb-1.5">{label}</p>
      <div className="flex gap-4">
        {(["yes", "no"] as const).map((opt) => (
          <label key={opt} className="inline-flex items-center gap-2 text-sm">
            <input
              type="radio" name={name} checked={value === opt}
              onChange={() => onChange(opt)} className="accent-retail"
            />
            {opt === "yes" ? "Yes" : "No"}
          </label>
        ))}
      </div>
      {error && <p className={errCls}>{error}</p>}
    </div>
  )
}

function FilePicker({ file, onPick, label, required, error, onError }: {
  file: File | null; onPick: (f: File | null) => void; label: string; required?: boolean
  error?: string; onError: (msg: string) => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        ref={ref} type="file" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp" className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0] || null
          const ferr = validateFile(f)
          if (ferr) { onError(ferr); return }
          onError("")
          onPick(f)
        }}
      />
      <button
        type="button" onClick={() => ref.current?.click()}
        className={`w-full rounded-lg border border-dashed px-4 py-3 text-sm flex items-center justify-center gap-2 transition-colors ${
          error ? "border-red-300 bg-red-50 text-red-600"
          : file ? "border-retail bg-retail-soft text-retail"
          : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/50"
        }`}
      >
        <Upload className="w-4 h-4" />
        {file?.name || "Upload PDF, Word or image (max 5MB)"}
      </button>
      {error && <p className={errCls}>{error}</p>}
    </div>
  )
}

export function ApplicationForm({
  vacancyId, vacancySlug, cvRequired, coverLetterRequired, portfolioEnabled,
  equipmentFields, questions, workingHoursLabel, durationLabel, locationLabel,
}: Props) {
  const [form, setForm] = useState<FormState>(initialForm)
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [step, setStep] = useState(0)
  const [cvFile, setCvFile] = useState<File | null>(null)
  const [coverLetterFile, setCoverLetterFile] = useState<File | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submittedRef, setSubmittedRef] = useState<string | null>(null)
  const [submittedMsg, setSubmittedMsg] = useState("")
  const [submitError, setSubmitError] = useState("")
  const [copied, setCopied] = useState(false)
  const captchaRef = useRef<CaptchaFieldHandle>(null)
  const [captcha, setCaptcha] = useState<CaptchaState>({ configured: false, token: null })

  const equipmentOn = (k: string) => equipmentFields[k] === true
  const anyEquipment = ["owns_android", "smartphone_model", "has_mobile_data", "owns_laptop", "owns_power_bank", "transportation"].some(equipmentOn)

  const steps = useMemo(() => {
    const s = ["Personal", "Availability", "Experience"]
    if (anyEquipment) s.push("Equipment")
    s.push("Documents")
    if (questions.length > 0) s.push("Questions")
    s.push("Consent")
    return s
  }, [anyEquipment, questions.length])

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }))

  const setFieldError = (id: string, msg: string) =>
    setErrors((p) => ({ ...p, [id]: msg }))

  const setAnswer = (qid: string, patch: Partial<AnswerValue>) =>
    setAnswers((a) => {
      const prev: AnswerValue = a[qid] || { text: "", options: [], file: null }
      return { ...a, [qid]: { ...prev, ...patch } }
    })

  const yn = (v: YesNo): boolean | null => (v === "yes" ? true : v === "no" ? false : null)

  function validateStep(idx: number): boolean {
    const e: Record<string, string> = {}
    const name = steps[idx]

    if (name === "Personal") {
      if (!form.fullName.trim()) e.fullName = "Full name is required"
      if (!form.email.trim()) e.email = "Email is required"
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = "Enter a valid email"
      if (!form.phone.trim()) e.phone = "Phone number is required"
      else if (form.phone.trim().length < 7) e.phone = "Enter a valid phone number"
      if (!form.state) e.state = "Select your state of residence"
      if (!form.city.trim()) e.city = "City/town is required"
    }
    if (name === "Availability") {
      if (!form.employmentStatus) e.employmentStatus = "Select your current status"
      if (form.availableWorkingHours === "") e.availableWorkingHours = "Required"
      if (form.canTravel === "") e.canTravel = "Required"
    }
    if (name === "Experience") {
      if (!form.highestQualification) e.highestQualification = "Select your highest qualification"
    }
    if (name === "Documents") {
      if (cvRequired && !cvFile) e.cvFile = "Please upload your CV"
      const cvErr = validateFile(cvFile); if (cvErr) e.cvFile = cvErr
      if (coverLetterRequired && !coverLetterFile) e.coverLetterFile = "Please upload a cover letter"
      const clErr = validateFile(coverLetterFile); if (clErr) e.coverLetterFile = clErr
      if (form.linkedin && !form.linkedin.includes("linkedin.com")) e.linkedin = "Enter a valid LinkedIn URL"
      if (form.portfolioUrl && !/^https?:\/\//i.test(form.portfolioUrl)) e.portfolioUrl = "Enter a valid URL"
    }
    if (name === "Questions") {
      for (const q of questions) {
        const a = answers[q.id]
        const empty = !a || (!a.text.trim() && a.options.length === 0 && !a.file)
        if (q.required && empty) e[`q_${q.id}`] = "This question is required"
        if (a?.file) {
          const ferr = validateFile(a.file); if (ferr) e[`q_${q.id}`] = ferr
        }
      }
    }
    if (name === "Consent") {
      if (!form.consentAccuracy) e.consentAccuracy = "Please confirm your information is accurate"
      if (!form.consentPrivacy) e.consentPrivacy = "Please accept the recruitment privacy notice"
    }

    setErrors(e)
    return Object.keys(e).length === 0
  }

  function next() {
    if (validateStep(step)) setStep((s) => Math.min(s + 1, steps.length - 1))
  }
  function back() {
    setErrors({})
    setStep((s) => Math.max(0, s - 1))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitError("")
    if (!validateStep(step)) return
    setSubmitting(true)

    const captchaToken = (await captchaRef.current?.execute()) ?? null
    if (captcha.configured && !captchaToken) {
      setSubmitting(false)
      setSubmitError("Please complete the security check before submitting.")
      return
    }

    try {
      const payload = new FormData()
      payload.append("vacancyId", vacancyId)
      if (captchaToken) payload.append("captchaToken", captchaToken)

      const fields: Record<string, string | boolean | null> = {
        fullName: form.fullName, email: form.email, phone: form.phone, whatsapp: form.whatsapp,
        state: form.state, lga: form.lga, city: form.city, residentialArea: form.residentialArea,
        employmentStatus: form.employmentStatus, earliestAvailableDate: form.earliestAvailableDate,
        availableWorkingHours: yn(form.availableWorkingHours),
        availableFullDuration: yn(form.availableFullDuration),
        canTravel: yn(form.canTravel),
        requiresAccommodation: yn(form.requiresAccommodation),
        otherCities: form.otherCities,
        highestQualification: form.highestQualification, fieldOfStudy: form.fieldOfStudy,
        currentOccupation: form.currentOccupation, yearsExperience: form.yearsExperience,
        workHistory: form.workHistory, skills: form.skills,
        excelProficiency: form.excelProficiency, inventorySoftwareExperience: form.inventorySoftwareExperience,
        ownsAndroid: yn(form.ownsAndroid), smartphoneModel: form.smartphoneModel,
        hasMobileData: yn(form.hasMobileData), ownsLaptop: yn(form.ownsLaptop),
        ownsPowerBank: yn(form.ownsPowerBank), transportation: form.transportation,
        linkedinUrl: form.linkedin, portfolioUrl: form.portfolioUrl,
        consentAccuracy: form.consentAccuracy, consentPrivacy: form.consentPrivacy,
        consentTalentPool: form.consentTalentPool, consentNotifications: form.consentNotifications,
      }
      payload.append("fields", JSON.stringify(fields))

      const serializedAnswers = questions.map((q) => {
        const a = answers[q.id] || { text: "", options: [], file: null }
        return { questionId: q.id, text: a.text || null, options: a.options }
      })
      payload.append("answers", JSON.stringify(serializedAnswers))

      if (cvFile) payload.append("cv", cvFile)
      if (coverLetterFile) payload.append("coverLetter", coverLetterFile)
      for (const q of questions) {
        const f = answers[q.id]?.file
        if (f) payload.append(`qfile_${q.id}`, f)
      }

      const res = await fetch("/api/careers/applications", { method: "POST", body: payload })
      const data = await res.json()
      if (!res.ok || data.error) {
        if (data.errors) setErrors(data.errors)
        throw new Error(data.error || "Submission failed")
      }
      setSubmittedRef(data.reference)
      setSubmittedMsg(typeof data.confirmationMessage === "string" ? data.confirmationMessage : "")
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  /* ─── Success ─── */
  if (submittedRef) {
    return (
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center mx-auto mb-4">
          <Check className="w-7 h-7 text-green-600" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">Application Submitted Successfully</h3>
        <p className="text-sm text-muted-foreground leading-relaxed mb-4">
          Your application reference is:
        </p>
        <div className="inline-flex items-center gap-2 rounded-lg bg-muted px-4 py-2.5 font-mono text-base font-semibold text-foreground">
          {submittedRef}
          <button
            type="button"
            onClick={() => { navigator.clipboard?.writeText(submittedRef); setCopied(true) }}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Copy reference"
          >
            {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
        {submittedMsg ? (
          <div className="mt-5 rounded-lg border border-border bg-muted/40 p-5 text-left text-sm text-foreground leading-relaxed whitespace-pre-line">
            {submittedMsg}
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">
            Keep this reference safe. A confirmation email is on its way if your address is reachable.
          </p>
        )}
        <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild variant="retail">
            <Link href="/careers/application-status">Check Application Status</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/careers/jobs/${vacancySlug}`}>Back to vacancy</Link>
          </Button>
        </div>
      </div>
    )
  }

  const renderQuestion = (q: Question) => {
    const a = answers[q.id] || { text: "", options: [], file: null }
    const eid = `q_${q.id}`
    const label = (
      <p className="text-sm font-medium text-foreground mb-1.5">
        {q.question_text} {q.required && <span className="text-red-500">*</span>}
      </p>
    )
    const err = errors[eid] ? <p className={errCls}>{errors[eid]}</p> : null

    switch (q.answer_type) {
      case "YES_NO":
        return (
          <div key={q.id}>
            {label}
            <div className="flex gap-4">
              {["yes", "no"].map((opt) => (
                <label key={opt} className="inline-flex items-center gap-2 text-sm">
                  <input type="radio" name={eid} checked={a.text === opt}
                    onChange={() => setAnswer(q.id, { text: opt })} className="accent-retail" />
                  {opt === "yes" ? "Yes" : "No"}
                </label>
              ))}
            </div>
            {err}
          </div>
        )
      case "SINGLE_CHOICE":
        return (
          <div key={q.id}>
            {label}
            <div className="space-y-2">
              {q.options.map((opt) => (
                <label key={opt} className="flex items-center gap-2 text-sm">
                  <input type="radio" name={eid} checked={a.options[0] === opt}
                    onChange={() => setAnswer(q.id, { options: [opt] })} className="accent-retail" />
                  {opt}
                </label>
              ))}
            </div>
            {err}
          </div>
        )
      case "MULTIPLE_CHOICE":
        return (
          <div key={q.id}>
            {label}
            <div className="space-y-2">
              {q.options.map((opt) => (
                <label key={opt} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={a.options.includes(opt)}
                    onChange={(e) =>
                      setAnswer(q.id, {
                        options: e.target.checked ? [...a.options, opt] : a.options.filter((o) => o !== opt),
                      })
                    }
                    className="accent-retail" />
                  {opt}
                </label>
              ))}
            </div>
            {err}
          </div>
        )
      case "LONG_TEXT":
        return (
          <div key={q.id}>
            {label}
            <textarea rows={4} className={inputCls} value={a.text}
              onChange={(e) => setAnswer(q.id, { text: e.target.value })} />
            {err}
          </div>
        )
      case "NUMBER":
        return (
          <div key={q.id}>
            {label}
            <input type="number" className={inputCls} value={a.text}
              onChange={(e) => setAnswer(q.id, { text: e.target.value })} />
            {err}
          </div>
        )
      case "DATE":
        return (
          <div key={q.id}>
            {label}
            <input type="date" className={inputCls} value={a.text}
              onChange={(e) => setAnswer(q.id, { text: e.target.value })} />
            {err}
          </div>
        )
      case "RATING":
        return (
          <div key={q.id}>
            {label}
            <div className="flex gap-3">
              {[1, 2, 3, 4, 5].map((n) => (
                <label key={n} className="inline-flex items-center gap-1.5 text-sm">
                  <input type="radio" name={eid} checked={a.text === String(n)}
                    onChange={() => setAnswer(q.id, { text: String(n) })} className="accent-retail" />
                  {n}
                </label>
              ))}
            </div>
            {err}
          </div>
        )
      case "FILE":
        return (
          <FilePicker key={q.id} file={a.file} error={errors[eid]} onError={(m) => setFieldError(eid, m)}
            onPick={(f) => setAnswer(q.id, { file: f })} label={q.question_text} required={q.required} />
        )
      case "LOCATION":
      case "SHORT_TEXT":
      default:
        return (
          <div key={q.id}>
            {label}
            <input type="text" className={inputCls} value={a.text}
              onChange={(e) => setAnswer(q.id, { text: e.target.value })} />
            {err}
          </div>
        )
    }
  }

  /* ─── Step bodies ─── */
  const stepBody = (name: string) => {
    switch (name) {
      case "Personal":
        return (
          <div className="space-y-5">
            <Field label="Full name" required error={errors.fullName}>
              <input className={inputCls} value={form.fullName} onChange={(e) => set("fullName", e.target.value)} placeholder="e.g. Adaeze Okafor" />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <Field label="Email address" required error={errors.email}>
                <input type="email" className={inputCls} value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="you@example.com" />
              </Field>
              <Field label="Phone number" required error={errors.phone}>
                <input type="tel" className={inputCls} value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+234 ..." />
              </Field>
            </div>
            <Field label="WhatsApp number" hint="Optional — if different from your phone number." error={errors.whatsapp}>
              <input type="tel" className={inputCls} value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <Field label="State of residence" required error={errors.state}>
                <select className={inputCls} value={form.state} onChange={(e) => set("state", e.target.value)}>
                  <option value="">Select state</option>
                  {STATES["Nigeria"].map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="LGA" error={errors.lga}>
                <input className={inputCls} value={form.lga} onChange={(e) => set("lga", e.target.value)} placeholder="Local government area" />
              </Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <Field label="City / town" required error={errors.city}>
                <input className={inputCls} value={form.city} onChange={(e) => set("city", e.target.value)} placeholder="e.g. Ilobu" />
              </Field>
              <Field label="Residential area" error={errors.residentialArea}>
                <input className={inputCls} value={form.residentialArea} onChange={(e) => set("residentialArea", e.target.value)} placeholder="Area / street" />
              </Field>
            </div>
          </div>
        )
      case "Availability":
        return (
          <div className="space-y-5">
            <Field label="Current employment status" required error={errors.employmentStatus}>
              <select className={inputCls} value={form.employmentStatus} onChange={(e) => set("employmentStatus", e.target.value)}>
                <option value="">Select</option>
                {EMPLOYMENT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Earliest date you can start" error={errors.earliestAvailableDate}>
              <input type="date" className={inputCls} value={form.earliestAvailableDate} onChange={(e) => set("earliestAvailableDate", e.target.value)} />
            </Field>
            <YesNoField name="availableWorkingHours" value={form.availableWorkingHours} error={errors.availableWorkingHours}
              onChange={(v) => set("availableWorkingHours", v)}
              label={workingHoursLabel ? `Are you available for the stated working hours (${workingHoursLabel})?` : "Are you available for the stated working hours?"} />
            {durationLabel && (
              <YesNoField name="availableFullDuration" value={form.availableFullDuration} error={errors.availableFullDuration}
                onChange={(v) => set("availableFullDuration", v)}
                label={`Can you commit to the full duration (${durationLabel})?`} />
            )}
            <YesNoField name="canTravel" value={form.canTravel} error={errors.canTravel}
              onChange={(v) => set("canTravel", v)}
              label={locationLabel ? `Can you travel to the job location (${locationLabel})?` : "Can you travel to the job location?"} />
            <YesNoField name="requiresAccommodation" value={form.requiresAccommodation} error={errors.requiresAccommodation}
              onChange={(v) => set("requiresAccommodation", v)} label="Do you require accommodation?" />
            <Field label="Other cities/towns where you can work" error={errors.otherCities}>
              <input className={inputCls} value={form.otherCities} onChange={(e) => set("otherCities", e.target.value)} placeholder="e.g. Osogbo, Ede" />
            </Field>
          </div>
        )
      case "Experience":
        return (
          <div className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <Field label="Highest qualification" required error={errors.highestQualification}>
                <select className={inputCls} value={form.highestQualification} onChange={(e) => set("highestQualification", e.target.value)}>
                  <option value="">Select</option>
                  {QUALIFICATIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Field of study" error={errors.fieldOfStudy}>
                <input className={inputCls} value={form.fieldOfStudy} onChange={(e) => set("fieldOfStudy", e.target.value)} />
              </Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <Field label="Current occupation" error={errors.currentOccupation}>
                <input className={inputCls} value={form.currentOccupation} onChange={(e) => set("currentOccupation", e.target.value)} />
              </Field>
              <Field label="Years of relevant experience" error={errors.yearsExperience}>
                <input type="number" min="0" step="0.5" className={inputCls} value={form.yearsExperience} onChange={(e) => set("yearsExperience", e.target.value)} />
              </Field>
            </div>
            <Field label="Relevant work history" hint="Briefly describe work relevant to this role." error={errors.workHistory}>
              <textarea rows={4} className={inputCls} value={form.workHistory} onChange={(e) => set("workHistory", e.target.value)} />
            </Field>
            <Field label="Skills" hint="Separate skills with commas, e.g. inventory counting, data entry, Excel" error={errors.skills}>
              <input className={inputCls} value={form.skills} onChange={(e) => set("skills", e.target.value)} />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <Field label="Excel proficiency" error={errors.excelProficiency}>
                <select className={inputCls} value={form.excelProficiency} onChange={(e) => set("excelProficiency", e.target.value)}>
                  <option value="">Select</option>
                  {EXCEL_LEVELS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Inventory software experience" error={errors.inventorySoftwareExperience}>
                <input className={inputCls} value={form.inventorySoftwareExperience} onChange={(e) => set("inventorySoftwareExperience", e.target.value)} placeholder="e.g. MartPoint Retail" />
              </Field>
            </div>
          </div>
        )
      case "Equipment":
        return (
          <div className="space-y-5">
            {equipmentOn("owns_android") && (
              <YesNoField name="ownsAndroid" value={form.ownsAndroid} error={errors.ownsAndroid} onChange={(v) => set("ownsAndroid", v)} label="Do you own an Android smartphone?" />
            )}
            {equipmentOn("smartphone_model") && (
              <Field label="Smartphone model" error={errors.smartphoneModel}>
                <input className={inputCls} value={form.smartphoneModel} onChange={(e) => set("smartphoneModel", e.target.value)} placeholder="e.g. Tecno Spark 10" />
              </Field>
            )}
            {equipmentOn("has_mobile_data") && (
              <YesNoField name="hasMobileData" value={form.hasMobileData} error={errors.hasMobileData} onChange={(v) => set("hasMobileData", v)} label="Do you have reliable mobile data?" />
            )}
            {equipmentOn("owns_laptop") && (
              <YesNoField name="ownsLaptop" value={form.ownsLaptop} error={errors.ownsLaptop} onChange={(v) => set("ownsLaptop", v)} label="Do you own a laptop?" />
            )}
            {equipmentOn("owns_power_bank") && (
              <YesNoField name="ownsPowerBank" value={form.ownsPowerBank} error={errors.ownsPowerBank} onChange={(v) => set("ownsPowerBank", v)} label="Do you own a power bank?" />
            )}
            {equipmentOn("transportation") && (
              <Field label="Means of transportation" error={errors.transportation}>
                <input className={inputCls} value={form.transportation} onChange={(e) => set("transportation", e.target.value)} placeholder="e.g. personal bike, public transport" />
              </Field>
            )}
          </div>
        )
      case "Documents":
        return (
          <div className="space-y-5">
            <FilePicker file={cvFile} onPick={setCvFile} label="CV / Résumé" required={cvRequired}
              error={errors.cvFile} onError={(m) => setFieldError("cvFile", m)} />
            {coverLetterRequired && (
              <FilePicker file={coverLetterFile} onPick={setCoverLetterFile} label="Cover letter" required
                error={errors.coverLetterFile} onError={(m) => setFieldError("coverLetterFile", m)} />
            )}
            <Field label="LinkedIn profile" hint="Optional." error={errors.linkedin}>
              <input type="url" className={inputCls} value={form.linkedin} onChange={(e) => set("linkedin", e.target.value)} placeholder="https://linkedin.com/in/..." />
            </Field>
            {portfolioEnabled && (
              <Field label="Portfolio URL" hint="Optional — link to work samples." error={errors.portfolioUrl}>
                <input type="url" className={inputCls} value={form.portfolioUrl} onChange={(e) => set("portfolioUrl", e.target.value)} placeholder="https://..." />
              </Field>
            )}
          </div>
        )
      case "Questions":
        return <div className="space-y-5">{questions.map(renderQuestion)}</div>
      case "Consent":
        return (
          <div className="space-y-4">
            <label className="flex items-start gap-3 text-sm text-foreground">
              <input type="checkbox" className="mt-0.5 accent-retail" checked={form.consentAccuracy}
                onChange={(e) => set("consentAccuracy", e.target.checked)} />
              <span>I confirm that the information provided in this application is accurate and complete. <span className="text-red-500">*</span></span>
            </label>
            {errors.consentAccuracy && <p className={errCls}>{errors.consentAccuracy}</p>}

            <label className="flex items-start gap-3 text-sm text-foreground">
              <input type="checkbox" className="mt-0.5 accent-retail" checked={form.consentPrivacy}
                onChange={(e) => set("consentPrivacy", e.target.checked)} />
              <span>
                I consent to MartPoint processing my personal data for recruitment purposes, as described in the{" "}
                <Link href="/careers/privacy" target="_blank" className="text-retail underline underline-offset-2">recruitment privacy notice</Link>.{" "}
                <span className="text-red-500">*</span>
              </span>
            </label>
            {errors.consentPrivacy && <p className={errCls}>{errors.consentPrivacy}</p>}

            <label className="flex items-start gap-3 text-sm text-muted-foreground">
              <input type="checkbox" className="mt-0.5 accent-retail" checked={form.consentTalentPool}
                onChange={(e) => set("consentTalentPool", e.target.checked)} />
              <span>Also add me to the MartPoint Talent Pool so I can be contacted about future roles and deployments. <em>(optional)</em></span>
            </label>

            <label className="flex items-start gap-3 text-sm text-muted-foreground">
              <input type="checkbox" className="mt-0.5 accent-retail" checked={form.consentNotifications}
                onChange={(e) => set("consentNotifications", e.target.checked)} />
              <span>Email me about future vacancies that match my profile. <em>(optional)</em></span>
            </label>

            <CaptchaField ref={captchaRef} onChange={setCaptcha} className="flex justify-center pt-2" />
          </div>
        )
      default:
        return null
    }
  }

  const currentName = steps[step]
  const isLast = step === steps.length - 1

  return (
    <div className="rounded-xl border border-border bg-card p-6 md:p-8">
      {/* Step indicator */}
      <div className="mb-8">
        <div className="flex items-center gap-1.5 mb-3">
          {steps.map((s, i) => (
            <div key={s} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-retail" : "bg-muted"}`} />
          ))}
        </div>
        <p className="text-sm font-medium text-foreground">
          Step {step + 1} of {steps.length}: {currentName}
        </p>
      </div>

      {submitError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 flex items-start gap-3 mb-6">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <p className="text-sm text-red-700">{submitError}</p>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {stepBody(currentName)}

        <div className="mt-8 flex items-center justify-between gap-3">
          <Button type="button" variant="outline" onClick={back} disabled={step === 0 || submitting}>
            <ChevronLeft className="w-4 h-4" /> Back
          </Button>
          {isLast ? (
            <Button type="submit" variant="retail" disabled={submitting}>
              {submitting ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Submitting...</>
              ) : (
                "Submit Application"
              )}
            </Button>
          ) : (
            <Button type="button" variant="retail" onClick={next}>
              Next <ChevronRight className="w-4 h-4" />
            </Button>
          )}
        </div>
      </form>
    </div>
  )
}
