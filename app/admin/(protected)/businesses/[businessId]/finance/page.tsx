"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Loader2, Building2, Receipt, CreditCard, RefreshCw, Award, BookOpen, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react"
import { formatMoney } from "@/lib/money-format"
import { enumLabel } from "@/lib/utils"

function fmtMoney(amount: number, currency = "NGN") {
  return formatMoney(amount, currency)
}

function fmtDate(iso?: string | null) {
  if (!iso) return "—"
  try { return new Date(iso).toLocaleDateString() } catch { return iso }
}

function StatusBadge({ status }: { status?: string }) {
  const color =
    status === "PAID" || status === "ACTIVE" ? "bg-green-100 text-green-700" :
    status === "PARTIALLY_PAID" || status === "PAST_DUE" ? "bg-amber-100 text-amber-700" :
    status === "OVERDUE" || status === "FAILED" ? "bg-red-100 text-red-700" :
    status === "SUSPENDED" || status === "CANCELLED" ? "bg-gray-100 text-gray-700" :
    "bg-blue-100 text-blue-700"
  return <span className={`text-xs uppercase px-2 py-0.5 rounded-full font-medium ${color}`}>{status || "—"}</span>
}

const ENDPOINTS = [
  ["quotes", "/api/admin/finance/commercial/quotes"],
  ["invoices", "/api/admin/finance/commercial/invoices"],
  ["payments", "/api/admin/finance/commercial/payments"],
  ["subscriptions", "/api/admin/finance/commercial/subscriptions"],
  ["renewals", "/api/admin/finance/commercial/renewals"],
  ["commissions", "/api/admin/finance/commercial/commissions"],
] as const

type StatementRow = {
  key: string
  date: string
  reference: string
  description: string
  charge: number
  payment: number
  balance: number
}

type StmtSortKey = "date" | "reference" | "charge" | "payment" | "balance"

export default function BusinessFinancePage() {
  const { businessId } = useParams() as { businessId: string }
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [business, setBusiness] = useState<any>(null)
  const [quotes, setQuotes] = useState<any[]>([])
  const [invoices, setInvoices] = useState<any[]>([])
  const [payments, setPayments] = useState<any[]>([])
  const [subscriptions, setSubscriptions] = useState<any[]>([])
  const [renewals, setRenewals] = useState<any[]>([])
  const [commissions, setCommissions] = useState<any[]>([])
  const [stmtSort, setStmtSort] = useState<{ key: StmtSortKey; dir: 1 | -1 }>({ key: "date", dir: 1 })

  useEffect(() => {
    if (!businessId) return
    async function load() {
      setLoading(true)
      setError("")
      try {
        const [businessRes, ...financeRes] = await Promise.all([
          fetch(`/api/admin/businesses?id=${businessId}`).then((r) => r.json()),
          ...ENDPOINTS.map(([, path]) =>
            fetch(`${path}?businessId=${businessId}`).then((r) => r.json())
          ),
        ])
        if (businessRes.business) setBusiness(businessRes.business)
        const data = (idx: number) => financeRes[idx]?.data || []
        setQuotes(data(0))
        setInvoices(data(1))
        setPayments(data(2))
        setSubscriptions(data(3))
        setRenewals(data(4))
        setCommissions(data(5))
      } catch {
        setError("Failed to load finance data. Please try again.")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [businessId])

  const businessName =
    business?.businessName ||
    quotes[0]?.businesses?.business_name ||
    invoices[0]?.businesses?.business_name ||
    businessId

  const originatingPartnerId =
    business?.originatingPartnerId ||
    quotes[0]?.businesses?.originating_partner_id ||
    invoices[0]?.businesses?.originating_partner_id

  const activeSubscription = subscriptions.find((s) => s.status === "ACTIVE") || subscriptions[0]
  const activePlan = activeSubscription?.plans
  const activeAddons = activeSubscription?.subscription_addons || []

  const outstandingBalance = invoices
    .filter((inv) => inv.status !== "VOID" && inv.status !== "CANCELLED")
    .reduce((sum, inv) => sum + (inv.balance_due || 0), 0)

  const currency = activeSubscription?.currency || invoices[0]?.currency || "NGN"

  const businessRenewals = renewals.filter(
    (r) => r.subscriptions?.business_id === businessId || r.business_id === businessId
  )
  const nextRenewal = businessRenewals[0]
  const renewalDate = nextRenewal?.renewal_due_date || activeSubscription?.renewal_date

  const commissionTotal = commissions.reduce(
    (sum, c) => sum + (c.commission_amount || 0),
    0
  )

  // Per-business statement: invoices are charges (money owed), confirmed payments are credits.
  // Running balance is always computed chronologically, then rows are displayed in the chosen sort order.
  const statementRows = useMemo<StatementRow[]>(() => {
    const rows: StatementRow[] = []
    for (const inv of invoices) {
      if (inv.status === "VOID" || inv.status === "CANCELLED") continue
      rows.push({
        key: `inv-${inv.id}`,
        date: String(inv.issue_date || inv.created_at || "").slice(0, 10),
        reference: inv.invoice_number,
        description: `Invoice ${inv.invoice_number}`,
        charge: Number(inv.total_amount) || 0,
        payment: 0,
        balance: 0,
      })
    }
    for (const p of payments) {
      if (p.status !== "CONFIRMED") continue
      rows.push({
        key: `pay-${p.id}`,
        date: String(p.paid_at || p.created_at || "").slice(0, 10),
        reference: p.payment_reference,
        description: `Payment received · ${enumLabel(String(p.payment_method || ""))}`,
        charge: 0,
        payment: Number(p.amount) || 0,
        balance: 0,
      })
    }
    rows.sort((a, b) => a.date.localeCompare(b.date) || a.reference.localeCompare(b.reference))
    let bal = 0
    for (const r of rows) {
      bal += r.charge - r.payment
      r.balance = bal
    }
    return rows
  }, [invoices, payments])

  const sortedStatementRows = useMemo(() => {
    const { key, dir } = stmtSort
    return [...statementRows].sort((a, b) => {
      let cmp = 0
      if (key === "date") cmp = a.date.localeCompare(b.date) || a.reference.localeCompare(b.reference)
      else if (key === "reference") cmp = a.reference.localeCompare(b.reference)
      else cmp = a[key] - b[key]
      return cmp * dir
    })
  }, [statementRows, stmtSort])

  const closingBalance = statementRows.length ? statementRows[statementRows.length - 1].balance : 0

  function toggleStatementSort(key: StmtSortKey) {
    setStmtSort((prev) => (prev.key === key ? { key, dir: (prev.dir * -1) as 1 | -1 } : { key, dir: 1 }))
  }

  function renderSortableTh(label: string, sortKey: StmtSortKey, right?: boolean) {
    const active = stmtSort.key === sortKey
    return (
      <th key={sortKey} className={`px-4 py-2 ${right ? "text-right" : "text-left"}`}>
        <button type="button" onClick={() => toggleStatementSort(sortKey)} className="inline-flex items-center gap-1 font-medium">
          {label}
          {active ? (
            stmtSort.dir === 1 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
          ) : (
            <ArrowUpDown className="h-3 w-3 opacity-40" />
          )}
        </button>
      </th>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Link href="/admin/businesses" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Businesses
        </Link>
        <p className="text-red-500 text-sm">{error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/businesses" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Businesses
        </Link>
        <h2 className="text-2xl font-bold tracking-tight mt-2 flex items-center gap-2">
          <Building2 className="w-5 h-5" /> {businessName}
        </h2>
        <p className="text-muted-foreground text-sm">Business Finance 360</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Outstanding Balance</p>
            <p className="text-2xl font-bold">{fmtMoney(outstandingBalance, currency)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Renewal Date</p>
            <p className="text-2xl font-bold">{fmtDate(renewalDate)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Commission Amount</p>
            <p className="text-2xl font-bold">{fmtMoney(commissionTotal, currency)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Originating Partner</p>
            <p className="text-2xl font-bold truncate" title={originatingPartnerId || undefined}>
              {originatingPartnerId ? (
                <Link href={`/admin/partners?id=${originatingPartnerId}`} className="hover:underline">
                  {originatingPartnerId}
                </Link>
              ) : "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BookOpen className="w-4 h-4" /> Statement of Account
            </CardTitle>
            <span className="text-xs text-muted-foreground">
              Closing balance: <span className="font-semibold text-foreground">{fmtMoney(closingBalance, currency)}</span>
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {sortedStatementRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No invoices or confirmed payments for this business yet.</p>
          ) : (
            <div className="overflow-x-auto -mx-6">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    {renderSortableTh("Date", "date")}
                    {renderSortableTh("Reference", "reference")}
                    <th className="px-4 py-2 text-left">Description</th>
                    {renderSortableTh("Charge", "charge", true)}
                    {renderSortableTh("Payment", "payment", true)}
                    {renderSortableTh("Balance", "balance", true)}
                  </tr>
                </thead>
                <tbody>
                  {sortedStatementRows.map((r) => (
                    <tr key={r.key} className="border-t border-border">
                      <td className="px-4 py-2 whitespace-nowrap">{fmtDate(r.date)}</td>
                      <td className="px-4 py-2 font-mono text-xs">{r.reference}</td>
                      <td className="px-4 py-2 text-muted-foreground">{r.description}</td>
                      <td className="px-4 py-2 text-right">{r.charge > 0 ? fmtMoney(r.charge, currency) : "—"}</td>
                      <td className="px-4 py-2 text-right text-emerald-600">{r.payment > 0 ? fmtMoney(r.payment, currency) : "—"}</td>
                      <td className="px-4 py-2 text-right font-medium">{fmtMoney(r.balance, currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">Commercial Profile</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><span className="text-muted-foreground">Business name:</span> {business?.businessName || "—"}</div>
              <div><span className="text-muted-foreground">Legal name:</span> {business?.legalName || "—"}</div>
              <div><span className="text-muted-foreground">Contact:</span> {business?.primaryContactName || "—"}</div>
              <div><span className="text-muted-foreground">Email:</span> {business?.primaryEmail || "—"}</div>
              <div><span className="text-muted-foreground">Phone:</span> {business?.primaryPhone || "—"}</div>
              <div><span className="text-muted-foreground">Status:</span> <StatusBadge status={business?.status} /></div>
              <div><span className="text-muted-foreground">Source:</span> {business?.source || "—"}</div>
              <div><span className="text-muted-foreground">Location:</span> {[business?.city, business?.state, business?.country].filter(Boolean).join(", ") || "—"}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <RefreshCw className="w-4 h-4" /> Current Plan & Subscription
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {activeSubscription ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Plan</span>
                  <span className="font-medium">{activePlan?.name || activeSubscription.plan_id}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Interval</span>
                  <span className="font-medium">{activeSubscription.billing_interval}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Subscription status</span>
                  <StatusBadge status={activeSubscription.status} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Current period</span>
                  <span className="font-medium">{fmtDate(activeSubscription.current_period_start)} – {fmtDate(activeSubscription.current_period_end)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Auto-renew</span>
                  <span className="font-medium">{activeSubscription.auto_renew ? "Yes" : "No"}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Licence:</span>{" "}
                  <span className="font-medium">{activePlan?.name || activeSubscription.plan_id} {activeSubscription.status}</span>
                </div>
                {activeAddons.length > 0 && (
                  <div className="pt-2">
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Add-ons</p>
                    <div className="flex flex-wrap gap-2">
                      {activeAddons.map((a: any, i: number) => (
                        <span key={i} className="text-xs px-2 py-0.5 rounded-full bg-muted font-medium">
                          {a.addons?.name || a.addon_id} × {a.quantity}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <p className="text-muted-foreground">No active subscription found.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Receipt className="w-4 h-4" /> Invoices
          </CardTitle>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground">No invoices for this business.</p>
          ) : (
            <div className="overflow-x-auto -mx-6">
              <table className="w-full text-sm">
                <thead className="bg-muted text-left">
                  <tr>
                    <th className="px-4 py-2">Invoice</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2">Total</th>
                    <th className="px-4 py-2">Paid</th>
                    <th className="px-4 py-2">Balance</th>
                    <th className="px-4 py-2">Due</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => (
                    <tr key={inv.id} className="border-t border-border">
                      <td className="px-4 py-2 font-medium">{inv.invoice_number}</td>
                      <td className="px-4 py-2"><StatusBadge status={inv.status} /></td>
                      <td className="px-4 py-2">{fmtMoney(inv.total_amount, inv.currency)}</td>
                      <td className="px-4 py-2">{fmtMoney(inv.amount_paid, inv.currency)}</td>
                      <td className="px-4 py-2">{fmtMoney(inv.balance_due, inv.currency)}</td>
                      <td className="px-4 py-2">{fmtDate(inv.due_date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <CreditCard className="w-4 h-4" /> Payments
          </CardTitle>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payments for this business.</p>
          ) : (
            <div className="overflow-x-auto -mx-6">
              <table className="w-full text-sm">
                <thead className="bg-muted text-left">
                  <tr>
                    <th className="px-4 py-2">Reference</th>
                    <th className="px-4 py-2">Method</th>
                    <th className="px-4 py-2">Amount</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2">Paid at</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id} className="border-t border-border">
                      <td className="px-4 py-2 font-medium">{p.payment_reference}</td>
                      <td className="px-4 py-2">{enumLabel(p.payment_method)}</td>
                      <td className="px-4 py-2">{fmtMoney(p.amount, p.currency)}</td>
                      <td className="px-4 py-2"><StatusBadge status={p.status} /></td>
                      <td className="px-4 py-2">{fmtDate(p.paid_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {commissions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Award className="w-4 h-4" /> Commissions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto -mx-6">
              <table className="w-full text-sm">
                <thead className="bg-muted text-left">
                  <tr>
                    <th className="px-4 py-2">Plan</th>
                    <th className="px-4 py-2">Type</th>
                    <th className="px-4 py-2">Amount</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2">Earned</th>
                  </tr>
                </thead>
                <tbody>
                  {commissions.map((c) => (
                    <tr key={c.id} className="border-t border-border">
                      <td className="px-4 py-2 font-medium">{c.commission_plans?.name || c.commission_plan_id}</td>
                      <td className="px-4 py-2">{c.attribution_type}</td>
                      <td className="px-4 py-2">{fmtMoney(c.commission_amount, c.currency)}</td>
                      <td className="px-4 py-2"><StatusBadge status={c.status} /></td>
                      <td className="px-4 py-2">{fmtDate(c.earned_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
