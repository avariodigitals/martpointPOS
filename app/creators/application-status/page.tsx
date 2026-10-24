import type { Metadata } from "next"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { CreatorStatusLookup } from "./status-lookup"

export const metadata: Metadata = {
  title: "Application Status — Creator Network",
  description: "Check the status of your MartPoint Creator Network application.",
  robots: { index: false },
}

export default function CreatorApplicationStatusPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="max-w-xl mx-auto px-4 sm:px-6 py-12 md:py-16">
        <div className="mb-8 text-center">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-2">Application Status</h1>
          <p className="text-muted-foreground text-sm">
            Enter your application reference (MCA-…) and the email you applied with.
          </p>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            Already applied for the Creator Network? You do not need to apply again for Pilot 001. If approved, activate your Creator Portal account and complete onboarding; the challenge will appear there when its join window opens.
          </p>
        </div>
        <CreatorStatusLookup />
      </main>
      <Footer />
    </div>
  )
}
