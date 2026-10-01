"use client"

import { useState, useRef } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Loader2, ArrowRight, ArrowLeft, CheckCircle2, Plus, Trash2, Upload } from "lucide-react"
import { LocationFields } from "@/components/location-fields"
import { CaptchaField, type CaptchaState, type CaptchaFieldHandle } from "@/components/captcha-field"
import { CONTENT_CATEGORIES, CREATOR_PLATFORMS, CREATOR_PLATFORM_LABELS, EXPERIENCE_OPTIONS } from "@/lib/creators"

const STEPS = ["Personal", "Profiles", "Audience", "Portfolio", "Statement", "Review"]

const inputCls = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
const labelCls = "block text-sm font-medium mb-1"
const hintCls = "text-xs text-muted-foreground mt-1"

const LANGUAGES = ["English", "Pidgin", "Hausa", "Yoruba", "Igbo", "Fulfulde", "Kanuri", "Other"]
const AGE_RANGES = ["Under 18", "18–24", "25–34", "35–44", "45+", "Mixed"]

interface SocialProfile {
  platform: string
  profileUrl: string
  username: string
  followers: string
  typicalViews: string
  typicalEngagement: string
  isPrimary: boolean
}

const emptyProfile = (): SocialProfile => ({
  platform: "TIKTOK",
  profileUrl: "",
  username: "",
  followers: "",
  typicalViews: "",
  typicalEngagement: "",
  isPrimary: false,
})

export function CreatorApplicationForm() {
  const [step, setStep] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState<{ reference: string } | null>(null)
  const [captcha, setCaptcha] = useState<CaptchaState>({ configured: false, token: null })
  const captchaRef = useRef<CaptchaFieldHandle>(null)
  const [photo, setPhoto] = useState<File | null>(null)

  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    whatsapp: "",
    country: "Nigeria",
    state: "",
    city: "",
    dateOfBirth: "",
    ageConfirmed: false,

    primaryCategory: "",
    secondaryCategory: "",
    languages: [] as string[],
    bio: "",
    experienceYears: "",

    primaryAudience: "",
    audienceLocations: "",
    audienceAgeRange: "",
    audienceHasBusinessOwners: "",
    audienceIndustries: "",

    whyCreator: "",
    introduceMartpoint: "",

    consentAccurate: false,
    consentPublicReview: false,
    consentRules: false,
    consentNoGuarantee: false,
  })

  const [profiles, setProfiles] = useState<SocialProfile[]>([emptyProfile()])
  const [portfolio, setPortfolio] = useState<{ url: string; note: string }[]>([
    { url: "", note: "" },
    { url: "", note: "" },
  ])

  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }))
  const toggleLanguage = (lang: string) =>
    set({ languages: form.languages.includes(lang) ? form.languages.filter((l) => l !== lang) : [...form.languages, lang] })

  const updateProfile = (i: number, patch: Partial<SocialProfile>) =>
    setProfiles((ps) => ps.map((p, idx) => (idx === i ? { ...p, ...patch } : p)))

  function validateStep(): string {
    if (step === 0) {
      if (form.fullName.trim().length < 2) return "Enter your full name."
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return "Enter a valid email address."
      if (form.phone.trim().length < 7) return "Enter a valid phone / WhatsApp number."
      if (!form.state) return "Select your state."
      if (!form.ageConfirmed) return "Confirm that you are 18 or older."
    }
    if (step === 1) {
      if (!form.primaryCategory) return "Choose your primary content category."
      if (form.languages.length === 0) return "Select at least one language."
      const valid = profiles.filter((p) => p.profileUrl.trim())
      if (valid.length === 0) return "Add at least one public creator profile."
      for (const p of valid) {
        try { new URL(p.profileUrl) } catch { return `"${p.profileUrl}" is not a valid URL — include https://` }
      }
    }
    if (step === 3) {
      const filled = portfolio.filter((p) => p.url.trim())
      if (filled.length < 2) return "Add at least 2 examples of your content."
      for (const p of filled) {
        try { new URL(p.url) } catch { return `"${p.url}" is not a valid URL.` }
      }
    }
    if (step === 4) {
      if (form.whyCreator.trim().length < 20) return "Tell us a bit more about why you want to join (min 20 characters)."
      if (form.introduceMartpoint.trim().length < 20) return "Tell us how you'd introduce MartPoint (min 20 characters)."
    }
    if (step === 5) {
      if (!form.consentAccurate || !form.consentPublicReview || !form.consentRules || !form.consentNoGuarantee) {
        return "Please confirm all four consent statements."
      }
    }
    return ""
  }

  function next() {
    const err = validateStep()
    if (err) { setError(err); return }
    setError("")
    setStep((s) => Math.min(s + 1, STEPS.length - 1))
  }

  async function handleSubmit() {
    const err = validateStep()
    if (err) { setError(err); return }
    setSubmitting(true)
    setError("")

    const captchaToken = (await captchaRef.current?.execute()) ?? null
    if (captcha.configured && !captchaToken) {
      setError("Verification failed — please try again.")
      setSubmitting(false)
      return
    }

    const payload = {
      ...form,
      secondaryCategory: form.secondaryCategory || undefined,
      experienceYears: form.experienceYears || undefined,
      audienceLocations: form.audienceLocations.split(",").map((s) => s.trim()).filter(Boolean),
      audienceHasBusinessOwners:
        form.audienceHasBusinessOwners === "" ? undefined : form.audienceHasBusinessOwners === "yes",
      audienceIndustries: form.audienceIndustries.split(",").map((s) => s.trim()).filter(Boolean),
      socialProfiles: profiles
        .filter((p) => p.profileUrl.trim())
        .map((p) => ({
          platform: p.platform,
          profileUrl: p.profileUrl.trim(),
          username: p.username.trim() || undefined,
          followers: p.followers ? Number(p.followers) : undefined,
          typicalViews: p.typicalViews ? Number(p.typicalViews) : undefined,
          typicalEngagement: p.typicalEngagement.trim() || undefined,
          isPrimary: p.isPrimary,
        })),
      portfolioLinks: portfolio.filter((p) => p.url.trim()).map((p) => ({ url: p.url.trim(), note: p.note.trim() || undefined })),
    }

    try {
      const fd = new FormData()
      fd.append("data", JSON.stringify(payload))
      if (captchaToken) fd.append("captchaToken", captchaToken)
      if (photo) fd.append("photo", photo)

      const res = await fetch("/api/creators/apply", { method: "POST", body: fd })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.issues?.[0] || json.error || "Submission failed. Please try again.")
        captchaRef.current?.reset?.()
        return
      }
      setSuccess({ reference: json.reference })
    } catch {
      setError("Network error — please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="rounded-2xl border bg-card p-8 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-green-600 mb-4" />
        <h2 className="text-2xl font-bold mb-2">Application received</h2>
        <p className="text-muted-foreground mb-6">
          Thank you — your application is now being reviewed by the MartPoint team.
          Save your application reference:
        </p>
        <p className="inline-block rounded-lg bg-muted px-6 py-3 font-mono text-xl font-bold tracking-wider mb-6">
          {success.reference}
        </p>
        <p className="text-sm text-muted-foreground mb-6">
          We&apos;ve emailed you a confirmation. You can check your status anytime with this
          reference and your email address.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild>
            <Link href="/creators/application-status">Track Application</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/creators">Back to Creator Network</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border bg-card p-6 md:p-8">
      {/* Stepper */}
      <div className="flex items-center gap-1 mb-8 overflow-x-auto pb-1">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-1 shrink-0">
            <div
              className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold ${
                i < step ? "bg-green-600 text-white" : i === step ? "bg-retail text-white" : "bg-muted text-muted-foreground"
              }`}
            >
              {i + 1}
            </div>
            <span className={`text-xs font-medium ${i === step ? "text-foreground" : "text-muted-foreground"}`}>{s}</span>
            {i < STEPS.length - 1 && <div className="w-4 h-px bg-border mx-1" />}
          </div>
        ))}
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>
      )}

      {/* STEP 0 — Personal */}
      {step === 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Personal details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Full name *</label>
              <input className={inputCls} value={form.fullName} onChange={(e) => set({ fullName: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Email *</label>
              <input type="email" className={inputCls} value={form.email} onChange={(e) => set({ email: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Phone / WhatsApp *</label>
              <input className={inputCls} value={form.phone} onChange={(e) => set({ phone: e.target.value })} placeholder="+234..." />
            </div>
            <div>
              <label className={labelCls}>WhatsApp (if different)</label>
              <input className={inputCls} value={form.whatsapp} onChange={(e) => set({ whatsapp: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <LocationFields
                country={form.country}
                state={form.state}
                city={form.city}
                onChange={(v) => set({ country: v.country ?? form.country, state: v.state ?? form.state, city: v.city ?? form.city })}
              />
            </div>
            <div>
              <label className={labelCls}>Date of birth</label>
              <input type="date" className={inputCls} value={form.dateOfBirth} onChange={(e) => set({ dateOfBirth: e.target.value })} />
            </div>
            <div>
              <label className={labelCls}>Profile photo</label>
              <label className="flex items-center gap-2 rounded-md border border-dashed border-input px-3 py-2 text-sm cursor-pointer hover:bg-muted/50">
                <Upload className="h-4 w-4 text-muted-foreground" />
                <span className="truncate">{photo ? photo.name : "Choose image (PNG/JPEG, max 5MB)"}</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>
          </div>
          <label className="flex items-start gap-3 rounded-lg border p-3 text-sm">
            <input type="checkbox" className="mt-0.5" checked={form.ageConfirmed} onChange={(e) => set({ ageConfirmed: e.target.checked })} />
            <span>I confirm that I am 18 years of age or older. *</span>
          </label>
        </div>
      )}

      {/* STEP 1 — Creator info + social profiles */}
      {step === 1 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Creator information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Primary content category *</label>
              <select className={inputCls} value={form.primaryCategory} onChange={(e) => set({ primaryCategory: e.target.value })}>
                <option value="">Select…</option>
                {CONTENT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Secondary category</label>
              <select className={inputCls} value={form.secondaryCategory} onChange={(e) => set({ secondaryCategory: e.target.value })}>
                <option value="">None</option>
                {CONTENT_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Creating content for</label>
              <select className={inputCls} value={form.experienceYears} onChange={(e) => set({ experienceYears: e.target.value })}>
                <option value="">Select…</option>
                {EXPERIENCE_OPTIONS.map((o) => (
                  <option key={o} value={o}>{o === "<1" ? "Less than a year" : `${o} years`}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>Languages used for content *</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {LANGUAGES.map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => toggleLanguage(l)}
                  className={`rounded-full border px-3 py-1 text-sm ${form.languages.includes(l) ? "bg-retail text-white border-retail" : "bg-background"}`}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className={labelCls}>Short creator biography</label>
            <textarea className={inputCls} rows={3} value={form.bio} onChange={(e) => set({ bio: e.target.value })} placeholder="Who are you and what do you create?" />
          </div>

          <div className="pt-2">
            <h3 className="font-semibold mb-1">Social accounts *</h3>
            <p className={hintCls + " mb-3"}>Add at least one public creator profile.</p>
            <div className="space-y-4">
              {profiles.map((p, i) => (
                <div key={i} className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Profile {i + 1}</span>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <input
                          type="radio"
                          name="primaryProfile"
                          checked={p.isPrimary}
                          onChange={() => setProfiles((ps) => ps.map((x, idx) => ({ ...x, isPrimary: idx === i })))}
                        />
                        Primary
                      </label>
                      {profiles.length > 1 && (
                        <button type="button" onClick={() => setProfiles((ps) => ps.filter((_, idx) => idx !== i))} className="text-red-600 hover:text-red-700">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className={labelCls}>Platform</label>
                      <select className={inputCls} value={p.platform} onChange={(e) => updateProfile(i, { platform: e.target.value })}>
                        {CREATOR_PLATFORMS.map((pl) => <option key={pl} value={pl}>{CREATOR_PLATFORM_LABELS[pl]}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Username</label>
                      <input className={inputCls} value={p.username} onChange={(e) => updateProfile(i, { username: e.target.value })} placeholder="@handle" />
                    </div>
                    <div className="md:col-span-2">
                      <label className={labelCls}>Profile URL *</label>
                      <input className={inputCls} value={p.profileUrl} onChange={(e) => updateProfile(i, { profileUrl: e.target.value })} placeholder="https://…" />
                    </div>
                    <div>
                      <label className={labelCls}>Followers / subscribers</label>
                      <input type="number" min={0} className={inputCls} value={p.followers} onChange={(e) => updateProfile(i, { followers: e.target.value })} />
                    </div>
                    <div>
                      <label className={labelCls}>Typical views</label>
                      <input type="number" min={0} className={inputCls} value={p.typicalViews} onChange={(e) => updateProfile(i, { typicalViews: e.target.value })} />
                    </div>
                    <div className="md:col-span-2">
                      <label className={labelCls}>Typical engagement (if known)</label>
                      <input className={inputCls} value={p.typicalEngagement} onChange={(e) => updateProfile(i, { typicalEngagement: e.target.value })} placeholder="e.g. ~4% engagement, 200 avg comments" />
                    </div>
                  </div>
                </div>
              ))}
              {profiles.length < 7 && (
                <Button type="button" variant="outline" size="sm" onClick={() => setProfiles((ps) => [...ps, emptyProfile()])}>
                  <Plus className="h-4 w-4 mr-1" /> Add another profile
                </Button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* STEP 2 — Audience */}
      {step === 2 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Your audience</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Primary audience</label>
              <input className={inputCls} value={form.primaryAudience} onChange={(e) => set({ primaryAudience: e.target.value })} placeholder="e.g. Young entrepreneurs, market traders" />
            </div>
            <div>
              <label className={labelCls}>Approximate audience age range</label>
              <select className={inputCls} value={form.audienceAgeRange} onChange={(e) => set({ audienceAgeRange: e.target.value })}>
                <option value="">Select…</option>
                {AGE_RANGES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Main audience locations</label>
              <input className={inputCls} value={form.audienceLocations} onChange={(e) => set({ audienceLocations: e.target.value })} placeholder="e.g. Lagos, Abuja, Kano" />
              <p className={hintCls}>Separate locations with commas.</p>
            </div>
            <div>
              <label className={labelCls}>Are business owners/entrepreneurs part of your audience?</label>
              <select className={inputCls} value={form.audienceHasBusinessOwners} onChange={(e) => set({ audienceHasBusinessOwners: e.target.value })}>
                <option value="">Select…</option>
                <option value="yes">Yes</option>
                <option value="no">No / not sure</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className={labelCls}>Industries your audience is interested in</label>
              <input className={inputCls} value={form.audienceIndustries} onChange={(e) => set({ audienceIndustries: e.target.value })} placeholder="e.g. Retail, Fashion, Food, Technology" />
              <p className={hintCls}>Separate with commas.</p>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3 — Portfolio */}
      {step === 3 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Portfolio</h2>
          <p className="text-sm text-muted-foreground">
            Share 2–5 links to content you&apos;re proud of. These can be posts, videos or campaigns on any platform.
          </p>
          <div className="space-y-3">
            {portfolio.map((p, i) => (
              <div key={i} className="flex gap-2 items-start">
                <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-2">
                  <input
                    className={`${inputCls} md:col-span-2`}
                    value={p.url}
                    onChange={(e) => setPortfolio((ps) => ps.map((x, idx) => (idx === i ? { ...x, url: e.target.value } : x)))}
                    placeholder={`Content URL ${i + 1} *`}
                  />
                  <input
                    className={inputCls}
                    value={p.note}
                    onChange={(e) => setPortfolio((ps) => ps.map((x, idx) => (idx === i ? { ...x, note: e.target.value } : x)))}
                    placeholder="Note (optional)"
                  />
                </div>
                {portfolio.length > 2 && (
                  <button type="button" onClick={() => setPortfolio((ps) => ps.filter((_, idx) => idx !== i))} className="text-red-600 hover:text-red-700 mt-2">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
          {portfolio.length < 5 && (
            <Button type="button" variant="outline" size="sm" onClick={() => setPortfolio((ps) => [...ps, { url: "", note: "" }])}>
              <Plus className="h-4 w-4 mr-1" /> Add another link
            </Button>
          )}
        </div>
      )}

      {/* STEP 4 — Statement */}
      {step === 4 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Creator statement</h2>
          <div>
            <label className={labelCls}>Why would you like to become a MartPoint Creator? *</label>
            <textarea className={inputCls} rows={5} value={form.whyCreator} onChange={(e) => set({ whyCreator: e.target.value })} />
          </div>
          <div>
            <label className={labelCls}>How would you introduce MartPoint to business owners in your own style? *</label>
            <textarea className={inputCls} rows={5} value={form.introduceMartpoint} onChange={(e) => set({ introduceMartpoint: e.target.value })} placeholder="Imagine you're explaining MartPoint to a shop owner who follows you…" />
          </div>
        </div>
      )}

      {/* STEP 5 — Consent + review */}
      {step === 5 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Consent &amp; review</h2>
          <div className="rounded-lg border bg-muted/40 p-4 text-sm space-y-1">
            <p><span className="text-muted-foreground">Name:</span> {form.fullName}</p>
            <p><span className="text-muted-foreground">Email:</span> {form.email}</p>
            <p><span className="text-muted-foreground">Location:</span> {[form.city, form.state].filter(Boolean).join(", ")}</p>
            <p><span className="text-muted-foreground">Category:</span> {form.primaryCategory}{form.secondaryCategory ? `, ${form.secondaryCategory}` : ""}</p>
            <p><span className="text-muted-foreground">Profiles:</span> {profiles.filter((p) => p.profileUrl.trim()).length} linked</p>
            <p><span className="text-muted-foreground">Portfolio:</span> {portfolio.filter((p) => p.url.trim()).length} links</p>
          </div>
          <div className="space-y-3">
            {(
              [
                ["consentAccurate", "The information I have provided is accurate."],
                ["consentPublicReview", "MartPoint may review publicly available content on the profiles I submitted."],
                ["consentRules", "My participation is subject to the Creator Network rules."],
                ["consentNoGuarantee", "I understand that applying does not guarantee acceptance or payment."],
              ] as const
            ).map(([key, text]) => (
              <label key={key} className="flex items-start gap-3 rounded-lg border p-3 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={form[key]}
                  onChange={(e) => set({ [key]: e.target.checked })}
                />
                <span>{text} *</span>
              </label>
            ))}
          </div>
          <CaptchaField ref={captchaRef} onChange={setCaptcha} className="flex justify-center" />
        </div>
      )}

      {/* Nav */}
      <div className="mt-8 flex items-center justify-between">
        <Button type="button" variant="outline" onClick={() => { setError(""); setStep((s) => Math.max(0, s - 1)) }} disabled={step === 0 || submitting}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button type="button" onClick={next}>
            Continue <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button type="button" onClick={handleSubmit} disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Submit Application
          </Button>
        )}
      </div>
    </div>
  )
}
