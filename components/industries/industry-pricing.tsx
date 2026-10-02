import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { SectionHeader } from "@/components/shared/section-header"
import { PlanCard } from "@/components/pricing/plan-card"
import { readSettings } from "@/lib/settings"
import { resolveCloudPlans, formatNairaAmount } from "@/lib/pricing-plans"

interface IndustryPricingProps {
  industryName: string
  /** Section background — chosen by the caller to preserve each template's
   *  alternating section colours. */
  tone?: "muted" | "background"
}

/** Compact pricing strip for retail industry pages. Reads the same
 *  settings-backed plan data as /pricing, so both can never drift.
 *  Render only for product === "retail" — ERP pricing is quote-only. */
export async function IndustryPricing({ industryName, tone = "muted" }: IndustryPricingProps) {
  const plans = resolveCloudPlans(await readSettings())
  const lowest = Math.min(...plans.map((p) => p.annualPrice))

  return (
    <section className={`w-full ${tone === "muted" ? "bg-muted" : "bg-background"} py-16 md:py-24`}>
      <div className="container-martpoint">
        <SectionHeader
          label="Pricing"
          headline={`Transparent annual pricing for ${industryName}`}
          description={`One annual Retail Cloud licence — from ${formatNairaAmount(lowest)} a year. Every plan includes your online store, WhatsApp ordering, activation and first admin login.`}
        />
        <div className="mt-14 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
          {plans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} />
          ))}
        </div>
        <p className="mt-10 text-center text-sm text-muted-foreground">
          Need different capacity? Add-ons extend any plan — and we always quote the lowest valid combination.
        </p>
        <div className="mt-3 text-center">
          <Link
            href="/pricing"
            className="inline-flex items-center text-sm font-semibold text-retail hover:underline"
          >
            See full plan comparison
            <ArrowRight className="ml-1.5 h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  )
}
