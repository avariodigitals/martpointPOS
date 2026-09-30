import type { Metadata } from "next"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { DemoBooking } from "@/components/shared/demo-booking"
import { getPublicPartnerByPartnerId } from "@/lib/partners"

export const metadata: Metadata = {
  title: "Book a Free Demo — See MartPoint POS in Action",
  description:
    "Schedule a free personalized demo of MartPoint Retail POS software. See how it works for your supermarket, pharmacy, restaurant or retail store.",
  alternates: {
    canonical: "/book-demo",
  },
  openGraph: {
    title: "Book a Free Demo — See MartPoint POS in Action",
    description: "Schedule a free demo of MartPoint Retail POS. See how it works for your business.",
    url: "https://martpoint.com.ng/book-demo",
  },
}

export default async function BookDemoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const partnerCode = typeof sp.partner === "string" ? sp.partner.toUpperCase().trim() : ""
  const partner = partnerCode ? await getPublicPartnerByPartnerId(partnerCode) : null
  const validPartner = partner && partner.status === "ACTIVE" ? partner : null
  // ERP demos arrive via the dedicated ?product=erp route only.
  const isErp = typeof sp.product === "string" && sp.product.toLowerCase() === "erp"

  return (
    <>
      <Header />
      <main className="flex-1">
        <section className="w-full bg-background border-b border-border">
          <div className="container-martpoint py-12 md:py-16">
            <div className="max-w-2xl mx-auto">
              {validPartner && (
                <div className="mb-6 rounded-lg border border-retail/20 bg-retail/5 p-4 text-sm text-center">
                  Referred by <span className="font-medium">{validPartner.businessName}</span> — your demo will be linked to them.
                </div>
              )}
              <DemoBooking partnerCode={validPartner?.partnerId} includeErpOption={isErp} productDefault={isErp ? "erp" : "not-sure"} />
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
