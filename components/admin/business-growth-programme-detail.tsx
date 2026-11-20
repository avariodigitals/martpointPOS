"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Loader2, RefreshCw } from "lucide-react"
import { DEFAULT_GROWTH_QUESTIONS, type GrowthQuestion } from "@/lib/business-growth-policy"
import { GrowthQuestionnaireEditor } from "@/components/admin/growth-questionnaire-editor"

// API rows have dynamic Supabase JSON columns; rendering below narrows each field by use.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AppRecord = Record<string, any>
type Detail = { programme: AppRecord; applications: AppRecord[]; awards: AppRecord[]; events: AppRecord[] }
const badge = "inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
const editorInput = "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
const editorLabel = "block text-sm font-medium text-slate-700"

function localDateTime(value: string | null | undefined) {
  if (!value) return ""
  const date = new Date(value)
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
  return local.toISOString().slice(0, 16)
}

function DraftProgrammeEditor({ programme, onCancel, onSaved }: { programme: AppRecord; onCancel: () => void; onSaved: () => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [form, setForm] = useState({
    name: String(programme.name || ""), slug: String(programme.slug || ""), description: String(programme.description || ""),
    opensAt: localDateTime(programme.opens_at), closesAt: localDateTime(programme.closes_at),
    onboardingScope: String(programme.onboarding_scope || ""), exclusions: String(programme.exclusions || ""),
    renewalPriceNote: String(programme.renewal_price_note || ""), termsText: String(programme.terms_text || ""),
    privacyText: String(programme.privacy_text || ""), capabilityReference: String(programme.capability_reference || ""),
    questions: (Array.isArray(programme.questions) ? programme.questions : DEFAULT_GROWTH_QUESTIONS) as GrowthQuestion[],
  })
  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) { setForm((current) => ({ ...current, [key]: value })) }
  async function save(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("")
    try {
      const response = await fetch(`/api/admin/programmes/${programme.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        action: "update_draft", ...form, opensAt: new Date(form.opensAt).toISOString(), closesAt: new Date(form.closesAt).toISOString(),
      }) })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || "Draft could not be saved")
      onSaved()
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Draft could not be saved") }
    finally { setBusy(false) }
  }
  return <form onSubmit={save} className="mt-4 space-y-4 rounded-xl border border-amber-200 bg-amber-50/50 p-4">
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    <div className="grid gap-4 sm:grid-cols-2"><label className={editorLabel}>Programme name<input required minLength={3} maxLength={120} className={editorInput} value={form.name} onChange={(event) => set("name", event.target.value)} /></label><label className={editorLabel}>Public URL slug<input required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" className={editorInput} value={form.slug} onChange={(event) => set("slug", event.target.value)} /></label><label className={`${editorLabel} sm:col-span-2`}>Description<textarea required minLength={20} maxLength={4000} rows={3} className={editorInput} value={form.description} onChange={(event) => set("description", event.target.value)} /></label><label className={editorLabel}>Opens<input required type="datetime-local" className={editorInput} value={form.opensAt} onChange={(event) => set("opensAt", event.target.value)} /></label><label className={editorLabel}>Closes<input required type="datetime-local" className={editorInput} value={form.closesAt} onChange={(event) => set("closesAt", event.target.value)} /></label><label className={`${editorLabel} sm:col-span-2`}>Included onboarding<textarea required minLength={10} maxLength={2000} rows={3} className={editorInput} value={form.onboardingScope} onChange={(event) => set("onboardingScope", event.target.value)} /></label><label className={`${editorLabel} sm:col-span-2`}>Exclusions<textarea required minLength={10} maxLength={1500} rows={2} className={editorInput} value={form.exclusions} onChange={(event) => set("exclusions", event.target.value)} /></label><label className={`${editorLabel} sm:col-span-2`}>Renewal terms<textarea required minLength={5} maxLength={1000} rows={2} className={editorInput} value={form.renewalPriceNote} onChange={(event) => set("renewalPriceNote", event.target.value)} /></label><label className={`${editorLabel} sm:col-span-2`}>Programme terms<textarea required minLength={30} maxLength={8000} rows={5} className={editorInput} value={form.termsText} onChange={(event) => set("termsText", event.target.value)} /></label><label className={`${editorLabel} sm:col-span-2`}>Privacy notice<textarea required minLength={30} maxLength={8000} rows={5} className={editorInput} value={form.privacyText} onChange={(event) => set("privacyText", event.target.value)} /></label><label className={`${editorLabel} sm:col-span-2`}>Verified Basic capability reference<textarea required minLength={50} maxLength={12000} rows={6} className={editorInput} value={form.capabilityReference} onChange={(event) => set("capabilityReference", event.target.value)} /></label><GrowthQuestionnaireEditor questions={form.questions} onChange={(questions) => set("questions", questions)} /></div>
    <div className="flex gap-2"><button disabled={busy} className="rounded-lg bg-retail px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{busy ? "Saving…" : "Save draft"}</button><button type="button" onClick={onCancel} className="rounded-lg border px-4 py-2 text-sm">Cancel</button></div>
  </form>
}

export function BusinessGrowthProgrammeDetail({ id }: { id: string }) {
  const [data, setData] = useState<Detail | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState("")
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const [editingDraft, setEditingDraft] = useState(false)
  const load = useCallback(async () => {
    setLoading(true); setError("")
    try {
      const response = await fetch(`/api/admin/programmes/${id}`, { cache: "no-store" })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || "Programme not found")
      setData(result)
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load programme") }
    finally { setLoading(false) }
  }, [id])
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load() }, [load])

  async function programmeAction(action: string) {
    const reason = window.prompt(`Reason for ${action} this programme:`)
    if (!reason?.trim()) return
    setBusy(action); setError(""); setMessage("")
    try {
      const response = await fetch(`/api/admin/programmes/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, reason }) })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || `Could not ${action} programme`)
      setMessage(`Programme ${action} complete.`); await load()
    } catch (cause) { setError(cause instanceof Error ? cause.message : `Could not ${action} programme`) }
    finally { setBusy("") }
  }

  async function applicationAction(app: AppRecord, action: string) {
    const reason = window.prompt(`Reason for ${action.replaceAll("_", " ")} for ${app.business_name}:`)
    if (!reason?.trim()) return
    let clarificationQuestions: string[] | undefined
    if (action === "needs_clarification") {
      const raw = window.prompt("Enter one clarification question per line:", (app.latestAssessment?.clarification_questions || []).join("\n"))
      clarificationQuestions = (raw || "").split("\n").map((value) => value.trim()).filter(Boolean)
      if (!clarificationQuestions.length) return
    }
    setBusy(`${action}:${app.id}`); setError(""); setMessage("")
    try {
      const response = await fetch(`/api/admin/programmes/applications/${app.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, reason, clarificationQuestions }) })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || `Could not ${action}`)
      setMessage(action === "offer" ? (result.emailSent ? "Offer sent." : "Offer reserved; email delivery needs admin follow-up.") : `${action.replaceAll("_", " ")} saved.`)
      await load()
    } catch (cause) { setError(cause instanceof Error ? cause.message : `Could not ${action}`) }
    finally { setBusy("") }
  }

  async function activate(award: AppRecord) {
    const reason = window.prompt("Activation reason (required if the activation deadline has passed; otherwise leave blank):", "")
    if (reason === null) return
    setBusy(`activate:${award.id}`); setError(""); setMessage("")
    try {
      const response = await fetch(`/api/admin/programmes/awards/${award.id}/activate`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason }) })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || "Activation failed")
      setMessage(result.alreadyActive ? "This award is already active." : "Licence activation confirmed by the licence service.")
      await load()
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Activation failed") }
    finally { setBusy("") }
  }

  if (loading && !data) return <div className="flex justify-center p-16"><Loader2 className="h-6 w-6 animate-spin text-retail" /></div>
  if (!data) return <div className="rounded-xl bg-red-50 p-5 text-sm text-red-800">{error || "Programme not found"}<div className="mt-4"><Link href="/admin/programmes" className="underline">Back to programmes</Link></div></div>
  const programme = data.programme
  const plan = programme.plan_snapshot || {}
  return <div className="mx-auto max-w-7xl space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><Link href="/admin/programmes" className="text-sm text-retail hover:underline">← Business Growth Programme</Link><h1 className="mt-2 text-3xl font-bold">{programme.name}</h1><div className="mt-2 flex flex-wrap gap-2"><span className={badge}>{programme.status}</span><span className={badge}>{programme.award_count} maximum awards</span><span className={badge}>{programme.sponsored_duration_months} months</span><span className={badge}>{plan.name || "Basic"} · ₦{Number(plan.base_price || 0).toLocaleString("en-NG")}</span></div><p className="mt-3 max-w-3xl text-sm text-slate-600">AI assessment is advisory. Review scores and evidence, conduct a readiness conversation, and record a reason for every manual decision.</p></div><button onClick={() => void load()} className="rounded-lg border p-2" aria-label="Refresh"><RefreshCw className="h-4 w-4" /></button></header>
    {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}{message && <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
    {programme.status === "DRAFT" && <section className="rounded-xl border bg-white p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">Draft setup</h2><p className="mt-1 text-sm text-slate-500">Review dates, offer terms, capability reference and questionnaire before publishing.</p></div><button onClick={() => setEditingDraft((value) => !value)} className="rounded-lg border px-4 py-2 text-sm">{editingDraft ? "Close editor" : "Edit draft"}</button></div>{editingDraft && <DraftProgrammeEditor programme={programme} onCancel={() => setEditingDraft(false)} onSaved={() => { setEditingDraft(false); setMessage("Draft saved."); void load() }} />}</section>}
    <section className="grid gap-4 md:grid-cols-3"><article className="rounded-xl border bg-white p-4"><p className="text-sm text-slate-500">Applications</p><p className="mt-1 text-2xl font-bold">{data.applications.length}</p></article><article className="rounded-xl border bg-white p-4"><p className="text-sm text-slate-500">Offered / accepted / active</p><p className="mt-1 text-2xl font-bold">{data.awards.filter((award) => ["OFFERED", "ACCEPTED", "ACTIVATED"].includes(award.status)).length} / {programme.award_count}</p></article><article className="rounded-xl border bg-white p-4"><p className="text-sm text-slate-500">Activation confirmed</p><p className="mt-1 text-2xl font-bold">{data.awards.filter((award) => award.fulfilment_status === "ACTIVE").length}</p></article></section>
    <section className="rounded-xl border bg-white p-5"><h2 className="font-semibold">Offer and launch readiness</h2><div className="mt-3 grid gap-4 text-sm sm:grid-cols-2"><p><strong>Opens:</strong> {programme.opens_at ? new Date(programme.opens_at).toLocaleString("en-NG", { timeZone: "Africa/Lagos" }) : "Not set"}</p><p><strong>Closes:</strong> {programme.closes_at ? new Date(programme.closes_at).toLocaleString("en-NG", { timeZone: "Africa/Lagos" }) : "Not set"}</p><p className="whitespace-pre-line"><strong>Onboarding:</strong> {programme.onboarding_scope}</p><p className="whitespace-pre-line"><strong>Exclusions:</strong> {programme.exclusions}</p><p className="whitespace-pre-line sm:col-span-2"><strong>Verified Basic capability reference:</strong><br />{programme.capability_reference}</p></div><p className="mt-3 text-xs text-slate-500">Programme terms version {programme.terms_version} · Privacy version {programme.privacy_version} · Rubric {programme.rubric_version}</p><div className="mt-4 flex flex-wrap gap-2">{programme.status === "DRAFT" && <button disabled={!!busy} onClick={() => void programmeAction("publish")} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white">Publish</button>}{["OPEN", "SCHEDULED"].includes(programme.status) && <button disabled={!!busy} onClick={() => void programmeAction("close")} className="rounded-lg border px-4 py-2 text-sm">Close applications</button>}{["CLOSED", "REVIEWING"].includes(programme.status) && <button disabled={!!busy} onClick={() => void programmeAction("complete")} className="rounded-lg border px-4 py-2 text-sm">Complete selection and notify remaining applicants</button>}{programme.status === "COMPLETED" && <Link href={`/programmes/${programme.slug}/results`} className="rounded-lg border px-4 py-2 text-sm">Public results page</Link>}</div></section>
    <section className="overflow-hidden rounded-xl border bg-white"><div className="border-b p-4"><h2 className="font-semibold">Applications ({data.applications.length})</h2><p className="mt-1 text-xs text-slate-500">Scores are internal and are not included in applicant notifications. Confirm product fit and readiness in person before offering a place.</p></div><div className="divide-y">{data.applications.length ? data.applications.map((app) => {
      const assessment = app.latestAssessment as AppRecord | null
      const award = app.award as AppRecord | null
      const awardStatus = award ? String(award.status || "") : ""
      return <details key={app.id} className="group p-4 sm:p-5"><summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3"><div><p className="font-semibold">{app.business_name} <span className="ml-1 text-xs font-normal text-slate-500">{app.reference}</span></p><p className="mt-1 text-sm text-slate-500">{app.applicant_name} · {app.industry} · {app.state}, {app.city}</p></div><div className="flex flex-wrap gap-2"><span className={badge}>{app.application_status}</span><span className={badge}>AI: {assessment?.status === "COMPLETED" ? `${assessment.total_score}/100` : app.assessment_status}</span>{award && <span className={badge}>{award.status}{award.fulfilment_status === "FAILED" ? " · activation failed" : ""}</span>}</div></summary>
        <div className="mt-5 space-y-5 border-t pt-5">
          <div className="grid gap-2 text-sm sm:grid-cols-2"><p><strong>Email:</strong> {app.email}</p><p><strong>Phone:</strong> {app.phone}</p><p><strong>Lead:</strong> <Link className="text-retail underline" href={`/admin/leads?id=${app.lead_id}`}>{app.lead_id}</Link></p><p><strong>Submitted:</strong> {new Date(app.submitted_at).toLocaleString("en-NG", { timeZone: "Africa/Lagos" })}</p><p><strong>Marketing consent:</strong> {app.marketing_consent ? `Yes (${app.marketing_consent_at})` : "No"}</p><p><strong>Publicity consent:</strong> {award?.public_announcement_consent_at ? `Yes (${award.public_announcement_consent_at})` : "Not given"}</p></div>
          <div><h3 className="text-sm font-semibold">Applicant answers</h3><dl className="mt-2 grid gap-3 md:grid-cols-2">{Object.entries(app.answers || {}).filter(([key]) => key !== "follow_up_answers").map(([key, value]) => { const question = (app.questions_snapshot || []).find((q: AppRecord) => q.id === key); return <div key={key} className="rounded-lg bg-slate-50 p-3"><dt className="text-xs font-semibold text-slate-500">{question?.label || key}</dt><dd className="mt-1 whitespace-pre-wrap text-sm">{String(value || "—")}</dd></div> })}</dl></div>
          {assessment && assessment.status === "COMPLETED" && <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">AI assessment · {assessment.total_score}/100</h3><span className={badge}>{assessment.recommendation} · model {assessment.model || "unknown"}</span></div><p className="mt-2 text-sm">{assessment.summary}</p><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">{Object.entries(assessment.criteria || {}).map(([key, value]) => <div key={key} className="rounded bg-white p-2 text-xs"><span className="capitalize">{key.replaceAll("_", " ")}</span><strong className="float-right">{String(value)}</strong></div>)}</div>{assessment.eligibility_flags?.length > 0 && <div className="mt-3 rounded bg-amber-50 p-3 text-sm text-amber-900"><strong>Eligibility flags requiring human review:</strong> {assessment.eligibility_flags.join(", ")}</div>}<div className="mt-3 grid gap-3 md:grid-cols-2"><div><h4 className="text-xs font-semibold">Supported needs</h4><p className="mt-1 text-sm">{(assessment.supported_needs || []).join(" · ") || "None identified"}</p></div><div><h4 className="text-xs font-semibold">Unsupported or uncertain needs</h4><p className="mt-1 text-sm">{(assessment.unsupported_needs || []).join(" · ") || "None identified"}</p></div></div><div className="mt-3"><h4 className="text-xs font-semibold">Evidence</h4><ul className="mt-1 list-disc space-y-1 pl-5 text-sm">{(assessment.evidence || []).map((e: AppRecord, index: number) => <li key={index}><strong>{e.question_id}:</strong> “{e.answer_excerpt}” — {e.reason}</li>)}</ul></div>{assessment.clarification_questions?.length > 0 && <p className="mt-3 text-sm"><strong>Suggested clarification:</strong> {assessment.clarification_questions.join(" · ")}</p>}</div>}
          {assessment?.status === "FAILED" && <p className="rounded bg-amber-50 p-3 text-sm text-amber-900">AI assessment failed and remains pending. It was not treated as a rejection. {assessment.error_message}</p>}
          {award?.fulfilment_status === "FAILED" && <p className="rounded bg-red-50 p-3 text-sm text-red-800"><strong>Activation needs review:</strong> {award.activation_error}</p>}
          {award?.status === "ACCEPTED" && award.fulfilment_status !== "ACTIVE" && <button disabled={!!busy} onClick={() => void activate(award)} className="rounded-lg bg-retail px-4 py-2 text-sm font-semibold text-white">{busy === `activate:${award.id}` ? "Activating…" : "Activate sponsored Basic licence"}</button>}
          {award?.status === "OFFERED" && <p className="text-sm text-slate-600">Offer reserved until {new Date(award.offer_expires_at).toLocaleString("en-NG", { timeZone: "Africa/Lagos" })}. <button disabled={!!busy} onClick={() => void applicationAction(app, "offer")} className="ml-1 text-retail underline">Resend offer</button></p>}
          <div className="flex flex-wrap gap-2 border-t pt-4">{assessment?.status === "FAILED" && !["WITHDRAWN", "INELIGIBLE"].includes(app.application_status) && <button disabled={!!busy} onClick={() => void applicationAction(app, "retry_assessment")} className="rounded-lg border px-3 py-2 text-sm">Retry assessment</button>}{app.application_status !== "READY" && app.application_status !== "SHORTLISTED" && !["WITHDRAWN", "INELIGIBLE"].includes(app.application_status) && assessment?.status === "COMPLETED" && <button disabled={!!busy} onClick={() => void applicationAction(app, "ready")} className="rounded-lg border px-3 py-2 text-sm">Mark ready</button>}{assessment?.status === "COMPLETED" && ["READY", "NEEDS_CLARIFICATION"].includes(app.application_status) && !["COMPLETED", "ARCHIVED"].includes(programme.status) && <button disabled={!!busy} onClick={() => void applicationAction(app, "shortlist")} className="rounded-lg border px-3 py-2 text-sm">Shortlist</button>}{!['NEEDS_CLARIFICATION', 'WITHDRAWN', 'INELIGIBLE'].includes(app.application_status) && !["OFFERED", "ACCEPTED", "ACTIVATED"].includes(awardStatus) && <button disabled={!!busy} onClick={() => void applicationAction(app, "needs_clarification")} className="rounded-lg border px-3 py-2 text-sm">Request clarification</button>}{app.application_status === "SHORTLISTED" && !award && ["CLOSED", "REVIEWING"].includes(programme.status) && <button disabled={!!busy} onClick={() => void applicationAction(app, "offer")} className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white">Offer place</button>}{!award && ["CLOSED", "REVIEWING"].includes(programme.status) && !["WITHDRAWN", "INELIGIBLE"].includes(app.application_status) && <button disabled={!!busy} onClick={() => void applicationAction(app, "waitlist")} className="rounded-lg border px-3 py-2 text-sm">Waitlist</button>}{!award && ["CLOSED", "REVIEWING"].includes(programme.status) && !["WITHDRAWN", "INELIGIBLE"].includes(app.application_status) && <button disabled={!!busy} onClick={() => void applicationAction(app, "not_selected")} className="rounded-lg border px-3 py-2 text-sm">Not selected</button>}{!award && !["WITHDRAWN", "INELIGIBLE"].includes(app.application_status) && <button disabled={!!busy} onClick={() => void applicationAction(app, "ineligible")} className="rounded-lg border border-amber-300 px-3 py-2 text-sm text-amber-800">Mark ineligible</button>}</div>
        </div>
      </details>
    }) : <p className="p-10 text-center text-sm text-slate-500">No applications received yet.</p>}</div></section>
    <section className="rounded-xl border bg-white p-5"><h2 className="font-semibold">Recent programme audit events</h2><div className="mt-3 space-y-2">{data.events.slice(0, 30).map((event) => <div key={event.id} className="flex flex-wrap justify-between gap-2 border-b pb-2 text-xs"><span className="font-medium">{event.event_type}{event.reason ? ` — ${event.reason}` : ""}</span><time className="text-slate-500">{new Date(event.created_at).toLocaleString("en-NG", { timeZone: "Africa/Lagos" })}</time></div>)}</div></section>
    {loading && <p className="text-xs text-slate-400">Refreshing…</p>}
  </div>
}
