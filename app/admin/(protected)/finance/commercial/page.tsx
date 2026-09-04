"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Landmark, FileText, CreditCard, AlertCircle, Repeat, Calendar, Gift, Wallet } from "lucide-react"
import Link from "next/link"
import type { FinanceOverview } from "@/lib/finance-commercial"

function formatNgn(n: number) {
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `₦${(n / 1_000).toFixed(0)}K`
  return `₦${n.toFixed(0)}`
}

function KpiCard({
  title,
  value,
  sub,
  icon: Icon,
}: {
  title: string
  value: string
  sub?: string
  icon: React.ElementType
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
            <p className="text-2xl font-bold tracking-tight">{value}</p>
            {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
          </div>
          <div className="p-2.5 rounded-lg bg-muted">
            <Icon className="w-5 h-5 text-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function CommercialFinancePage() {
  const [overview, setOverview] = useState<FinanceOverview | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/admin/finance/commercial?action=overview")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) setOverview(data.overview)
      })
      .catch(() => setOverview(null))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Landmark className="w-5 h-5" />
            Commercial Finance
          </h2>
          <p className="text-muted-foreground">Customer billing, payments, subscriptions and partner commissions.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/finance/transactions">Bookkeeping</Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/admin/finance">Investor Dashboard</Link>
          </Button>
        </div>
      </div>

      {overview ? (
        <>
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Commercial Overview</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <KpiCard title="Invoices Issued" value={String(overview.invoices_issued)} icon={FileText} />
              <KpiCard title="Payments Received" value={formatNgn(overview.payments_received)} icon={CreditCard} />
              <KpiCard title="Outstanding" value={formatNgn(overview.outstanding_balance)} icon={Wallet} />
              <KpiCard title="Overdue Invoices" value={`${overview.overdue_invoices} · ${formatNgn(overview.overdue_balance)}`} icon={AlertCircle} />
              <KpiCard title="Active Subscriptions" value={String(overview.active_subscriptions)} icon={Repeat} />
              <KpiCard title="Renewals (30d)" value={String(overview.renewals_30_days)} icon={Calendar} />
              <KpiCard title="Renewals (7d)" value={String(overview.renewals_7_days)} icon={Calendar} />
              <KpiCard title="Commissions Payable" value={formatNgn(overview.commission_payable)} icon={Gift} />
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Operational Modules</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: "Quotes", href: "/admin/finance/quotes", desc: "Customer quotations" },
                { label: "Invoices", href: "/admin/finance/invoices", desc: "Issue & manage invoices" },
                { label: "Payments", href: "/admin/finance/payments", desc: "Record & confirm payments" },
                { label: "Subscriptions", href: "/admin/finance/subscriptions", desc: "Activate & renew subscriptions" },
                { label: "Renewals", href: "/admin/finance/renewals", desc: "Renewal pipeline" },
                { label: "Partner Commissions", href: "/admin/finance/commissions", desc: "Approve & pay commissions" },
                { label: "Commission Payouts", href: "/admin/finance/payouts", desc: "Payout batches" },
                { label: "Reports", href: "/admin/finance/reports", desc: "Commercial reports" },
              ].map((m) => (
                <Card key={m.href} className="hover:bg-muted/50 transition-colors">
                  <CardContent className="p-4">
                    <Link href={m.href} className="block space-y-1">
                      <p className="font-semibold text-sm">{m.label}</p>
                      <p className="text-xs text-muted-foreground">{m.desc}</p>
                    </Link>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </>
      ) : (
        <p className="text-muted-foreground">Failed to load commercial finance data.</p>
      )}
    </div>
  )
}
