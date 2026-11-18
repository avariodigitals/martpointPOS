"use client"

import { useRef, useState } from "react"
import { CheckCircle2, Loader2 } from "lucide-react"
import { CaptchaField, type CaptchaFieldHandle, type CaptchaState } from "@/components/captcha-field"
import type { GrowthQuestion } from "@/lib/business-growth-policy"

type Props = { programme: { slug: string; questions: GrowthQuestion[]; termsText: string; privacyText: string } }

const field = "mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-retail focus:ring-2 focus:ring-retail/20"

export function GrowthProgrammeApplicationForm({ programme }: Props) {
  const captchaRef = useRef<CaptchaFieldHandle>(null)
  const [captcha, setCaptcha] = useState<CaptchaState>({ configured: false, token: null })
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [applicantName, setApplicantName] = useState("")
  const [businessName, setBusinessName] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [stateName, setStateName] = useState("")
  const [city, setCity] = useState("")
  const [address, setAddress] = useState("")
  const [industry, setIndustry] = useState("")
  const [website, setWebsite] = useState("")
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [privacyAccepted, setPrivacyAccepted] = useState(false)
  const [accuracyConfirmed, setAccuracyConfirmed] = useState(false)
  const [marketingConsent, setMarketingConsent] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [reference, setReference] = useState("")

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!termsAccepted || !privacyAccepted || !accuracyConfirmed) {
      setError("Please confirm the terms, privacy notice and accuracy statement.")
      return
    }
    setSubmitting(true)
    setError("")
    const captchaToken = await captchaRef.current?.execute() ?? null
    if (captcha.configured && !captchaToken) {
      setError("Security verification failed. Please complete the check and try again.")
      setSubmitting(false)
      return
    }
    try {
      const response = await fetch(`/api/programmes/${encodeURIComponent(programme.slug)}/applications`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicantName, businessName, email, phone, state: stateName, city, address, industry, website, answers, termsAccepted, accuracyConfirmed, marketingConsent, captchaToken }),
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) {
        setError(result.error || "We could not submit the application. Please try again.")
        captchaRef.current?.reset()
        return
      }
      setReference(String(result.reference || ""))
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  if (reference) return (
    <section className="rounded-2xl bg-white p-8 text-center shadow-sm sm:p-10">
      <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
      <h2 className="mt-4 text-2xl font-bold">Application received</h2>
      <p className="mt-2 text-slate-600">We’ve received your application. This acknowledgement does not mean you have been selected.</p>
      <p className="mt-5 inline-block rounded-lg bg-slate-100 px-5 py-3 font-mono text-lg font-semibold">{reference}</p>
      <p className="mt-4 text-sm text-slate-500">Keep this reference. We’ll send updates to the email address you provided.</p>
    </section>
  )

  return (
    <form onSubmit={submit} className="space-y-6 rounded-3xl bg-white p-6 shadow-sm sm:p-10">
      <div><h2 className="text-2xl font-bold">Apply for a sponsored place</h2><p className="mt-2 text-sm text-slate-600">Simple, honest answers are welcome. Writing quality, revenue size, website and social following do not affect scoring.</p></div>
      <section className="space-y-4">
        <h3 className="font-semibold">Contact and business</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm">Your name *<input required maxLength={120} autoComplete="name" className={field} value={applicantName} onChange={(e) => setApplicantName(e.target.value)} /></label>
          <label className="text-sm">Business name *<input required maxLength={160} autoComplete="organization" className={field} value={businessName} onChange={(e) => setBusinessName(e.target.value)} /></label>
          <label className="text-sm">Email *<input required type="email" maxLength={254} autoComplete="email" className={field} value={email} onChange={(e) => setEmail(e.target.value)} /></label>
          <label className="text-sm">Phone *<input required type="tel" maxLength={40} autoComplete="tel" className={field} value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
          <label className="text-sm">State *<input required maxLength={100} autoComplete="address-level1" className={field} value={stateName} onChange={(e) => setStateName(e.target.value)} /></label>
          <label className="text-sm">City *<input required maxLength={100} autoComplete="address-level2" className={field} value={city} onChange={(e) => setCity(e.target.value)} /></label>
          <label className="text-sm">Business address (optional)<input maxLength={240} autoComplete="street-address" className={field} value={address} onChange={(e) => setAddress(e.target.value)} /></label>
          <label className="text-sm">Industry *<input required maxLength={120} className={field} value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="e.g. Grocery retail" /></label>
          <label className="text-sm sm:col-span-2">Business website or social page (optional)<input type="url" maxLength={300} className={field} value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://" /></label>
        </div>
      </section>
      <section className="space-y-4">
        <h3 className="font-semibold">About your business</h3>
        {programme.questions.map((question) => (
          <label key={question.id} className="block text-sm leading-6">
            {question.label}{question.required ? " *" : " (optional)"}
            {question.type === "select" ? (
              <select required={question.required} className={field} value={answers[question.id] || ""} onChange={(e) => setAnswers((current) => ({ ...current, [question.id]: e.target.value }))}>
                <option value="">Choose an answer…</option>{(question.options || []).map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            ) : question.type === "textarea" ? (
              <textarea required={question.required} maxLength={question.maxLength || 2500} rows={4} className={field} value={answers[question.id] || ""} onChange={(e) => setAnswers((current) => ({ ...current, [question.id]: e.target.value }))} />
            ) : (
              <input required={question.required} maxLength={question.maxLength || 2500} className={field} value={answers[question.id] || ""} onChange={(e) => setAnswers((current) => ({ ...current, [question.id]: e.target.value }))} />
            )}
          </label>
        ))}
      </section>
      <section className="space-y-4 rounded-xl border p-4">
        <details><summary className="cursor-pointer font-medium">Programme terms (version current at submission)</summary><p className="mt-3 whitespace-pre-line text-sm text-slate-600">{programme.termsText}</p></details>
        <details><summary className="cursor-pointer font-medium">Privacy notice</summary><p className="mt-3 whitespace-pre-line text-sm text-slate-600">{programme.privacyText}</p></details>
        <label className="flex items-start gap-3 text-sm"><input className="mt-1" type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} /><span>I accept the programme terms. *</span></label>
        <label className="flex items-start gap-3 text-sm"><input className="mt-1" type="checkbox" checked={privacyAccepted} onChange={(e) => setPrivacyAccepted(e.target.checked)} /><span>I have read the privacy notice and agree to the use of my information to assess this application. *</span></label>
        <label className="flex items-start gap-3 text-sm"><input className="mt-1" type="checkbox" checked={accuracyConfirmed} onChange={(e) => setAccuracyConfirmed(e.target.checked)} /><span>I confirm that the information provided is accurate. *</span></label>
        <label className="flex items-start gap-3 text-sm"><input className="mt-1" type="checkbox" checked={marketingConsent} onChange={(e) => setMarketingConsent(e.target.checked)} /><span>I’d like to receive optional MartPoint product and business updates. This is optional and does not affect selection.</span></label>
      </section>
      <CaptchaField ref={captchaRef} onChange={setCaptcha} />
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <button disabled={submitting} className="inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-retail px-5 py-3 font-semibold text-white disabled:opacity-60 sm:w-auto">
        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{submitting ? "Submitting…" : "Submit application"}
      </button>
    </form>
  )
}
