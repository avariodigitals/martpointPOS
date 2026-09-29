"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, FileText, Download, StickyNote, ArrowLeft, MailPlus, X } from "lucide-react"
import { APPLICATION_STATUSES, APPLICATION_STATUS_LABELS, applicationStatusLabel } from "@/lib/careers"

interface AppData {
  id: string; reference_number: string; full_name: string; email: string
  phone: string | null; whatsapp: string | null
  state: string | null; lga: string | null; city: string | null; residential_area: string | null
  employment_status: string | null; earliest_available_date: string | null
  available_working_hours: boolean | null; available_full_duration: boolean | null
  can_travel_to_location: boolean | null; requires_accommodation: boolean | null
  other_work_cities: string | null
  highest_qualification: string | null; field_of_study: string | null
  current_occupation: string | null; years_experience: number | null
  work_history: string | null; skills: string[] | null
  excel_proficiency: string | null; inventory_software_experience: string | null
  owns_android: boolean | null; smartphone_model: string | null
  has_mobile_data: boolean | null; owns_laptop: boolean | null
  owns_power_bank: boolean | null; transportation: string | null
  linkedin_url: string | null; portfolio_url: string | null
  status: string; review_score: number | null; screening_score: number | null
  screening_passed: boolean | null; assigned_reviewer_id: string | null
  consent_accuracy: boolean; consent_privacy: boolean; consent_talent_pool: boolean
  consent_notifications: boolean; source: string; submitted_at: string
  offer_sent_at: string | null
  offer_details: { compensation?: string; startDate?: string; location?: string; sentBy?: string } | null
  career_vacancies: { id: string; title: string; slug: string; reference_number: string } | null
}
interface Answer {
  id: string; question_text?: string; answer_type?: string
  answer_text: string | null; answer_json: { options?: string[] } | null
  file_document_id: string | null
}
interface Doc { id: string; kind: string; original_filename: string | null; mime_type: string | null; file_size: number | null; created_at: string }
interface Hist { id: string; previous_status: string | null; new_status: string; reason: string | null; changed_by_name: string | null; created_at: string }
interface Note { id: string; note: string; author_name: string | null; created_at: string }
interface OtherApp { id: string; reference_number: string; status: string; submitted_at: string; career_vacancies: { title?: string } | null }

const inputCls = "rounded-md border border-input bg-background px-3 py-1.5 text-sm"

function fmtAnswer(a: Answer): string {
  if (a.answer_json?.options?.length) return a.answer_json.options.join(", ")
  if (a.file_document_id) return a.answer_text || "(file attached)"
  return a.answer_text || "—"
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === null || value === undefined || value === "") return null
  return (
    <div>
      <p className="text-[11px] uppercase text-muted-foreground">{label}</p>
      <p className="text-sm">{value}</p>
    </div>
  )
}

export default function ApplicationDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [loading, setLoading] = useState(true)
  const [app, setApp] = useState<AppData | null>(null)
  const [answers, setAnswers] = useState<Answer[]>([])
  const [documents, setDocuments] = useState<Doc[]>([])
  const [history, setHistory] = useState<Hist[]>([])
  const [notes, setNotes] = useState<Note[]>([])
  const [others, setOthers] = useState<OtherApp[]>([])
  const [reviewers, setReviewers] = useState<{ id: string; name: string }[]>([])
  const [newNote, setNewNote] = useState("")
  const [statusSel, setStatusSel] = useState("")
  const [reason, setReason] = useState("")
  const [score, setScore] = useState("")
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState("")
  const [offerOpen, setOfferOpen] = useState(false)
  const [offer, setOffer] = useState({ employmentType: "", location: "", compensation: "", startDate: "", workSchedule: "", benefits: "", terms: "", responseNote: "" })
  const [offerBusy, setOfferBusy] = useState(false)

  const load = useCallback(() => {
    Promise.all([
      fetch(`/api/admin/careers/applications/${id}`).then((r) => r.json()),
      fetch("/api/admin/careers/settings").then((r) => r.json()),
    ]).then(([d, m]) => {
      setApp(d.application || null)
      setAnswers(d.answers || [])
      setDocuments(d.documents || [])
      setHistory(d.history || [])
      setNotes(d.notes || [])
      setOthers(d.otherApplications || [])
      setReviewers(m.admins || [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [id])

  useEffect(load, [load])

  async function patch(body: Record<string, unknown>) {
    setBusy(true); setMsg("")
    const res = await fetch(`/api/admin/careers/applications/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    })
    const d = await res.json()
    setBusy(false)
    if (!res.ok) { setMsg(d.error || "Failed"); return }
    setMsg("Saved.")
    load()
  }

  async function addNote() {
    if (!newNote.trim()) return
    await fetch(`/api/admin/careers/applications/${id}/notes`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ note: newNote }),
    })
    setNewNote("")
    load()
  }

  async function sendOffer() {
    setOfferBusy(true)
    const res = await fetch(`/api/admin/careers/applications/${id}/offer`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(Object.entries(offer).filter(([, v]) => v.trim()))),
    })
    const d = await res.json()
    setOfferBusy(false)
    if (!res.ok) { setMsg(d.error || "Failed to send offer"); return }
    setOfferOpen(false)
    setMsg(d.emailSent ? "Offer letter emailed to the applicant." : "Offer recorded — email delivery failed (check notification log).")
    load()
  }

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
  if (!app) return <p className="text-sm text-muted-foreground">Application not found.</p>

  const equipmentBadges: string[] = [
    app.owns_android ? "Android phone" : null,
    app.has_mobile_data ? "Mobile data" : null,
    app.owns_laptop ? "Laptop" : null,
    app.owns_power_bank ? "Power bank" : null,
    app.smartphone_model ? `Model: ${app.smartphone_model}` : null,
    app.transportation ? `Transport: ${app.transportation}` : null,
  ].filter((x): x is string => Boolean(x))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <Link href="/admin/careers/applications" className="text-xs text-muted-foreground hover:text-retail inline-flex items-center gap-1 mb-1">
            <ArrowLeft className="w-3 h-3" /> Back to pipeline
          </Link>
          <h2 className="text-2xl font-bold tracking-tight">{app.full_name}</h2>
          <p className="text-muted-foreground">
            <span className="font-mono">{app.reference_number}</span>
            {app.career_vacancies && <> · {app.career_vacancies.title}</>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {app.offer_sent_at && (
            <span className="text-xs px-2.5 py-1 rounded-full bg-green-50 text-green-700 border border-green-200">
              Offer sent {new Date(app.offer_sent_at).toLocaleDateString()}
            </span>
          )}
          <Button size="sm" variant="outline" onClick={() => setOfferOpen(true)}>
            <MailPlus className="w-3.5 h-3.5" /> {app.offer_sent_at ? "Resend offer" : "Send offer letter"}
          </Button>
          <span className="text-sm font-medium px-3 py-1 rounded-full bg-muted">{applicationStatusLabel(app.status)}</span>
        </div>
      </div>

      {/* Review controls */}
      <Card>
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Change status</p>
            <select className={inputCls + " w-full"} value={statusSel} onChange={(e) => setStatusSel(e.target.value)}>
              <option value="">Select…</option>
              {APPLICATION_STATUSES.filter((s) => s !== app.status).map((s) => (
                <option key={s} value={s}>{APPLICATION_STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Reason / note (recorded in history)</p>
            <input className={inputCls + " w-full"} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Review score (0–100)</p>
            <input type="number" min={0} max={100} className={inputCls + " w-full"} value={score || (app.review_score ?? "")} onChange={(e) => setScore(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button size="sm" disabled={busy || (!statusSel && !score)} onClick={() => {
              const body: Record<string, unknown> = {}
              if (statusSel) {
                body.status = statusSel
                body.reason = reason || null
                body.notify = window.confirm("Send the applicant a status notification email?")
              }
              if (score) body.reviewScore = Number(score)
              patch(body)
            }}>
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Apply"}
            </Button>
            <select className={inputCls} defaultValue={app.assigned_reviewer_id || ""}
              onChange={(e) => patch({ assignedReviewerId: e.target.value || null })}>
              <option value="">Unassigned reviewer</option>
              {reviewers.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
        </CardContent>
      </Card>
      {msg && <p className="text-xs text-muted-foreground">{msg}</p>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Applicant info */}
        <Card>
          <CardHeader><CardTitle className="text-base">Applicant information</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <Field label="Email" value={app.email} />
            <Field label="Phone" value={app.phone} />
            <Field label="WhatsApp" value={app.whatsapp} />
            <Field label="Location" value={[app.residential_area, app.city, app.lga, app.state].filter(Boolean).join(", ")} />
            <Field label="Employment status" value={app.employment_status} />
            <Field label="Earliest start" value={app.earliest_available_date ? new Date(app.earliest_available_date).toLocaleDateString() : null} />
            <Field label="Available for hours" value={app.available_working_hours === null ? null : app.available_working_hours ? "Yes" : "No"} />
            <Field label="Full duration" value={app.available_full_duration === null ? null : app.available_full_duration ? "Yes" : "No"} />
            <Field label="Can travel" value={app.can_travel_to_location === null ? null : app.can_travel_to_location ? "Yes" : "No"} />
            <Field label="Needs accommodation" value={app.requires_accommodation === null ? null : app.requires_accommodation ? "Yes" : "No"} />
            <Field label="Other cities" value={app.other_work_cities} />
            <Field label="Qualification" value={app.highest_qualification} />
            <Field label="Field of study" value={app.field_of_study} />
            <Field label="Occupation" value={app.current_occupation} />
            <Field label="Experience" value={app.years_experience != null ? `${app.years_experience} yrs` : null} />
            <Field label="Skills" value={app.skills?.join(", ")} />
            <Field label="Excel proficiency" value={app.excel_proficiency} />
            <Field label="Inventory software" value={app.inventory_software_experience} />
            <Field label="LinkedIn" value={app.linkedin_url ? <a href={app.linkedin_url} target="_blank" className="text-retail hover:underline">Profile</a> : null} />
            <Field label="Portfolio" value={app.portfolio_url ? <a href={app.portfolio_url} target="_blank" className="text-retail hover:underline">Link</a> : null} />
            {equipmentBadges.length > 0 && (
              <div className="col-span-2">
                <p className="text-[11px] uppercase text-muted-foreground mb-1">Equipment</p>
                <div className="flex flex-wrap gap-1.5">
                  {equipmentBadges.map((b) => (
                    <span key={b} className="text-xs bg-muted px-2 py-0.5 rounded">{b}</span>
                  ))}
                </div>
              </div>
            )}
            {app.work_history && (
              <div className="col-span-2">
                <p className="text-[11px] uppercase text-muted-foreground">Work history</p>
                <p className="text-sm whitespace-pre-wrap">{app.work_history}</p>
              </div>
            )}
            <div className="col-span-2 flex flex-wrap gap-3 text-xs text-muted-foreground pt-1">
              <span>Screening: {app.screening_score != null ? `${app.screening_score}%` : "—"}{app.screening_passed != null ? ` (${app.screening_passed ? "pass" : "fail"})` : ""}</span>
              <span>Consents: accuracy {app.consent_accuracy ? "✓" : "✗"} · privacy {app.consent_privacy ? "✓" : "✗"} · talent pool {app.consent_talent_pool ? "✓" : "✗"}</span>
              <span>Source: {app.source}</span>
            </div>
          </CardContent>
        </Card>

        {/* Screening answers + documents */}
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Screening answers</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {answers.length === 0 ? <p className="text-sm text-muted-foreground">No answers recorded.</p> :
                answers.map((a) => (
                  <div key={a.id} className="text-sm border-b border-border pb-2 last:border-0">
                    <p className="text-xs text-muted-foreground">{a.question_text}</p>
                    <p className="mt-0.5">{fmtAnswer(a)}</p>
                  </div>
                ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Documents</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {documents.length === 0 ? <p className="text-sm text-muted-foreground">No documents uploaded.</p> :
                documents.map((d) => (
                  <div key={d.id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                      <span className="truncate">{d.original_filename || d.kind}</span>
                      <span className="text-xs text-muted-foreground">({d.kind})</span>
                    </div>
                    <a href={`/api/admin/careers/applications/${id}/documents/${d.id}`} target="_blank"
                      className="text-xs text-retail hover:underline inline-flex items-center gap-1 shrink-0">
                      <Download className="w-3 h-3" /> Open
                    </a>
                  </div>
                ))}
            </CardContent>
          </Card>

          {others.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Previous applications</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {others.map((o) => (
                  <div key={o.id} className="text-sm flex items-center justify-between">
                    <span className="font-mono text-xs">{o.reference_number}</span>
                    <span className="text-xs text-muted-foreground">{o.career_vacancies?.title} — {applicationStatusLabel(o.status)}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Internal notes */}
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><StickyNote className="w-4 h-4" /> Internal notes</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <input className={inputCls + " flex-1"} placeholder="Add a note…" value={newNote}
                onChange={(e) => setNewNote(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addNote()} />
              <Button size="sm" variant="outline" onClick={addNote}>Add</Button>
            </div>
            {notes.map((n) => (
              <div key={n.id} className="text-sm border-b border-border pb-2 last:border-0">
                <p>{n.note}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{n.author_name || "Admin"} · {new Date(n.created_at).toLocaleString()}</p>
              </div>
            ))}
            {notes.length === 0 && <p className="text-sm text-muted-foreground">No notes yet.</p>}
          </CardContent>
        </Card>

        {/* Status history */}
        <Card>
          <CardHeader><CardTitle className="text-base">Status history</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {history.length === 0 ? <p className="text-sm text-muted-foreground">No status changes yet.</p> :
              history.map((h) => (
                <div key={h.id} className="text-sm border-b border-border pb-2 last:border-0">
                  <p>
                    {h.previous_status ? <span>{applicationStatusLabel(h.previous_status)} → </span> : null}
                    <strong>{applicationStatusLabel(h.new_status)}</strong>
                  </p>
                  {h.reason && <p className="text-xs text-muted-foreground italic">{h.reason}</p>}
                  <p className="text-xs text-muted-foreground">{h.changed_by_name || "System"} · {new Date(h.created_at).toLocaleString()}</p>
                </div>
              ))}
          </CardContent>
        </Card>
      </div>

      {/* Offer letter dialog */}
      {offerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOfferOpen(false)}>
          <div className="w-full max-w-lg rounded-xl border border-border bg-card shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <h3 className="font-semibold">Send offer letter</h3>
                <p className="text-xs text-muted-foreground">Emailed to {app.email}. Blank fields fall back to the vacancy details.</p>
              </div>
              <button onClick={() => setOfferOpen(false)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-3">
              {([
                ["employmentType", "Employment type", "e.g. Project-based"],
                ["location", "Work location", "e.g. Ilobu, Osun State"],
                ["compensation", "Compensation", "e.g. ₦10,000 daily + ₦2,000 transport"],
                ["workSchedule", "Working schedule", "e.g. Mon–Fri, 8:00 AM–5:00 PM"],
                ["benefits", "Benefits & support", "e.g. Lunch and water provided daily"],
                ["responseNote", "Response instructions", "e.g. Reply within 3 working days"],
              ] as const).map(([k, label, ph]) => (
                <div key={k}>
                  <p className="text-xs text-muted-foreground mb-1">{label}</p>
                  <input className={inputCls + " w-full"} placeholder={ph} value={offer[k]}
                    onChange={(e) => setOffer((o) => ({ ...o, [k]: e.target.value }))} />
                </div>
              ))}
              <div>
                <p className="text-xs text-muted-foreground mb-1">Start date</p>
                <input type="date" className={inputCls + " w-full"} value={offer.startDate}
                  onChange={(e) => setOffer((o) => ({ ...o, startDate: e.target.value }))} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Additional terms (optional)</p>
                <textarea rows={3} className={inputCls + " w-full"} value={offer.terms}
                  onChange={(e) => setOffer((o) => ({ ...o, terms: e.target.value }))}
                  placeholder="e.g. This offer is subject to satisfactory identity verification…" />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border">
              <Button size="sm" variant="outline" onClick={() => setOfferOpen(false)}>Cancel</Button>
              <Button size="sm" disabled={offerBusy} onClick={sendOffer}>
                {offerBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MailPlus className="w-3.5 h-3.5" />}
                Send offer letter
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
