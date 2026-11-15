"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

type Lifecycle = { accepted_at?: string | null; accepted_version?: string | null; performance_status?: string; listing_status?: string; probation_end_at?: string | null; days_remaining?: number | null }
type Activity = { id: string; activity_type: string; description: string; verification_status: string; occurred_at: string; rejection_reason?: string | null }
type Notice = { notice_type: string; delivery_status: string; sent_at?: string | null; response_deadline_at?: string | null }
type ReviewCase = { id: string; opening_reason?: string | null; response_deadline_at?: string | null }
type Policy = { version?: string; config_json?: { policy_text?: string } }
type QualifyingLead = { id: string; business_name: string; status: string }
type State = { lifecycle: Lifecycle | null; activities: Activity[]; notices: Notice[]; cases: ReviewCase[]; policy: Policy | null; qualifyingLeads: QualifyingLead[] }
const blank: State = { lifecycle: null, activities: [], notices: [], cases: [], policy: null, qualifyingLeads: [] }

export function LifecyclePanel() {
  const [state, setState] = useState<State>(blank)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const [description, setDescription] = useState("")
  const [evidence, setEvidence] = useState("")
  const [policyConfirmed, setPolicyConfirmed] = useState(false)
  const [activityType, setActivityType] = useState("qualified_lead")
  const [sourceRecordId, setSourceRecordId] = useState("")
  const [consentConfirmed, setConsentConfirmed] = useState(false)
  const [lawfulBasis, setLawfulBasis] = useState("consent")
  const [caseEvidence, setCaseEvidence] = useState<Record<string, string>>({})
  const [response, setResponse] = useState<Record<string, string>>({})
  const refresh = async () => {
    const res = await fetch("/api/partner/lifecycle", { cache: "no-store" })
    if (res.ok) setState({ ...blank, ...(await res.json() as State) })
  }
  useEffect(() => {
    let mounted = true
    void fetch("/api/partner/lifecycle", { cache: "no-store" }).then(async (res) => {
      if (res.ok && mounted) setState({ ...blank, ...(await res.json() as State) })
    })
    return () => { mounted = false }
  }, [])
  const post = async (payload: Record<string, unknown>) => {
    setBusy(true); setMessage("")
    try {
      const res = await fetch("/api/partner/lifecycle", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Unable to update lifecycle")
      setMessage("Saved. Activity remains pending until MartPoint verifies it.")
      await refresh()
    } catch (e) { setMessage(e instanceof Error ? e.message : "Unable to update lifecycle") }
    finally { setBusy(false) }
  }
  const life = state.lifecycle
  const daysLeft = life?.days_remaining ?? null
  return <Card>
    <CardHeader><CardTitle className="text-sm">Partner lifecycle and directory status</CardTitle></CardHeader>
    <CardContent className="space-y-4 text-sm">
      {!life ? <p className="text-muted-foreground">Lifecycle details will appear after the policy migration is installed.</p> : <>
        <div className="grid gap-2 sm:grid-cols-3">
          <div><span className="text-muted-foreground">Performance</span><p className="font-medium capitalize">{String(life.performance_status).replaceAll("_", " ")}</p></div>
          <div><span className="text-muted-foreground">Directory listing</span><p className="font-medium capitalize">{String(life.listing_status).replaceAll("_", " ")}</p></div>
          <div><span className="text-muted-foreground">Probation</span><p className="font-medium">{daysLeft === null ? "Not started" : daysLeft ? `${daysLeft} days remaining` : "Review due"}</p></div>
        </div>
        <p className="text-muted-foreground">Qualification requires at least one verified qualified lead, attended demo, proposal, closed-won deal, or documented client meeting, plus approved onboarding and clear compliance. Login alone does not count. Directory publication requires MartPoint review.</p>
        {!life.accepted_at && <div className="rounded-lg border p-3"><p className="mb-2 font-medium">Policy {state.policy?.version || "current"}</p><p className="mb-2 text-muted-foreground">{String(state.policy?.config_json?.policy_text || "The activation period and directory performance policy begin only after acceptance and approved onboarding.")}</p><label className="mb-2 flex items-start gap-2"><input type="checkbox" checked={policyConfirmed} onChange={(e) => setPolicyConfirmed(e.target.checked)} /><span>I have read the policy and accept version {state.policy?.version || "current"}.</span></label><button disabled={busy || !policyConfirmed} onClick={() => post({ action: "accept" })} className="rounded-md bg-primary px-3 py-2 text-primary-foreground">Accept policy and start transition</button></div>}
        <div className="rounded-lg border p-3 space-y-2">
          <p className="font-medium">Submit qualifying activity for review</p>
          <select value={activityType} onChange={(e) => setActivityType(e.target.value)} className="w-full rounded border bg-background px-3 py-2"><option value="qualified_lead">Qualified lead</option><option value="attended_demo">Attended demo</option><option value="proposal_submitted">Proposal submitted</option><option value="closed_won">Closed-won deal</option><option value="documented_client_meeting">Documented client meeting</option></select>
          {activityType === "qualified_lead" && <><select value={sourceRecordId} onChange={(e) => setSourceRecordId(e.target.value)} className="w-full rounded border bg-background px-3 py-2"><option value="">Choose a verified pipeline record</option>{state.qualifyingLeads.map((lead) => <option key={lead.id} value={lead.id}>{lead.business_name} · {lead.status}</option>)}</select><select value={lawfulBasis} onChange={(e) => setLawfulBasis(e.target.value)} className="w-full rounded border bg-background px-3 py-2"><option value="consent">Consent</option><option value="contract">Contract</option><option value="legitimate_interest">Legitimate interest</option><option value="other">Other lawful basis</option></select><label className="flex items-start gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={consentConfirmed} onChange={(e) => setConsentConfirmed(e.target.checked)} /><span>I confirm this selected basis is accurate and permits sharing the opportunity with MartPoint.</span></label></>}
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} placeholder="Describe the meaningful client requirement. Do not enter prospect personal data here." className="w-full rounded border bg-background px-3 py-2" />
          <input value={evidence} onChange={(e) => setEvidence(e.target.value)} placeholder="Evidence link (optional)" className="w-full rounded border bg-background px-3 py-2" />
          <button disabled={busy || (activityType === "qualified_lead" && (!sourceRecordId || !consentConfirmed))} onClick={() => void post({ action: "activity", activityType, sourceRecordId: activityType === "qualified_lead" ? sourceRecordId : undefined, consentConfirmed: activityType === "qualified_lead" ? consentConfirmed : undefined, lawfulBasis: activityType === "qualified_lead" ? lawfulBasis : undefined, description, evidenceUrl: evidence || null, occurredAt: new Date().toISOString() })} className="rounded-md border px-3 py-2">Submit for verification</button>
        </div>
        {state.activities.length > 0 && <div><p className="mb-2 font-medium">Activity history</p>{state.activities.map((a) => <div key={a.id} className="flex justify-between gap-4 border-t py-2"><span>{a.activity_type.replaceAll("_", " ")} · {a.description}</span><span className="shrink-0 capitalize text-muted-foreground">{a.verification_status}</span></div>)}</div>}
        {state.notices.length > 0 && <div><p className="mb-2 font-medium">Notices</p>{state.notices.map((n, i) => <div key={`${n.notice_type}-${i}`} className="border-t py-2">{n.notice_type.replaceAll("_", " ")} · {n.delivery_status}{n.sent_at ? ` · sent ${new Date(n.sent_at).toLocaleDateString()}` : ""}</div>)}</div>}
        {state.cases.map((c) => <div key={c.id} className="rounded-lg border border-amber-300 p-3"><p className="font-medium">Review response requested</p><p className="text-muted-foreground">{c.opening_reason || "MartPoint requests your response and supporting information."} Reply by {c.response_deadline_at ? new Date(c.response_deadline_at).toLocaleDateString() : "the date in your notice"}.</p><textarea value={response[c.id] || ""} onChange={(e) => setResponse({ ...response, [c.id]: e.target.value })} className="mt-2 w-full rounded border bg-background px-3 py-2" placeholder="Your response" /><input value={caseEvidence[c.id] || ""} onChange={(e) => setCaseEvidence({ ...caseEvidence, [c.id]: e.target.value })} className="mt-2 w-full rounded border bg-background px-3 py-2" placeholder="Evidence link (optional)" /><button disabled={busy} onClick={() => post({ action: "respond", caseId: c.id, response: response[c.id], evidenceUrl: caseEvidence[c.id] || null })} className="mt-2 rounded-md border px-3 py-2">Send response</button></div>)}
      </>}
      {message && <p role="status" className="text-muted-foreground">{message}</p>}
    </CardContent>
  </Card>
}
