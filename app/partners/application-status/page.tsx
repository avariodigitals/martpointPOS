import type { Metadata } from "next"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { ApplicationStatusLookup } from "./status-lookup"

export const metadata: Metadata = {
  title: "Check Partner Application Status | MartPoint",
  description: "Check the status of your MartPoint partner application using your reference number and email.",
  alternates: { canonical: "/partners/application-status" },
}

export default function ApplicationStatusPage() {
  return (
    <>
      <Header />
      <main className="flex-1 bg-muted/30">
        <div className="container-martpoint py-12 md:py-16">
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-8">
              <span className="inline-block text-xs font-semibold uppercase tracking-widest text-retail mb-3">
                Application Status
              </span>
              <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-foreground">
                Check Your Application Status
              </h1>
              <p className="mt-3 text-muted-foreground">
                Enter your application reference and the email you used to apply.
              </p>
            </div>
            <ApplicationStatusLookup />
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
