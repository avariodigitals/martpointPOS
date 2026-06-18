import type { Metadata } from "next"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { SectionHeader } from "@/components/shared/section-header"
import { Check, ArrowRight, HelpCircle } from "lucide-react"

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Transparent pricing for MartPoint Retail and ERP. Plans for every business size.",
}

const retailTiers = [
  {
    name: "MartPoint Retail Cloud",
    price: "₦99,999",
    period: "/ Year",
    description: "Everything you need to run a modern retail business.",
    features: [
      "POS Sales",
      "Inventory Management",
      "Customer Management",
      "Expense Tracking",
      "Supplier Management",
      "Reports & Analytics",
      "Receipt Printing",
      "Cloud Backup",
      "Software Updates",
      "Technical Support",
      "Mobile, Tablet & Desktop Access",
    ],
    branchNote: "Includes 1 Branch",
    extraBranch: "Additional Branch: ₦50,000 / Year",
    cta: "Get Started",
    href: "https://wa.me/+2348036028069?text=Hi%2C%20I%20came%20across%20your%20website%20and%20I%27m%20interested%20in%20the%20MartPoint%20Retail%20Cloud%20plan.%20Can%20we%20talk%3F",
    highlighted: true,
    external: true,
  },
  {
    name: "MartPoint Retail Offline",
    price: "₦250,000",
    period: "One-Time",
    description: "For businesses that prefer a perpetual offline deployment.",
    features: [
      "Full Retail Software",
      "POS Sales",
      "Inventory Management",
      "Receipt Printing",
      "Reporting",
      "Local Installation",
      "Staff Setup & Training",
    ],
    branchNote: "",
    extraBranch: "Additional Branch: ₦100,000 One-Time",
    supportNote: "Optional Support Renewal: ₦50,000 / Year",
    cta: "Request Offline Setup",
    href: "https://wa.me/+2348036028069?text=Hi%2C%20I%20came%20across%20your%20website%20and%20I%27m%20interested%20in%20the%20MartPoint%20Retail%20Offline%20setup.%20Can%20we%20talk%3F",
    highlighted: false,
    external: true,
  },
]

const erpTiers = [
  {
    name: "Growth",
    price: "₦85,000",
    period: "/month",
    description: "For SMEs ready to systematize operations",
    features: [
      "Up to 20 employees",
      "Accounting module",
      "Procurement module",
      "Basic HR & CRM",
      "Standard reports",
      "Email support",
    ],
    branchNote: "",
    extraBranch: "",
    supportNote: "",
    cta: "Get Started",
    href: "/book-demo",
    highlighted: false,
    external: false,
  },
  {
    name: "Scale",
    price: "₦180,000",
    period: "/month",
    description: "For multi-department businesses",
    features: [
      "Up to 100 employees",
      "Full accounting suite",
      "Advanced procurement",
      "HR, CRM & approvals",
      "Custom reports",
      "Priority support",
    ],
    branchNote: "",
    extraBranch: "",
    supportNote: "",
    cta: "Get Started",
    href: "/book-demo",
    highlighted: true,
    external: false,
  },
  {
    name: "Corporate",
    price: "Custom",
    period: "",
    description: "For enterprises with complex needs",
    features: [
      "Unlimited employees",
      "All modules included",
      "Custom workflows",
      "API access",
      "White-label options",
      "Dedicated support team",
    ],
    branchNote: "",
    extraBranch: "",
    supportNote: "",
    cta: "Request Quote",
    href: "/request-quote",
    highlighted: false,
    external: false,
  },
]

function PricingSection({
  title,
  subtitle,
  tiers,
  accentColor,
}: {
  title: string
  subtitle: string
  tiers: typeof retailTiers
  accentColor: "retail" | "erp"
}) {
  return (
    <div>
      <div className="text-center mb-10">
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
          {title}
        </h2>
        <p className="mt-2 text-muted-foreground">{subtitle}</p>
      </div>
      <div className={`grid grid-cols-1 ${accentColor === "retail" ? "md:grid-cols-2 max-w-3xl mx-auto" : "md:grid-cols-3"} gap-6`}>
        {tiers.map((tier) => (
          <div
            key={tier.name}
            className={`rounded-2xl border p-8 flex flex-col ${
              tier.highlighted
                ? accentColor === "retail"
                  ? "border-retail bg-retail-soft"
                  : "border-erp bg-erp-soft"
                : "border-border bg-card"
            }`}
          >
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-foreground">
                {tier.name}
              </h3>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold text-foreground">
                  {tier.price}
                </span>
                <span className="text-muted-foreground">{tier.period}</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {tier.description}
              </p>
            </div>
            <ul className="space-y-3 mb-6 flex-1">
              {tier.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2 text-sm">
                  <Check
                    className={`w-4 h-4 mt-0.5 shrink-0 ${
                      accentColor === "retail" ? "text-retail" : "text-erp"
                    }`}
                  />
                  <span className="text-foreground">{feature}</span>
                </li>
              ))}
            </ul>
            {"branchNote" in tier && tier.branchNote && (
              <div className="rounded-lg bg-muted p-3 text-center mb-3">
                <p className="text-sm font-semibold text-foreground">{tier.branchNote}</p>
                <p className="text-xs text-muted-foreground mt-1">{tier.extraBranch}</p>
              </div>
            )}
            {"supportNote" in tier && tier.supportNote && (
              <p className="text-xs text-muted-foreground text-center mb-3">{tier.supportNote}</p>
            )}
            {tier.external ? (
              <Button
                asChild
                variant={tier.highlighted ? accentColor : "outline"}
                className="w-full"
              >
                <a href={tier.href} target="_blank" rel="noopener noreferrer">
                  {tier.cta}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </Button>
            ) : (
              <Button
                asChild
                variant={tier.highlighted ? accentColor : "outline"}
                className="w-full"
              >
                <Link href={tier.href}>
                  {tier.cta}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function PricingPage() {
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
            <PricingSection
              title="MartPoint Retail"
              subtitle="Store management software that scales with you"
              tiers={retailTiers}
              accentColor="retail"
            />
            <PricingSection
              title="MartPoint ERP"
              subtitle="Enterprise software for businesses that need control"
              tiers={erpTiers}
              accentColor="erp"
            />
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
