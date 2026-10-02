"use client"

import { useCallback, useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Loader2, ArrowLeft, Sparkles, CalendarClock, CheckCircle2,
  PauseCircle, XCircle, Ban, ExternalLink, StickyNote,
} from "lucide-react"
import { enumLabel } from "@/lib/utils"

interface ApplicationDetail {
  id: string
  referenceNumber: string
  fullName: string
  email: string
  phone: string
  whatsapp: string | null
  state: string | null
  city: string | null
  dateOfBirth: string | null
  primaryCategory: string
  secondaryCategory: string | null
  languages: string[]
  bio: string | null
  experienceYears: string | null
  primaryAudience: string | null
  audienceLocations: string[]
  audienceAgeRange: string | null
  audienceHasBusinessOwners: boolean | null
  audienceIndustries: string[]
  portfolioLinks: { url: string; note?: string }[]
  whyCreator: string | null
  introduceMartpoint: string | null
  status: string
  statusHistory: { status: string; at: string; by?: string | null; reason?: string | null }[]
  reviewedByName: string | null
  decisionReason: string | null
  createdCreatorId: string | null
  submittedAt: string
}

interface Social { id: string; platform: string; profileUrl: string; username: string | null; followers: number | null; typicalViews: number | null; isPrimary: boolean }
interface Interview { id: string; status: string; scheduledAt: string | null; durationMinutes: number; meetingUrl: string | null; meetingLocation: string | null; interviewerName: string | null; notes: string | null; result: string | null }
interface Note { id: string; note: string; authorName: string | null; createdAt: string }
interface AiReview {
  id: string; status: string; total_score: number | null; recommendation: string | null
  score_profile_completeness: number | null; score_content_quality: number | null
  score_audience_fit: number | null; score_engagement_quality: number | null
  score_communication: number | null; score_geographic_value: number | null
  score_brand_safety: number | null
  strengths: string[]; concerns: string[]; suggested_questions: string[]
  audience_fit_summary: string | null; suggested_tier: string | null
  data_notes: string | null; error_message: string | null; created_at: string
}

const inputCls = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm"

const REC_LABEL: Record<string, string> = {
  STRONG_CANDIDATE: "Strong Candidate",
  REVIEW: "Needs Review",
  FURTHER_VERIFICATION: "Further Verification Required",
}

function ScoreBar({ label, score, max }: { label: string; score: number | null; max: number }) {
  const v = score ?? 0
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{v}/{max}</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted">
        <div className="h-full rounded-full bg-retail" style={{ width: `${(v / max) * 100}%` }} />
      </div>
    </div>
  )
}

export default function CreatorApplicationDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [loading, setLoading] = useState(true)
  const [application, setApplication] = useState<ApplicationDetail | null>(null)
  const [socials, setSocials] = useState<Social[]>([])
  const [interviews, setInterviews] = useState<Interview[]>([])
  const [notes, setNotes] = useState<Note[]>([])
  const [aiReviews, setAiReviews] = useState<AiReview[]>([])

  const [busy, setBusy] = useState<string | null>(null)
  const [reason, setReason] = useState("")
  const [noteText, setNoteText] = useState("")
  const [showInterview, setShowInterview] = useState(false)
  const [interviewAt, setInterviewAt] = useState("")
  const [interviewDuration, setInterviewDuration] = useState(30)
  const [interviewLocation, setInterviewLocation] = useState("")
  const [interviewNotes, setInterviewNotes] = useState("")
  const [toast, setToast] = useState("")

  const load = useCallback(() => {
    return fetch(`/api/admin/creators/applications/${id}`)
      .then((res) => res.json().then((d) => ({ ok: res.ok, d })))
      .then(({ ok, d }) => {
        if (ok) {
          setApplication(d.application)
          setSocials(d.socials || [])
          setInterviews(d.interviews || [])
          setNotes(d.notes || [])
          setAiReviews(d.aiReviews || [])
        }
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [id])

  useEffect(() => {
    let cancelled = false
    fetch(`/api/admin/creators/applications/${id}`)
      .then((res) => res.json().then((d) => ({ ok: res.ok, d })))
      .then(({ ok, d }) => {
        if (cancelled) return
        if (ok) {
          setApplication(d.application)
          setSocials(d.socials || [])
          setInterviews(d.interviews || [])
          setNotes(d.notes || [])
          setAiReviews(d.aiReviews || [])
        }
        setLoading(false)
      })
      .catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [id])

  async function act(action: string, fn: () => Promise<Response>, okMessage: string) {
    setBusy(action)
    try {
      const res = await fn()
      const d = await res.json()
      setToast(res.ok ? okMessage : d.error || "Action failed")
      if (res.ok) await load()
    } finally {
      setBusy(null)
      setTimeout(() => setToast(""), 5000)
    }
  }

  const decide = (status: string) =>
    act(status, () =>
      fetch(`/api/admin/creators/applications/${id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, reason: reason || null }),
      }), `Status → ${status}`)

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
  }
  if (!application) {
    return <p className="text-muted-foreground py-16 text-center">Application not found.</p>
  }

  const latestAi = aiReviews[0]

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push("/admin/creators/applications")}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Back
        </Button>
        <div>
          <h2 className="text-xl font-bold tracking-tight">
            {application.fullName} <span className="text-sm font-mono text-muted-foreground">{application.referenceNumber}</span>
          </h2>
          <p className="text-sm text-muted-foreground">
            Status: <span className="font-medium">{enumLabel(application.status)}</span>
            {application.reviewedByName ? ` · by ${application.reviewedByName}` : ""}
          </p>
        </div>
      </div>

      {toast && <p className="rounded-md bg-muted px-4 py-2 text-sm">{toast}</p>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: applicant info */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-sm">Applicant</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <div><span className="text-muted-foreground">Email:</span> {application.email}</div>
              <div><span className="text-muted-foreground">Phone:</span> {application.phone}</div>
              {application.whatsapp && <div><span className="text-muted-foreground">WhatsApp:</span> {application.whatsapp}</div>}
              <div><span className="text-muted-foreground">Location:</span> {[application.city, application.state].filter(Boolean).join(", ") || "—"}</div>
              {application.dateOfBirth && <div><span className="text-muted-foreground">DOB:</span> {application.dateOfBirth}</div>}
              <div><span className="text-muted-foreground">Category:</span> {application.primaryCategory}{application.secondaryCategory ? ` / ${application.secondaryCategory}` : ""}</div>
              <div><span className="text-muted-foreground">Languages:</span> {application.languages.join(", ") || "—"}</div>
              <div><span className="text-muted-foreground">Experience:</span> {application.experienceYears || "—"}</div>
              {application.bio && <div className="col-span-2 mt-2"><span className="text-muted-foreground">Bio:</span><p className="mt-1">{application.bio}</p></div>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm">Social Profiles</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {socials.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                  <div>
                    <p className="font-medium">{s.platform}{s.isPrimary ? " · primary" : ""}{s.username ? ` · ${s.username}` : ""}</p>
                    <a href={s.profileUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-retail hover:underline break-all inline-flex items-center gap-1">
                      {s.profileUrl} <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <div className="text-right text-xs text-muted-foreground shrink-0">
                    {s.followers != null && <p>{s.followers.toLocaleString()} followers</p>}
                    {s.typicalViews != null && <p>{s.typicalViews.toLocaleString()} avg views</p>}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm">Audience & Portfolio</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div><span className="text-muted-foreground">Primary audience:</span> {application.primaryAudience || "—"}</div>
              <div><span className="text-muted-foreground">Locations:</span> {application.audienceLocations.join(", ") || "—"}</div>
              <div><span className="text-muted-foreground">Age range:</span> {application.audienceAgeRange || "—"}</div>
              <div><span className="text-muted-foreground">Business owners in audience:</span> {application.audienceHasBusinessOwners == null ? "—" : application.audienceHasBusinessOwners ? "Yes" : "No"}</div>
              <div><span className="text-muted-foreground">Industries:</span> {application.audienceIndustries.join(", ") || "—"}</div>
              <div>
                <span className="text-muted-foreground">Portfolio:</span>
                <ul className="mt-1 space-y-1">
                  {application.portfolioLinks.map((p, i) => (
                    <li key={i}>
                      <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-retail hover:underline break-all inline-flex items-center gap-1 text-xs">
                        {p.url} <ExternalLink className="w-3 h-3" />
                      </a>
                      {p.note && <span className="text-xs text-muted-foreground"> — {p.note}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm">Creator Statement</CardTitle></CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">Why become a MartPoint Creator?</p>
                <p className="whitespace-pre-wrap">{application.whyCreator}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">How would you introduce MartPoint?</p>
                <p className="whitespace-pre-wrap">{application.introduceMartpoint}</p>
              </div>
            </CardContent>
          </Card>

          {/* Interviews */}
          <Card>
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><CalendarClock className="w-4 h-4" /> Interviews</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {interviews.length === 0 && <p className="text-sm text-muted-foreground">No interviews scheduled.</p>}
              {interviews.map((iv) => (
                <div key={iv.id} className="rounded-lg border p-3 text-sm">
                  <div className="flex justify-between">
                    <p className="font-medium">{iv.scheduledAt ? new Date(iv.scheduledAt).toLocaleString("en-GB") : "—"} · {iv.durationMinutes}m</p>
                    <span className="text-xs rounded-full bg-muted px-2 py-0.5">{enumLabel(iv.status)}</span>
                  </div>
                  {iv.meetingUrl && <a href={iv.meetingUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-retail hover:underline">{iv.meetingUrl}</a>}
                  {iv.meetingLocation && <p className="text-xs text-muted-foreground">Location: {iv.meetingLocation}</p>}
                  {iv.interviewerName && <p className="text-xs text-muted-foreground">Interviewer: {iv.interviewerName}</p>}
                  {iv.result && <p className="text-xs mt-1"><span className="text-muted-foreground">Result:</span> {iv.result}</p>}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Right column: AI review + actions + notes */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2"><Sparkles className="w-4 h-4 text-retail" /> AI Assessment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!latestAi || latestAi.status !== "COMPLETED" ? (
                <p className="text-sm text-muted-foreground">
                  {latestAi?.status === "FAILED" ? `Last run failed: ${latestAi.error_message || "error"}` : "No assessment yet."}
                </p>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-3xl font-bold">{latestAi.total_score}<span className="text-sm text-muted-foreground">/100</span></p>
                    <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-semibold">
                      {REC_LABEL[latestAi.recommendation || ""] || latestAi.recommendation}
                    </span>
                  </div>
                  <div className="space-y-2">
                    <ScoreBar label="Profile completeness" score={latestAi.score_profile_completeness} max={10} />
                    <ScoreBar label="Content quality" score={latestAi.score_content_quality} max={20} />
                    <ScoreBar label="Audience fit" score={latestAi.score_audience_fit} max={20} />
                    <ScoreBar label="Engagement quality" score={latestAi.score_engagement_quality} max={15} />
                    <ScoreBar label="Communication" score={latestAi.score_communication} max={15} />
                    <ScoreBar label="Geographic value" score={latestAi.score_geographic_value} max={10} />
                    <ScoreBar label="Brand safety" score={latestAi.score_brand_safety} max={10} />
                  </div>
                  {latestAi.strengths?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold uppercase text-green-700 mb-1">Strengths</p>
                      <ul className="text-xs space-y-1 list-disc pl-4">{latestAi.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul>
                    </div>
                  )}
                  {latestAi.concerns?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold uppercase text-amber-700 mb-1">Concerns</p>
                      <ul className="text-xs space-y-1 list-disc pl-4">{latestAi.concerns.map((s, i) => <li key={i}>{s}</li>)}</ul>
                    </div>
                  )}
                  {latestAi.suggested_questions?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">Suggested interview questions</p>
                      <ul className="text-xs space-y-1 list-disc pl-4">{latestAi.suggested_questions.map((s, i) => <li key={i}>{s}</li>)}</ul>
                    </div>
                  )}
                  {latestAi.data_notes && (
                    <p className="text-xs text-muted-foreground border-t pt-2">{latestAi.data_notes}</p>
                  )}
                  {latestAi.suggested_tier && (
                    <p className="text-xs"><span className="text-muted-foreground">Suggested tier:</span> {latestAi.suggested_tier}</p>
                  )}
                </>
              )}
              <Button
                size="sm" variant="outline" className="w-full"
                disabled={busy === "ai"}
                onClick={() => act("ai", () =>
                  fetch(`/api/admin/creators/applications/${id}/ai-review`, { method: "POST" }), "AI assessment completed")}
              >
                {busy === "ai" ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
                {latestAi ? "Re-run AI Assessment" : "Run AI Assessment"}
              </Button>
              <p className="text-[11px] text-muted-foreground">AI recommends — the final decision is always yours.</p>
            </CardContent>
          </Card>

          {/* Decision panel */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Decision</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {application.createdCreatorId ? (
                <p className="text-sm text-green-700 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" /> Approved — creator account created.
                </p>
              ) : (
                <>
                  <textarea
                    className={inputCls}
                    rows={2}
                    placeholder="Reason / internal note (required for reject & suspend)"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Button size="sm" disabled={!!busy} onClick={() => decide("APPROVED")}>
                      {busy === "APPROVED" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-1" />}
                      Approve
                    </Button>
                    <Button size="sm" variant="outline" disabled={!!busy} onClick={() => decide("WAITLISTED")}>
                      <PauseCircle className="w-3.5 h-3.5 mr-1" /> Waitlist
                    </Button>
                    <Button size="sm" variant="outline" disabled={!!busy} onClick={() => decide("MANUAL_REVIEW")}>
                      Manual Review
                    </Button>
                    <Button size="sm" variant="outline" disabled={!!busy} onClick={() => setShowInterview((v) => !v)}>
                      <CalendarClock className="w-3.5 h-3.5 mr-1" /> Interview
                    </Button>
                    <Button size="sm" variant="outline" className="text-red-600" disabled={!!busy || !reason.trim()} onClick={() => decide("REJECTED")}>
                      <XCircle className="w-3.5 h-3.5 mr-1" /> Reject
                    </Button>
                    <Button size="sm" variant="outline" className="text-red-600" disabled={!!busy || !reason.trim()} onClick={() => decide("SUSPENDED")}>
                      <Ban className="w-3.5 h-3.5 mr-1" /> Suspend
                    </Button>
                  </div>
                </>
              )}

              {showInterview && !application.createdCreatorId && (
                <div className="border-t pt-3 space-y-2">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Schedule interview</p>
                  <input type="datetime-local" className={inputCls} value={interviewAt} onChange={(e) => setInterviewAt(e.target.value)} />
                  <div className="grid grid-cols-2 gap-2">
                    <input type="number" min={10} max={240} className={inputCls} value={interviewDuration} onChange={(e) => setInterviewDuration(Number(e.target.value))} placeholder="Minutes" />
                    <input className={inputCls} value={interviewLocation} onChange={(e) => setInterviewLocation(e.target.value)} placeholder="Location (optional)" />
                  </div>
                  <textarea className={inputCls} rows={2} value={interviewNotes} onChange={(e) => setInterviewNotes(e.target.value)} placeholder="Notes for the applicant (optional)" />
                  <Button
                    size="sm" className="w-full"
                    disabled={!!busy || !interviewAt}
                    onClick={() => act("interview", () =>
                      fetch(`/api/admin/creators/applications/${id}/interviews`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          scheduledAt: new Date(interviewAt).toISOString(),
                          durationMinutes: interviewDuration,
                          meetingLocation: interviewLocation || null,
                          notes: interviewNotes || null,
                        }),
                      }), "Interview scheduled — invite emailed")}
                  >
                    {busy === "interview" ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                    Schedule & Send Invite
                  </Button>
                  <p className="text-[11px] text-muted-foreground">A Google Meet link is attached automatically when the workspace calendar is connected.</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Internal notes */}
          <Card>
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><StickyNote className="w-4 h-4" /> Internal Notes</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {notes.map((n) => (
                <div key={n.id} className="rounded-lg border p-3 text-xs">
                  <p>{n.note}</p>
                  <p className="text-muted-foreground mt-1">{n.authorName || "—"} · {new Date(n.createdAt).toLocaleString("en-GB")}</p>
                </div>
              ))}
              <div className="space-y-2">
                <textarea className={inputCls} rows={2} value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Add an internal note (never shown to the applicant)" />
                <Button
                  size="sm" variant="outline" className="w-full"
                  disabled={!!busy || !noteText.trim()}
                  onClick={() => act("note", async () => {
                    const r = await fetch(`/api/admin/creators/applications/${id}/notes`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ note: noteText }),
                    })
                    if (r.ok) setNoteText("")
                    return r
                  }, "Note added")}
                >
                  Add Note
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Status history */}
          <Card>
            <CardHeader><CardTitle className="text-sm">History</CardTitle></CardHeader>
            <CardContent>
              <ul className="text-xs space-y-1.5">
                {(application.statusHistory || []).map((h, i) => (
                  <li key={i} className="flex justify-between gap-2">
                    <span className="font-medium">{enumLabel(h.status)}</span>
                    <span className="text-muted-foreground text-right">
                      {h.by ? `${h.by} · ` : ""}{new Date(h.at).toLocaleString("en-GB")}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
