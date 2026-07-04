export const revalidate = 86400
import type { Metadata } from "next"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { LeadForm } from "@/components/shared/lead-form"

export const metadata: Metadata = {
  title: "Book a Free Demo — See MartPoint POS in Action",
  description:
    "Schedule a free personalized demo of MartPoint Retail POS or ERP software. See how it works for your supermarket, pharmacy, restaurant or retail store.",
  alternates: {
    canonical: "/book-demo",
  },
  openGraph: {
    title: "Book a Free Demo — See MartPoint POS in Action",
    description: "Schedule a free demo of MartPoint Retail POS or ERP. See how it works for your business.",
    url: "https://martpoint.com.ng/book-demo",
  },
}

export default function BookDemoPage() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <section className="w-full bg-background border-b border-border">
          <div className="container-martpoint py-12 md:py-16">
            <div className="max-w-2xl mx-auto">
              <LeadForm pageType="demo" />
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
