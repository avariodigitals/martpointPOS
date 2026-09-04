import type { Metadata } from "next"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { PartnerApplicationForm } from "./apply-form"

export const metadata: Metadata = {
  title: "Become a MartPoint Partner | Partner Application",
  description:
    "Apply to become a MartPoint partner. Referral, channel, implementation, technology and payment partnerships.",
  alternates: { canonical: "/partners/apply" },
}

export default function PartnerApplyPage() {
  return (
    <>
      <Header />
      <main className="flex-1 bg-muted/30">
        <div className="container-martpoint py-12 md:py-16">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-8">
              <span className="inline-block text-xs font-semibold uppercase tracking-widest text-retail mb-3">
                Partner Application
              </span>
              <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-foreground">
                Become a MartPoint Partner
              </h1>
              <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
                Complete the application below. We review every application carefully and will
                contact you with next steps.
              </p>
            </div>
            <PartnerApplicationForm />
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
