"use client"

import { useCallback, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { type UserRole } from "@/lib/admin-types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, RefreshCw } from "lucide-react"
import { formatMoney } from "@/lib/money-format"
import { enumLabel } from "@/lib/utils"

type ApprovalRequest = {
  id: string; action_key: string; entity_type: string; entity_id: string; entity_reference: string; reason: string; details: Record<string, unknown>
  status: string; requested_by: string; requested_by_name: string; requested_by_role: UserRole; requested_at: string
  decided_by_name?: string | null; decision_note?: string | null
}
type ApprovalPolicy = { action_key: string; label: string; enabled: boolean; approver_roles: UserRole[]; approver_user_ids: string[] }

const FIELD_LABELS: Record<string, string> = {
  amount: "Amount",
  balance_due: "Balance due",
  bank_reference: "Bank reference",
  business_id: "Customer",
  currency: "Currency",
  due_date: "Due date",
  invoice_id: "Invoice",
  notes: "Payment note",
  notes_internal: "Internal note",
  notes_public: "Public note",
  paid_at: "Payment date",
  payment_account_id: "Receiving account",
  payment_method: "Payment method",
  payment_terms: "Payment terms",
  status: "Current status",
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(value)
}

function fieldLabel(key: string): string {
  return FIELD_LABELS[key] || key.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
}

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

function ApprovalRequestDetails({ request }: { request: ApprovalRequest }) {
  const details = recordValue(request.details)
  const payload = recordValue(details.payload)
  const display = recordValue(details.display)
  const currency = typeof payload.currency === "string" ? payload.currency : "NGN"
  const displayNames: Record<string, string> = {
    business_id: String(display.business_name || ""),
    invoice_id: String(display.invoice_number || ""),
  }
  const hiddenKeys = new Set(["quote", "display", "payload", "quote_updated_at", "updated_at_at_request", "requested_action"])
  const detailRows: [string, unknown][] = Object.entries(details).filter(([key, value]) => !hiddenKeys.has(key) && (value === null || ["string", "number", "boolean"].includes(typeof value)))
  const payloadRows = Object.entries(payload).filter(([key, value]) => {
    if (key === "reason" || value === null || value === undefined || key === "items") return false
    if (typeof value === "object") return false
    if ((key === "business_id" || key === "invoice_id") && !displayNames[key]) return false
    return !(typeof value === "string" && isUuid(value))
  })
  if (displayNames.business_id && payload.business_id) payloadRows.unshift(["business_id", displayNames.business_id])
  if (displayNames.invoice_id && payload.invoice_id) payloadRows.splice(displayNames.business_id ? 1 : 0, 0, ["invoice_id", displayNames.invoice_id])
  const itemRows = Array.isArray(payload.items) ? payload.items as Record<string, unknown>[] : []
  if (!detailRows.length && !payloadRows.length && !itemRows.length) return null

  return <div className="mt-3 space-y-3 rounded-lg border bg-muted/20 p-3">
    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Request details</p>
    {detailRows.length > 0 && <dl className="grid gap-2 sm:grid-cols-2">{detailRows.map(([key, value]) => <div key={key} className="min-w-0"><dt className="text-xs text-muted-foreground">{fieldLabel(key)}</dt><dd className="break-words text-sm">{formattedValue(key, value, currency)}</dd></div>)}</dl>}
    {payloadRows.length > 0 && <dl className="grid gap-2 sm:grid-cols-2">{payloadRows.map(([key, value]) => <div key={key} className="min-w-0"><dt className="text-xs text-muted-foreground">{fieldLabel(key)}</dt><dd className="break-words text-sm">{formattedValue(key, value, currency)}</dd></div>)}</dl>}
    {itemRows.length > 0 && <div><p className="text-xs text-muted-foreground">Invoice lines ({itemRows.length})</p><ul className="mt-1 space-y-1">{itemRows.map((line, index) => <li key={index} className="flex flex-wrap justify-between gap-x-4 text-sm"><span>{String(line.description || "Item")} · {Number(line.quantity || 0)} × {formatMoney(Number(line.unit_price || 0), currency)}</span><span>{formatMoney(Number(line.line_total || 0), currency)}</span></li>)}</ul></div>}
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

  const reload = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const response = await fetch("/api/admin/approvals")
      const data = await response.json()
      if (!response.ok || !data.success) throw new Error(data.error || "Could not load approvals")
      setRequests(data.requests || [])
      setPolicies(data.policies || [])
      setCurrentUserId(data.currentUserId || "")
      setAllowSelfApproval(data.allowSelfApproval === true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load approvals")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void reload() }, [reload])

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

  const focusedRequest = requests.find((item) => item.id === requestedRequestId) || (requestedQuoteId
    ? requests.find((item) => item.entity_type === "LEAD_QUOTATION" && item.entity_id === requestedQuoteId && item.action_key === "quotation.send" && item.status === "PENDING")
      || requests.find((item) => item.entity_type === "LEAD_QUOTATION" && item.entity_id === requestedQuoteId && item.action_key === "quotation.send")
    : undefined)
  const focusedRequestId = focusedRequest?.id || requestedRequestId
  const orderedRequests = focusedRequestId
    ? [...requests].sort((a, b) => Number(b.id === focusedRequestId) - Number(a.id === focusedRequestId))
    : requests
  const pending = requests.filter((item) => item.status === "PENDING")
  const requestGroups = [
    { label: "Sales & Quotations", items: orderedRequests.filter((item) => item.action_key === "quotation.send") },
    { label: "Finance", items: orderedRequests.filter((item) => item.action_key.startsWith("finance.")) },
    { label: "Other Workflows", items: orderedRequests.filter((item) => !item.action_key.startsWith("finance.") && item.action_key !== "quotation.send") },
  ].filter((group) => group.items.length > 0)
  const focusedIsQuote = focusedRequest?.action_key === "quotation.send"

  useEffect(() => {
    if (!loading && focusedRequestId) {
      document.getElementById(`approval-request-${focusedRequestId}`)?.scrollIntoView({ behavior: "smooth", block: "center" })
    }
  }, [loading, focusedRequestId, requests])

  return <div className="space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="text-2xl font-semibold">{focusedRequest ? focusedIsQuote ? "Review quotation approval" : "Review approval request" : "Approvals & Workflows"}</h1><p className="mt-1 text-sm text-muted-foreground">{focusedRequest ? `${focusedIsQuote ? "Quotation" : focusedRequest.entity_type} ${focusedRequest.entity_reference} · review the details and record your decision.` : "Review and authorize pending work across Sales, Finance and other teams."}</p></div>
      <Button variant="outline" onClick={() => void reload()} disabled={loading}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>
    </div>
    {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
    {!loading && focusedRequestId && !focusedRequest && <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">This approval request is no longer available in your inbox. It may already have been decided or reassigned.</div>}

    <Card>
      <CardHeader><CardTitle>Request inbox <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900">{pending.length} pending</span></CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {loading && <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>}
        {!loading && requests.length === 0 && <p className="py-5 text-sm text-muted-foreground">No approval requests yet.</p>}
        {requestGroups.map((group) => <section key={group.label} className="space-y-3"><h3 className="border-b pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.label} <span className="ml-1 font-normal">({group.items.length})</span></h3>{group.items.map((item) => <div id={`approval-request-${item.id}`} key={item.id} className={`rounded-lg border p-4 ${item.id === focusedRequestId ? "border-2 border-retail shadow-md" : ""}`}>
          <div className="flex flex-wrap items-start justify-between gap-3"><div>
            <p className="font-medium">{item.entity_type === "INVOICE" ? "Invoice" : item.entity_type} {item.entity_reference}</p>
            <p className="text-sm text-muted-foreground">{policies.find((policy) => policy.action_key === item.action_key)?.label || item.action_key} · Requested by {item.requested_by_name} ({item.requested_by_role}) · {new Date(item.requested_at).toLocaleString()}</p>
          </div><span className={`rounded-full px-2 py-1 text-xs font-medium ${item.status === "PENDING" ? "bg-amber-100 text-amber-900" : item.status === "APPROVED" ? "bg-emerald-100 text-emerald-900" : "bg-slate-100 text-slate-700"}`}>{item.status}</span></div>
          <p className="mt-3 text-sm"><span className="font-medium">Reason:</span> {item.reason}</p>
          {item.action_key === "quotation.send" && Boolean(item.details?.quote) && (() => {
            const quote = item.details.quote as { title?: string; lead_name?: string; business_name?: string; email?: string; total_amount?: number; valid_until?: string | null; items?: Array<{ description?: string; quantity?: number; unit_price?: number; line_total?: number }> }
            return <div className="mt-3 rounded-md border bg-muted/30 p-3 text-sm"><p className="font-semibold">{quote.title || "Quotation details"}</p><p className="mt-1 text-xs text-muted-foreground">{quote.lead_name || "Lead"} · {quote.business_name || "Business"} · {quote.email || "No email"}</p><p className="mt-2 font-medium">Total: ₦{Number(quote.total_amount || 0).toLocaleString("en-NG", { minimumFractionDigits: 2 })}{quote.valid_until ? ` · Valid until ${new Date(quote.valid_until).toLocaleDateString()}` : ""}</p>{quote.items?.length ? <ul className="mt-2 space-y-1 border-t pt-2 text-xs">{quote.items.map((line, index) => <li key={`${item.id}-${index}`} className="flex justify-between gap-3"><span>{line.description} · {line.quantity} × ₦{Number(line.unit_price || 0).toLocaleString("en-NG")}</span><span className="shrink-0">₦{Number(line.line_total || 0).toLocaleString("en-NG")}</span></li>)}</ul> : null}</div>
          })()}
          <ApprovalRequestDetails request={item} />
          {item.status === "PENDING" && (item.requested_by !== currentUserId || allowSelfApproval) ? <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input value={notes[item.id] || ""} onChange={(event) => setNotes((current) => ({ ...current, [item.id]: event.target.value }))} className="min-w-48 flex-1 rounded-md border px-3 py-2 text-sm" placeholder="Decision note; required when rejecting" />
            <Button variant="outline" disabled={Boolean(busy)} onClick={() => void post({ action: "decide", requestId: item.id, decision: "REJECTED", note: notes[item.id] || "" }, item.id)}>Reject</Button>
            <Button disabled={Boolean(busy)} onClick={() => void post({ action: "decide", requestId: item.id, decision: "APPROVED", note: notes[item.id] || "" }, item.id)}>{busy === item.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Approve</Button>
          </div> : item.status === "PENDING" ? <p className="mt-2 text-xs text-muted-foreground">You submitted this request and cannot approve it yourself.</p> : <p className="mt-2 text-xs text-muted-foreground">{item.decided_by_name ? `Decided by ${item.decided_by_name}` : "Decision recorded"}{item.decision_note ? ` · ${item.decision_note}` : ""}</p>}
        </div>)}</section>)}
      </CardContent>
    </Card>
  </div>
}
