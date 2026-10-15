"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Search, X, ArrowLeft, CheckCircle2, Wallet } from "lucide-react"
import { formatMoney } from "@/lib/money-format"
import { enumLabel } from "@/lib/utils"

interface Payment {
  id: string
  payment_reference: string
  business_id?: string | null
  invoice_id?: string | null
  amount: number
  currency: string
  payment_method: string
  status: string
  paid_at?: string | null
  created_at?: string
  notes?: string | null
  payment_account_id?: string | null
  businesses?: { business_name: string } | null
  invoices?: { invoice_number: string } | null
  payment_accounts?: { id: string; name: string } | null
}

/** Active receiving account from the ledger (GET /api/admin/finance/ledger?resource=payment-accounts). */
interface PaymentAccountOption {
  id: string
  name: string
  bank_name?: string | null
  account_number_last4?: string | null
  payment_method?: string | null
  is_default: boolean
  active: boolean
  gl_accounts?: { code: string; name: string } | null
}

/** Option label: "Primary Bank · ····1234 · maps Paystack · Default" */
function paymentAccountLabel(a: PaymentAccountOption): string {
  return [
    a.name,
    a.account_number_last4 ? `····${a.account_number_last4}` : null,
    a.payment_method ? `maps ${enumLabel(a.payment_method)}` : null,
    a.is_default ? "Default" : null,
  ].filter(Boolean).join(" · ")
}

const METHODS = ["BANK_TRANSFER", "PAYSTACK", "FLUTTERWAVE", "CASH", "POS", "OTHER"]
const STATUSES = ["PENDING", "CONFIRMED", "FAILED", "REVERSED", "REFUNDED", "PARTIALLY_REFUNDED"]

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-700",
  CONFIRMED: "bg-green-50 text-green-700",
  FAILED: "bg-red-50 text-red-700",
  REVERSED: "bg-gray-100 text-gray-600",
  REFUNDED: "bg-purple-50 text-purple-700",
  PARTIALLY_REFUNDED: "bg-purple-50 text-purple-700",
}

function thisMonthKey(): string {
  return new Date().toISOString().slice(0, 7)
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState("")

  const [filterMethod, setFilterMethod] = useState<string>("all")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [filterPaidFrom, setFilterPaidFrom] = useState<string>("")
  const [filterPaidTo, setFilterPaidTo] = useState<string>("")
  const [searchQuery, setSearchQuery] = useState("")
  const filtersActive = filterMethod !== "all" || filterStatus !== "all" || filterPaidFrom !== "" || filterPaidTo !== "" || searchQuery.trim() !== ""

  const [paymentAccounts, setPaymentAccounts] = useState<PaymentAccountOption[]>([])

  const [confirmTarget, setConfirmTarget] = useState<Payment | null>(null)
  const [confirmAccountId, setConfirmAccountId] = useState("")
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    fetchPayments()
    fetchPaymentAccounts()
  }, [])

  async function fetchPaymentAccounts() {
    try {
      const res = await fetch("/api/admin/finance/ledger?resource=payment-accounts")
      const data = await res.json()
      if (data.success && Array.isArray(data.data)) {
        setPaymentAccounts((data.data as PaymentAccountOption[]).filter((a) => a.active))
      }
    } catch {
      // Non-critical: confirming still works with "Auto" routing.
    }
  }

  async function fetchPayments() {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/finance/commercial/payments")
      const data = await res.json()
      if (data.success && data.data) setPayments(data.data as Payment[])
    } catch {
      setMessage("Failed to load payments")
    } finally {
      setLoading(false)
    }
  }

  const kpis = useMemo(() => {
    const sum = (list: Payment[]) => list.reduce((acc, p) => acc + (Number(p.amount) || 0), 0)
    const monthKey = thisMonthKey()
    return {
      collected: sum(payments.filter((p) => p.status === "CONFIRMED")),
      pending: sum(payments.filter((p) => p.status === "PENDING")),
      thisMonthCount: payments.filter((p) => (p.paid_at || p.created_at || "").slice(0, 7) === monthKey).length,
      reversedRefundedCount: payments.filter((p) => ["REVERSED", "REFUNDED", "PARTIALLY_REFUNDED"].includes(p.status)).length,
    }
  }, [payments])

  const filteredPayments = useMemo(() => {
    let list = payments
    if (filterMethod !== "all") list = list.filter((p) => p.payment_method === filterMethod)
    if (filterStatus !== "all") list = list.filter((p) => p.status === filterStatus)
    if (filterPaidFrom) list = list.filter((p) => (p.paid_at || "").slice(0, 10) >= filterPaidFrom)
    if (filterPaidTo) list = list.filter((p) => (p.paid_at || "").slice(0, 10) <= filterPaidTo)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter(
        (p) =>
          (p.payment_reference || "").toLowerCase().includes(q) ||
          (p.businesses?.business_name || "").toLowerCase().includes(q) ||
          (p.invoices?.invoice_number || "").toLowerCase().includes(q)
      )
    }
    return list.sort((a, b) => new Date(b.paid_at || b.created_at || 0).getTime() - new Date(a.paid_at || a.created_at || 0).getTime())
  }, [payments, filterMethod, filterStatus, filterPaidFrom, filterPaidTo, searchQuery])

  function openConfirm(payment: Payment) {
    setConfirmTarget(payment)
    setConfirmAccountId("")
  }

  async function confirmPaymentRecord() {
    if (!confirmTarget) return
    setConfirming(true)
    setMessage("")
    try {
      const res = await fetch("/api/admin/finance/commercial/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "confirm",
          // Same contract as the invoices page: omit payment_account_id for
          // "Auto — route by payment method".
          data: {
            id: confirmTarget.id,
            ...(confirmAccountId ? { payment_account_id: confirmAccountId } : {}),
          },
        }),
      })
      const data = await res.json()
      if (data.success) {
        setMessage("Payment confirmed and applied")
        setConfirmTarget(null)
        fetchPayments()
      } else {
        setMessage(data.error || "Failed to confirm payment")
      }
    } catch {
      setMessage("Failed to confirm payment")
    } finally {
      setConfirming(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/admin/finance" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="mr-1 h-4 w-4" /> Back to Finance
          </Link>
          <h2 className="mt-1 text-2xl font-bold tracking-tight flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Payments
          </h2>
          <p className="text-sm text-muted-foreground">All invoice payments across the platform.</p>
        </div>
        <Link href="/admin/finance/invoices">
          <Button variant="outline">
            <Search className="mr-1 h-4 w-4" /> Invoice Collections
          </Button>
        </Link>
      </div>

      {message && (
        <p className={`text-sm ${message.includes("confirmed") ? "text-emerald-600" : "text-red-500"}`}>{message}</p>
      )}

      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Collected</p>
            <p className="mt-1 text-xl font-bold text-emerald-600">{formatMoney(kpis.collected)}</p>
            <p className="text-xs text-muted-foreground">Confirmed payments</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Pending</p>
            <p className="mt-1 text-xl font-bold text-amber-600">{formatMoney(kpis.pending)}</p>
            <p className="text-xs text-muted-foreground">Awaiting confirmation</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">This Month</p>
            <p className="mt-1 text-xl font-bold">{kpis.thisMonthCount}</p>
            <p className="text-xs text-muted-foreground">Payments dated this month</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Reversed / Refunded</p>
            <p className="mt-1 text-xl font-bold text-red-600">{kpis.reversedRefundedCount}</p>
            <p className="text-xs text-muted-foreground">Reversed, refunded or partially refunded</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by reference, business or invoice #..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm"
          />
        </div>
        <select
          value={filterMethod}
          onChange={(e) => setFilterMethod(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="all">All Methods</option>
          {METHODS.map((m) => (
            <option key={m} value={m}>{enumLabel(m)}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="all">All Statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{enumLabel(s)}</option>
          ))}
        </select>
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">Paid</label>
          <input
            type="date"
            value={filterPaidFrom}
            onChange={(e) => setFilterPaidFrom(e.target.value)}
            className="rounded-md border border-input bg-background px-2 py-2 text-sm"
            aria-label="Paid date from"
          />
          <span className="text-xs text-muted-foreground">to</span>
          <input
            type="date"
            value={filterPaidTo}
            onChange={(e) => setFilterPaidTo(e.target.value)}
            className="rounded-md border border-input bg-background px-2 py-2 text-sm"
            aria-label="Paid date to"
          />
        </div>
        {filtersActive && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSearchQuery("")
              setFilterMethod("all")
              setFilterStatus("all")
              setFilterPaidFrom("")
              setFilterPaidTo("")
            }}
          >
            <X className="mr-1 h-3.5 w-3.5" /> Clear filters
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : filteredPayments.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              <Wallet className="h-10 w-10 mx-auto mb-3" />
              <p>No payments found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Reference</th>
                    <th className="px-3 py-2 font-medium">Business</th>
                    <th className="px-3 py-2 font-medium">Invoice #</th>
                    <th className="px-3 py-2 font-medium text-right">Amount</th>
                    <th className="px-3 py-2 font-medium">Method</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Paid Date</th>
                    <th className="px-3 py-2 font-medium">Receiving Account</th>
                    <th className="px-3 py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPayments.map((p) => (
                    <tr key={p.id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="px-3 py-2 font-mono text-xs">{p.payment_reference}</td>
                      <td className="px-3 py-2">{p.businesses?.business_name || "—"}</td>
                      <td className="px-3 py-2 font-mono text-xs">{p.invoices?.invoice_number || "—"}</td>
                      <td className="px-3 py-2 text-right">{formatMoney(p.amount, p.currency)}</td>
                      <td className="px-3 py-2">{enumLabel(p.payment_method)}</td>
                      <td className="px-3 py-2">
                        <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium ${STATUS_COLORS[p.status] || "bg-gray-100 text-gray-700"}`}>
                          {enumLabel(p.status)}
                        </span>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">{(p.paid_at || "").slice(0, 10) || "—"}</td>
                      <td className="px-3 py-2">
                        {p.payment_accounts?.name || <span className="text-xs italic text-muted-foreground">Auto-routed</span>}
                      </td>
                      <td className="px-3 py-2">
                        {p.status === "PENDING" && (
                          <button
                            onClick={() => openConfirm(p)}
                            className="p-1.5 rounded-md text-muted-foreground hover:text-green-600 hover:bg-green-50"
                            title="Confirm Payment"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {confirmTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-background shadow-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Confirm Payment</h3>
              <button onClick={() => setConfirmTarget(null)} className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Reference {confirmTarget.payment_reference}</p>
              {confirmTarget.businesses?.business_name && <p className="text-sm text-muted-foreground">{confirmTarget.businesses.business_name}{confirmTarget.invoices?.invoice_number ? ` · ${confirmTarget.invoices.invoice_number}` : ""}</p>}
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Amount</label>
              <input
                type="text"
                value={formatMoney(confirmTarget.amount, confirmTarget.currency)}
                readOnly
                disabled
                className="w-full rounded-md border border-input bg-muted px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Receiving account</label>
              <select
                value={confirmAccountId}
                onChange={(e) => setConfirmAccountId(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Auto — route by payment method</option>
                {paymentAccounts.map((a) => (
                  <option key={a.id} value={a.id}>{paymentAccountLabel(a)}</option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">Auto picks the default account for the payment method (e.g. Paystack/Flutterwave settlement accounts).</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirmTarget(null)} disabled={confirming}>Cancel</Button>
              <Button onClick={confirmPaymentRecord} disabled={confirming}>
                {confirming ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1 h-4 w-4" />}
                Confirm Payment
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
