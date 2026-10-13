"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/admin/admin-toast"
import { Loader2, RefreshCw, Search, ShieldAlert } from "lucide-react"

/* ───────────────────────────  Referral decision queue  ───────────────────────────
 * Sales + Partner Operations surface. Accept / duplicate / reject / request
 * information all live here; the server re-checks the role and records the
 * decision, the history entry, the notification and the controlled notice.
 */

interface ReferralRow {
  id: string
  referralReference: string
  status: string
  statusLabel: string
  businessName: string
  contactName: string
  phone: string
  email: string
  city: string
  state: string
  country: string
  businessType: string
  knownRequirement: string
  relationshipSource: string
  currentSystem: string
  notes: string
  consentConfirmed: boolean
  partnerName: string | null
  submittedAt: string | null
  protectionExpiresAt: string | null
  informationRequestMessage: string | null
  informationResponse: string | null
  decisionByName: string | null
  decisionReason: string | null
  salesOwner: string | null
  createdAt: string
}

interface Match {
  category: string
  sourceTable: string
  internalDetail: string
}

interface Detail {
  referral: ReferralRow
  timeline: { previousStatus: string | null; status: string; actorType: string; actorName: string | null; reason: string | null; at: string }[]
  duplicate: { duplicate: boolean; matches: Match[] }
  earnings: { id: string; status: string; earningKind: string; commissionNaira: number; invoiceId: string | null }[]
  can: { review: boolean; attribute: boolean }
}

const DECIDABLE = ["SUBMITTED", "UNDER_REVIEW", "INFORMATION_REQUIRED"]

const TONES: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  SUBMITTED: "bg-blue-50 text-blue-700",
  UNDER_REVIEW: "bg-blue-50 text-blue-700",
  INFORMATION_REQUIRED: "bg-amber-100 text-amber-800",
  ACCEPTED: "bg-teal-50 text-teal-700",
  QUALIFIED: "bg-teal-50 text-teal-700",
  CONVERTED_UNPAID: "bg-amber-50 text-amber-800",
  PAID_PENDING_ACTIVATION: "bg-indigo-50 text-indigo-700",
  ACTIVATED_HOLDING: "bg-indigo-50 text-indigo-700",
  COMMISSION_ELIGIBLE: "bg-purple-50 text-purple-700",
  APPROVED: "bg-purple-50 text-purple-700",
  PAID: "bg-green-100 text-green-700",
  DUPLICATE: "bg-red-50 text-red-700",
  REJECTED: "bg-red-50 text-red-700",
  LOST: "bg-gray-100 text-gray-600",
  EXPIRED: "bg-gray-100 text-gray-600",
}

const inputCls = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm"

function fmtDate(iso: string | null) {
  if (!iso) return "—"
  try {
    return new Date(iso).toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })
  } catch {
    return iso
  }
}

function Pill({ status, label }: { status: string; label: string }) {
  return <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${TONES[status] || "bg-gray-100 text-gray-700"}`}>{label}</span>
}

type DecisionKind = "request_information" | "accept" | "duplicate" | "reject" | "extend_protection"

const DECISION_COPY: Record<DecisionKind, { title: string; cta: string; hint: string; reasonLabel: string }> = {
  request_information: {
    title: "Request information",
    cta: "Send request",
    hint: "The partner answers in the portal and the referral returns to review.",
    reasonLabel: "What do you need to know?",
  },
  accept: {
    title: "Accept referral",
    cta: "Accept and protect",
    hint: "Protection starts now and runs on the partner's signed Commission Schedule. Acceptance creates no commission.",
    reasonLabel: "Why is this new and attributable?",
  },
  duplicate: {
    title: "Mark duplicate",
    cta: "Mark duplicate",
    hint: "Only the factual category reaches the partner — never the other record, account or partner identity.",
    reasonLabel: "Which existing record does this match?",
  },
  reject: {
    title: "Reject referral",
    cta: "Reject",
    hint: "Use for ineligible or non-consented prospects. The reason is shown to the partner.",
    reasonLabel: "Reason for rejection",
  },
  extend_protection: {
    title: "Extend protection",
    cta: "Extend",
    hint: "An exception: it re-issues the acceptance notice and records the reason.",
    reasonLabel: "Why is the window being extended?",
  },
}

export default function AdminReferralDecisionsPage() {
  const { toast } = useToast()
  const [rows, setRows] = useState<ReferralRow[]>([])
  const [can, setCan] = useState({ review: false, attribute: false })
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState("OPEN")
  const [query, setQuery] = useState("")

  const [selected, setSelected] = useState<Detail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [decision, setDecision] = useState<DecisionKind | null>(null)
  const [reason, setReason] = useState("")
  const [dueAt, setDueAt] = useState("")
  const [days, setDays] = useState("30")
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      // "Awaiting review" spans three statuses, so it is filtered after the fetch.
      if (statusFilter !== "OPEN" && statusFilter !== "ALL") params.set("status", statusFilter)
      if (query.trim()) params.set("q", query.trim())
      if (query.trim()) params.set("q", query.trim())
      const res = await fetch(`/api/admin/referrals?${params.toString()}`)
      const json = await res.json()
      if (!res.ok) {
        toast({ title: "Could not load referrals", description: json.error, variant: "error" })
        return
      }
      setRows(json.referrals || [])
      setCan(json.can || { review: false, attribute: false })
    } finally {
      setLoading(false)
    }
  }, [query, statusFilter, toast])

  useEffect(() => {
    void load()
  }, [load])

  async function open(id: string) {
    setDetailLoading(true)
    setDecision(null)
    setReason("")
    try {
      const res = await fetch(`/api/admin/referrals/${id}`)
      const json = await res.json()
      if (!res.ok) {
        toast({ title: "Could not open this referral", description: json.error, variant: "error" })
        return
      }
      setSelected(json as Detail)
    } finally {
      setDetailLoading(false)
    }
  }

  async function decide() {
    if (!selected || !decision) return
    if (!reason.trim()) {
      toast({ title: "A reason is required", description: "It is stored in the audit trail and, for partner-visible decisions, in their notice.", variant: "warning" })
      return
    }
    setBusy(true)
    try {
      const body: Record<string, unknown> = { action: decision, reason: reason.trim() }
      if (decision === "request_information") {
        body.message = reason.trim()
        if (dueAt) body.dueAt = new Date(dueAt).toISOString()
      }
      if (decision === "extend_protection") body.days = Number(days)
      const res = await fetch(`/api/admin/referrals/${selected.referral.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast({ title: "Decision rejected", description: json.error || "The server refused this decision", variant: "error", duration: 0 })
        return
      }
      toast({
        title: decision === "extend_protection" ? "Protection extended" : "Decision recorded",
        description: `${selected.referral.referralReference} — ${selected.referral.businessName}`,
        variant: "success",
      })
      setSelected(null)
      setDecision(null)
      setReason("")
      await load()
    } finally {
      setBusy(false)
    }
  }

  async function convertToCustomer() {
    if (!selected) return
    setBusy(true)
    try {
      const res = await fetch("/api/admin/partner-leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selected.referral.id, action: "convert" }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast({ title: "Conversion refused", description: json.error || "The server would not create the customer", variant: "error", duration: 0 })
        return
      }
      toast({
        title: "Converted — awaiting first payment",
        description: `${selected.referral.referralReference} is now a MartPoint customer. No commission exists until an eligible payment clears, the licence activates and the holding period completes.`,
        variant: "success",
        duration: 0,
      })
      setSelected(null)
      await load()
    } finally {
      setBusy(false)
    }
  }

  const visible = useMemo(
    () => (statusFilter === "OPEN" ? rows.filter((r) => DECIDABLE.includes(r.status)) : rows),
    [rows, statusFilter]
  )
  const openCount = visible.filter((r) => DECIDABLE.includes(r.status)).length

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Referral Decisions</h2>
          <p className="text-sm text-muted-foreground">
            {openCount} awaiting a decision. Acceptance starts protection — it never creates a commission.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void load()}>
          <RefreshCw className="mr-2 h-4 w-4" /> Refresh
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={`${inputCls} w-48`}>
          <option value="OPEN">Awaiting review</option>
          <option value="ALL">All statuses</option>
          <option value="SUBMITTED">Submitted</option>
          <option value="UNDER_REVIEW">Under review</option>
          <option value="INFORMATION_REQUIRED">Information requested</option>
          <option value="ACCEPTED">Accepted</option>
          <option value="QUALIFIED">Qualified</option>
          <option value="CONVERTED_UNPAID">Converted — unpaid</option>
          <option value="PAID_PENDING_ACTIVATION">Paid — pending activation</option>
          <option value="ACTIVATED_HOLDING">Activated — holding</option>
          <option value="COMMISSION_ELIGIBLE">Commission eligible</option>
          <option value="APPROVED">Approved</option>
          <option value="PAID">Paid</option>
          <option value="DUPLICATE">Duplicate</option>
          <option value="REJECTED">Rejected</option>
          <option value="LOST">Lost</option>
          <option value="EXPIRED">Expired</option>
        </select>
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Reference, business or contact"
            className={`${inputCls} pl-9`}
          />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <p className="p-6 text-sm text-muted-foreground">Loading…</p>
          ) : visible.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No referrals match this filter.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted text-left">
                  <tr>
                    <th className="px-4 py-2 font-medium">Referral</th>
                    <th className="px-4 py-2 font-medium">Partner</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                    <th className="px-4 py-2 font-medium">Submitted</th>
                    <th className="px-4 py-2 font-medium">Protection until</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((r) => (
                    <tr
                      key={r.id}
                      onClick={() => void open(r.id)}
                      className={`cursor-pointer border-t border-border hover:bg-muted/40 ${selected?.referral.id === r.id ? "bg-muted/60" : ""}`}
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium">{r.businessName}</p>
                        <p className="font-mono text-xs text-muted-foreground">{r.referralReference}</p>
                        {r.informationResponse && !r.informationRequestMessage && (
                          <p className="mt-1 text-xs text-blue-700">Partner answered the information request</p>
                        )}
                        {r.informationRequestMessage && (
                          <p className="mt-1 text-xs text-amber-700">Waiting on the partner</p>
                        )}
                      </td>
                      <td className="px-4 py-3">{r.partnerName || "MartPoint direct"}</td>
                      <td className="px-4 py-3"><Pill status={r.status} label={r.statusLabel} /></td>
                      <td className="px-4 py-3 text-muted-foreground">{fmtDate(r.submittedAt)}</td>
                      <td className="px-4 py-3 text-muted-foreground">{fmtDate(r.protectionExpiresAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {detailLoading && <p className="text-sm text-muted-foreground">Loading referral…</p>}

      {selected && !detailLoading && (
        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center justify-between gap-2 text-base">
              <span>
                {selected.referral.businessName}
                <span className="ml-2 font-mono text-xs text-muted-foreground">{selected.referral.referralReference}</span>
              </span>
              <span className="flex items-center gap-3">
                <Pill status={selected.referral.status} label={selected.referral.statusLabel} />
                <button onClick={() => setSelected(null)} className="text-xs text-muted-foreground hover:underline">Close</button>
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <div className="rounded-lg border p-3">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Contact</p>
                <p className="mt-1 text-sm">{selected.referral.contactName}</p>
                <p className="text-xs text-muted-foreground">{selected.referral.phone || "—"} {selected.referral.email && `· ${selected.referral.email}`}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Location / type</p>
                <p className="mt-1 text-sm">{[selected.referral.city, selected.referral.state, selected.referral.country].filter(Boolean).join(", ") || "—"}</p>
                <p className="text-xs text-muted-foreground">{selected.referral.businessType || "—"}</p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Consent</p>
                <p className={`mt-1 text-sm font-medium ${selected.referral.consentConfirmed ? "text-green-700" : "text-red-700"}`}>
                  {selected.referral.consentConfirmed ? "Confirmed by partner" : "Not confirmed"}
                </p>
              </div>
              <div className="rounded-lg border p-3">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Attribution</p>
                <p className="mt-1 text-sm">{selected.referral.partnerName || "MartPoint direct"}</p>
                <p className="text-xs text-muted-foreground">Owner: {selected.referral.salesOwner || "unassigned"}</p>
              </div>
            </div>

            <div className="rounded-lg border p-3 text-sm">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">What they need</p>
              <p className="mt-1 whitespace-pre-line">{selected.referral.knownRequirement || "—"}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Relationship: {selected.referral.relationshipSource || "—"} · Current system: {selected.referral.currentSystem || "—"}
              </p>
              {selected.referral.notes && <p className="mt-2 whitespace-pre-line text-xs text-muted-foreground">{selected.referral.notes}</p>}
            </div>

            {selected.referral.informationRequestMessage && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                <p className="font-medium">Information you requested</p>
                <p className="mt-1 whitespace-pre-line">{selected.referral.informationRequestMessage}</p>
                {selected.referral.informationResponse ? (
                  <>
                    <p className="mt-2 font-medium">Partner response</p>
                    <p className="mt-1 whitespace-pre-line">{selected.referral.informationResponse}</p>
                  </>
                ) : (
                  <p className="mt-2 text-xs">No response yet.</p>
                )}
              </div>
            )}

            <div className={`rounded-lg border p-3 text-sm ${selected.duplicate.duplicate ? "border-red-200 bg-red-50 text-red-900" : "border-border"}`}>
              <p className="flex items-center gap-2 font-medium">
                {selected.duplicate.duplicate && <ShieldAlert className="h-4 w-4" />}
                Duplicate check: {selected.duplicate.duplicate ? "possible existing record" : "no match found"}
              </p>
              {selected.duplicate.matches.length > 0 ? (
                <ul className="mt-2 space-y-1 text-xs">
                  {selected.duplicate.matches.slice(0, 8).map((m, i) => (
                    <li key={i} className="font-mono">
                      {m.category} · {m.sourceTable} · {m.internalDetail}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">
                  Matched against customers, CRM leads, prospects, opportunities, other partners&apos; referrals and direct sales activity.
                </p>
              )}
              <p className="mt-2 text-xs text-muted-foreground">
                Internal detail stays here. The partner only ever receives the factual category.
              </p>
            </div>

            {selected.earnings.length > 0 && (
              <div className="rounded-lg border p-3 text-sm">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Earning records</p>
                <ul className="mt-2 space-y-1 text-xs">
                  {selected.earnings.map((e) => (
                    <li key={e.id} className="flex justify-between gap-3">
                      <span>{e.earningKind || "commission"}</span>
                      <span className="font-medium">₦{e.commissionNaira.toLocaleString("en-NG", { minimumFractionDigits: 2 })} · {e.status}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="rounded-lg border p-3">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">History</p>
              <ol className="mt-2 space-y-1.5 text-xs">
                {selected.timeline.map((t, i) => (
                  <li key={i} className="flex flex-wrap gap-2">
                    <span className="font-medium">{t.status}</span>
                    <span className="text-muted-foreground">{new Date(t.at).toLocaleString("en-NG")}</span>
                    <span className="text-muted-foreground">{t.actorType === "PARTNER" ? "partner" : t.actorName || "system"}</span>
                    {t.reason && <span className="text-muted-foreground">— {t.reason}</span>}
                  </li>
                ))}
              </ol>
            </div>

            {selected.can.review || selected.can.attribute ? (
              <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
                {DECIDABLE.includes(selected.referral.status) && selected.can.review ? (
                  <div className="flex flex-wrap gap-2">
                    {(["request_information", "accept", "duplicate", "reject"] as DecisionKind[]).map((kind) => (
                      <Button
                        key={kind}
                        size="sm"
                        variant={kind === "accept" ? "default" : "outline"}
                        onClick={() => {
                          setDecision(kind)
                          setReason("")
                        }}
                      >
                        {DECISION_COPY[kind].title}
                      </Button>
                    ))}
                  </div>
                ) : ["ACCEPTED", "QUALIFIED"].includes(selected.referral.status) ? (
                  <div className="flex flex-wrap gap-2">
                    {selected.can.review && (
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => void convertToCustomer()}>
                        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Convert to MartPoint customer
                      </Button>
                    )}
                    {selected.can.attribute && (
                      <Button size="sm" variant="outline" onClick={() => { setDecision("extend_protection"); setReason("") }}>
                        Extend protection
                      </Button>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    This referral is not awaiting a review decision. Status moves automatically as the customer pays, the
                    licence activates and Finance approves the earning.
                  </p>
                )}

                {decision && (
                  <div className="space-y-2 rounded-md border bg-background p-3">
                    <p className="text-sm font-medium">{DECISION_COPY[decision].title}</p>
                    <p className="text-xs text-muted-foreground">{DECISION_COPY[decision].hint}</p>
                    {decision === "extend_protection" && (
                      <label className="block text-xs">
                        Extra days
                        <input type="number" min={1} value={days} onChange={(e) => setDays(e.target.value)} className={`${inputCls} mt-1`} />
                      </label>
                    )}
                    <label className="block text-xs">
                      {DECISION_COPY[decision].reasonLabel}
                      <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} className={`${inputCls} mt-1`} />
                    </label>
                    {decision === "request_information" && (
                      <label className="block text-xs">
                        Response due (optional)
                        <input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} className={`${inputCls} mt-1`} />
                      </label>
                    )}
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => void decide()} disabled={busy}>
                        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {DECISION_COPY[decision].cta}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setDecision(null)}>Cancel</Button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Your role can review referral records but cannot decide them.</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
