export const revalidate = 86400
import type { Metadata } from "next"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { LeadForm } from "@/components/shared/lead-form"

export const metadata: Metadata = {
  title: "Book a Demo",
  description:
    "Schedule a personalized demo of MartPoint Retail or ERP. See how it works for your business.",
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
