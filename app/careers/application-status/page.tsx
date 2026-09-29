import type { Metadata } from "next"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { StatusLookup } from "./status-lookup"

export const metadata: Metadata = {
  title: "Check Application Status | MartPoint Careers",
  description:
    "Check the status of your MartPoint job application using your application reference and email.",
  alternates: { canonical: "/careers/application-status" },
}

export default function CareerStatusPage() {
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
                Enter your application reference (e.g. MPC-2026-XXXXXX) and the email you applied with.
              </p>
            </div>
            <StatusLookup />
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
