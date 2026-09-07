import type { Metadata } from "next"
import Link from "next/link"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { listPublicPartners, PARTNER_TYPE_LABELS, type PartnerType } from "@/lib/partners"
import { PartnerDirectoryClient } from "./directory-client"
import { ShieldCheck, BadgeCheck, Globe2, Building2, SearchCheck } from "lucide-react"

export const metadata: Metadata = {
  title: "MartPoint Partner Directory | Verified Partners Near You",
  description:
    "Browse verified, active MartPoint partners by name, location and partnership type. Buy MartPoint through an authorised partner and verify any partner by ID.",
  alternates: { canonical: "/partners/directory" },
}

export const dynamic = "force-dynamic"

export default async function PartnerDirectoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const sp = await searchParams
  const getString = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined)

  const partners = await listPublicPartners({
    country: getString("country"),
    state: getString("state"),
    city: getString("city"),
    partnerType: getString("type"),
    query: getString("q"),
  })

  // Distinct filter values from the full active+public set
  const all = await listPublicPartners()
  const countries = Array.from(new Set(all.map((p) => p.country).filter(Boolean))).sort()
  const states = Array.from(new Set(all.map((p) => p.state).filter(Boolean))).sort()
  const types = Array.from(new Set(all.map((p) => p.partnerType))) as PartnerType[]

  return (
    <>
      <Header />
      <main className="flex-1 bg-muted/30">
        {/* Hero */}
        <section className="relative overflow-hidden bg-retail-soft border-b border-retail-muted">
          <div
            aria-hidden
            className="absolute inset-0 opacity-60"
            style={{
              backgroundImage:
                "radial-gradient(circle at 15% 20%, rgba(0,87,255,0.12) 0%, transparent 45%), radial-gradient(circle at 85% 0%, rgba(20,195,142,0.12) 0%, transparent 40%)",
            }}
          />
          <div className="container-martpoint relative py-16 md:py-24">
            <div className="max-w-3xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-retail/20 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-retail">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                MartPoint Partner Network
              </span>
              <h1 className="mt-5 text-4xl md:text-5xl font-extrabold tracking-tight leading-[1.05] text-foreground">
                Work with a verified
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-retail to-emerald-500"> MartPoint partner</span>
              </h1>
              <p className="mt-4 text-muted-foreground text-lg max-w-2xl">
                Every partner listed here is approved, active and authorised to represent MartPoint.
                Buy through a partner, get local support — and verify anyone claiming to be a partner by their official ID.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <Link
                  href="/partners/verify"
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-retail text-white px-5 py-3 text-sm font-semibold hover:bg-retail/90 transition-colors"
                >
                  <SearchCheck className="w-4 h-4" /> Verify a Partner ID
                </Link>
                <Link
                  href="/partners/apply"
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-retail/30 bg-white px-5 py-3 text-sm font-semibold text-retail hover:bg-retail-soft transition-colors"
                >
                  Become a Partner
                </Link>
              </div>
            </div>

            {/* Stats band */}
            <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-px rounded-2xl overflow-hidden border border-retail-muted bg-retail-muted shadow-sm">
              {[
                { icon: BadgeCheck, value: String(all.length), label: "Verified partners" },
                { icon: Globe2, value: String(countries.length || "—"), label: "Countries" },
                { icon: Building2, value: String(types.length || "—"), label: "Partnership types" },
                { icon: ShieldCheck, value: "100%", label: "ID-verifiable" },
              ].map((s) => (
                <div key={s.label} className="bg-white px-5 py-4">
                  <s.icon className="w-4 h-4 text-retail mb-1.5" />
                  <p className="text-2xl font-bold text-foreground">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Directory */}
        <div className="container-martpoint py-12 md:py-16">
          <PartnerDirectoryClient
            partners={partners}
            countries={countries}
            states={states}
            types={types}
            typeLabels={PARTNER_TYPE_LABELS}
            initialFilters={{ country: getString("country") || "", state: getString("state") || "", city: getString("city") || "", type: getString("type") || "", q: getString("q") || "" }}
          />
        </div>

        {/* Trust strip */}
        <section className="border-t border-border bg-background">
          <div className="container-martpoint py-12 md:py-16 grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: BadgeCheck,
                title: "Only approved partners are listed",
                desc: "Every partner shown here has been reviewed and approved by MartPoint. Suspended or unauthorised individuals will not appear in this directory.",
              },
              {
                icon: SearchCheck,
                title: "Verify a partner instantly",
                desc: "Search using the partner's name or unique MartPoint Partner ID, or scan the QR code on their official certificate.",
              },
              {
                icon: ShieldCheck,
                title: "Your software purchase is protected",
                desc: "MartPoint issues all software invoices, licences and activation confirmations. A listed partner may guide your purchase, but payment should only be made through an authorised MartPoint payment channel stated on your invoice.",
              },
            ].map((f) => (
              <div key={f.title} className="flex gap-4">
                <div className="w-10 h-10 rounded-lg bg-retail-soft flex items-center justify-center shrink-0">
                  <f.icon className="w-5 h-5 text-retail" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">{f.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
