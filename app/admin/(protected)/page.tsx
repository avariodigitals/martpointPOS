import type { Metadata } from "next"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Building2,
  Loader2,
  Handshake,
  Target,
  Ticket,
  AlertTriangle,
  Receipt,
  CalendarClock,
  CreditCard,
  UserPlus,
  UserX,
  CheckCircle2,
  TrendingUp,
  HandCoins,
  HeartPulse,
  Headphones,
  ArrowRight,
  ArrowUpRight,
  Users,
} from "lucide-react"
import {
  parseControlPeriod,
  getControlCentreMetrics,
  getRequiresAttention,
  getFinancialSnapshot,
  getPartnerSnapshot,
  getCustomerSnapshot,
  getSupportSnapshot,
  type ControlCentrePeriod,
  type RequiresAttentionItem,
  CONTROL_CENTRE_PERIODS,
} from "@/lib/control-centre"

export const metadata: Metadata = {
  title: "MartPoint Control Centre",
  description: "Executive dashboard for MartPoint platform operations.",
}

export const dynamic = "force-dynamic"

const currency = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  maximumFractionDigits: 0,
})

const number = new Intl.NumberFormat("en-NG")

function fmtCurrency(n: number) {
  return currency.format(n)
}

function fmtNumber(n: number) {
  return number.format(n)
}

function fmtDate(d: string | undefined | null) {
  if (!d) return "—"
  try {
    return new Date(d).toLocaleDateString("en-GB")
  } catch {
    return "—"
  }
}

function PeriodSelector({ period }: { period: ControlCentrePeriod }) {
  const labels: Record<ControlCentrePeriod, string> = {
    today: "Today",
    "7d": "7D",
    "30d": "30D",
    this_month: "MTD",
    quarter: "QTD",
    year: "YTD",
  }

  return (
    <div className="inline-flex items-center gap-1 p-1 bg-muted rounded-lg">
      {CONTROL_CENTRE_PERIODS.map((p) => {
        const active = p === period
        return (
          <Link
            key={p}
            href={`/admin?period=${p}`}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-background/50"
            }`}
          >
            {labels[p]}
          </Link>
        )
      })}
    </div>
  )
}

function StatCard({
  value,
  label,
  icon: Icon,
  href,
  tone = "muted",
}: {
  value: React.ReactNode
  label: string
  icon: React.ComponentType<{ className?: string }>
  href?: string
  tone?: "muted" | "warning" | "destructive" | "success"
}) {
  const toneClass =
    tone === "warning"
      ? "text-warning"
      : tone === "destructive"
        ? "text-destructive"
        : tone === "success"
          ? "text-success"
          : "text-muted-foreground"

  const content = (
    <Card className="h-full">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
          </div>
          <Icon className={`w-5 h-5 ${toneClass}`} />
        </div>
        {href && (
          <Link
            href={href}
            className="inline-flex items-center gap-1 text-xs text-retail mt-3 hover:underline"
          >
            View <ArrowRight className="w-3 h-3" />
          </Link>
        )}
      </CardContent>
    </Card>
  )

  return content
}

function SectionCard({
  title,
  description,
  href,
  icon: Icon,
  children,
}: {
  title: string
  description?: string
  href?: string
  icon: React.ComponentType<{ className?: string }>
  children: React.ReactNode
}) {
  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Icon className="w-4 h-4 text-muted-foreground" />
              {title}
            </CardTitle>
            {description && <CardDescription>{description}</CardDescription>}
          </div>
          {href && (
            <Link href={href} className="text-retail hover:underline flex items-center gap-1 text-xs">
              Open <ArrowUpRight className="w-3 h-3" />
            </Link>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">{children}</CardContent>
    </Card>
  )
}

function ProgressRow({
  label,
  value,
  total,
  color,
}: {
  label: string
  value: number
  total: number
  color: string
}) {
  const pct = total > 0 ? (value / total) * 100 : 0
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">{fmtNumber(value)}</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export default async function ControlCentrePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const raw = Array.isArray(sp?.period) ? sp.period[0] : sp?.period
  const period = parseControlPeriod(raw)

  const [metrics, attention, financial, partner, customer, support] = await Promise.all([
    getControlCentreMetrics(period),
    getRequiresAttention(),
    getFinancialSnapshot(period),
    getPartnerSnapshot(period),
    getCustomerSnapshot(),
    getSupportSnapshot(period),
  ])

  const totalHealth =
    customer.health.HEALTHY +
    customer.health.WATCH +
    customer.health.AT_RISK +
    customer.health.CRITICAL

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Control Centre</h2>
          <p className="text-muted-foreground">Executive view of the MartPoint platform.</p>
        </div>
        <PeriodSelector period={period} />
      </div>

      {/* ─── Current State ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          value={fmtNumber(metrics.current.activeBusinesses)}
          label="Active Businesses"
          icon={Building2}
          href="/admin/businesses"
        />
        <StatCard
          value={fmtNumber(metrics.current.businessesOnboarding)}
          label="Businesses Onboarding"
          icon={Loader2}
          href="/admin/onboarding"
        />
        <StatCard
          value={fmtNumber(metrics.current.activePartners)}
          label="Active Partners"
          icon={Handshake}
          href="/admin/partners"
        />
        <StatCard
          value={fmtNumber(metrics.current.openOpportunities)}
          label="Open Opportunities"
          icon={Target}
          href="/admin/leads"
        />
        <StatCard
          value={fmtNumber(metrics.current.openSupportTickets)}
          label="Open Support Tickets"
          icon={Ticket}
          href="/admin/support"
        />
        <StatCard
          value={fmtNumber(metrics.current.atRiskCustomers)}
          label="At-Risk Customers"
          icon={AlertTriangle}
          tone="destructive"
          href="/admin/customer-success"
        />
        <StatCard
          value={fmtCurrency(metrics.current.outstandingReceivables)}
          label="Outstanding Receivables"
          icon={Receipt}
          href="/admin/finance/commercial/invoices"
        />
        <StatCard
          value={fmtNumber(metrics.current.renewalsDue)}
          label="Renewals Due"
          icon={CalendarClock}
          href="/admin/finance/commercial/renewals"
        />
      </div>

      {/* ─── Period Highlights ─── */}
      <div>
        <h3 className="text-sm font-semibold mb-3">Period Performance</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            value={fmtCurrency(metrics.period.revenueCollected)}
            label="Revenue Collected"
            icon={CreditCard}
          />
          <StatCard
            value={fmtNumber(metrics.period.newCustomers)}
            label="New Customers"
            icon={UserPlus}
          />
          <StatCard
            value={fmtNumber(metrics.period.ticketsResolved)}
            label="Tickets Resolved"
            icon={CheckCircle2}
          />
          <StatCard
            value={fmtCurrency(metrics.period.attributedRevenue)}
            label="Attributed Revenue"
            icon={TrendingUp}
          />
          <StatCard
            value={fmtNumber(metrics.period.partnerWon)}
            label="Won Partner Leads"
            icon={Handshake}
          />
          <StatCard
            value={fmtCurrency(metrics.period.commission)}
            label="Commission"
            icon={HandCoins}
          />
          <StatCard
            value={fmtNumber(metrics.period.churned)}
            label="Churned"
            icon={UserX}
            tone="destructive"
          />
          <StatCard
            value={fmtNumber(metrics.period.partnerApplications)}
            label="Partner Applications"
            icon={Users}
          />
        </div>
      </div>

      {/* ─── Requires Attention ─── */}
      <SectionCard
        title="Requires Attention"
        description="Open operational tasks from the action centre"
        href="/admin/tasks"
        icon={AlertTriangle}
      >
        {attention.length === 0 ? (
          <p className="text-sm text-muted-foreground">No open tasks. Great work.</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
            {(attention as RequiresAttentionItem[]).map((task) => (
              <div
                key={task.id}
                className="flex items-start justify-between gap-3 p-2.5 rounded-lg border border-border/50 hover:bg-muted/50 transition-colors"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">{task.title}</p>
                    {task.priority && (
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                          task.priority === "URGENT"
                            ? "bg-destructive text-white"
                            : task.priority === "HIGH"
                              ? "bg-warning text-foreground"
                              : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {task.priority}
                      </span>
                    )}
                  </div>
                  {task.description && (
                    <p className="text-xs text-muted-foreground truncate">{task.description}</p>
                  )}
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Due {task.due_at ? fmtDate(task.due_at) : "—"}
                  </p>
                </div>
                {task.deep_link ? (
                  <Link
                    href={task.deep_link}
                    className="text-retail hover:underline text-xs whitespace-nowrap flex items-center gap-1"
                  >
                    Open <ArrowUpRight className="w-3 h-3" />
                  </Link>
                ) : (
                  <span className="text-xs text-muted-foreground whitespace-nowrap">—</span>
                )}
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* ─── Operational Sections ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard
          title="Financial Snapshot"
          description={`Revenue, outstanding, renewals and commission for ${period}`}
          href="/admin/finance/commercial"
          icon={Receipt}
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Revenue Collected</p>
              <p className="text-lg font-semibold">{fmtCurrency(financial.revenueCollected)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Outstanding</p>
              <p className="text-lg font-semibold">{fmtCurrency(financial.outstanding)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Renewals</p>
              <p className="text-lg font-semibold">{fmtNumber(financial.renewals)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Commission</p>
              <p className="text-lg font-semibold">{fmtCurrency(financial.commission)}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link href="/admin/finance/commercial/payments" className="text-xs text-retail hover:underline">
              Payments
            </Link>
            <Link href="/admin/finance/commercial/invoices" className="text-xs text-retail hover:underline">
              Invoices
            </Link>
            <Link href="/admin/finance/commercial/renewals" className="text-xs text-retail hover:underline">
              Renewals
            </Link>
            <Link href="/admin/finance/commercial/commissions" className="text-xs text-retail hover:underline">
              Commissions
            </Link>
          </div>
        </SectionCard>

        <SectionCard
          title="Partner Snapshot"
          description={`Partner activity for ${period}`}
          href="/admin/partners"
          icon={Handshake}
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Active Partners</p>
              <p className="text-lg font-semibold">{fmtNumber(partner.activePartners)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Applications</p>
              <p className="text-lg font-semibold">{fmtNumber(partner.applications)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Leads / Won</p>
              <p className="text-lg font-semibold">
                {fmtNumber(partner.leads)} / {fmtNumber(partner.won)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Attributed Revenue</p>
              <p className="text-lg font-semibold">{fmtCurrency(partner.attributedRevenue)}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link href="/admin/partners/applications" className="text-xs text-retail hover:underline">
              Applications
            </Link>
            <Link href="/admin/partner-leads" className="text-xs text-retail hover:underline">
              Leads
            </Link>
            <Link href="/admin/finance/commercial/commissions" className="text-xs text-retail hover:underline">
              Commissions
            </Link>
          </div>
        </SectionCard>

        <SectionCard
          title="Customer Snapshot"
          description="Health distribution and lifecycle counts"
          href="/admin/customer-success"
          icon={HeartPulse}
        >
          <div className="space-y-2">
            <ProgressRow
              label="Healthy"
              value={customer.health.HEALTHY}
              total={totalHealth}
              color="bg-success"
            />
            <ProgressRow
              label="Watch"
              value={customer.health.WATCH}
              total={totalHealth}
              color="bg-warning"
            />
            <ProgressRow
              label="At-Risk"
              value={customer.health.AT_RISK}
              total={totalHealth}
              color="bg-retail"
            />
            <ProgressRow
              label="Critical"
              value={customer.health.CRITICAL}
              total={totalHealth}
              color="bg-destructive"
            />
          </div>
          <div className="grid grid-cols-2 gap-4 pt-2">
            <div>
              <p className="text-xs text-muted-foreground">Onboarding</p>
              <p className="text-lg font-semibold">{fmtNumber(customer.onboarding)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Churned</p>
              <p className="text-lg font-semibold">{fmtNumber(customer.churned)}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link href="/admin/customer-success" className="text-xs text-retail hover:underline">
              Customer Success
            </Link>
            <Link href="/admin/onboarding" className="text-xs text-retail hover:underline">
              Onboarding
            </Link>
            <Link href="/admin/businesses" className="text-xs text-retail hover:underline">
              Businesses
            </Link>
          </div>
        </SectionCard>

        <SectionCard
          title="Support Snapshot"
          description={`Support operations for ${period}`}
          href="/admin/support"
          icon={Headphones}
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Open</p>
              <p className="text-lg font-semibold">{fmtNumber(support.open)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Urgent</p>
              <p className="text-lg font-semibold">{fmtNumber(support.urgent)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Escalated</p>
              <p className="text-lg font-semibold">{fmtNumber(support.escalated)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Resolved</p>
              <p className="text-lg font-semibold">{fmtNumber(support.resolved)}</p>
            </div>
          </div>
          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-muted-foreground">
              SLA Breached: <span className="font-semibold text-destructive">{fmtNumber(support.slaBreached)}</span>
            </p>
            <Link href="/admin/support" className="text-xs text-retail hover:underline">
              Queue <ArrowUpRight className="w-3 h-3 inline" />
            </Link>
          </div>
        </SectionCard>
      </div>
    </div>
  )
}
