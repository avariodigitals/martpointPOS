"use client"

import { Button } from "@/components/ui/button"
import {
  ArrowRight,
  Heart,
  Star,
  Gift,
  Wallet,
  Cake,
  Users,
  Repeat,
  Crown,
} from "lucide-react"

/* ───────────────────────────  LOYALTY MAIN  ─────────────────────────── */

const loyaltyCards = [
  {
    icon: Heart,
    title: "Loyalty Points",
    description: "Customers earn points on every purchase. Redeem for discounts, free products or exclusive perks — all tracked automatically.",
  },
  {
    icon: Crown,
    title: "Membership Levels",
    description: "Create Bronze, Silver, Gold tiers with increasing rewards. Customers advance automatically as they spend more with your business.",
  },
  {
    icon: Gift,
    title: "Gift Cards",
    description: "Sell branded gift cards customers can purchase and share. Drive new revenue and bring first-time shoppers through your doors.",
  },
  {
    icon: Wallet,
    title: "Store Credit",
    description: "Issue store credit for returns, referrals or promotions. Customers see their balance at checkout and can apply it instantly.",
  },
  {
    icon: Users,
    title: "Recover Lost Customers",
    description: "Automatically identify customers who haven&apos;t visited in weeks and send promotions to bring them back.",
  },
]

export function LoyaltySection() {
  return (
    <section className="w-full bg-background py-10 md:py-16 lg:py-20">
      <div className="container-martpoint">
        {/* Header */}
        <div className="max-w-3xl mx-auto text-center mb-14">
          <span className="inline-block text-xs font-semibold uppercase tracking-widest text-retail mb-3">
            Customer Retention
          </span>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground">
            Keep Customers Coming Back
          </h2>
          <p className="mt-4 text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            Reward loyal customers automatically with points, membership tiers, gift cards, store credit and referral rewards — all managed from one platform.
          </p>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-start">
          {/* Left: Content cards */}
          <div className="space-y-5">
            {loyaltyCards.map((card) => (
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

          {/* Right: Highlights list */}
          <div className="rounded-xl border border-border bg-slate-100 p-3 md:p-5 shadow-xl">
            <div className="rounded-lg bg-white overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-retail-soft/50">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded bg-retail flex items-center justify-center">
                    <Heart className="w-3.5 h-3.5 text-white" />
                  </div>
                  <span className="text-sm font-semibold text-foreground">Loyalty Overview</span>
                </div>
                <span className="text-xs text-muted-foreground">This Month</span>
              </div>

              <div className="p-4 space-y-3">
                {[
                  { label: "Active Members", value: "1,247", trend: "+12%" },
                  { label: "Points Issued", value: "45,200", trend: "+8%" },
                  { label: "Gift Cards Sold", value: "₦320K", trend: "+15%" },
                  { label: "Repeat Purchases", value: "68%", trend: "+5%" },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
                    <span className="text-sm text-muted-foreground">{item.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">{item.value}</span>
                      <span className="text-xs text-retail font-medium">{item.trend}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ───────────────────────  LOYALTY BENEFITS STRIP  ─────────────────────── */

const benefits = [
  {
    icon: Star,
    title: "Increase Sales",
    description: "Loyalty members spend up to 67% more than non-members over time.",
  },
  {
    icon: Cake,
    title: "Birthday Rewards",
    description: "Send automatic birthday discounts and offers to make customers feel valued.",
  },
  {
    icon: Users,
    title: "Referral Rewards",
    description: "Turn happy customers into promoters with built-in referral incentives.",
  },
  {
    icon: Repeat,
    title: "Reduce Churn",
    description: "Track repeat purchase behaviour and win back lapsed customers with targeted campaigns.",
  },
]

export function LoyaltyBenefits() {
  return (
    <section className="w-full bg-muted py-10 md:py-16 lg:py-20">
      <div className="container-martpoint">
        <div className="max-w-3xl mx-auto text-center mb-14">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
            Why Businesses Love Loyalty Programs
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

/* ───────────────────────  LOYALTY TRUST CALLOUT  ─────────────────────── */

export function LoyaltyTrustCallout() {
  return (
    <section className="w-full bg-[#023047] py-10 md:py-16 lg:py-20">
      <div className="container-martpoint">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white">
            Still Losing Customers To Competitors?
          </h2>
          <p className="mt-4 text-lg text-white/70 leading-relaxed max-w-2xl mx-auto">
            MartPoint Loyalty keeps your best customers engaged with automatic rewards, tiered memberships and gift cards — so they choose you first.
          </p>
          <p className="mt-2 text-xl font-bold text-white">
            Reward loyalty. Grow revenue.
          </p>
          <div className="mt-8 flex justify-center">
            <Button asChild size="lg" variant="retail">
              <a
                href="https://wa.me/+2348036028069?text=Hi%2C%20I%20came%20across%20your%20website%20and%20I%27m%20interested%20in%20learning%20more%20about%20MartPoint%20Loyalty.%20Can%20we%20talk%3F"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2"
              >
                See Loyalty In Action
                <ArrowRight className="w-4 h-4" />
              </a>
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
