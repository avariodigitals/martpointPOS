"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Loader2, ArrowLeft, Trophy, AlertTriangle, Users, FileText, Award,
  Gavel, Megaphone, ScrollText, Settings2, Eye, Plus,
} from "lucide-react"
import { enumLabel } from "@/lib/utils"
import { STATES } from "@/lib/locations"

const field = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
const lbl = "block text-xs font-medium mb-1 text-muted-foreground"

interface Detail {
  challenge: Record<string, unknown> & { id: string }
  awards: { id: string; award_type: string; title: string; description: string | null; winners_count: number; cash_amount_kobo: number | null; non_cash_reward: string | null; judging_criteria: string | null; scoring_config: Record<string, unknown> }[]
  brief: Record<string, unknown> | null
  briefVersion: number | null
  resources: { id: string; required: boolean; resource: { id: string; name: string; category: string } | null }[]
  ruleVersions: { id: string; version: number; reason: string | null; is_material: boolean; created_by_name: string | null; effective_at: string }[]
  participants: { id: string; creatorId: string; creatorName: string; creatorCode: string; state: string | null; status: string; joinedAt: string; rulesVersionAccepted: number; acknowledgedVersion: number | null }[]
  submissions: {
    id: string; creatorId: string; creatorName: string; creatorCode: string
    platform: string; contentUrl: string; trackingToken: string; status: string
    quarantined: boolean; publishedAt: string | null; submittedAt: string
    reviewFeedback: string | null
    metrics: { source: string; verified: boolean; capturedAt: string; views: number | null; likes: number | null; comments: number | null; shares: number | null; engagementRate: number | null } | null
    referrals: { clicks: number; leads: number; demos: number; signups: number; customers: number }
    openFlags: number
  }[]
  flags: { id: string; type: string; severity: string; status: string; description: string; submission_id: string | null; created_at: string }[]
  winners: { id: string; position: number; creators: { full_name: string; creator_id: string } | null; creator_challenge_awards: { title: string; award_type: string } | null; creator_rewards: { status: string; amount_kobo: number } | null }[]
  analytics: {
    participants: number; participantsByState: { state: string; count: number }[]
    submissions: number; approvedSubmissions: number; approvalRate: number
    totalViews: number
    referrals: { clicks: number; leads: number; demos: number; signups: number; customers: number }
  }
}

const TABS = [
  { key: "overview", label: "Overview", icon: Settings2 },
  { key: "brief", label: "Brief", icon: FileText },
  { key: "awards", label: "Awards", icon: Trophy },
  { key: "participants", label: "Participants", icon: Users },
  { key: "submissions", label: "Submissions", icon: FileText },
  { key: "judging", label: "Judging", icon: Gavel },
  { key: "winners", label: "Winners", icon: Award },
  { key: "comms", label: "Communications", icon: Megaphone },
  { key: "rules", label: "Rules", icon: ScrollText },
] as const

const PLATFORMS = ["TIKTOK", "INSTAGRAM", "YOUTUBE", "FACEBOOK", "X", "LINKEDIN", "BLOG", "OTHER"]
const AWARD_TYPES = ["OVERALL", "CONVERSION", "REACH", "CREATIVE", "RISING", "REGIONAL", "CUSTOM"]
const LEVELS = ["STARTER", "CREATOR", "PRO", "ELITE"]

const SUB_STATUS_CLASS: Record<string, string> = {
  SUBMITTED: "bg-blue-100 text-blue-700", UNDER_REVIEW: "bg-amber-100 text-amber-700",
  APPROVED: "bg-green-100 text-green-700", NEEDS_CORRECTION: "bg-orange-100 text-orange-700",
  REJECTED: "bg-red-100 text-red-700", DISQUALIFIED: "bg-red-200 text-red-800",
}

export default function AdminChallengeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [detail, setDetail] = useState<Detail | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("overview")
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const inFlight = useRef(false)

  const load = useCallback(() => {
    fetch(`/api/admin/creators/challenges/${id}`)
      .then((r) => r.json())
      .then(setDetail)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => { load() }, [load])

  const act = useCallback(async (action: string, extra: Record<string, unknown> = {}) => {
    if (inFlight.current) return
    inFlight.current = true
    setBusy(true); setMsg(null)
    try {
      const res = await fetch(`/api/admin/creators/challenges/${id}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...extra }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMsg({ kind: "err", text: data.missing ? `${data.error}: ${data.missing.join(", ")}` : data.error ?? "Failed" })
      } else {
        setMsg({ kind: "ok", text: `Done — ${enumLabel(action)}` })
        load()
      }
    } finally { setBusy(false); inFlight.current = false }
  }, [id, load])

  if (loading || !detail) {
    return <div className="p-10 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" /></div>
  }

  const c = detail.challenge
  const status = c.status as string

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 flex-wrap">
        <Link href="/admin/creators/challenges"><Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4" /></Button></Link>
        <div className="min-w-0 flex-1">
          <h2 className="text-2xl font-bold tracking-tight truncate">{c.name as string}</h2>
          <p className="text-sm text-muted-foreground">
            <span className="font-mono">{c.slug as string}</span> · Rules v{c.rules_version as number}
            {(c.rules_version as number) > 1 && <span className="ml-1 rounded-full bg-amber-100 text-amber-700 px-1.5 py-0.5 text-[10px] font-medium">Amended</span>}
          </p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${{
          DRAFT: "bg-muted", SCHEDULED: "bg-blue-100 text-blue-700", ACTIVE: "bg-green-100 text-green-700",
          SUBMISSION_CLOSED: "bg-amber-100 text-amber-700", JUDGING: "bg-purple-100 text-purple-700",
          COMPLETED: "bg-emerald-100 text-emerald-800", ARCHIVED: "bg-muted text-muted-foreground",
        }[status]}`}>{enumLabel(status)}</span>
        <Link href={`/creator/challenges/${c.id as string}`} target="_blank">
          <Button size="sm" variant="outline"><Eye className="w-3.5 h-3.5 mr-1" /> Creator view</Button>
        </Link>
      </div>

      {/* Lifecycle actions */}
      <div className="flex flex-wrap gap-2">
        {status === "DRAFT" && (
          <>
            <Button size="sm" disabled={busy} onClick={() => act("activate")}>Activate now</Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => act("schedule")}>Schedule</Button>
          </>
        )}
        {status === "SCHEDULED" && <Button size="sm" disabled={busy} onClick={() => act("activate")}>Activate</Button>}
        {status === "ACTIVE" && <Button size="sm" variant="outline" disabled={busy} onClick={() => act("close_submissions")}>Close submissions</Button>}
        {status === "SUBMISSION_CLOSED" && <Button size="sm" variant="outline" disabled={busy} onClick={() => act("start_judging")}>Start judging</Button>}
        {status === "JUDGING" && <Button size="sm" disabled={busy} onClick={() => act("complete")}>Complete challenge</Button>}
        {status === "COMPLETED" && <Button size="sm" variant="outline" disabled={busy} onClick={() => act("archive")}>Archive</Button>}
      </div>

      {msg && <p className={`text-sm ${msg.kind === "ok" ? "text-green-600" : "text-destructive"}`}>{msg.text}</p>}

      <div className="flex flex-wrap gap-1 border-b border-border">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 -mb-px ${tab === key ? "border-retail text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
            <Icon className="w-3.5 h-3.5" /> {label}
          </button>
        ))}
      </div>

      {tab === "overview" && <OverviewTab detail={detail} act={act} busy={busy} reload={load} setMsg={setMsg} />}
      {tab === "brief" && <BriefTab detail={detail} id={id} reload={load} setMsg={setMsg} />}
      {tab === "awards" && <AwardsTab detail={detail} id={id} reload={load} setMsg={setMsg} />}
      {tab === "participants" && <ParticipantsTab detail={detail} />}
      {tab === "submissions" && <SubmissionsTab detail={detail} reload={load} />}
      {tab === "judging" && <JudgingTab detail={detail} id={id} />}
      {tab === "winners" && <WinnersTab detail={detail} id={id} reload={load} />}
      {tab === "comms" && <CommsTab detail={detail} id={id} />}
      {tab === "rules" && <RulesTab detail={detail} />}
    </div>
  )
}

/* ═══ Overview — edit config + analytics ═══ */
function OverviewTab({ detail, reload, setMsg }: { detail: Detail; act: (a: string) => void; busy: boolean; reload: () => void; setMsg: (m: { kind: "ok" | "err"; text: string } | null) => void }) {
  const c = detail.challenge
  const frozen = !!c.rules_frozen_at
  const [form, setForm] = useState({
    name: c.name as string ?? "", description: (c.description as string) ?? "",
    objective: (c.objective as string) ?? "", theme: (c.theme as string) ?? "",
    startDate: toLocal(c.start_date as string), submissionDeadline: toLocal(c.submission_deadline as string),
    performanceCutoff: toLocal(c.performance_cutoff as string), announcementDate: toLocal(c.announcement_date as string),
    joinOpensAt: toLocal(c.join_opens_at as string), joinClosesAt: toLocal(c.join_closes_at as string),
    judgingDate: toLocal(c.judging_date as string),
    eligibleLevels: (c.eligible_levels as string[]) ?? [], eligibleStates: (c.eligible_states as string[]) ?? [],
    eligiblePlatforms: (c.eligible_platforms as string[]) ?? [],
    requiredHashtags: ((c.required_hashtags as string[]) ?? []).join(", "),
    requiredMentions: ((c.required_mentions as string[]) ?? []).join(", "),
    requiredCta: (c.required_cta as string) ?? "",
    contentRequirements: (c.content_requirements as string) ?? "",
    prohibitedClaims: (c.prohibited_claims as string) ?? "",
    judgingCriteria: (c.judging_criteria as string) ?? "",
    terms: (c.terms as string) ?? "",
    minSubmissions: (c.min_submissions as number) ?? 0, maxSubmissions: (c.max_submissions as number | null) ?? null,
    creatorReadyRequired: c.creator_ready_required !== false,
    leaderboardVisible: c.leaderboard_visible !== false,
    featured: !!c.featured,
  })
  const [amendReason, setAmendReason] = useState("")
  const [amendAck, setAmendAck] = useState(false)
  const [saving, setSaving] = useState(false)

  function toLocal(iso: string | null) {
    return iso ? new Date(iso).toISOString().slice(0, 16) : ""
  }
  const toIso = (v: string) => (v ? new Date(v).toISOString() : null)
  const list = (v: string) => v.split(",").map((s) => s.trim()).filter(Boolean)
  const toggle = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v])

  const save = async () => {
    setSaving(true); setMsg(null)
    try {
      const res = await fetch(`/api/admin/creators/challenges/${c.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patch: {
            name: form.name, description: form.description || null, objective: form.objective || null,
            theme: form.theme || null,
            startDate: toIso(form.startDate), submissionDeadline: toIso(form.submissionDeadline),
            performanceCutoff: toIso(form.performanceCutoff), announcementDate: toIso(form.announcementDate),
            joinOpensAt: toIso(form.joinOpensAt), joinClosesAt: toIso(form.joinClosesAt),
            judgingDate: toIso(form.judgingDate),
            eligibleLevels: form.eligibleLevels, eligibleStates: form.eligibleStates,
            eligiblePlatforms: form.eligiblePlatforms,
            requiredHashtags: list(form.requiredHashtags), requiredMentions: list(form.requiredMentions),
            requiredCta: form.requiredCta || null, contentRequirements: form.contentRequirements || null,
            prohibitedClaims: form.prohibitedClaims || null, judgingCriteria: form.judgingCriteria || null,
            terms: form.terms || null, minSubmissions: form.minSubmissions,
            maxSubmissions: form.maxSubmissions, creatorReadyRequired: form.creatorReadyRequired,
            leaderboardVisible: form.leaderboardVisible, featured: form.featured,
          },
          reason: amendReason || undefined,
          confirmMaterialAmendment: amendAck || undefined,
          notifyParticipants: true,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMsg({ kind: "err", text: data.missing ? `${data.error}: ${data.missing.join(", ")}` : `${data.error}${data.materialFields ? ` (${data.materialFields.join(", ")})` : ""}` })
      } else {
        setMsg({ kind: "ok", text: data.materialChanged?.length ? `Saved — material amendment recorded as rules v${data.rulesVersion}` : "Saved" })
        setAmendReason(""); setAmendAck(false)
        reload()
      }
    } finally { setSaving(false) }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <Card className="lg:col-span-2">
        <CardHeader><CardTitle className="text-base">Challenge configuration</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {frozen && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 flex gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>This challenge is live. Changes to material fields (eligibility, deadlines, terms, requirements, judging) create a new immutable rules version and notify participants.</span>
            </div>
          )}
          <div className="grid gap-3 md:grid-cols-2">
            <label className="md:col-span-2"><span className={lbl}>Name</span><input className={field} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label className="md:col-span-2"><span className={lbl}>Short description</span><textarea rows={2} className={field} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
            <label><span className={lbl}>Objective</span><input className={field} value={form.objective} onChange={(e) => setForm({ ...form, objective: e.target.value })} /></label>
            <label><span className={lbl}>Theme</span><input className={field} value={form.theme} onChange={(e) => setForm({ ...form, theme: e.target.value })} /></label>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <label><span className={lbl}>Start date</span><input type="datetime-local" className={field} value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} /></label>
            <label><span className={lbl}>Submission deadline</span><input type="datetime-local" className={field} value={form.submissionDeadline} onChange={(e) => setForm({ ...form, submissionDeadline: e.target.value })} /></label>
            <label><span className={lbl}>Performance cutoff</span><input type="datetime-local" className={field} value={form.performanceCutoff} onChange={(e) => setForm({ ...form, performanceCutoff: e.target.value })} /></label>
            <label><span className={lbl}>Join opens</span><input type="datetime-local" className={field} value={form.joinOpensAt} onChange={(e) => setForm({ ...form, joinOpensAt: e.target.value })} /></label>
            <label><span className={lbl}>Join closes</span><input type="datetime-local" className={field} value={form.joinClosesAt} onChange={(e) => setForm({ ...form, joinClosesAt: e.target.value })} /></label>
            <label><span className={lbl}>Announcement date</span><input type="datetime-local" className={field} value={form.announcementDate} onChange={(e) => setForm({ ...form, announcementDate: e.target.value })} /></label>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <span className={lbl}>Eligible levels (blank = all)</span>
              <div className="flex flex-wrap gap-1.5">{LEVELS.map((l) => (
                <button type="button" key={l} onClick={() => setForm({ ...form, eligibleLevels: toggle(form.eligibleLevels, l) })}
                  className={`rounded-full px-2.5 py-1 text-xs border ${form.eligibleLevels.includes(l) ? "bg-retail text-white border-retail" : "border-input"}`}>{enumLabel(l)}</button>
              ))}</div>
            </div>
            <div>
              <span className={lbl}>Eligible platforms (blank = all)</span>
              <div className="flex flex-wrap gap-1.5">{PLATFORMS.map((p) => (
                <button type="button" key={p} onClick={() => setForm({ ...form, eligiblePlatforms: toggle(form.eligiblePlatforms, p) })}
                  className={`rounded-full px-2.5 py-1 text-xs border ${form.eligiblePlatforms.includes(p) ? "bg-retail text-white border-retail" : "border-input"}`}>{enumLabel(p)}</button>
              ))}</div>
            </div>
            <div>
              <span className={lbl}>States (blank = nationwide)</span>
              <select multiple size={4} className={field} value={form.eligibleStates}
                onChange={(e) => setForm({ ...form, eligibleStates: [...(e.target as HTMLSelectElement).selectedOptions].map((o) => o.value) })}>
                {(STATES.Nigeria ?? []).map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label><span className={lbl}>Required hashtags (comma-separated)</span><input className={field} value={form.requiredHashtags} onChange={(e) => setForm({ ...form, requiredHashtags: e.target.value })} placeholder="#MartPoint, #CreatorChallenge" /></label>
            <label><span className={lbl}>Required mentions</span><input className={field} value={form.requiredMentions} onChange={(e) => setForm({ ...form, requiredMentions: e.target.value })} placeholder="@martpoint" /></label>
            <label><span className={lbl}>Required CTA</span><input className={field} value={form.requiredCta} onChange={(e) => setForm({ ...form, requiredCta: e.target.value })} placeholder="Sign up via the link in bio" /></label>
            <div className="grid grid-cols-2 gap-3">
              <label><span className={lbl}>Min submissions</span><input type="number" min={0} className={field} value={form.minSubmissions} onChange={(e) => setForm({ ...form, minSubmissions: Number(e.target.value) })} /></label>
              <label><span className={lbl}>Max submissions</span><input type="number" min={1} className={field} value={form.maxSubmissions ?? ""} onChange={(e) => setForm({ ...form, maxSubmissions: e.target.value ? Number(e.target.value) : null })} /></label>
            </div>
          </div>

          <label><span className={lbl}>Content requirements</span><textarea rows={3} className={field} value={form.contentRequirements} onChange={(e) => setForm({ ...form, contentRequirements: e.target.value })} /></label>
          <label><span className={lbl}>Prohibited claims / content</span><textarea rows={2} className={field} value={form.prohibitedClaims} onChange={(e) => setForm({ ...form, prohibitedClaims: e.target.value })} /></label>
          <label><span className={lbl}>Judging criteria</span><textarea rows={3} className={field} value={form.judgingCriteria} onChange={(e) => setForm({ ...form, judgingCriteria: e.target.value })} /></label>
          <label><span className={lbl}>Terms &amp; conditions</span><textarea rows={4} className={field} value={form.terms} onChange={(e) => setForm({ ...form, terms: e.target.value })} /></label>

          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.creatorReadyRequired} onChange={(e) => setForm({ ...form, creatorReadyRequired: e.target.checked })} /> Creator Ready required</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.leaderboardVisible} onChange={(e) => setForm({ ...form, leaderboardVisible: e.target.checked })} /> Leaderboard visible</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} /> Featured</label>
          </div>

          {frozen && (
            <div className="rounded-md border border-input p-3 space-y-2">
              <p className="text-xs font-medium">Amendment details (required for material changes on a live challenge)</p>
              <input className={field} placeholder="Reason for the change" value={amendReason} onChange={(e) => setAmendReason(e.target.value)} />
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={amendAck} onChange={(e) => setAmendAck(e.target.checked)} />
                I confirm this is a material amendment — a new rules version will be recorded and participants notified.
              </label>
            </div>
          )}

          <Button onClick={save} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null} Save changes
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Performance</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Row l="Joined participants" v={detail.analytics.participants} />
          <Row l="Submissions" v={detail.analytics.submissions} />
          <Row l="Approved" v={`${detail.analytics.approvedSubmissions} (${detail.analytics.approvalRate}%)`} />
          <Row l="Verified reach (latest snapshots)" v={detail.analytics.totalViews.toLocaleString()} />
          <Row l="Tracked clicks" v={detail.analytics.referrals.clicks} />
          <Row l="Leads" v={detail.analytics.referrals.leads} />
          <Row l="Demo bookings" v={detail.analytics.referrals.demos} />
          <Row l="Signups" v={detail.analytics.referrals.signups} />
          <Row l="Conversions" v={detail.analytics.referrals.customers} />
          {detail.analytics.participantsByState.length > 0 && (
            <div className="pt-2 border-t">
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Participants by state</p>
              {detail.analytics.participantsByState.map((s) => (
                <div key={s.state} className="flex justify-between text-xs py-0.5"><span>{s.state}</span><span className="font-medium">{s.count}</span></div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function Row({ l, v }: { l: string; v: string | number }) {
  return <div className="flex justify-between"><span className="text-muted-foreground">{l}</span><span className="font-medium">{v}</span></div>
}

/* ═══ Brief editor ═══ */
function BriefTab({ detail, id, reload, setMsg }: { detail: Detail; id: string; reload: () => void; setMsg: (m: { kind: "ok" | "err"; text: string } | null) => void }) {
  const b = detail.brief ?? {}
  const arr = (k: string) => ((b[k] as string[] | undefined) ?? []).join("\n")
  const [form, setForm] = useState({
    overview: (b.overview as string) ?? "", audience: (b.audience as string) ?? "",
    keyMessage: (b.keyMessage as string) ?? "",
    directions: arr("directions"), requiredElements: arr("requiredElements"),
    exampleIdeas: arr("exampleIdeas"), submissionInstructions: (b.submissionInstructions as string) ?? "",
    judgingExplainer: (b.judgingExplainer as string) ?? "",
  })
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    const lines = (v: string) => v.split("\n").map((s) => s.trim()).filter(Boolean)
    const res = await fetch(`/api/admin/creators/challenges/${id}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "save_brief",
        brief: {
          overview: form.overview, audience: form.audience, keyMessage: form.keyMessage,
          directions: lines(form.directions), requiredElements: lines(form.requiredElements),
          exampleIdeas: lines(form.exampleIdeas),
          submissionInstructions: form.submissionInstructions, judgingExplainer: form.judgingExplainer,
        },
      }),
    })
    const data = await res.json()
    setMsg(res.ok ? { kind: "ok", text: `Brief saved (v${data.briefVersion})` } : { kind: "err", text: data.error })
    setSaving(false); reload()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Challenge brief {detail.briefVersion ? `(v${detail.briefVersion})` : ""}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <label><span className={lbl}>Overview</span><textarea rows={4} className={field} value={form.overview} onChange={(e) => setForm({ ...form, overview: e.target.value })} placeholder="What this challenge is about…" /></label>
        <div className="grid gap-3 md:grid-cols-2">
          <label><span className={lbl}>Target audience</span><textarea rows={2} className={field} value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })} /></label>
          <label><span className={lbl}>Key message</span><textarea rows={2} className={field} value={form.keyMessage} onChange={(e) => setForm({ ...form, keyMessage: e.target.value })} /></label>
        </div>
        <label><span className={lbl}>Content directions (one per line)</span><textarea rows={3} className={field} value={form.directions} onChange={(e) => setForm({ ...form, directions: e.target.value })} /></label>
        <label><span className={lbl}>Required elements (one per line)</span><textarea rows={3} className={field} value={form.requiredElements} onChange={(e) => setForm({ ...form, requiredElements: e.target.value })} /></label>
        <label><span className={lbl}>Example ideas / hooks (one per line)</span><textarea rows={3} className={field} value={form.exampleIdeas} onChange={(e) => setForm({ ...form, exampleIdeas: e.target.value })} /></label>
        <label><span className={lbl}>Submission instructions</span><textarea rows={3} className={field} value={form.submissionInstructions} onChange={(e) => setForm({ ...form, submissionInstructions: e.target.value })} /></label>
        <label><span className={lbl}>How judging works (shown to creators)</span><textarea rows={2} className={field} value={form.judgingExplainer} onChange={(e) => setForm({ ...form, judgingExplainer: e.target.value })} /></label>
        <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null} Save brief</Button>
        <p className="text-xs text-muted-foreground">Required hashtags, mentions, CTA, prohibited claims and terms are set on the Overview tab and shown to creators alongside this brief.</p>
      </CardContent>
    </Card>
  )
}

/* ═══ Awards editor ═══ */
function AwardsTab({ detail, id, reload, setMsg }: { detail: Detail; id: string; reload: () => void; setMsg: (m: { kind: "ok" | "err"; text: string } | null) => void }) {
  const locked = !!detail.challenge.rules_frozen_at
  const [awards, setAwards] = useState(
    detail.awards.map((a) => ({
      awardType: a.award_type, title: a.title, description: a.description ?? "",
      winnersCount: a.winners_count, cashAmountNaira: a.cash_amount_kobo != null ? a.cash_amount_kobo / 100 : (null as number | null),
      nonCashReward: a.non_cash_reward ?? "", judgingCriteria: a.judging_criteria ?? "",
    })),
  )
  const [saving, setSaving] = useState(false)

  const update = (i: number, k: string, v: unknown) => setAwards((arr) => arr.map((a, j) => (j === i ? { ...a, [k]: v } : a)))
  const add = () => setAwards((arr) => [...arr, { awardType: "CUSTOM", title: "", description: "", winnersCount: 1, cashAmountNaira: null, nonCashReward: "", judgingCriteria: "" }])

  const save = async () => {
    setSaving(true)
    const res = await fetch(`/api/admin/creators/challenges/${id}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "replace_awards", awards: awards.filter((a) => a.title.trim()) }),
    })
    const data = await res.json()
    setMsg(res.ok ? { kind: "ok", text: "Awards saved" } : { kind: "err", text: data.error })
    setSaving(false); reload()
  }

  return (
    <div className="space-y-4">
      {locked && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Awards are locked — the challenge is live. Changing prize values or winner counts requires cancelling/replacing the challenge; editing here is disabled to protect participants.
        </div>
      )}
      {awards.map((a, i) => (
        <Card key={i}>
          <CardContent className="p-4 grid gap-3 md:grid-cols-4">
            <label><span className={lbl}>Type</span>
              <select className={field} disabled={locked} value={a.awardType} onChange={(e) => update(i, "awardType", e.target.value)}>
                {AWARD_TYPES.map((t) => <option key={t} value={t}>{enumLabel(t)}</option>)}
              </select></label>
            <label className="md:col-span-2"><span className={lbl}>Title</span>
              <input className={field} disabled={locked} value={a.title} onChange={(e) => update(i, "title", e.target.value)} placeholder="e.g. Conversion Champion" /></label>
            <label><span className={lbl}>Winners</span>
              <input type="number" min={1} className={field} disabled={locked} value={a.winnersCount} onChange={(e) => update(i, "winnersCount", Number(e.target.value))} /></label>
            <label><span className={lbl}>Cash (₦)</span>
              <input type="number" min={0} className={field} disabled={locked} value={a.cashAmountNaira ?? ""} onChange={(e) => update(i, "cashAmountNaira", e.target.value ? Number(e.target.value) : null)} /></label>
            <label className="md:col-span-2"><span className={lbl}>Non-cash reward</span>
              <input className={field} disabled={locked} value={a.nonCashReward} onChange={(e) => update(i, "nonCashReward", e.target.value)} placeholder="e.g. Feature on MartPoint channels" /></label>
            <label><span className={lbl}>Description</span>
              <input className={field} disabled={locked} value={a.description} onChange={(e) => update(i, "description", e.target.value)} /></label>
            <label className="md:col-span-4"><span className={lbl}>Judging criteria for this award</span>
              <input className={field} disabled={locked} value={a.judgingCriteria} onChange={(e) => update(i, "judgingCriteria", e.target.value)} placeholder="e.g. Quality: originality, clarity, MartPoint accuracy" /></label>
            {!locked && (
              <div><Button size="sm" variant="ghost" onClick={() => setAwards((arr) => arr.filter((_, j) => j !== i))}>Remove</Button></div>
            )}
          </CardContent>
        </Card>
      ))}
      {!locked && (
        <div className="flex gap-2">
          <Button variant="outline" onClick={add}><Plus className="w-4 h-4 mr-1" /> Add award</Button>
          <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null} Save awards</Button>
        </div>
      )}
    </div>
  )
}

/* ═══ Participants ═══ */
function ParticipantsTab({ detail }: { detail: Detail }) {
  return (
    <Card>
      <CardContent className="p-0">
        <table className="w-full text-sm">
          <thead><tr className="border-b text-left text-muted-foreground">
            <th className="p-4 font-medium">Creator</th><th className="p-4 font-medium">State</th>
            <th className="p-4 font-medium">Status</th><th className="p-4 font-medium">Rules v.</th>
            <th className="p-4 font-medium">Joined</th>
          </tr></thead>
          <tbody>
            {detail.participants.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">No participants yet.</td></tr>}
            {detail.participants.map((p) => (
              <tr key={p.id} className="border-b last:border-0">
                <td className="p-4">
                  <Link className="font-medium text-retail hover:underline" href={`/admin/creators/creators/${p.creatorId}`}>{p.creatorName}</Link>
                  <span className="block text-xs text-muted-foreground font-mono">{p.creatorCode}</span>
                </td>
                <td className="p-4 text-xs">{p.state ?? "—"}</td>
                <td className="p-4"><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${p.status === "JOINED" ? "bg-green-100 text-green-700" : p.status === "DISQUALIFIED" ? "bg-red-100 text-red-700" : "bg-muted"}`}>{enumLabel(p.status)}</span></td>
                <td className="p-4 text-xs">v{p.rulesVersionAccepted}{p.acknowledgedVersion ? ` · ack v${p.acknowledgedVersion}` : ""}</td>
                <td className="p-4 text-xs text-muted-foreground">{new Date(p.joinedAt).toLocaleString("en-GB")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  )
}

/* ═══ Submissions ═══ */
function SubmissionsTab({ detail, reload }: { detail: Detail; reload: () => void }) {
  const [feedback, setFeedback] = useState<Record<string, { review: string; internal: string }>>({})
  const setF = (id: string, k: "review" | "internal", v: string) =>
    setFeedback((f) => ({ ...f, [id]: { review: f[id]?.review ?? "", internal: f[id]?.internal ?? "", [k]: v } }))

  const review = async (subId: string, action: string) => {
    const f = feedback[subId] ?? { review: "", internal: "" }
    const res = await fetch(`/api/admin/creators/submissions/${subId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reviewFeedback: f.review || null, decisionReason: f.internal || null }),
    })
    const data = await res.json()
    if (!res.ok) alert(data.error ?? "Failed")
    else reload()
  }

  const addMetric = async (subId: string) => {
    const views = prompt("Views at snapshot:"); if (views == null) return
    const likes = prompt("Likes:") ?? "0"
    const comments = prompt("Comments:") ?? "0"
    const shares = prompt("Shares:") ?? "0"
    const verified = confirm("Mark this snapshot as verified (confirmed against platform/creator evidence)?")
    await fetch(`/api/admin/creators/submissions/${subId}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "metric", verified, views: Number(views), likes: Number(likes), comments: Number(comments), shares: Number(shares) }),
    })
    reload()
  }

  const checkUrl = async (subId: string) => {
    const res = await fetch(`/api/admin/creators/submissions/${subId}`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "check_availability" }),
    })
    const d = await res.json()
    alert(d.available === true ? "Content reachable" : d.available === false ? `Flagged — HTTP ${d.httpStatus}` : (d.note ?? "Could not check"))
    reload()
  }

  return (
    <div className="space-y-3">
      {detail.submissions.length === 0 && <Card><CardContent className="p-8 text-center text-muted-foreground">No submissions yet.</CardContent></Card>}
      {detail.submissions.map((s) => (
        <Card key={s.id}>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <p className="font-medium">{s.creatorName} <span className="font-mono text-xs text-muted-foreground">{s.creatorCode}</span></p>
                <a href={s.contentUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-retail hover:underline break-all">{s.contentUrl}</a>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {enumLabel(s.platform)} · published {s.publishedAt ? new Date(s.publishedAt).toLocaleDateString("en-GB") : "—"} · submitted {new Date(s.submittedAt).toLocaleString("en-GB")}
                </p>
                <p className="text-[10px] font-mono text-muted-foreground">token: {s.trackingToken}</p>
              </div>
              <div className="flex items-center gap-2">
                {s.openFlags > 0 && <span className="rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-xs font-medium">{s.openFlags} flag{s.openFlags > 1 ? "s" : ""}</span>}
                {s.quarantined && <span className="rounded-full bg-red-200 text-red-800 px-2 py-0.5 text-xs font-medium">Quarantined</span>}
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${SUB_STATUS_CLASS[s.status] ?? "bg-muted"}`}>{enumLabel(s.status)}</span>
              </div>
            </div>
            {(s.metrics || s.referrals.clicks > 0) && (
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                {s.metrics && <span>{Number(s.metrics.views ?? 0).toLocaleString()} views · {Number(s.metrics.likes ?? 0)} likes ({s.metrics.source}{s.metrics.verified ? " · verified" : " · unverified"})</span>}
                <span>{s.referrals.clicks} clicks · {s.referrals.leads} leads · {s.referrals.demos} demos · {s.referrals.customers} conversions</span>
              </div>
            )}
            {s.reviewFeedback && <p className="text-xs bg-muted rounded px-2 py-1">Feedback: {s.reviewFeedback}</p>}
            <div className="grid gap-2 md:grid-cols-2">
              <input className={field} placeholder="Creator-visible feedback" value={feedback[s.id]?.review ?? ""} onChange={(e) => setF(s.id, "review", e.target.value)} />
              <input className={field} placeholder="Internal reason (required for reject/disqualify)" value={feedback[s.id]?.internal ?? ""} onChange={(e) => setF(s.id, "internal", e.target.value)} />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => review(s.id, "approve")}>Approve</Button>
              <Button size="sm" variant="outline" onClick={() => review(s.id, "request_correction")}>Request correction</Button>
              <Button size="sm" variant="outline" onClick={() => review(s.id, "reject")}>Reject</Button>
              <Button size="sm" variant="outline" onClick={() => review(s.id, "disqualify")}>Disqualify</Button>
              <Button size="sm" variant="ghost" onClick={() => addMetric(s.id)}>Add metric snapshot</Button>
              <Button size="sm" variant="ghost" onClick={() => checkUrl(s.id)}>Check content live</Button>
              <Link href={`/admin/creators/submissions?focus=${s.id}`} className="text-xs self-center text-retail hover:underline">Full detail →</Link>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

/* ═══ Judging ═══ */
function JudgingTab({ detail, id }: { detail: Detail; id: string }) {
  const [candidates, setCandidates] = useState<Record<string, { creatorId: string; creatorName: string; creatorCode: string; submissionId: string | null; submissionUrl: string | null; verifiedViews: number; clicks: number; leads: number; conversions: number; computedScore: number; scoreBreakdown: Record<string, number>; metricsVerified: boolean; judgeScore: number | null; quarantined: boolean; flagCount: number }[]>>({})
  const [scores, setScores] = useState<{ id: string; award_id: string; creator_id: string; submission_id: string | null; criterion: string; score: number; judge_name: string | null; finalized: boolean }[]>([])
  const [loaded, setLoaded] = useState(false)
  const [criterion, setCriterion] = useState("Overall quality")
  const [busy, setBusy] = useState<string | null>(null)

  const loadScores = useCallback(() => {
    fetch(`/api/admin/creators/challenges/${id}/scores`).then((r) => r.json()).then((d) => {
      setCandidates(d.candidatesByAward ?? {}); setScores(d.scores ?? []); setLoaded(true)
    })
  }, [id])
  useEffect(() => { if (!loaded) loadScores() }, [loaded, loadScores])

  const saveScore = async (awardId: string, c: { creatorId: string; submissionId: string | null }, score: number) => {
    setBusy(`${awardId}:${c.creatorId}`)
    await fetch(`/api/admin/creators/challenges/${id}/scores`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ awardId, submissionId: c.submissionId, creatorId: c.creatorId, criterion, score }),
    })
    setBusy(null); loadScores()
  }

  if (!loaded) return <div className="p-6 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" /></div>

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <label className="text-xs text-muted-foreground">Criterion: <input className="rounded border border-input px-2 py-1 text-sm" value={criterion} onChange={(e) => setCriterion(e.target.value)} /></label>
        <p className="text-xs text-muted-foreground">Scores are saved per judge — multiple judges each keep their own.</p>
      </div>
      {detail.awards.length === 0 && <p className="text-sm text-muted-foreground">No awards configured.</p>}
      {detail.awards.map((a) => (
        <Card key={a.id}>
          <CardHeader><CardTitle className="text-base">{a.title} <span className="text-xs font-normal text-muted-foreground">({enumLabel(a.award_type)} · {a.winners_count} winner{a.winners_count > 1 ? "s" : ""})</span></CardTitle></CardHeader>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left text-muted-foreground text-xs">
                <th className="px-4 py-2 font-medium">Creator</th><th className="px-4 py-2 font-medium">Views</th>
                <th className="px-4 py-2 font-medium">Leads/Conv.</th><th className="px-4 py-2 font-medium">Computed</th>
                <th className="px-4 py-2 font-medium">Judge score</th><th className="px-4 py-2 font-medium">Flags</th>
                <th className="px-4 py-2 font-medium"></th>
              </tr></thead>
              <tbody>
                {(candidates[a.id] ?? []).map((cand) => (
                  <tr key={cand.creatorId} className="border-b last:border-0">
                    <td className="px-4 py-2">
                      <span className="font-medium">{cand.creatorName}</span>
                      <span className="block text-xs text-muted-foreground font-mono">{cand.creatorCode}</span>
                      {cand.submissionUrl && <a href={cand.submissionUrl} target="_blank" rel="noopener noreferrer" className="text-[10px] text-retail hover:underline">view content</a>}
                    </td>
                    <td className="px-4 py-2 text-xs">{cand.verifiedViews.toLocaleString()}{!cand.metricsVerified && <span className="block text-amber-600">unverified</span>}</td>
                    <td className="px-4 py-2 text-xs">{cand.leads} / {cand.conversions}</td>
                    <td className="px-4 py-2 text-xs font-medium">{cand.computedScore}</td>
                    <td className="px-4 py-2 text-xs">{cand.judgeScore != null ? cand.judgeScore.toFixed(1) : "—"}</td>
                    <td className="px-4 py-2 text-xs">
                      {cand.quarantined ? <span className="text-red-600 font-medium">Quarantined</span> : cand.flagCount > 0 ? <span className="text-amber-600">{cand.flagCount}</span> : "—"}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-1">
                        <input type="number" min={0} max={100} className="w-16 rounded border border-input px-1.5 py-1 text-xs" placeholder="0-100"
                          id={`score-${a.id}-${cand.creatorId}`} />
                        <Button size="sm" variant="outline" disabled={busy === `${a.id}:${cand.creatorId}`}
                          onClick={() => { const el = document.getElementById(`score-${a.id}-${cand.creatorId}`) as HTMLInputElement; if (el.value) saveScore(a.id, cand, Number(el.value)) }}>
                          {busy === `${a.id}:${cand.creatorId}` ? <Loader2 className="w-3 h-3 animate-spin" /> : "Save"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {(candidates[a.id] ?? []).length === 0 && <tr><td colSpan={7} className="px-4 py-6 text-center text-muted-foreground text-xs">No approved submissions to judge yet.</td></tr>}
              </tbody>
            </table>
          </CardContent>
        </Card>
      ))}
      <p className="text-xs text-muted-foreground">Recorded scores: {scores.length}. Computed scores rank candidates by award-type rules — final winner selection is always manual on the Winners tab.</p>
    </div>
  )
}

/* ═══ Winners ═══ */
function WinnersTab({ detail, id, reload }: { detail: Detail; id: string; reload: () => void }) {
  const [candidates, setCandidates] = useState<Record<string, { creatorId: string; creatorName: string; creatorCode: string; submissionId: string | null; computedScore: number; quarantined: boolean; flagCount: number; judgeScore: number | null }[]>>({})
  const [selected, setSelected] = useState<Record<string, { creatorId: string; submissionId: string | null; position: number }[]>>({})
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    fetch(`/api/admin/creators/challenges/${id}/scores`).then((r) => r.json()).then((d) => {
      setCandidates(d.candidatesByAward ?? {}); setLoaded(true)
    })
  }, [id])
  useEffect(() => { if (!loaded) load() }, [loaded, load])

  const winnersByAward = new Map<string, typeof detail.winners>()
  for (const w of detail.winners) {
    const aid = (w as unknown as { award_id?: string }).award_id ?? ""
    winnersByAward.set(aid, [...(winnersByAward.get(aid) ?? []), w])
  }

  const finalize = async (awardId: string, awardTitle: string) => {
    const picks = selected[awardId] ?? []
    if (picks.length === 0) return
    if (!confirm(`Finalise ${picks.length} winner${picks.length > 1 ? "s" : ""} for "${awardTitle}"? This creates reward records and notifies the creators.`)) return
    setBusy(true)
    const res = await fetch(`/api/admin/creators/challenges/${id}/winners`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ awardId, winners: picks, confirm: true }),
    })
    const data = await res.json()
    if (!res.ok) alert(data.error ?? "Failed")
    setBusy(false); reload(); load()
  }

  return (
    <div className="space-y-5">
      {detail.awards.map((a) => {
        const existing = winnersByAward.get(a.id) ?? []
        const remaining = a.winners_count - existing.length
        const picks = selected[a.id] ?? []
        return (
          <Card key={a.id}>
            <CardHeader>
              <CardTitle className="text-base flex items-center justify-between">
                <span>{a.title} <span className="text-xs font-normal text-muted-foreground">{a.cash_amount_kobo ? `₦${(a.cash_amount_kobo / 100).toLocaleString()}` : ""}{a.non_cash_reward ? ` · ${a.non_cash_reward}` : ""} · {a.winners_count} winner{a.winners_count > 1 ? "s" : ""}</span></span>
                <span className="text-xs text-muted-foreground">{existing.length}/{a.winners_count} finalised</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {existing.length > 0 && (
                <div className="space-y-1">
                  {existing.map((w) => (
                    <div key={w.id} className="flex items-center justify-between rounded-md bg-green-50 px-3 py-2 text-sm">
                      <span className="font-medium">#{w.position} {w.creators?.full_name ?? "—"} <span className="font-mono text-xs text-muted-foreground">{w.creators?.creator_id}</span></span>
                      <span className="text-xs">Reward: {enumLabel(w.creator_rewards?.status ?? "PENDING")}{w.creator_rewards?.amount_kobo ? ` · ₦${(w.creator_rewards.amount_kobo / 100).toLocaleString()}` : ""}</span>
                    </div>
                  ))}
                </div>
              )}
              {remaining > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Select up to {remaining} winner{remaining > 1 ? "s" : ""} (top candidates by computed score — you decide):</p>
                  {(candidates[a.id] ?? []).slice(0, 15).map((cand) => {
                    const pick = picks.find((p) => p.creatorId === cand.creatorId)
                    return (
                      <div key={cand.creatorId} className={`flex items-center justify-between rounded-md border px-3 py-2 text-sm ${pick ? "border-retail bg-retail/5" : "border-input"} ${cand.quarantined ? "opacity-60" : ""}`}>
                        <span>{cand.creatorName} <span className="font-mono text-xs text-muted-foreground">{cand.creatorCode}</span>
                          {cand.quarantined && <span className="ml-1 text-[10px] text-red-600 font-medium">FLAGGED</span>}
                          {cand.flagCount > 0 && !cand.quarantined && <span className="ml-1 text-[10px] text-amber-600">{cand.flagCount} flag{cand.flagCount > 1 ? "s" : ""}</span>}
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">score {cand.computedScore}{cand.judgeScore != null ? ` · judged ${cand.judgeScore.toFixed(0)}` : ""}</span>
                          <Button size="sm" variant={pick ? "default" : "outline"} disabled={cand.quarantined}
                            onClick={() => setSelected((s) => {
                              const cur = s[a.id] ?? []
                              const next = pick ? cur.filter((p) => p.creatorId !== cand.creatorId)
                                : cur.length < remaining ? [...cur, { creatorId: cand.creatorId, submissionId: cand.submissionId, position: existing.length + cur.length + 1 }] : cur
                              return { ...s, [a.id]: next }
                            })}>
                            {pick ? `Winner #${pick.position}` : "Select"}
                          </Button>
                        </span>
                      </div>
                    )
                  })}
                  {picks.length > 0 && (
                    <Button size="sm" disabled={busy} onClick={() => finalize(a.id, a.title)}>
                      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                      Finalise {picks.length} winner{picks.length > 1 ? "s" : ""}
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )
      })}
      <p className="text-xs text-muted-foreground">Finalising creates a PENDING reward record for each winner and notifies them. Rewards are paid out from Admin → Creator Network → Rewards.</p>
    </div>
  )
}

/* ═══ Communications ═══ */
function CommsTab({ id }: { detail: Detail; id: string }) {
  const [audience, setAudience] = useState("JOINED")
  const [title, setTitle] = useState("")
  const [body, setBody] = useState("")
  const [sendEmail, setSendEmail] = useState(false)
  const [busy, setBusy] = useState(false)
  const inFlight = useRef(false)
  const [result, setResult] = useState<{ kind: "ok" | "err"; text: string } | null>(null)

  const AUDIENCES: Record<string, string> = {
    ELIGIBLE: "All eligible creators", JOINED: "Joined participants",
    NO_SUBMISSION: "Joined — no submission yet", APPROVED: "Creators with approved submissions",
    WINNERS: "Winners",
  }

  const send = async () => {
    if (inFlight.current || busy) return
    inFlight.current = true; setBusy(true); setResult(null)
    try {
      const res = await fetch(`/api/admin/creators/challenges/${id}/notify`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audience, title, body, sendEmail }),
      })
      const data = await res.json()
      setResult(res.ok
        ? { kind: "ok", text: `Sent to ${data.sent} creator${data.sent === 1 ? "" : "s"}${sendEmail ? ` (${data.emailed} emails)` : ""}.` }
        : { kind: "err", text: data.error ?? "Failed" })
      if (res.ok) { setTitle(""); setBody("") }
    } finally { setBusy(false); inFlight.current = false }
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Message participants</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <label><span className={lbl}>Audience</span>
          <select className={field} value={audience} onChange={(e) => setAudience(e.target.value)}>
            {Object.entries(AUDIENCES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select></label>
        <label><span className={lbl}>Title</span><input className={field} value={title} onChange={(e) => setTitle(e.target.value)} /></label>
        <label><span className={lbl}>Message</span><textarea rows={4} className={field} value={body} onChange={(e) => setBody(e.target.value)} /></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} /> Also send by email</label>
        {result && <p className={`text-sm ${result.kind === "ok" ? "text-green-600" : "text-destructive"}`}>{result.text}</p>}
        <Button onClick={send} disabled={busy || !title.trim() || !body.trim()}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Megaphone className="w-4 h-4 mr-1" />} Send
        </Button>
      </CardContent>
    </Card>
  )
}

/* ═══ Rules history ═══ */
function RulesTab({ detail }: { detail: Detail }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Rules version history</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">Rules froze when the challenge activated{detail.challenge.rules_frozen_at ? ` (${new Date(detail.challenge.rules_frozen_at as string).toLocaleString("en-GB")})` : ""}. Material amendments create a new immutable version — participants keep the version they accepted on join, and must acknowledge amendments.</p>
        {detail.ruleVersions.length === 0 && <p className="text-sm text-muted-foreground">No versions recorded yet — the first snapshot is created on activation.</p>}
        {detail.ruleVersions.map((v) => (
          <div key={v.id} className="rounded-md border border-input px-3 py-2 text-sm">
            <div className="flex justify-between">
              <span className="font-medium">Version {v.version}{v.is_material && <span className="ml-1 text-[10px] rounded-full bg-amber-100 text-amber-700 px-1.5 py-0.5">Material amendment</span>}</span>
              <span className="text-xs text-muted-foreground">{new Date(v.effective_at).toLocaleString("en-GB")} · {v.created_by_name ?? "System"}</span>
            </div>
            {v.reason && <p className="text-xs text-muted-foreground mt-1">Reason: {v.reason}</p>}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
