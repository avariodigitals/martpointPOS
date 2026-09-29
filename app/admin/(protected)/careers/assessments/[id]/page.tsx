"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, ArrowLeft, Send, Video, MapPin } from "lucide-react"

interface Assessment {
  id: string; name: string; assessment_type: string; instructions: string | null
  max_score: number; pass_score: number | null; scheduled_at: string | null
  duration_minutes: number | null; meeting_link: string | null; meeting_provider: string | null
  meeting_location: string | null
  status: string; career_vacancies: { title?: string } | null
}
interface CandRow {
  id: string; application_id: string | null; candidate_id: string | null
  name: string; email: string; reference: string; application_status?: string
  score: number | null; passed: boolean | null; notes: string | null; invited_at: string | null; completed_at: string | null
}
interface ShortlistApp { id: string; full_name: string; reference_number: string; status: string }

export default function AssessmentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [loading, setLoading] = useState(true)
  const [assessment, setAssessment] = useState<Assessment | null>(null)
  const [candidates, setCandidates] = useState<CandRow[]>([])
  const [invitable, setInvitable] = useState<ShortlistApp[]>([])
  const [inviteSel, setInviteSel] = useState<Set<string>>(new Set())
  const [scores, setScores] = useState<Record<string, { score: string; notes: string }>>({})
  const [msg, setMsg] = useState("")
  const [logistics, setLogistics] = useState({ scheduled_at: "", duration_minutes: "", meeting_link: "", meeting_location: "" })

  const syncLogistics = useCallback((a: Assessment | null) => {
    setLogistics({
      scheduled_at: a?.scheduled_at ? new Date(new Date(a.scheduled_at).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "",
      duration_minutes: a?.duration_minutes != null ? String(a.duration_minutes) : "",
      meeting_link: a?.meeting_link || "",
      meeting_location: a?.meeting_location || "",
    })
  }, [])

  const load = useCallback(() => {
    fetch(`/api/admin/careers/assessments/${id}`).then((r) => r.json()).then((d) => {
      setAssessment(d.assessment || null)
      setCandidates(d.candidates || [])
      syncLogistics(d.assessment || null)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [id, syncLogistics])

  useEffect(load, [load])

  // Load shortlisted/verified applications for the linked vacancy to invite.
  useEffect(() => {
    const vacId = assessment ? undefined : undefined
    // fetch all shortlisted applications — the API supports vacancyId filter server-side via the vacancy link
    if (!assessment) return
    fetch(`/api/admin/careers/applications?status=SHORTLISTED`).then((r) => r.json())
      .then((d) => setInvitable(d.applications || []))
    void vacId
  }, [assessment])

  async function patch(body: Record<string, unknown>) {
    setMsg("")
    const res = await fetch(`/api/admin/careers/assessments/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    })
    const d = await res.json()
    setMsg(res.ok ? "Saved." : d.error || "Failed")
    if (res.ok) load()
  }

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
  if (!assessment) return <p className="text-sm text-muted-foreground">Assessment not found.</p>

  const invitedIds = new Set(candidates.map((c) => c.application_id).filter(Boolean))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <Link href="/admin/careers/assessments" className="text-xs text-muted-foreground hover:text-retail inline-flex items-center gap-1 mb-1">
            <ArrowLeft className="w-3 h-3" /> Back to assessments
          </Link>
          <h2 className="text-2xl font-bold tracking-tight">{assessment.name}</h2>
          <p className="text-muted-foreground">
            {assessment.assessment_type.replace(/_/g, " ")} · {assessment.career_vacancies?.title || "No vacancy"}
            {assessment.scheduled_at ? ` · ${new Date(assessment.scheduled_at).toLocaleString()}` : ""}
          </p>
        </div>
        <span className="text-sm font-medium px-3 py-1 rounded-full bg-muted">{assessment.status}</span>
      </div>

      {assessment.instructions && (
        <Card><CardContent className="p-4 text-sm whitespace-pre-wrap">{assessment.instructions}</CardContent></Card>
      )}

      {/* Interview logistics — schedule, video link, venue */}
      <Card>
        <CardHeader><CardTitle className="text-base flex items-center gap-2"><Video className="w-4 h-4" /> Interview logistics</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Date &amp; time</p>
              <input type="datetime-local" className="rounded-md border border-input bg-background px-3 py-1.5 text-sm w-full"
                value={logistics.scheduled_at} onChange={(e) => setLogistics((l) => ({ ...l, scheduled_at: e.target.value }))} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Duration (minutes)</p>
              <input type="number" min={5} className="rounded-md border border-input bg-background px-3 py-1.5 text-sm w-full"
                value={logistics.duration_minutes} onChange={(e) => setLogistics((l) => ({ ...l, duration_minutes: e.target.value }))} placeholder="45" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Meeting link (optional)</p>
              <input type="url" className="rounded-md border border-input bg-background px-3 py-1.5 text-sm w-full"
                value={logistics.meeting_link} onChange={(e) => setLogistics((l) => ({ ...l, meeting_link: e.target.value }))} placeholder="https://meet.google.com/…" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">In-person venue (optional)</p>
              <input className="rounded-md border border-input bg-background px-3 py-1.5 text-sm w-full"
                value={logistics.meeting_location} onChange={(e) => setLogistics((l) => ({ ...l, meeting_location: e.target.value }))} placeholder="e.g. MartPoint office, Osogbo" />
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <Button size="sm" variant="outline" onClick={() => patch({
              scheduled_at: logistics.scheduled_at ? new Date(logistics.scheduled_at).toISOString() : null,
              duration_minutes: logistics.duration_minutes ? Number(logistics.duration_minutes) : null,
              meeting_link: logistics.meeting_link || null,
              meeting_location: logistics.meeting_location || null,
            })}>Save logistics</Button>
            {assessment.meeting_link ? (
              <a href={assessment.meeting_link} target="_blank" className="text-xs text-retail hover:underline inline-flex items-center gap-1">
                <Video className="w-3 h-3" /> {assessment.meeting_provider || "Meeting link"} saved
              </a>
            ) : assessment.assessment_type === "INTERVIEW" ? (
              <p className="text-xs text-muted-foreground">
                Leave the link empty and a Google Meet link is generated automatically when invites are sent (if Google is connected).
              </p>
            ) : null}
            {assessment.meeting_location && (
              <span className="text-xs text-muted-foreground inline-flex items-center gap-1"><MapPin className="w-3 h-3" /> {assessment.meeting_location}</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Invite candidates */}
      <Card>
        <CardHeader><CardTitle className="text-base">Invite shortlisted applicants</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {invitable.filter((a) => !invitedIds.has(a.id)).length === 0 ? (
            <p className="text-sm text-muted-foreground">No shortlisted applicants available to invite.</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {invitable.filter((a) => !invitedIds.has(a.id)).map((a) => (
                  <label key={a.id} className="flex items-center gap-2 text-sm border border-border rounded-md px-2.5 py-1.5">
                    <input type="checkbox" className="accent-retail" checked={inviteSel.has(a.id)}
                      onChange={() => setInviteSel((s) => { const n = new Set(s); if (n.has(a.id)) n.delete(a.id); else n.add(a.id); return n })} />
                    {a.full_name} <span className="text-xs text-muted-foreground font-mono">{a.reference_number}</span>
                  </label>
                ))}
              </div>
              <Button size="sm" disabled={inviteSel.size === 0} onClick={() => {
                const sendInvites = window.confirm(
                  assessment.assessment_type === "INTERVIEW"
                    ? "Send interview invitations now? A meeting link and calendar invite (.ics) are included automatically."
                    : "Send invitation emails now?"
                )
                patch({ invite: [...inviteSel].map((applicationId) => ({ applicationId })), sendInvites })
                setInviteSel(new Set())
              }}>
                <Send className="w-3.5 h-3.5" /> Invite {inviteSel.size || ""}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Score entry */}
      <Card>
        <CardHeader><CardTitle className="text-base">Candidates & scores</CardTitle></CardHeader>
        <CardContent className="p-0">
          {candidates.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No candidates invited yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs uppercase text-muted-foreground border-b border-border">
                <th className="py-3 px-4">Candidate</th><th className="py-3 px-4">Reference</th><th className="py-3 px-4">Invited</th>
                <th className="py-3 px-4">Score (/{assessment.max_score})</th><th className="py-3 px-4">Result</th><th className="py-3 px-4">Notes</th>
              </tr></thead>
              <tbody>
                {candidates.map((c) => (
                  <tr key={c.id} className="border-b border-border">
                    <td className="py-3 px-4">{c.name}<p className="text-xs text-muted-foreground">{c.email}</p></td>
                    <td className="py-3 px-4 font-mono text-xs">{c.reference}</td>
                    <td className="py-3 px-4 text-xs text-muted-foreground">{c.invited_at ? new Date(c.invited_at).toLocaleDateString() : "—"}</td>
                    <td className="py-3 px-4 w-28">
                      <input type="number" min={0} max={assessment.max_score}
                        className="w-20 rounded-md border border-input bg-background px-2 py-1 text-sm"
                        value={scores[c.id]?.score ?? (c.score ?? "")}
                        onChange={(e) => setScores((s) => ({ ...s, [c.id]: { score: e.target.value, notes: s[c.id]?.notes ?? c.notes ?? "" } }))} />
                    </td>
                    <td className="py-3 px-4 text-xs">
                      {c.passed === true ? <span className="text-green-600 font-medium">Pass</span>
                        : c.passed === false ? <span className="text-red-600 font-medium">Fail</span> : "—"}
                    </td>
                    <td className="py-3 px-4">
                      <input className="rounded-md border border-input bg-background px-2 py-1 text-xs w-40"
                        value={scores[c.id]?.notes ?? (c.notes || "")}
                        onChange={(e) => setScores((s) => ({ ...s, [c.id]: { score: s[c.id]?.score ?? String(c.score ?? ""), notes: e.target.value } }))} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button size="sm" onClick={() => patch({
          scores: candidates.map((c) => ({
            id: c.id,
            score: scores[c.id]?.score !== undefined ? scores[c.id].score : c.score,
            notes: scores[c.id]?.notes !== undefined ? scores[c.id].notes : c.notes,
          })),
        })}>Save scores</Button>
        <Button size="sm" variant="outline" onClick={() => patch({ status: "COMPLETED" })}>Mark completed</Button>
        {msg && <p className="text-xs text-muted-foreground">{msg}</p>}
      </div>
    </div>
  )
}
