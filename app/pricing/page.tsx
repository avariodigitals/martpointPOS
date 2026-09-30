export const revalidate = 86400
import { Fragment } from "react"
import type { Metadata } from "next"
import Link from "next/link"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { Button } from "@/components/ui/button"
import { SectionHeader } from "@/components/shared/section-header"
import {
  BadgeCheck,
  BarChart3,
  Bot,
  CalendarClock,
  Check,
  ChevronDown,
  Globe,
  HandCoins,
  Heart,
  HelpCircle,
  Link2,
  Calculator,
  MessageCircle,
  Minus,
  MonitorSmartphone,
  Package,
  QrCode,
  ScanFace,
  ShoppingCart,
  WifiOff,
} from "lucide-react"
import { readSettings } from "@/lib/settings"
import {
  ADDONS,
  COMPARISON_GROUPS,
  OFFLINE_PLAN,
  formatNairaAmount,
  resolveCloudPlans,
  type CellValue,
  type ResolvedCloudPlan,
} from "@/lib/pricing-plans"

export const metadata: Metadata = {
  title: "Pricing — Retail POS Software Plans & Prices in Nigeria",
  description:
    "Transparent annual pricing for MartPoint Retail Cloud, configured for your business type. Plans from ₦99,999/year plus a one-time Offline licence option for stores without reliable internet.",
  keywords: [
    "POS software price Nigeria", "affordable POS system",
    "retail software pricing", "retail POS cost Nigeria",
    "MartPoint pricing", "cheap POS system Africa",
    "POS software subscription", "offline POS software",
  ],
  alternates: {
    canonical: "/pricing",
  },
  openGraph: {
    title: "Pricing — Retail POS Software Plans & Prices in Nigeria",
    description:
      "Transparent annual pricing for MartPoint Retail Cloud. Plans from ₦99,999/year, plus a one-time Offline licence option.",
    url: "https://martpoint.com.ng/pricing",
  },
}

interface OfflinePlanData {
  name?: string
  description?: string
  features?: string[]
  ctaText?: string
  ctaLink?: string
}

function PlanCard({ plan }: { plan: ResolvedCloudPlan }) {
  const isHighlighted = plan.badge !== ""
  const isExternal = plan.ctaLink.startsWith("http")

  return (
    <div
      className={`relative rounded-2xl ${isHighlighted ? "border-2 border-retail" : "border border-border"} bg-card p-6 shadow-sm flex flex-col`}
    >
      {isHighlighted && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="inline-block rounded-full bg-retail px-4 py-1 text-xs font-bold uppercase tracking-wider text-white">
            {plan.badge}
          </span>
        </div>
      )}
      <h3 className="text-lg font-bold text-foreground mt-2">{plan.displayName}</h3>
      <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Annual licence</p>
      <div className="mt-1 flex flex-col items-start">
        <span className={`text-3xl sm:text-4xl font-extrabold ${isHighlighted ? "text-retail" : "text-foreground"}`}>
          {plan.priceText}
        </span>
        <span className="text-muted-foreground">/ year</span>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{plan.description}</p>

      <ul className="mt-5 space-y-2.5 flex-1 text-sm">
        <li className="flex items-center gap-2 text-foreground">
          <Check className="w-4 h-4 text-retail shrink-0" />
          {plan.limits.branches} branch{plan.limits.branches !== 1 ? "es" : ""} · {plan.limits.namedUsers} named users
        </li>
        <li className="flex items-center gap-2 text-foreground">
          <Check className="w-4 h-4 text-retail shrink-0" />
          {plan.limits.mainProducts.toLocaleString("en-NG")} main products
        </li>
        <li className="flex items-center gap-2 text-foreground">
          <Check className="w-4 h-4 text-retail shrink-0" />
          {plan.limits.onlineProducts.toLocaleString("en-NG")} online store products
        </li>
        <li className="flex items-center gap-2 text-foreground">
          <Check className="w-4 h-4 text-retail shrink-0" />
          {plan.limits.services.toLocaleString("en-NG")} services · {plan.limits.mediaGb} GB media
        </li>
        <li className="flex items-center gap-2 text-foreground">
          <Check className="w-4 h-4 text-retail shrink-0" />
          {plan.limits.storefronts} storefront{plan.limits.storefronts !== 1 ? "s" : ""} · {plan.limits.customDomains} custom domain{plan.limits.customDomains !== 1 ? "s" : ""}
        </li>
      </ul>

      <div className="mt-6">
        {isExternal ? (
          <Button asChild size="lg" variant={isHighlighted ? "retail" : "outline"} className="w-full">
            <a href={plan.ctaLink} target="_blank" rel="noopener noreferrer">
              {plan.ctaText}
            </a>
          </Button>
        ) : (
          <Button asChild size="lg" variant={isHighlighted ? "retail" : "outline"} className="w-full">
            <a href={plan.ctaLink}>{plan.ctaText}</a>
          </Button>
        )}
      </div>
    </div>
  )
}

const COMMON_INCLUSIONS: { icon: typeof ShoppingCart; label: string; desc: string }[] = [
  { icon: ShoppingCart, label: "POS sales & checkout", desc: "Fast counter sales on desktop or tablet" },
  { icon: Package, label: "Inventory & stock control", desc: "Live stock levels, transfers and alerts" },
  { icon: Globe, label: "Online store included", desc: "Your storefront, ready to take orders" },
  { icon: MessageCircle, label: "WhatsApp ordering & invoices", desc: "Catalogue, orders and invoices on WhatsApp" },
  { icon: QrCode, label: "QR menu ordering", desc: "Scan-to-order for restaurants and cafés" },
  { icon: Link2, label: "Payment links", desc: "Get paid remotely by link" },
  { icon: CalendarClock, label: "PayPlan™ installments", desc: "Deposits and balance collection built in" },
  { icon: Heart, label: "Loyalty & rewards", desc: "Points and rewards that bring customers back" },
  { icon: BadgeCheck, label: "Customer verification", desc: "Verify before extending credit or installments" },
  { icon: HandCoins, label: "Collections tracking", desc: "Who owes what — and when it's due" },
  { icon: ScanFace, label: "Staff attendance", desc: "Face-capture clock-in for your team" },
  { icon: BarChart3, label: "Daily reports", desc: "Sales, stock and staff performance at a glance" },
  { icon: Bot, label: "AI assistant", desc: "Answers and guidance inside the platform" },
  { icon: MonitorSmartphone, label: "Mobile & desktop access", desc: "Run your store from any device" },
]

function Cell({ value }: { value: CellValue }) {
  if (value === "yes") {
    return <Check className="w-4 h-4 text-retail mx-auto" aria-label="Included" />
  }
  if (value === "soon") {
    return (
      <span className="inline-block rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground whitespace-nowrap">
        Coming soon
      </span>
    )
  }
  if (value === "no") {
    return <Minus className="w-4 h-4 text-muted-foreground/50 mx-auto" aria-label="Not included" />
  }
  return <span className="text-sm font-medium text-foreground whitespace-nowrap">{value}</span>
}

const INDUSTRY_EXAMPLES = [
  {
    name: "Supermarkets",
    href: "/industries/supermarkets",
    text: "Fast barcode checkout, expiry alerts and real-time stock across thousands of SKUs.",
  },
  {
    name: "Pharmacies",
    href: "/industries/pharmacies",
    text: "Batch and expiry tracking, prescription sales records and low-stock alerts.",
  },
  {
    name: "Restaurants",
    href: "/industries/restaurants",
    text: "QR table ordering, kitchen tickets, split bills and ingredient-level stock.",
  },
  {
    name: "Fashion Stores",
    href: "/industries/fashion-stores",
    text: "Size and colour variants, seasonal stock and dead-stock alerts.",
  },
  {
    name: "Electronics Stores",
    href: "/industries/electronics-stores",
    text: "Serial number and warranty tracking for high-value inventory.",
  },
  {
    name: "Beauty & Salons",
    href: "/industries/beauty-and-salons",
    text: "Service bookings, product sales and staff performance tracking.",
  },
]

const PRICING_FAQS = [
  {
    q: "What is included when I subscribe?",
    a: "Your annual licence covers the software, activation, your store URL and the initial administrator invitation. Standard Online Store capability is included in every active Retail Cloud subscription at no extra charge.",
  },
  {
    q: "What is the difference between activation and implementation?",
    a: "Activation — creating your account, store URL and first admin login — is included with every plan. Assisted implementation (configuration, workflow setup, training sessions and data guidance) is a defined, separately quoted scope of work agreed before it begins.",
  },
  {
    q: "Can I upgrade or downgrade my plan?",
    a: "You can upgrade or add capacity mid-term — you pay the price difference for the remaining billing months. Downgrades take effect at your next renewal, and no mid-term credit is given.",
  },
  {
    q: "How do add-ons work?",
    a: "Add-ons extend a specific limit — extra branches, users, products, variations, services or media — and co-terminate with your subscription. We always quote the lowest valid plan and add-on combination for your requirement; when that reaches the next plan's price, we recommend the higher plan instead.",
  },
  {
    q: "What costs are not included in the licence?",
    a: "Payment gateway fees, SMS/messaging, paid email, verification lookups, AI usage, domain registration or renewal, custom design, integrations, hardware, onsite work and travel are charged separately unless your accepted offer expressly bundles them. Connecting your own domain is included within your plan's domain allowance — buying the domain is not.",
  },
  {
    q: "Is MartPoint Retail Offline a subscription?",
    a: "No. Retail Offline is a one-time licence covering one branch and five users, priced per setup on request. The first 12 months of eligible updates and standard remote support are included. From year two, optional Annual Care keeps updates and support active — your licensed software keeps working either way.",
  },
]

export default async function PricingPage() {
  const settings = await readSettings()
  const plans = resolveCloudPlans(settings)
  const pricing = (settings?.pricing as Record<string, unknown>) || {}
  const offline = (pricing.offline as OfflinePlanData) || {}

  const offlineFeatures =
    Array.isArray(offline.features) && offline.features.length > 0
      ? offline.features
      : [
          "POS Sales & Checkout",
          "Inventory & Stock Control",
          "Receipt Printing",
          "Barcode & SKU Management",
          "Customer & Supplier Records",
          "Staff Attendance (Face Capture)",
          "Daily Sales Report",
          "Multi-Branch (LAN Connected)",
          "Works Without Internet",
          "Local Installation",
          "First 12 Months Updates & Support",
        ]

  return (
    <>
      <Header />
      <main className="flex-1">
        <section className="w-full bg-background border-b border-border">
          <div className="container-martpoint py-16 md:py-24">
            <SectionHeader
              label="Retail Pricing"
              headline="Pricing configured for your business type"
              description="MartPoint Retail Cloud is licensed annually by capacity — branches, users and catalogue size. Pick the plan that fits, add capacity only where you need it, and upgrade anytime. Downgrades apply at renewal."
            />
          </div>
        </section>

        <section className="w-full bg-muted py-16 md:py-24">
          <div className="container-martpoint space-y-20">
            {/* Retail Cloud Plans */}
            <div>
              <div className="max-w-3xl mx-auto text-center mb-10">
                <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
                  MartPoint Retail Cloud
                </h2>
                <p className="mt-2 text-muted-foreground">
                  One annual licence. Standard Online Store, activation and your first admin login are included in every plan.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
                {plans.map((plan) => (
                  <PlanCard key={plan.id} plan={plan} />
                ))}
              </div>

              {/* Plan comparison */}
              <div className="mt-12 max-w-5xl mx-auto">
                <h3 className="text-lg font-semibold text-foreground mb-4 text-center">
                  Compare plans in detail
                </h3>
                <div className="overflow-x-auto rounded-xl border border-border bg-background">
                  <table className="w-full min-w-[680px] text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/60">
                        <th className="text-left px-4 py-3 font-semibold text-foreground sticky left-0 bg-muted/60 min-w-[200px]">
                          Feature
                        </th>
                        {plans.map((p) => (
                          <th key={p.id} className="text-center px-4 py-3 font-semibold text-foreground whitespace-nowrap">
                            {p.displayName}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {COMPARISON_GROUPS.map((group) => (
                        <Fragment key={group.title}>
                          <tr className="bg-muted/40 border-b border-border">
                            <td
                              colSpan={plans.length + 1}
                              className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-foreground sticky left-0 bg-muted/40"
                            >
                              {group.title}
                            </td>
                          </tr>
                          {group.rows.map((row) => (
                            <tr key={row.label} className="border-b border-border last:border-0">
                              <td className="px-4 py-3 text-muted-foreground sticky left-0 bg-background">
                                {row.label}
                              </td>
                              {row.values.map((v, i) => (
                                <td key={i} className="px-4 py-3 text-center">
                                  <Cell value={v} />
                                </td>
                              ))}
                            </tr>
                          ))}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-3 text-xs text-muted-foreground text-center">
                  Main products are active top-level catalogue items. Product variations count active sellable inventory records, including simple items. Domain allowance covers connecting a domain you own — domain purchase and renewal are billed separately.
                </p>
              </div>

              {/* Common inclusions */}
              <div className="mt-12 max-w-4xl mx-auto">
                <h3 className="text-lg font-semibold text-foreground mb-2 text-center">
                  Every Retail Cloud plan includes
                </h3>
                <p className="text-sm text-muted-foreground text-center mb-6">
                  One licence. Everything you need to sell — in store, online and on WhatsApp.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {COMMON_INCLUSIONS.map((item) => (
                    <div
                      key={item.label}
                      className="flex items-start gap-3 rounded-xl border border-border bg-background p-4"
                    >
                      <div className="w-9 h-9 rounded-lg bg-retail-soft flex items-center justify-center shrink-0">
                        <item.icon className="w-4.5 h-4.5 text-retail" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground leading-snug">{item.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Add-ons */}
              <div className="mt-12 max-w-4xl mx-auto">
                <h3 className="text-lg font-semibold text-foreground mb-2 text-center">
                  Need more capacity? Add only what you need.
                </h3>
                <p className="text-sm text-muted-foreground text-center mb-6">
                  Add-ons are billed annually and end with your subscription term.
                </p>
                <div className="overflow-x-auto rounded-xl border border-border bg-background">
                  <table className="w-full min-w-[480px] text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/60">
                        <th className="text-left px-4 py-3 font-semibold text-foreground">Add-on</th>
                        <th className="text-left px-4 py-3 font-semibold text-foreground">Billed</th>
                        <th className="text-right px-4 py-3 font-semibold text-foreground">Annual price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ADDONS.map((addon) => (
                        <tr key={addon.id} className="border-b border-border last:border-0">
                          <td className="px-4 py-3 text-foreground">{addon.label}</td>
                          <td className="px-4 py-3 text-muted-foreground">{addon.detail}</td>
                          <td className="px-4 py-3 text-right font-semibold text-foreground whitespace-nowrap">
                            {formatNairaAmount(addon.annualPrice)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Retail Offline */}
            <div>
              <div className="max-w-3xl mx-auto text-center mb-10">
                <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
                  MartPoint Retail Offline
                </h2>
                <p className="mt-2 text-muted-foreground">
                  Prefer a locally installed system that runs without internet? Retail Offline is a separate one-time licence — priced per setup, on request.
                </p>
              </div>
              <div className="max-w-2xl mx-auto">
                <div className="relative rounded-2xl border-2 border-retail bg-card p-8 shadow-sm">
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-retail px-4 py-1 text-xs font-bold uppercase tracking-wider text-white">
                      <WifiOff className="w-3 h-3" />
                      One-time licence
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-foreground mt-2">{offline.name || OFFLINE_PLAN.name}</h3>
                  <div className="mt-4 flex flex-col items-start">
                    <span className="text-4xl sm:text-5xl font-extrabold text-retail">
                      On request
                    </span>
                    <span className="text-muted-foreground">one-time licence — priced per setup</span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {offline.description ||
                      `One-time licence for ${OFFLINE_PLAN.branchesIncluded} branch and ${OFFLINE_PLAN.usersIncluded} users, installed locally. Works without internet. Includes the first 12 months of eligible updates and standard remote support.`}
                  </p>
                  <ul className="mt-6 space-y-3">
                    {offlineFeatures.map((item) => (
                      <li key={item} className="flex items-center gap-2 text-sm text-foreground">
                        <Check className="w-4 h-4 text-retail shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-6 rounded-lg bg-retail-soft p-4 text-center space-y-1.5">
                    <p className="text-sm font-semibold text-foreground">
                      Includes {OFFLINE_PLAN.branchesIncluded} branch · {OFFLINE_PLAN.usersIncluded} users · local installation
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Optional Annual Care from year two keeps updates and standard remote support active. Without it, your licensed installation keeps working.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Hosted Online Store is not included — it requires Retail Cloud or a separately quoted hosted arrangement.
                    </p>
                  </div>
                  <div className="mt-6">
                    <Button asChild size="lg" variant="retail" className="w-full">
                      <a
                        href={offline.ctaLink || "https://wa.me/+2348036028069?text=Hi%2C%20I%27d%20like%20a%20quote%20for%20MartPoint%20Retail%20Offline.%20Can%20we%20talk%3F"}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {offline.ctaText || "Request Offline Pricing"}
                      </a>
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Industry workflows */}
            <div>
              <div className="max-w-3xl mx-auto text-center mb-10">
                <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
                  Configured for how your business actually works
                </h2>
                <p className="mt-2 text-muted-foreground">
                  The same Retail Cloud platform, set up around your industry&apos;s workflow.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 max-w-5xl mx-auto">
                {INDUSTRY_EXAMPLES.map((ind) => (
                  <Link
                    key={ind.href}
                    href={ind.href}
                    className="rounded-xl border border-border bg-background p-6 transition-all duration-200 hover:border-retail/30 hover:shadow-sm"
                  >
                    <h3 className="text-base font-semibold text-foreground mb-2">{ind.name}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{ind.text}</p>
                  </Link>
                ))}
              </div>
            </div>

            {/* Activation vs implementation + catalogue responsibility */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
              <div className="rounded-xl border border-border bg-background p-6 md:p-8">
                <h3 className="text-lg font-semibold text-foreground mb-3">Activation is included. Implementation is scoped.</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Activation, your store URL and the initial administrator invitation are included with every plan at no extra charge. If you want hands-on help — configuration, workflow setup or training — we assess the scope and provide an itemised quotation with agreed deliverables and an estimated schedule before work begins.
                </p>
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                  Onsite setup, onsite training, travel, marketing and custom requirements are separately assessed unless expressly included in your purchased offer.
                </p>
              </div>
              <div className="rounded-xl border border-border bg-background p-6 md:p-8">
                <h3 className="text-lg font-semibold text-foreground mb-3">Your Product Catalogue</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  You are responsible for the accuracy and ongoing maintenance of your product catalogue, including descriptions, images, prices and stock quantities. If you need assistance preparing or uploading your catalogue, MartPoint can arrange this through approved implementation partners as a separately quoted service. Standard onboarding includes up to 20 client-supplied sample products for system testing; full catalogue upload is included only when expressly stated in your agreed service package.
                </p>
              </div>
            </div>

            {/* Pricing FAQs */}
            <div className="max-w-3xl mx-auto">
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground text-center mb-8">
                Pricing questions, answered
              </h2>
              <div className="space-y-4">
                {PRICING_FAQS.map((faq) => (
                  <details key={faq.q} className="group rounded-xl border border-border bg-background p-5 cursor-pointer">
                    <summary className="flex items-center justify-between list-none">
                      <span className="text-sm font-semibold text-foreground">{faq.q}</span>
                      <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform group-open:rotate-180" />
                    </summary>
                    <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{faq.a}</p>
                  </details>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="w-full bg-background py-16 md:py-24">
          <div className="container-martpoint">
            <div className="max-w-3xl mx-auto text-center">
              <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-4">
                <HelpCircle className="w-6 h-6 text-muted-foreground" />
              </div>
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
                Not sure which plan fits?
              </h2>
              <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
                Tell us about your business and we&apos;ll recommend the lowest-cost
                plan and add-on combination for your branches, staff and catalogue size.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                <Button asChild size="lg">
                  <Link href="/book-demo">Book My Industry Demo</Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <a href="/estimate">
                    <Calculator className="mr-2 h-4 w-4" />
                    Estimate My Cost
                  </a>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <a href="https://wa.me/+2348036028069?text=Hi%2C%20I%20came%20across%20your%20website%20and%20I%27m%20interested%20in%20learning%20more%20about%20MartPoint%20Retail.%20Can%20we%20talk%3F" target="_blank" rel="noopener noreferrer">Talk to Sales</a>
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
