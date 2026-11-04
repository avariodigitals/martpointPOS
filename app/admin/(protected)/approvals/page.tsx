"use client"

import { useCallback, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { ALL_ROLES, type UserRole } from "@/lib/admin-types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, RefreshCw, ShieldCheck } from "lucide-react"

type ApprovalRequest = {
  id: string; action_key: string; entity_type: string; entity_reference: string; reason: string; details: Record<string, unknown>
  status: string; requested_by: string; requested_by_name: string; requested_by_role: UserRole; requested_at: string
  decided_by_name?: string | null; decision_note?: string | null
}
type ApprovalPolicy = { action_key: string; label: string; enabled: boolean; approver_roles: UserRole[]; approver_user_ids: string[] }
type StaffUser = { id: string; name: string; username: string; role: UserRole }

export default function ApprovalsPage() {
  const searchParams = useSearchParams()
  const focusedRequestId = searchParams.get("requestId") || ""
  const [requests, setRequests] = useState<ApprovalRequest[]>([])
  const [policies, setPolicies] = useState<ApprovalPolicy[]>([])
  const [users, setUsers] = useState<StaffUser[]>([])
  const [canManagePolicies, setCanManagePolicies] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState("")
  const [error, setError] = useState("")
  const [notes, setNotes] = useState<Record<string, string>>({})

  const reload = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const response = await fetch("/api/admin/approvals")
      const data = await response.json()
      if (!response.ok || !data.success) throw new Error(data.error || "Could not load approvals")
      setRequests(data.requests || [])
      setPolicies(data.policies || [])
      setUsers(data.users || [])
      setCanManagePolicies(data.canManagePolicies === true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load approvals")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void reload() }, [reload])

  useEffect(() => {
    if (!loading && focusedRequestId) {
      document.getElementById(`approval-request-${focusedRequestId}`)?.scrollIntoView({ behavior: "smooth", block: "center" })
    }
  }, [loading, focusedRequestId, requests])

  async function post(body: Record<string, unknown>, busyKey: string) {
    setBusy(busyKey); setError("")
    try {
      const response = await fetch("/api/admin/approvals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      const data = await response.json()
      if (!response.ok || !data.success) throw new Error(data.error || "Action failed")
      await reload()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Action failed")
    } finally { setBusy("") }
  }

  function updatePolicy(key: string, updates: Partial<ApprovalPolicy>) {
    setPolicies((current) => current.map((policy) => policy.action_key === key ? { ...policy, ...updates } : policy))
  }

  const orderedRequests = focusedRequestId
    ? [...requests].sort((a, b) => Number(b.id === focusedRequestId) - Number(a.id === focusedRequestId))
    : requests
  const focusedRequest = requests.find((item) => item.id === focusedRequestId)
  const pending = requests.filter((item) => item.status === "PENDING")

  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-2xl font-semibold">{focusedRequest ? "Review quotation approval" : "Approvals"}</h1><p className="mt-1 text-sm text-muted-foreground">{focusedRequest ? `Quotation ${focusedRequest.entity_reference} · review the details and record your decision.` : "Set review rules and decide pending business actions."}</p></div>
      <Button variant="outline" onClick={() => void reload()} disabled={loading}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>
    </div>
    {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
    {!loading && focusedRequestId && !focusedRequest && <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">This approval request is no longer available in your inbox. It may already have been decided or reassigned.</div>}

    {canManagePolicies && !focusedRequest && <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" />Approval rules</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {policies.map((policy) => <div key={policy.action_key} className="rounded-lg border p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><p className="font-medium">{policy.label}</p><p className="text-xs text-muted-foreground">{policy.action_key}</p></div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={policy.enabled} onChange={(event) => updatePolicy(policy.action_key, { enabled: event.target.checked })} />Require approval</label>
          </div>
          {policy.action_key === "quotation.send" && <p className="mt-2 text-xs text-muted-foreground">Assign the Technical Lead or Sales Head by selecting their individual user account. Admins can also approve. Approval returns the draft to its creator; it does not email the client.</p>}
          {policy.enabled && <div className="mt-3 grid gap-4 lg:grid-cols-2">
            <fieldset><legend className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Approver roles</legend><div className="flex flex-wrap gap-x-4 gap-y-2">
              {ALL_ROLES.map((role) => <label key={role} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={policy.approver_roles.includes(role)} onChange={(event) => updatePolicy(policy.action_key, { approver_roles: event.target.checked ? [...policy.approver_roles, role] : policy.approver_roles.filter((item) => item !== role) })} />{role}</label>)}
            </div></fieldset>
            {users.length > 0 && <fieldset><legend className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Individual approvers</legend><div className="flex max-h-36 flex-wrap gap-x-4 gap-y-2 overflow-y-auto">
              {users.map((user) => <label key={user.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={policy.approver_user_ids.includes(user.id)} onChange={(event) => updatePolicy(policy.action_key, { approver_user_ids: event.target.checked ? [...policy.approver_user_ids, user.id] : policy.approver_user_ids.filter((item) => item !== user.id) })} />{user.name} <span className="text-xs text-muted-foreground">({user.role})</span></label>)}
            </div></fieldset>}
          </div>}
          <div className="mt-3 flex justify-end"><Button size="sm" disabled={busy === `policy:${policy.action_key}`} onClick={() => void post({ action: "save_policy", actionKey: policy.action_key, enabled: policy.enabled, approverRoles: policy.approver_roles, approverUserIds: policy.approver_user_ids }, `policy:${policy.action_key}`)}>{busy === `policy:${policy.action_key}` && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save rule</Button></div>
        </div>)}
        {policies.length === 0 && !loading && <p className="text-sm text-muted-foreground">No approval policies are available. Apply database migration 167.</p>}
      </CardContent>
    </Card>}

    <Card>
      <CardHeader><CardTitle>Request inbox <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900">{pending.length} pending</span></CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {loading && <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>}
        {!loading && requests.length === 0 && <p className="py-5 text-sm text-muted-foreground">No approval requests yet.</p>}
        {orderedRequests.map((item) => <div id={`approval-request-${item.id}`} key={item.id} className={`rounded-lg border p-4 ${item.id === focusedRequestId ? "border-2 border-retail shadow-md" : ""}`}>
          <div className="flex flex-wrap items-start justify-between gap-3"><div>
            <p className="font-medium">{item.entity_type === "INVOICE" ? "Invoice" : item.entity_type} {item.entity_reference}</p>
            <p className="text-sm text-muted-foreground">{policies.find((policy) => policy.action_key === item.action_key)?.label || item.action_key} · Requested by {item.requested_by_name} ({item.requested_by_role}) · {new Date(item.requested_at).toLocaleString()}</p>
          </div><span className={`rounded-full px-2 py-1 text-xs font-medium ${item.status === "PENDING" ? "bg-amber-100 text-amber-900" : item.status === "APPROVED" ? "bg-emerald-100 text-emerald-900" : "bg-slate-100 text-slate-700"}`}>{item.status}</span></div>
          <p className="mt-3 text-sm"><span className="font-medium">Reason:</span> {item.reason}</p>
          {item.action_key === "quotation.send" && Boolean(item.details?.quote) && (() => {
            const quote = item.details.quote as { title?: string; lead_name?: string; business_name?: string; email?: string; total_amount?: number; valid_until?: string | null; items?: Array<{ description?: string; quantity?: number; unit_price?: number; line_total?: number }> }
            return <div className="mt-3 rounded-md border bg-muted/30 p-3 text-sm"><p className="font-semibold">{quote.title || "Quotation details"}</p><p className="mt-1 text-xs text-muted-foreground">{quote.lead_name || "Lead"} · {quote.business_name || "Business"} · {quote.email || "No email"}</p><p className="mt-2 font-medium">Total: ₦{Number(quote.total_amount || 0).toLocaleString("en-NG", { minimumFractionDigits: 2 })}{quote.valid_until ? ` · Valid until ${new Date(quote.valid_until).toLocaleDateString()}` : ""}</p>{quote.items?.length ? <ul className="mt-2 space-y-1 border-t pt-2 text-xs">{quote.items.map((line, index) => <li key={`${item.id}-${index}`} className="flex justify-between gap-3"><span>{line.description} · {line.quantity} × ₦{Number(line.unit_price || 0).toLocaleString("en-NG")}</span><span className="shrink-0">₦{Number(line.line_total || 0).toLocaleString("en-NG")}</span></li>)}</ul> : null}</div>
          })()}
          {Object.keys(item.details || {}).length > 0 && <details className="mt-3 rounded-md bg-muted/50 p-3"><summary className="cursor-pointer text-xs font-medium">Request details</summary><pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-words text-xs text-muted-foreground">{JSON.stringify(item.details, null, 2)}</pre></details>}
          {item.status === "PENDING" ? <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input value={notes[item.id] || ""} onChange={(event) => setNotes((current) => ({ ...current, [item.id]: event.target.value }))} className="min-w-48 flex-1 rounded-md border px-3 py-2 text-sm" placeholder="Decision note; required when rejecting" />
            <Button variant="outline" disabled={Boolean(busy)} onClick={() => void post({ action: "decide", requestId: item.id, decision: "REJECTED", note: notes[item.id] || "" }, item.id)}>Reject</Button>
            <Button disabled={Boolean(busy)} onClick={() => void post({ action: "decide", requestId: item.id, decision: "APPROVED", note: notes[item.id] || "" }, item.id)}>{busy === item.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Approve</Button>
          </div> : <p className="mt-2 text-xs text-muted-foreground">{item.decided_by_name ? `Decided by ${item.decided_by_name}` : "Decision recorded"}{item.decision_note ? ` · ${item.decision_note}` : ""}</p>}
        </div>)}
      </CardContent>
    </Card>
  </div>
}
