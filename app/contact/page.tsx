export const revalidate = 86400
import type { Metadata } from "next"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { LeadForm } from "@/components/shared/lead-form"

export const metadata: Metadata = {
  title: "Contact Sales — Talk to MartPoint Team",
  description: "Talk to our sales team about MartPoint POS and ERP software for your business in Nigeria and Africa.",
  alternates: {
    canonical: "/contact",
  },
  openGraph: {
    title: "Contact Sales — Talk to MartPoint Team",
    description: "Talk to our sales team about MartPoint POS and ERP for your business.",
    url: "https://martpoint.com.ng/contact",
  },
}

export default function ContactPage() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <section className="w-full bg-background border-b border-border">
          <div className="container-martpoint py-12 md:py-16">
            <div className="max-w-2xl mx-auto">
              <LeadForm pageType="contact" />
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
