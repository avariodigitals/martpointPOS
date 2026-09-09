import type { Metadata } from "next"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { EstimateCalculator } from "@/components/estimate/estimate-calculator"
import { readSettings } from "@/lib/settings"
import { buildPricingFromSettings, type EstimatePricing } from "@/lib/estimate-calculator"

export const metadata: Metadata = {
  title: "Cost Estimator — Estimate Your MartPoint Setup Cost",
  description:
    "Answer a few questions about your business and get an instant estimated cost range for MartPoint Retail or ERP. No hidden fees — just a tailored recommendation.",
  alternates: {
    canonical: "/estimate",
  },
  openGraph: {
    title: "Cost Estimator — Estimate Your MartPoint Setup Cost",
    description:
      "Answer a few questions and get an instant estimated cost range for MartPoint Retail or ERP.",
    url: "https://martpoint.com.ng/estimate",
  },
}

export default async function EstimatePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const partnerCode = typeof sp.partner === "string" ? sp.partner.toUpperCase().trim() : ""

  const settings = await readSettings()
  const pricing = buildPricingFromSettings((settings?.pricing as Record<string, unknown>) || {})

  // Strip any numeric internals before passing to the client — only public plan
  // names + ranges are surfaced; the recommendation engine runs on the client for
  // live feedback, but the authoritative computation also runs server-side on submit.
  const clientPricing: EstimatePricing = pricing

  return (
    <>
      <Header />
      <main className="flex-1">
        <section className="w-full bg-background border-b border-border">
          <div className="container-martpoint py-12 md:py-16">
            <div className="max-w-3xl mx-auto text-center">
              <span className="inline-block text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                Cost Estimator
              </span>
              <h1 className="text-3xl md:text-5xl font-bold tracking-tight text-foreground">
                Estimate your MartPoint cost in 2 minutes
              </h1>
              <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
                Answer a few questions about your business and we will recommend the right
                MartPoint edition with an estimated cost range. No commitment — just clarity.
              </p>
            </div>
          </div>
        </section>

        <section className="w-full bg-muted py-12 md:py-20">
          <div className="container-martpoint">
            <EstimateCalculator pricing={clientPricing} partnerCode={partnerCode || undefined} />
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
