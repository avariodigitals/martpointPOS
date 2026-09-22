import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { VerifyPartnerClient } from "./verify-client"

export const metadata: Metadata = {
  title: "Verify a MartPoint Partner | Partner Verification",
  description: "Verify a MartPoint partner by Partner ID. Confirm active partner status.",
  alternates: { canonical: "/partners/verify" },
}

export default async function VerifyPartnerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  /* Badge embeds link here as /partners/verify?partner=MP-NG-00001 — send
   * straight to the public profile so one click verifies the partner. */
  const sp = await searchParams
  const code = (typeof sp.partner === "string" ? sp.partner : "").trim().toUpperCase()
  if (/^MP-[A-Z]{2,3}-\d{1,6}$/.test(code)) {
    redirect(`/partners/${code}?src=badge`)
  }

  return (
    <>
      <Header />
      <main className="flex-1 bg-muted/30">
        <div className="container-martpoint py-12 md:py-16">
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-8">
              <span className="inline-block text-xs font-semibold uppercase tracking-widest text-retail mb-3">
                Partner Verification
              </span>
              <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-foreground">
                Verify a MartPoint Partner
              </h1>
              <p className="mt-3 text-muted-foreground">
                Enter a MartPoint Partner ID to confirm their status.
              </p>
            </div>
            <VerifyPartnerClient />
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
