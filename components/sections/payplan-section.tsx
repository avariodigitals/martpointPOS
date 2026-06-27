"use client"

import { Button } from "@/components/ui/button"
import {
  ArrowRight,
  HandCoins,
  CalendarClock,
  ClipboardList,
  ShieldCheck,
  TrendingUp,
  AlertTriangle,
  Wallet,
} from "lucide-react"

/* ───────────────────────────  PAYPLAN MAIN  ─────────────────────────── */

const payplanCards = [
  {
    icon: HandCoins,
    title: "Customer Pays Deposit",
    description: "Customers can make an initial deposit and take products or services immediately.",
  },
  {
    icon: CalendarClock,
    title: "Flexible Payment Plans",
    description: "Configure daily, weekly or monthly installment schedules that fit your customers and your cash flow.",
  },
  {
    icon: ClipboardList,
    title: "Automatic Balance Tracking",
    description: "Track deposits, outstanding balances, due dates, payment history and collections — without spreadsheets or exercise books.",
  },
  {
    icon: ShieldCheck,
    title: "Customer Verification",
    description: "Optional NIN verification, BVN verification and custom approval rules to protect your business.",
  },
]

export function PayPlanSection() {
  return (
    <section className="w-full bg-background py-10 md:py-16 lg:py-20">
      <div className="container-martpoint">
        {/* Header */}
        <div className="max-w-3xl mx-auto text-center mb-14">
          <span className="inline-block text-xs font-semibold uppercase tracking-widest text-retail mb-3">
            Installment Payments
          </span>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
            Sell More. Collect Better.
          </h2>
          <p className="mt-4 text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            Turn customers who can&apos;t pay in full today into paying customers with structured installment plans, automatic balance tracking and payment reminders.
          </p>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-start">
          {/* Left: Content cards */}
          <div className="space-y-5">
            {payplanCards.map((card) => (
              <div
                key={card.title}
                className="rounded-xl border border-border bg-card p-5 transition-all duration-200 hover:border-retail/30 hover:shadow-sm"
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-retail-soft flex items-center justify-center shrink-0">
                    <card.icon className="w-5 h-5 text-retail" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-foreground mb-1">
                      {card.title}
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {card.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Right: Dashboard mockup */}
          <div className="rounded-xl border border-border bg-slate-100 p-3 md:p-5 shadow-xl">
            <div className="rounded-lg bg-white overflow-hidden">
              {/* Dashboard header */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-retail-soft/50">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-retail flex items-center justify-center">
                    <Wallet className="w-3.5 h-3.5 text-white" />
                  </div>
                  <span className="text-sm font-semibold text-foreground">PayPlan Overview</span>
                </div>
                <span className="text-xs text-muted-foreground">Today</span>
              </div>

              {/* Widget grid */}
              <div className="grid grid-cols-2 gap-3 p-4">
                <Widget label="Active Plans" value="42" trend="+8%" />
                <Widget label="Amount Collected" value="₦2.4M" trend="+12%" />
                <Widget label="Outstanding Balance" value="₦890K" trend="stable" />
                <Widget label="Overdue Accounts" value="3" trend="alert" />
              </div>

              {/* Lists */}
              <div className="px-4 pb-4 space-y-3">
                <ListCard title="Recent Installments" items={[
                  { name: "Chioma A.", detail: "₦50,000 · Weekly · Due today", status: "paid" },
                  { name: "Emeka N.", detail: "₦35,000 · Monthly · Due in 3 days", status: "upcoming" },
                  { name: "Adeola B.", detail: "₦120,000 · Weekly · Overdue 2 days", status: "overdue" },
                ]} />
                <ListCard title="Upcoming Payments" items={[
                  { name: "DailyNeeds Store", detail: "₦75,000 · Due tomorrow", status: "upcoming" },
                  { name: "FreshMart", detail: "₦40,000 · Due in 2 days", status: "upcoming" },
                ]} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

function Widget({ label, value, trend }: { label: string; value: string; trend: string }) {
  const isAlert = trend === "alert"
  const isPositive = trend.startsWith("+")
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <div className="flex items-end justify-between">
        <p className="text-lg font-bold text-foreground">{value}</p>
        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
          isAlert
            ? "bg-destructive/10 text-destructive"
            : isPositive
            ? "bg-success/10 text-success"
            : "bg-muted text-muted-foreground"
        }`}>
          {isPositive ? "↑ " : isAlert ? "! " : "→ "}{trend}
        </span>
      </div>
    </div>
  )
}

function ListCard({ title, items }: { title: string; items: { name: string; detail: string; status: string }[] }) {
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <p className="text-xs font-semibold text-foreground mb-2">{title}</p>
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.name} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${
                item.status === "paid" ? "bg-success" :
                item.status === "overdue" ? "bg-destructive" :
                "bg-accent"
              }`} />
              <span className="text-foreground font-medium">{item.name}</span>
            </div>
            <span className="text-muted-foreground">{item.detail}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ───────────────────────  PAYPLAN BENEFITS STRIP  ─────────────────────── */

const benefits = [
  {
    icon: TrendingUp,
    title: "Increase Sales",
    description: "Convert customers who cannot pay in full today. Let them buy now and pay over time.",
  },
  {
    icon: ClipboardList,
    title: "Track Every Balance",
    description: "Know exactly who owes what and when. No more forgotten payments or manual ledgers.",
  },
  {
    icon: AlertTriangle,
    title: "Reduce Defaults",
    description: "Follow payment schedules and overdue accounts with automatic alerts and reminders.",
  },
  {
    icon: ShieldCheck,
    title: "Stay In Control",
    description: "You decide who qualifies and what terms apply. Set your own rules, your own limits.",
  },
]

export function PayPlanBenefits() {
  return (
    <section className="w-full bg-muted py-10 md:py-16 lg:py-20">
      <div className="container-martpoint">
        <div className="max-w-3xl mx-auto text-center mb-14">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
            Why Businesses Love PayPlan
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {benefits.map((b) => (
            <div
              key={b.title}
              className="rounded-xl border border-border bg-background p-6 text-center transition-all duration-200 hover:border-retail/30 hover:shadow-sm"
            >
              <div className="w-12 h-12 rounded-xl bg-retail-soft flex items-center justify-center mx-auto mb-4">
                <b.icon className="w-6 h-6 text-retail" />
              </div>
              <h3 className="text-base font-semibold text-foreground mb-2">{b.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{b.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ───────────────────────  PAYPLAN TRUST CALLOUT  ─────────────────────── */

export function PayPlanTrustCallout() {
  return (
    <section className="w-full bg-[#023047] py-10 md:py-16 lg:py-20">
      <div className="container-martpoint">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white">
            Still Tracking Credit Sales In Exercise Books?
          </h2>
          <p className="mt-4 text-lg text-white/70 leading-relaxed max-w-2xl mx-auto">
            MartPoint PayPlan tracks customer installment plans, deposits, balances, due dates and collections automatically.
          </p>
          <p className="mt-2 text-xl font-bold text-white">
            Stop guessing. Start collecting.
          </p>
          <div className="mt-8 flex justify-center">
            <Button asChild size="lg" variant="retail">
              <a
                href="https://wa.me/+2348036028069?text=Hi%2C%20I%20came%20across%20your%20website%20and%20I%27m%20interested%20in%20seeing%20MartPoint%20PayPlan%20in%20action.%20Can%20we%20talk%3F"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2"
              >
                See PayPlan In Action
                <ArrowRight className="w-4 h-4" />
              </a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
