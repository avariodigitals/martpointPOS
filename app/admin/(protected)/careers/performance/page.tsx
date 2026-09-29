"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2 } from "lucide-react"
import { formatKobo } from "@/lib/careers"

interface Metrics {
  leadsReceived: number
  firstResponseMinutes: number | null
  contactRate: number | null
  qualifiedLeads: number
  demosBooked: number
  demosCompleted: number
  demoAttendanceRate: number | null
  proposalsIssued: number
  paymentsReceived: number
  leadToPaymentConversion: number | null
  demoToPaymentConversion: number | null
  revenueCollectedKobo: number
  avgSalesCycleDays: number | null
  customersActivated: number
  timeToActivationDays: number | null
  activeUsage14Days: number | null
  activeUsage30Days: number | null
  supportResponseMinutes: number | null
  customerSatisfaction: number | null
  renewalsDue: number
  renewalRate: number | null
  churnedCustomers: number
  commissionEarnedKobo: number
  commissionApprovedKobo: number
  commissionPaidKobo: number
  pendingHandovers: number
}

function pct(v: number | null | undefined) {
  return v == null ? "—" : `${v}%`
}
function mins(v: number | null | undefined) {
  if (v == null) return "—"
  if (v >= 60) return `${(v / 60).toFixed(1)}h`
  return `${v}m`
}

export default function PerformancePage() {
  const [loading, setLoading] = useState(true)
  const [m, setM] = useState<Metrics | null>(null)

  useEffect(() => {
    fetch("/api/admin/careers/performance")
      .then((r) => r.json())
      .then((d) => setM(d.metrics || null))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
  if (!m) return <p className="text-sm text-muted-foreground">No performance data available.</p>

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Workforce Performance</h2>
        <p className="text-muted-foreground">
          Conversion, collected revenue, activation, usage and retention — raw activity alone is not rewarded.
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Conversion pipeline</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <Stat label="Leads received" value={m.leadsReceived} />
          <Stat label="First-response time" value={mins(m.firstResponseMinutes)} />
          <Stat label="Contact rate" value={pct(m.contactRate)} />
          <Stat label="Qualified leads" value={m.qualifiedLeads} />
          <Stat label="Demos booked" value={m.demosBooked} />
          <Stat label="Demos completed" value={m.demosCompleted} />
          <Stat label="Demo attendance" value={pct(m.demoAttendanceRate)} />
          <Stat label="Proposals issued" value={m.proposalsIssued} />
          <Stat label="Payments received" value={m.paymentsReceived} />
          <Stat label="Lead → payment" value={pct(m.leadToPaymentConversion)} />
          <Stat label="Demo → payment" value={pct(m.demoToPaymentConversion)} />
          <Stat label="Avg sales cycle" value={m.avgSalesCycleDays == null ? "—" : `${m.avgSalesCycleDays}d`} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Revenue & commission</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Stat label="Revenue collected" value={formatKobo(m.revenueCollectedKobo)} />
          <Stat label="Commission earned" value={formatKobo(m.commissionEarnedKobo)} />
          <Stat label="Commission approved" value={formatKobo(m.commissionApprovedKobo)} />
          <Stat label="Commission paid" value={formatKobo(m.commissionPaidKobo)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Activation, usage & retention</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <Stat label="Customers activated" value={m.customersActivated} />
          <Stat label="Time to activation" value={m.timeToActivationDays == null ? "—" : `${m.timeToActivationDays}d`} />
          <Stat label="Active usage (14d)" value={m.activeUsage14Days == null ? "—" : pct(m.activeUsage14Days)} />
          <Stat label="Active usage (30d)" value={m.activeUsage30Days == null ? "—" : pct(m.activeUsage30Days)} />
          <Stat label="Renewals due" value={m.renewalsDue} />
          <Stat label="Churned customers" value={m.churnedCustomers} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Support & pipeline health</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Stat label="Support response time" value={mins(m.supportResponseMinutes)} />
          <Stat label="Customer satisfaction" value={m.customerSatisfaction == null ? "—" : `${m.customerSatisfaction}/5`} />
          <Stat label="Pending handovers" value={m.pendingHandovers} />
        </CardContent>
      </Card>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-[11px] uppercase text-muted-foreground">{label}</p>
      <p className="text-xl font-bold mt-1">{value}</p>
    </div>
  )
}
