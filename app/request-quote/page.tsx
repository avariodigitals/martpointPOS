import type { Metadata } from "next"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { LeadForm } from "@/components/shared/lead-form"
import { getPublicPartnerByPartnerId } from "@/lib/partners"
import { BadgeCheck } from "lucide-react"

export const metadata: Metadata = {
  title: "Request a Quote",
  description:
    "Get a custom quote for MartPoint Retail or ERP. Tailored pricing for your business size and needs.",
  alternates: {
    canonical: "/request-quote",
  },
}

export default async function RequestQuotePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const partnerCode = typeof sp.partner === "string" ? sp.partner.toUpperCase().trim() : ""
  const partner = partnerCode ? await getPublicPartnerByPartnerId(partnerCode) : null
  const validPartner = partner && partner.status === "ACTIVE" ? partner : null

  return (
    <>
      <Header />
      <main className="flex-1">
        <section className="w-full bg-background border-b border-border">
          <div className="container-martpoint py-12 md:py-16">
            <div className="max-w-2xl mx-auto">
              {validPartner && (
                <div className="mb-8 rounded-xl border border-emerald-200 bg-emerald-50 p-4 flex items-center gap-3">
                  <BadgeCheck className="w-5 h-5 text-emerald-600 shrink-0" />
                  <p className="text-sm text-emerald-900">
                    Referred by verified partner{" "}
                    <span className="font-semibold">{validPartner.displayName}</span>{" "}
                    <span className="font-mono text-xs">({validPartner.partnerId})</span> —
                    your quote will be linked to them.
                  </p>
                </div>
              )}
              <LeadForm pageType="quote" partnerCode={validPartner?.partnerId} />
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
