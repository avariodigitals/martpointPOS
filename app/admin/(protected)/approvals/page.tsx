"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { type UserRole } from "@/lib/admin-types"
import { Button } from "@/components/ui/button"
import { Loader2, RefreshCw, Search, Eye, MessageSquareText, Check, X, FileText, Wallet, Database, ClipboardCheck, Clock3 } from "lucide-react"
import { formatMoney } from "@/lib/money-format"
import { enumLabel } from "@/lib/utils"

type ApprovalRequest = {
  id: string; action_key: string; entity_type: string; entity_id: string; entity_reference: string; reason: string; details: Record<string, unknown>
  status: string; requested_by: string; requested_by_name: string; requested_by_role: UserRole; requested_at: string
  decided_by_name?: string | null; decision_note?: string | null
}
type ApprovalPolicy = { action_key: string; label: string; enabled: boolean; approver_roles: UserRole[]; approver_user_ids: string[] }
type CategoryKey = "ALL" | "SALES" | "FINANCE" | "DATA" | "OTHER"
type StatusFilter = "PENDING" | "ALL" | "DECIDED"
type ModalState = { request: ApprovalRequest; mode: "view" | "decision"; decision?: "APPROVED" | "REJECTED" }

const FIELD_LABELS: Record<string, string> = {
  amount: "Amount", balance_due: "Balance due", bank_reference: "Bank reference", business_id: "Customer", currency: "Currency",
  due_date: "Due date", invoice_id: "Invoice", notes: "Payment note", notes_internal: "Internal note", notes_public: "Public note",
  paid_at: "Payment date", payment_account_id: "Receiving account", payment_method: "Payment method", payment_terms: "Payment terms", status: "Current status",
}
const CATEGORIES: { key: CategoryKey; label: string }[] = [
  { key: "ALL", label: "All" }, { key: "SALES", label: "Sales & Quotations" }, { key: "FINANCE", label: "Finance" }, { key: "DATA", label: "Data & Records" }, { key: "OTHER", label: "Other" },
]

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}
}
function isUuid(value: string): boolean { return /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(value) }
function fieldLabel(key: string): string { return FIELD_LABELS[key] || key.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) }
function formattedValue(key: string, value: unknown, currency: string): string {
  if (typeof value === "number" && /(amount|balance|total|price|discount|tax)/i.test(key)) return formatMoney(value, currency)
  if (typeof value === "boolean") return value ? "Yes" : "No"
  if (typeof value !== "string") return String(value)
  if (/(paid_at|due_date|issue_date|start_date|end_date|created_at|updated_at)/i.test(key)) {
    const date = new Date(value)
    if (!Number.isNaN(date.getTime())) return date.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: key.endsWith("_at") ? "short" : undefined })
  }
  if (/(status|payment_method|billing_interval)/i.test(key)) return enumLabel(value)
  return value
}
function categoryFor(request: ApprovalRequest): Exclude<CategoryKey, "ALL"> {
  const key = request.action_key.toLowerCase()
  if (key.startsWith("quotation.") || key.startsWith("sales.")) return "SALES"
  if (key.startsWith("finance.") || ["PAYMENT", "INVOICE", "PAYOUT", "COMMISSION", "SUBSCRIPTION"].includes(request.entity_type.toUpperCase())) return "FINANCE"
  if (key.startsWith("data.") || key.startsWith("records.") || /(import|export|data|record|delete)/.test(key)) return "DATA"
  return "OTHER"
}
function actionIcon(request: ApprovalRequest) {
  const category = categoryFor(request)
  if (category === "SALES") return FileText
  if (category === "FINANCE") return Wallet
  if (category === "DATA") return Database
  return ClipboardCheck
}
function actionLabel(request: ApprovalRequest, policies: ApprovalPolicy[]) {
  return policies.find((policy) => policy.action_key === request.action_key)?.label || request.action_key.split(".").map(enumLabel).join(" · ")
}
function statusClass(status: string) {
  if (status === "PENDING") return "bg-amber-100 text-amber-900"
  if (status === "APPROVED") return "bg-emerald-100 text-emerald-800"
  if (status === "REJECTED") return "bg-red-100 text-red-800"
  return "bg-slate-100 text-slate-700"
}

function ApprovalRequestDetails({ request }: { request: ApprovalRequest }) {
  const details = recordValue(request.details)
  const payload = recordValue(details.payload)
  const display = recordValue(details.display)
  const currency = typeof payload.currency === "string" ? payload.currency : "NGN"
  const displayNames: Record<string, string> = { business_id: String(display.business_name || ""), invoice_id: String(display.invoice_number || "") }
  const hiddenKeys = new Set(["quote", "display", "payload", "quote_updated_at", "updated_at_at_request", "requested_action"])
  const detailRows: [string, unknown][] = Object.entries(details).filter(([key, value]) => !hiddenKeys.has(key) && (value === null || ["string", "number", "boolean"].includes(typeof value)))
  const payloadRows = Object.entries(payload).filter(([key, value]) => {
    if (key === "reason" || value === null || value === undefined || key === "items" || typeof value === "object") return false
    if ((key === "business_id" || key === "invoice_id") && !displayNames[key]) return false
    return !(typeof value === "string" && isUuid(value))
  })
  if (displayNames.business_id && payload.business_id) payloadRows.unshift(["business_id", displayNames.business_id])
  if (displayNames.invoice_id && payload.invoice_id) payloadRows.splice(displayNames.business_id ? 1 : 0, 0, ["invoice_id", displayNames.invoice_id])
  const itemRows = Array.isArray(payload.items) ? payload.items as Record<string, unknown>[] : []
  const quote = recordValue(details.quote)
  const quoteItems = Array.isArray(quote.items) ? quote.items as Record<string, unknown>[] : []
  const hasQuote = Object.keys(quote).length > 0

  return <div className="space-y-4">
    <section className="rounded-lg border bg-muted/20 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Request summary</p>
      <dl className="mt-2 grid gap-x-4 gap-y-3 sm:grid-cols-2">
        <div><dt className="text-xs text-muted-foreground">Requested by</dt><dd className="text-sm">{request.requested_by_name} · {request.requested_by_role}</dd></div>
        <div><dt className="text-xs text-muted-foreground">Requested</dt><dd className="text-sm">{new Date(request.requested_at).toLocaleString()}</dd></div>
        <div className="sm:col-span-2"><dt className="text-xs text-muted-foreground">Reason</dt><dd className="whitespace-pre-wrap text-sm">{request.reason || "No reason provided"}</dd></div>
      </dl>
    </section>
    {hasQuote && <section className="rounded-lg border p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Quotation to approve</p>
      <p className="mt-2 font-medium">{String(quote.title || "Quotation")}</p>
      <p className="text-sm text-muted-foreground">{String(quote.lead_name || "Lead")} · {String(quote.business_name || "Business")} · {String(quote.email || "No email")}</p>
      <p className="mt-2 font-semibold">Total: {formatMoney(Number(quote.total_amount || 0), typeof quote.currency === "string" ? quote.currency : "NGN")}{quote.valid_until ? <span className="font-normal text-muted-foreground"> · Valid until {new Date(String(quote.valid_until)).toLocaleDateString()}</span> : null}</p>
      {quoteItems.length > 0 && <div className="mt-3 overflow-x-auto border-t pt-2"><table className="w-full min-w-[440px] text-left text-sm"><thead className="text-xs text-muted-foreground"><tr><th className="py-1 pr-3 font-medium">Item</th><th className="py-1 px-3 text-right font-medium">Qty</th><th className="py-1 px-3 text-right font-medium">Unit price</th><th className="py-1 pl-3 text-right font-medium">Line total</th></tr></thead><tbody className="divide-y">{quoteItems.map((line, index) => <tr key={index}><td className="py-2 pr-3">{String(line.description || "Item")}</td><td className="px-3 py-2 text-right">{Number(line.quantity || 0)}</td><td className="px-3 py-2 text-right whitespace-nowrap">{formatMoney(Number(line.unit_price || 0), "NGN")}</td><td className="py-2 pl-3 text-right whitespace-nowrap">{formatMoney(Number(line.line_total || 0), "NGN")}</td></tr>)}</tbody></table></div>}
    </section>}
    {(detailRows.length > 0 || payloadRows.length > 0 || itemRows.length > 0) && <section className="rounded-lg border p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Approval details</p>
      {detailRows.length > 0 && <dl className="mt-2 grid gap-3 sm:grid-cols-2">{detailRows.map(([key, value]) => <div key={key} className="min-w-0"><dt className="text-xs text-muted-foreground">{fieldLabel(key)}</dt><dd className="break-words text-sm">{formattedValue(key, value, currency)}</dd></div>)}</dl>}
      {payloadRows.length > 0 && <dl className="mt-2 grid gap-3 sm:grid-cols-2">{payloadRows.map(([key, value]) => <div key={key} className="min-w-0"><dt className="text-xs text-muted-foreground">{fieldLabel(key)}</dt><dd className="break-words text-sm">{formattedValue(key, value, currency)}</dd></div>)}</dl>}
      {itemRows.length > 0 && <div className="mt-3"><p className="text-xs text-muted-foreground">Invoice lines ({itemRows.length})</p><ul className="mt-1 divide-y">{itemRows.map((line, index) => <li key={index} className="flex flex-wrap justify-between gap-x-4 py-2 text-sm"><span>{String(line.description || "Item")} · {Number(line.quantity || 0)} × {formatMoney(Number(line.unit_price || 0), currency)}</span><span className="shrink-0 font-medium">{formatMoney(Number(line.line_total || 0), currency)}</span></li>)}</ul></div>}
    </section>}
    {request.status !== "PENDING" && <section className="rounded-lg border bg-muted/20 p-3 text-sm"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Decision</p><p className="mt-2">{request.decided_by_name ? `Decided by ${request.decided_by_name}` : "Decision recorded"}{request.decision_note ? ` · ${request.decision_note}` : ""}</p></section>}
  </div>
}

export default function ApprovalsPage() {
  const searchParams = useSearchParams()
  const requestedRequestId = searchParams.get("requestId") || ""
  const requestedQuoteId = searchParams.get("quoteId") || ""
  const [requests, setRequests] = useState<ApprovalRequest[]>([])
  const [policies, setPolicies] = useState<ApprovalPolicy[]>([])
  const [currentUserId, setCurrentUserId] = useState("")
  const [allowSelfApproval, setAllowSelfApproval] = useState(false)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState("")
  const [error, setError] = useState("")
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [category, setCategory] = useState<CategoryKey>("ALL")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("PENDING")
  const [search, setSearch] = useState("")
  const [modal, setModal] = useState<ModalState | null>(null)
  const [autoOpenedRequestId, setAutoOpenedRequestId] = useState("")

  const reload = useCallback(async () => {
    setLoading(true); setError("")
    try {
      const response = await fetch("/api/admin/approvals")
      const data = await response.json()
      if (!response.ok || !data.success) throw new Error(data.error || "Could not load approvals")
      setRequests(data.requests || []); setPolicies(data.policies || []); setCurrentUserId(data.currentUserId || ""); setAllowSelfApproval(data.allowSelfApproval === true)
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load approvals") }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void reload() }, [reload])

  async function post(body: Record<string, unknown>, busyKey: string) {
    setBusy(busyKey); setError("")
    try {
      const response = await fetch("/api/admin/approvals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      const data = await response.json()
      if (!response.ok || !data.success) throw new Error(data.error || "Action failed")
      setModal(null); await reload()
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Action failed") }
    finally { setBusy("") }
  }

  const focusedRequest = requests.find((item) => item.id === requestedRequestId) || (requestedQuoteId
    ? requests.find((item) => item.entity_type === "LEAD_QUOTATION" && item.entity_id === requestedQuoteId && item.action_key === "quotation.send" && item.status === "PENDING")
      || requests.find((item) => item.entity_type === "LEAD_QUOTATION" && item.entity_id === requestedQuoteId && item.action_key === "quotation.send")
    : undefined)
  useEffect(() => {
    if (!loading && focusedRequest && autoOpenedRequestId !== focusedRequest.id) {
      setModal({ request: focusedRequest, mode: "view" })
      setAutoOpenedRequestId(focusedRequest.id)
    }
  }, [loading, focusedRequest, autoOpenedRequestId])

  const pendingCount = requests.filter((request) => request.status === "PENDING").length
  const categoryCounts = useMemo(() => Object.fromEntries(CATEGORIES.map(({ key }) => [key, key === "ALL" ? requests.filter((request) => request.status === "PENDING").length : requests.filter((request) => categoryFor(request) === key && request.status === "PENDING").length])) as Record<CategoryKey, number>, [requests])
  const visibleRequests = useMemo(() => {
    const query = search.trim().toLowerCase()
    return requests.filter((request) => {
      const matchesCategory = category === "ALL" || categoryFor(request) === category
      const matchesStatus = statusFilter === "ALL" || (statusFilter === "PENDING" ? request.status === "PENDING" : request.status !== "PENDING")
      const matchesSearch = !query || [request.entity_reference, request.entity_type, request.action_key, request.reason, request.requested_by_name, actionLabel(request, policies)].some((value) => value.toLowerCase().includes(query))
      return matchesCategory && matchesStatus && matchesSearch
    })
  }, [requests, category, statusFilter, search, policies])

  function canDecide(request: ApprovalRequest) { return request.status === "PENDING" && (request.requested_by !== currentUserId || allowSelfApproval) }
  function openDecision(request: ApprovalRequest, decision: "APPROVED" | "REJECTED") { setModal({ request, mode: "decision", decision }) }
  function submitDecision(decision?: "APPROVED" | "REJECTED") {
    if (!modal || modal.mode !== "decision") return
    const note = notes[modal.request.id] || ""
    const finalDecision = decision || modal.decision
    if (!finalDecision) return
    if (finalDecision === "REJECTED" && !note.trim()) { setError("Add a remark before rejecting this request."); return }
    void post({ action: "decide", requestId: modal.request.id, decision: finalDecision, note }, modal.request.id)
  }

  return <div className="space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-2xl font-semibold">Approvals &amp; Workflows</h1><p className="mt-1 text-sm text-muted-foreground">Review requests by team, inspect the details and record a decision.</p></div>
      <Button variant="outline" onClick={() => void reload()} disabled={loading}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>
    </div>
    {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
    {!loading && requestedRequestId && !requests.some((request) => request.id === requestedRequestId) && <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">This approval request is no longer available in your inbox. It may already have been decided or reassigned.</div>}

    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <div><h2 className="font-semibold">Request inbox <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">{pendingCount} pending</span></h2></div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="relative"><span className="sr-only">Search requests</span><Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><input value={search} onChange={(event) => setSearch(event.target.value)} className="h-9 w-52 rounded-md border bg-background pl-8 pr-3 text-sm" placeholder="Search requests" /></label>
          <select aria-label="Request status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)} className="h-9 rounded-md border bg-background px-2 text-sm"><option value="PENDING">Pending</option><option value="ALL">All requests</option><option value="DECIDED">Decided</option></select>
        </div>
      </div>
      <div className="flex gap-1 overflow-x-auto border-b px-3 py-2" aria-label="Approval categories">
        {CATEGORIES.map(({ key, label }) => <button key={key} type="button" onClick={() => setCategory(key)} className={`shrink-0 rounded-md px-3 py-1.5 text-sm transition-colors ${category === key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>{label}<span className={`ml-2 rounded-full px-1.5 py-0.5 text-[10px] ${category === key ? "bg-white/20" : "bg-muted"}`}>{categoryCounts[key]}</span></button>)}
      </div>
      {loading ? <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin" /></div> : visibleRequests.length === 0 ? <div className="py-12 text-center text-sm text-muted-foreground">{requests.length === 0 ? "No approval requests yet." : "No requests match these filters."}</div> : <div className="overflow-x-auto">
        <table className="w-full min-w-[850px] text-sm">
          <thead className="bg-muted/40 text-left text-xs text-muted-foreground"><tr><th className="w-10 px-3 py-2"></th><th className="px-3 py-2 font-medium">Request</th><th className="px-3 py-2 font-medium">Requested by</th><th className="px-3 py-2 font-medium">Reason</th><th className="px-3 py-2 font-medium">Date</th><th className="px-3 py-2 font-medium">Status</th><th className="w-36 px-3 py-2 text-right font-medium">Actions</th></tr></thead>
          <tbody className="divide-y">
            {visibleRequests.map((request) => {
              const Icon = actionIcon(request)
              const rowBusy = busy === request.id
              const selfRequest = request.status === "PENDING" && request.requested_by === currentUserId && !allowSelfApproval
              return <tr key={request.id} className={`hover:bg-muted/30 ${request.id === focusedRequest?.id ? "bg-retail/5" : ""}`}>
                <td className="px-3 py-2.5"><span title={CATEGORIES.find((item) => item.key === categoryFor(request))?.label} className={`flex h-8 w-8 items-center justify-center rounded-md ${categoryFor(request) === "FINANCE" ? "bg-emerald-50 text-emerald-700" : categoryFor(request) === "SALES" ? "bg-blue-50 text-blue-700" : categoryFor(request) === "DATA" ? "bg-violet-50 text-violet-700" : "bg-slate-100 text-slate-700"}`}><Icon className="h-4 w-4" /></span></td>
                <td className="px-3 py-2.5"><div className="font-medium">{request.entity_type === "INVOICE" ? "Invoice" : enumLabel(request.entity_type)} <span className="text-muted-foreground">{request.entity_reference}</span></div><div className="text-xs text-muted-foreground">{actionLabel(request, policies)}</div></td>
                <td className="px-3 py-2.5"><div>{request.requested_by_name}</div><div className="text-xs text-muted-foreground">{request.requested_by_role}</div></td>
                <td className="max-w-[260px] px-3 py-2.5"><span className="block truncate text-muted-foreground" title={request.reason}>{request.reason || "—"}</span></td>
                <td className="whitespace-nowrap px-3 py-2.5 text-xs text-muted-foreground"><span className="flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" />{new Date(request.requested_at).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</span></td>
                <td className="px-3 py-2.5"><span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${statusClass(request.status)}`}>{enumLabel(request.status)}</span></td>
                <td className="px-3 py-2.5"><div className="flex justify-end gap-1">
                  <button type="button" onClick={() => setModal({ request, mode: "view" })} aria-label={`View ${request.entity_reference}`} title="View what you are approving" className="rounded-md p-2 text-muted-foreground hover:bg-blue-50 hover:text-blue-700"><Eye className="h-4 w-4" /></button>
                  {request.status === "PENDING" && <button type="button" onClick={() => { setError(""); setModal({ request, mode: "decision" }) }} aria-label="Add remarks" title="Remarks" className="rounded-md p-2 text-muted-foreground hover:bg-amber-50 hover:text-amber-700"><MessageSquareText className="h-4 w-4" /></button>}
                  {canDecide(request) && <><button type="button" disabled={Boolean(busy)} onClick={() => openDecision(request, "REJECTED")} aria-label="Reject request" title="Reject" className="rounded-md p-2 text-red-700 hover:bg-red-50 disabled:opacity-40"><X className="h-4 w-4" /></button><button type="button" disabled={Boolean(busy)} onClick={() => openDecision(request, "APPROVED")} aria-label="Approve request" title="Approve" className="rounded-md p-2 text-emerald-700 hover:bg-emerald-50 disabled:opacity-40">{rowBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}</button></>}
                  {selfRequest && <span className="self-center text-xs text-muted-foreground" title="You cannot approve your own request">Self request</span>}
                  {request.status !== "PENDING" && request.decision_note && <button type="button" onClick={() => setModal({ request, mode: "view" })} aria-label="View decision remarks" title="View decision remarks" className="rounded-md p-2 text-muted-foreground hover:bg-muted"><MessageSquareText className="h-4 w-4" /></button>}
                </div></td>
              </tr>
            })}
          </tbody>
        </table>
      </div>}
    </div>

    {modal && <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-3 sm:p-6" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setModal(null) }}>
      <section role="dialog" aria-modal="true" aria-labelledby="approval-modal-title" className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border bg-background shadow-xl">
        <header className="flex items-start justify-between gap-4 border-b px-5 py-4"><div><h2 id="approval-modal-title" className="font-semibold">{modal.mode === "view" ? "Review request" : modal.decision === "REJECTED" ? "Reject request" : modal.decision === "APPROVED" ? "Approve request" : "Add remarks"}</h2><p className="mt-1 text-sm text-muted-foreground">{enumLabel(modal.request.entity_type)} {modal.request.entity_reference} · {actionLabel(modal.request, policies)}</p></div><button type="button" onClick={() => setModal(null)} disabled={Boolean(busy)} aria-label="Close dialog" className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"><X className="h-5 w-5" /></button></header>
        <div className="overflow-y-auto p-5">{error && <div role="alert" className="mb-4 rounded-md border border-red-200 bg-red-50 p-2.5 text-sm text-red-800">{error}</div>}{modal.mode === "view" ? <ApprovalRequestDetails request={modal.request} /> : <div className="space-y-4"><div className="rounded-lg border bg-muted/20 p-3"><p className="text-sm font-medium">{modal.request.reason || "No reason provided"}</p><p className="mt-1 text-xs text-muted-foreground">Requested by {modal.request.requested_by_name} · {new Date(modal.request.requested_at).toLocaleString()}</p></div><label className="block space-y-1.5 text-sm"><span className="font-medium">Remarks {modal.decision === "REJECTED" ? "(required)" : "(optional)"}</span><textarea autoFocus value={notes[modal.request.id] || ""} onChange={(event) => setNotes((current) => ({ ...current, [modal.request.id]: event.target.value }))} rows={4} maxLength={2000} className="w-full resize-y rounded-md border bg-background px-3 py-2" placeholder={modal.decision === "REJECTED" ? "Explain why this request is being rejected" : "Add an optional decision remark"} /></label></div>}</div>
        <footer className="flex flex-wrap justify-end gap-2 border-t bg-muted/20 px-5 py-3"><Button variant="outline" onClick={() => setModal(null)} disabled={Boolean(busy)}>{modal.mode === "view" ? "Close" : "Cancel"}</Button>{modal.mode === "view" && canDecide(modal.request) ? <><Button variant="outline" className="border-red-200 text-red-700 hover:bg-red-50" onClick={() => { setError(""); setModal({ request: modal.request, mode: "decision", decision: "REJECTED" }) }}><X className="mr-1.5 h-4 w-4" />Reject</Button><Button onClick={() => setModal({ request: modal.request, mode: "decision", decision: "APPROVED" })}><Check className="mr-1.5 h-4 w-4" />Approve</Button></> : modal.mode === "decision" && canDecide(modal.request) && (modal.decision ? <Button onClick={() => submitDecision()} disabled={Boolean(busy)}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{modal.decision === "REJECTED" ? "Confirm rejection" : "Confirm approval"}</Button> : <><Button variant="outline" className="border-red-200 text-red-700 hover:bg-red-50" onClick={() => submitDecision("REJECTED")} disabled={Boolean(busy)}>Reject with remark</Button><Button onClick={() => submitDecision("APPROVED")} disabled={Boolean(busy)}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Approve with remark</Button></>)}</footer>
      </section>
    </div>}
  </div>
}
