"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Loader2, Plus, RefreshCw, Sparkles } from "lucide-react"
import { DEFAULT_GROWTH_QUESTIONS, type GrowthQuestion } from "@/lib/business-growth-policy"
import { GrowthQuestionnaireEditor } from "@/components/admin/growth-questionnaire-editor"

type Programme = { id: string; name: string; slug: string; status: string; opens_at: string | null; closes_at: string | null; sponsored_duration_months: number; applicationCount: number; awardCount: number; plan_snapshot: Record<string, unknown> }
const input = "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
const label = "block text-sm font-medium text-slate-700"
const defaultTerms = "Three selected businesses may receive the standard MartPoint Basic licence for one store for the stated sponsored period. Selection is not guaranteed by applying or being shortlisted. Standard onboarding is limited to the stated programme allowance. Hardware, custom development and feature modifications are excluded. Optional SMS and email credits and payment processing charges are separate. Renewal is optional, paid at the price communicated before expiry, and no future charge is authorised by accepting this sponsorship. Applicants agree to participate in onboarding and brief progress reviews. Publicity, case studies, photographs and testimonials require separate consent."
const defaultPrivacy = "Application details are used to assess eligibility, administer selection, contact applicants, deliver the sponsored offer and measure programme adoption. Contact details are not sent to the AI assessment provider. Programme records are retained for operational, audit and legal needs under MartPoint's retention policy. Marketing updates are optional and separate from application processing."

export function BusinessGrowthProgrammes() {
  const router = useRouter()
  const [programmes, setProgrammes] = useState<Programme[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [form, setForm] = useState({ name: "MartPoint Business Growth Programme", slug: "business-growth-programme", description: "We’re selecting three operating businesses to receive a sponsored MartPoint Basic licence for one store. Tell us about your business, what you want to improve, and how you would use MartPoint. Simple, honest answers are welcome; writing quality will not affect selection.", opensAt: "", closesAt: "", onboardingScope: "", exclusions: "No hardware, custom development or feature modifications. SMS and email credits are optional paid purchases; payment processing charges remain separate.", renewalPriceNote: "Renewal after sponsorship is optional at the price communicated before expiry.", termsText: defaultTerms, privacyText: defaultPrivacy, capabilityReference: "", questions: DEFAULT_GROWTH_QUESTIONS as GrowthQuestion[] })

  async function load() {
    setLoading(true); setError("")
    try {
      const response = await fetch("/api/admin/programmes", { cache: "no-store" })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || "Could not load programmes")
      setProgrammes(data.programmes || [])
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load programmes") }
    finally { setLoading(false) }
  }
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load() }, [])

  async function create(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("")
    try {
      const response = await fetch("/api/admin/programmes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, opensAt: new Date(form.opensAt).toISOString(), closesAt: new Date(form.closesAt).toISOString() }) })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || "Could not create programme")
      router.push(`/admin/programmes/${data.programme.id}`)
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not create programme") }
    finally { setBusy(false) }
  }

  async function programmeAction(programme: Programme, action: string) {
    const reason = window.prompt(`Reason for ${action} ${programme.name}:`)
    if (!reason?.trim()) return
    setBusy(true); setError(""); setMessage("")
    try {
      const response = await fetch(`/api/admin/programmes/${programme.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, reason }) })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || `Could not ${action} programme`)
      setMessage(`Programme ${action} complete.`)
      await load()
    } catch (cause) { setError(cause instanceof Error ? cause.message : `Could not ${action} programme`) }
    finally { setBusy(false) }
  }

  return <div className="mx-auto max-w-6xl space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-retail">Growth</p><h1 className="mt-1 text-3xl font-bold tracking-tight">Business Growth Programme</h1><p className="mt-2 max-w-3xl text-sm text-slate-600">Collect applications, assess product fit with AI, keep selection human-approved, and track sponsored licence activation and adoption.</p></div><button type="button" onClick={() => setCreating((value) => !value)} className="inline-flex items-center gap-2 rounded-lg bg-retail px-4 py-2.5 text-sm font-semibold text-white"><Plus className="h-4 w-4" />Create programme</button></header>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}{message && <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
    {creating && <form onSubmit={create} className="space-y-5 rounded-2xl border bg-white p-5 shadow-sm sm:p-7"><div><h2 className="text-xl font-semibold">Programme setup</h2><p className="mt-1 text-sm text-slate-500">The programme remains a draft until an admin checks the offer and publishes it.</p></div>
      <div className="grid gap-4 sm:grid-cols-2"><label className={label}>Programme name<input required maxLength={120} className={input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label><label className={label}>Public URL slug<input required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" className={input} value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} /></label><label className={`${label} sm:col-span-2`}>Description<textarea required minLength={20} maxLength={4000} rows={3} className={input} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label><label className={label}>Opening date and time<input required type="datetime-local" className={input} value={form.opensAt} onChange={(e) => setForm({ ...form, opensAt: e.target.value })} /></label><label className={label}>Closing date and time<input required type="datetime-local" className={input} value={form.closesAt} onChange={(e) => setForm({ ...form, closesAt: e.target.value })} /></label><label className={`${label} sm:col-span-2`}>Included standard onboarding scope<textarea required minLength={10} rows={3} className={input} value={form.onboardingScope} onChange={(e) => setForm({ ...form, onboardingScope: e.target.value })} placeholder="Describe onboarding time, channels and included setup work" /></label><label className={`${label} sm:col-span-2`}>Exclusions<textarea required minLength={10} rows={2} className={input} value={form.exclusions} onChange={(e) => setForm({ ...form, exclusions: e.target.value })} /></label><label className={`${label} sm:col-span-2`}>Renewal terms<textarea required minLength={5} rows={2} className={input} value={form.renewalPriceNote} onChange={(e) => setForm({ ...form, renewalPriceNote: e.target.value })} /></label><label className={`${label} sm:col-span-2`}>Programme terms<textarea required minLength={30} rows={5} className={input} value={form.termsText} onChange={(e) => setForm({ ...form, termsText: e.target.value })} /></label><label className={`${label} sm:col-span-2`}>Privacy notice<textarea required minLength={30} rows={5} className={input} value={form.privacyText} onChange={(e) => setForm({ ...form, privacyText: e.target.value })} /></label><label className={`${label} sm:col-span-2`}>Verified Basic capability reference<textarea required minLength={50} rows={7} className={input} value={form.capabilityReference} onChange={(e) => setForm({ ...form, capabilityReference: e.target.value })} placeholder="List only verified Basic features, supported workflows, limits and known exclusions. This text grounds AI assessment." /></label><GrowthQuestionnaireEditor questions={form.questions} onChange={(questions) => setForm({ ...form, questions })} /></div>
      <div className="flex flex-wrap gap-3"><button disabled={busy} className="inline-flex items-center rounded-lg bg-retail px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save draft</button><button type="button" onClick={() => setCreating(false)} className="rounded-lg border px-5 py-2.5 text-sm font-semibold">Cancel</button></div>
    </form>}
    <section className="rounded-2xl border bg-white shadow-sm"><div className="flex items-center justify-between border-b p-4 sm:px-6"><div><h2 className="font-semibold">Programmes</h2><p className="mt-1 text-xs text-slate-500">The selected business receives the existing Basic plan. The award count is capped at three.</p></div><button onClick={() => void load()} className="rounded-lg border p-2" aria-label="Refresh programmes"><RefreshCw className="h-4 w-4" /></button></div>
      {loading ? <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-retail" /></div> : programmes.length ? <div className="divide-y">{programmes.map((programme) => <article key={programme.id} className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{programme.name}</h3><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium">{programme.status}</span></div><p className="mt-1 text-sm text-slate-500">{programme.applicationCount} applications · {programme.awardCount}/3 reserved or active · {programme.sponsored_duration_months} month(s)</p><p className="mt-1 text-xs text-slate-400">/programmes/{programme.slug}</p></div><div className="flex flex-wrap gap-2"><Link href={`/admin/programmes/${programme.id}`} className="rounded-lg border px-3 py-2 text-sm font-medium">Review</Link>{programme.status === "DRAFT" && <button disabled={busy} onClick={() => void programmeAction(programme, "publish")} className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white">Publish</button>}{["OPEN", "SCHEDULED"].includes(programme.status) && <button disabled={busy} onClick={() => void programmeAction(programme, "close")} className="rounded-lg border border-amber-300 px-3 py-2 text-sm font-medium text-amber-800">Close applications</button>}{["REVIEWING", "CLOSED"].includes(programme.status) && <button disabled={busy} onClick={() => void programmeAction(programme, "complete")} className="rounded-lg border border-emerald-300 px-3 py-2 text-sm font-medium text-emerald-800">Complete selection</button>}</div></article>)}</div> : <div className="p-10 text-center text-sm text-slate-500"><Sparkles className="mx-auto mb-3 h-8 w-8 text-slate-300" />No growth programmes yet.</div>}
    </section>
  </div>
}
