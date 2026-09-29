import type { Metadata } from "next"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { TalentPoolForm } from "./talent-pool-form"

export const metadata: Metadata = {
  title: "Join the MartPoint Talent Pool | Careers",
  description:
    "Join the MartPoint Talent Pool and be contacted when roles or field deployments match your skills and location.",
  alternates: { canonical: "/careers/talent-pool" },
}

export default function TalentPoolPage() {
  return (
    <>
      <Header />
      <main className="flex-1 bg-muted/30">
        <div className="container-martpoint py-12 md:py-16">
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-8">
              <span className="inline-block text-xs font-semibold uppercase tracking-widest text-retail mb-3">
                Talent Pool
              </span>
              <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-foreground">
                Join Our Talent Pool
              </h1>
              <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
                Tell us about your skills, location and availability. When a matching role or field
                deployment opens, we will contact you. Joining is optional and consent-based.
              </p>
            </div>
            <TalentPoolForm />
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
