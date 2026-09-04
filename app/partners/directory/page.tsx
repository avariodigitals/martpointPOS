import type { Metadata } from "next"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { listPublicPartners, PARTNER_TYPE_LABELS, type PartnerType } from "@/lib/partners"
import { PartnerDirectoryClient } from "./directory-client"

export const metadata: Metadata = {
  title: "Find a MartPoint Partner | Partner Directory",
  description: "Browse verified, active MartPoint partners by location and partnership type.",
  alternates: { canonical: "/partners/directory" },
}

export const dynamic = "force-dynamic"

export default async function PartnerDirectoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const getString = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined)

  const partners = await listPublicPartners({
    country: getString("country"),
    state: getString("state"),
    city: getString("city"),
    partnerType: getString("type"),
    query: getString("q"),
  })

  // Distinct filter values from the full active+public set
  const all = await listPublicPartners()
  const countries = Array.from(new Set(all.map((p) => p.country).filter(Boolean))).sort()
  const states = Array.from(new Set(all.map((p) => p.state).filter(Boolean))).sort()
  const types = Array.from(new Set(all.map((p) => p.partnerType))) as PartnerType[]

  return (
    <>
      <Header />
      <main className="flex-1 bg-muted/30">
        <div className="container-martpoint py-12 md:py-16">
          <div className="text-center mb-10">
            <span className="inline-block text-xs font-semibold uppercase tracking-widest text-retail mb-3">
              Partner Directory
            </span>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-foreground">
              Find a MartPoint Partner
            </h1>
            <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
              Browse verified, active MartPoint partners. Only partners who have opted into public listing appear here.
            </p>
          </div>
          <PartnerDirectoryClient
            partners={partners}
            countries={countries}
            states={states}
            types={types}
            typeLabels={PARTNER_TYPE_LABELS}
            initialFilters={{ country: getString("country") || "", state: getString("state") || "", city: getString("city") || "", type: getString("type") || "", q: getString("q") || "" }}
          />
        </div>
      </main>
      <Footer />
    </>
  )
}
