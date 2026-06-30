export const revalidate = 86400
import type { Metadata } from "next"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { LeadForm } from "@/components/shared/lead-form"

export const metadata: Metadata = {
  title: "Request a Quote",
  description:
    "Get a custom quote for MartPoint Retail or ERP. Tailored pricing for your business size and needs.",
}

export default function RequestQuotePage() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <section className="w-full bg-background border-b border-border">
          <div className="container-martpoint py-12 md:py-16">
            <div className="max-w-2xl mx-auto">
              <LeadForm pageType="quote" />
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
