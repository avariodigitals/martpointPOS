import type { Metadata } from "next"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { CreatorApplicationForm } from "./apply-form"

export const metadata: Metadata = {
  title: "Apply — MartPoint Creator Network",
  description:
    "Apply to join the MartPoint Creator Network. Tell us about your content, platforms and audience. Applications are reviewed by the MartPoint team.",
  alternates: { canonical: "/creators/apply" },
}

export default function CreatorApplyPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-retail mb-2">
            MartPoint Creator Network
          </p>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight mb-3">Apply as a Creator</h1>
          <p className="text-muted-foreground">
            Tell us about yourself and your content. Admission is subject to review by the
            MartPoint team — an automated assistant helps our reviewers, but a person always
            makes the final decision.
          </p>
        </div>
        <CreatorApplicationForm />
      </main>
      <Footer />
    </div>
  )
}
