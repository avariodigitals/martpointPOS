export const revalidate = 86400
import type { Metadata } from "next"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { Button } from "@/components/ui/button"
import { SectionHeader } from "@/components/shared/section-header"
import { Check, ArrowRight, HelpCircle } from "lucide-react"
import { readSettings } from "@/lib/settings"

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Transparent pricing for MartPoint Retail and ERP. Plans for every business size.",
}

interface PlanData {
  name: string
  price: string
  period: string
  badge: string
  description: string
  features: string[]
  branchesIncluded?: number
  usersIncluded?: number
  branchAddonPrice?: string
  supportRenewal?: string
  ctaText: string
  ctaLink: string
}

function PricingCard({
  plan,
  accent,
}: {
  plan: PlanData
  accent: "retail" | "erp"
}) {
  const isHighlighted = plan.badge && plan.badge !== ""
  const borderClass = isHighlighted
    ? accent === "retail"
      ? "border-2 border-retail"
      : "border-2 border-erp"
    : "border border-border"
  const badgeBg = accent === "retail" ? "bg-retail" : "bg-erp"
  const accentText = accent === "retail" ? "text-retail" : "text-erp"
  const accentSoft = accent === "retail" ? "bg-retail-soft" : "bg-erp-soft"

  const isExternal = plan.ctaLink.startsWith("http")

  return (
    <div className={`relative rounded-2xl ${borderClass} bg-card p-8 shadow-sm flex flex-col`}>
      {isHighlighted && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className={`inline-block rounded-full ${badgeBg} px-4 py-1 text-xs font-bold uppercase tracking-wider text-white`}>
            {plan.badge}
          </span>
        </div>
      )}
      <h3 className="text-xl font-bold text-foreground mt-2">{plan.name}</h3>
      <div className="mt-4 flex flex-col items-start">
        <span className={`text-4xl sm:text-5xl font-extrabold ${isHighlighted ? accentText : "text-foreground"}`}>
          {plan.price}
        </span>
        {plan.period && <span className="text-muted-foreground">{plan.period}</span>}
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{plan.description}</p>
      <ul className="mt-6 space-y-3 flex-1">
        {plan.features.map((item: string) => (
          <li key={item} className="flex items-center gap-2 text-sm text-foreground">
            <Check className={`w-4 h-4 ${accentText} shrink-0`} />
            {item}
          </li>
        ))}
      </ul>

      {(plan.branchesIncluded !== undefined || plan.usersIncluded !== undefined) && (
        <div className={`mt-6 rounded-lg ${accentSoft} p-4 text-center`}>
          {plan.branchesIncluded !== undefined && plan.usersIncluded !== undefined && (
            <p className="text-sm font-semibold text-foreground">
              {plan.branchesIncluded === 0 && plan.usersIncluded === 0
                ? "Custom Branches & Users"
                : `Includes ${plan.branchesIncluded} Branch${plan.branchesIncluded !== 1 ? "es" : ""} · ${plan.usersIncluded} User${plan.usersIncluded !== 1 ? "s" : ""}`}
            </p>
          )}
          {plan.branchAddonPrice && (
            <p className={`text-base font-bold ${accentText} mt-1`}>Additional Branch: {plan.branchAddonPrice}</p>
          )}
          {plan.supportRenewal && (
            <p className="text-xs text-muted-foreground mt-1">Maintenance and License Renewal: {plan.supportRenewal}</p>
          )}
        </div>
      )}

      <div className="mt-6">
        {isExternal ? (
          <Button asChild size="lg" variant={isHighlighted ? accent : "outline"} className="w-full">
            <a href={plan.ctaLink} target="_blank" rel="noopener noreferrer">
              {plan.ctaText}
            </a>
          </Button>
        ) : (
          <Button asChild size="lg" variant={isHighlighted ? accent : "outline"} className="w-full">
            <a href={plan.ctaLink}>{plan.ctaText}</a>
          </Button>
        )}
      </div>
    </div>
  )
}

export default async function PricingPage() {
  const settings = await readSettings()
  const pricing = (settings?.pricing as Record<string, unknown>) || {}
  const cloud = (pricing.cloud as unknown as PlanData) || {} as PlanData
  const offline = (pricing.offline as unknown as PlanData) || {} as PlanData
  const erp = Array.isArray(pricing.erp) ? (pricing.erp as unknown as PlanData[]) : []

  const retailPlans: PlanData[] = [
    {
      name: cloud.name || "MartPoint Retail Cloud",
      price: cloud.price || "₦99,999",
      period: cloud.period || "/ Year",
      badge: cloud.badge || "Most Popular",
      description: cloud.description || "Everything you need to run a modern retail business.",
      features: cloud.features || [
        "POS Sales & Checkout", "Inventory & Stock Control", "Online Store",
        "WhatsApp Ordering & Invoice", "QR Menu Ordering", "Payment Links",
        "PayPlan™ Installment Plans", "Loyalty & Rewards", "Customer Verification",
        "Collections Tracking", "Attendance (Face Capture)", "Daily Report",
        "Martpoint Assist", "Training & Onboarding", "Mobile & Desktop Access",
      ],
      branchesIncluded: cloud.branchesIncluded ?? 1,
      usersIncluded: cloud.usersIncluded ?? 5,
      branchAddonPrice: cloud.branchAddonPrice || "₦49,999 / Year",
      ctaText: cloud.ctaText || "Get Started",
      ctaLink: cloud.ctaLink || "https://wa.me/+2348036028069",
    },
    {
      name: offline.name || "MartPoint Retail Offline",
      price: offline.price || "₦250,000",
      period: offline.period || "One-Time Payment",
      badge: offline.badge || "One-Time",
      description: offline.description || "Full software with offline capability installed locally. Maintenance and License Renewal. Works without internet.",
      features: offline.features || [
        "POS Sales & Checkout", "Inventory & Stock Control", "Receipt Printing",
        "Barcode & SKU Management", "Customer & Supplier Records",
        "Staff Attendance (Face Capture)", "Daily Sales Report",
        "Multi-Branch (LAN Connected)", "Offline-First Sync",
        "Local Installation", "Staff Setup & Training", "No Recurring Fees",
      ],
      branchesIncluded: offline.branchesIncluded ?? 1,
      usersIncluded: offline.usersIncluded ?? 5,
      branchAddonPrice: offline.branchAddonPrice || "₦100,000 One-Time",
      supportRenewal: offline.supportRenewal || "₦50,000 / Year",
      ctaText: offline.ctaText || "Request Offline Setup",
      ctaLink: offline.ctaLink || "https://wa.me/+2348036028069",
    },
  ]

  const erpPlans: PlanData[] = erp.map((plan: PlanData) => ({
    name: plan.name || "ERP Plan",
    price: plan.price || "Custom",
    period: plan.period || "",
    badge: plan.badge || "",
    description: plan.description || "",
    features: Array.isArray(plan.features) ? plan.features : [],
    branchesIncluded: plan.branchesIncluded,
    usersIncluded: plan.usersIncluded,
    ctaText: plan.ctaText || "Get Started",
    ctaLink: plan.ctaLink || "https://wa.me/+2348036028069",
  }))

  return (
    <>
      <Header />
      <main className="flex-1">
        <section className="w-full bg-background border-b border-border">
          <div className="container-martpoint py-16 md:py-24">
            <SectionHeader
              label="Pricing"
              headline="Transparent pricing. No hidden fees. No surprises."
              description="Choose the plan that fits your business size. Upgrade or downgrade anytime."
            />
          </div>
        </section>

        <section className="w-full bg-muted py-16 md:py-24">
          <div className="container-martpoint space-y-20">
            {/* Retail Plans */}
            <div>
              <div className="max-w-3xl mx-auto text-center mb-10">
                <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
                  MartPoint Retail
                </h2>
                <p className="mt-2 text-muted-foreground">Store management software that scales with you</p>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-4xl mx-auto">
                {retailPlans.map((plan) => (
                  <PricingCard key={plan.name} plan={plan} accent="retail" />
                ))}
              </div>
            </div>

            {/* ERP Plans */}
            {erpPlans.length > 0 && (
              <div>
                <div className="max-w-3xl mx-auto text-center mb-10">
                  <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
                    MartPoint Enterprise
                  </h2>
                  <p className="mt-2 text-muted-foreground">Enterprise software for businesses that need control</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
                  {erpPlans.map((plan) => (
                    <PricingCard key={plan.name} plan={plan} accent="erp" />
                  ))}
                </div>
              </div>
            )}
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
                Talk to our team. We&apos;ll recommend the right setup based on
                your number of branches, staff size, and current challenges.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
                <Button asChild size="lg">
                  <a href="https://wa.me/+2348036028069?text=Hi%2C%20I%20came%20across%20your%20website%20and%20I%27m%20interested%20in%20learning%20more%20about%20MartPoint%20Retail.%20Can%20we%20talk%3F" target="_blank" rel="noopener noreferrer">
                    Book a Demo
                    <ArrowRight className="ml-2 h-4 w-4" />
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
