import type { Metadata } from "next"
import QRCode from "qrcode"
import { notFound } from "next/navigation"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { getPublicPartnerByPartnerId, PARTNER_TYPE_LABELS } from "@/lib/partners"
import { BadgeCheck, MapPin, Globe, Calendar, ShieldAlert, QrCode } from "lucide-react"

export const dynamic = "force-dynamic"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ partnerId: string }>
}): Promise<Metadata> {
  const { partnerId } = await params
  const partner = await getPublicPartnerByPartnerId(partnerId.toUpperCase())
  if (!partner) {
    return { title: "Partner Not Found — MartPoint" }
  }
  return {
    title: `${partner.displayName} — MartPoint Partner ${partner.partnerId}`,
    description: `Verify MartPoint partner ${partner.displayName} (${partner.partnerId}).`,
    alternates: { canonical: `/partners/${partner.partnerId}` },
  }
}

export default async function PartnerProfilePage({
  params,
}: {
  params: Promise<{ partnerId: string }>
}) {
  const { partnerId: rawId } = await params
  const partnerId = rawId.toUpperCase()
  const partner = await getPublicPartnerByPartnerId(partnerId)

  if (!partner) {
    return (
      <>
        <Header />
        <main className="flex-1 bg-muted/30">
          <div className="container-martpoint py-16 md:py-24">
            <div className="max-w-xl mx-auto text-center">
              <ShieldAlert className="w-12 h-12 mx-auto text-amber-500 mb-4" />
              <h1 className="text-2xl font-bold">Partner Not Found</h1>
              <p className="text-muted-foreground mt-2">
                No MartPoint partner was found for ID <span className="font-mono">{partnerId}</span>.
                Please check the Partner ID and try again.
              </p>
              <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
                <a href="/partners/verify" className="inline-flex items-center justify-center rounded-lg bg-retail text-white px-4 py-2 text-sm font-semibold">Try Another ID</a>
                <a href="/partners/directory" className="inline-flex items-center justify-center rounded-lg border border-border px-4 py-2 text-sm font-semibold">Browse Directory</a>
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </>
    )
  }

  const isActive = partner.status === "ACTIVE" && partner.publicProfileEnabled
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://www.martpoint.com.ng"
  const verifyUrl = `${baseUrl}/partners/${partner.partnerId}`
  // QR contains ONLY the public verification URL — no private info.
  const qrDataUrl = await QRCode.toDataURL(verifyUrl, { margin: 1, width: 240, color: { dark: "#0A0F1C", light: "#ffffff" } })

  return (
    <>
      <Header />
      <main className="flex-1 bg-muted/30">
        <div className="container-martpoint py-12 md:py-16">
          <div className="max-w-3xl mx-auto">
            <div className="rounded-xl border border-border bg-background p-6 md:p-8">
              <div className="flex flex-col sm:flex-row gap-6">
                <div className="w-16 h-16 rounded-lg bg-retail-soft flex items-center justify-center text-retail font-bold text-2xl shrink-0">
                  {partner.displayName.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-2xl font-bold tracking-tight">{partner.displayName}</h1>
                    {isActive ? (
                      <span className="inline-flex items-center gap-1 text-xs uppercase tracking-wider px-2 py-0.5 rounded-full bg-green-50 text-green-700 font-semibold">
                        <BadgeCheck className="w-3.5 h-3.5" /> Verified Active Partner
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-semibold">
                        <ShieldAlert className="w-3.5 h-3.5" /> Not Active
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground font-mono mt-1">{partner.partnerId}</p>
                  <p className="text-sm text-retail mt-1">{PARTNER_TYPE_LABELS[partner.partnerType] || partner.partnerType}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground"><MapPin className="w-4 h-4" /> {[partner.city, partner.state, partner.country].filter(Boolean).join(", ") || "—"}</div>
                {partner.partnerSince && <div className="flex items-center gap-2 text-muted-foreground"><Calendar className="w-4 h-4" /> Partner since {new Date(partner.partnerSince).toLocaleDateString()}</div>}
                {partner.website && isActive && <div className="flex items-center gap-2 text-muted-foreground"><Globe className="w-4 h-4" /> <a href={partner.website} target="_blank" rel="noopener noreferrer" className="text-retail hover:underline">{partner.website}</a></div>}
              </div>

              {/* Future-ready sections (disabled) */}
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">Authorised services</p>
                  <p className="text-xs mt-1">Not yet available.</p>
                </div>
                <div className="rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground">
                  <p className="font-medium text-foreground">Certifications</p>
                  <p className="text-xs mt-1">Not yet available.</p>
                </div>
              </div>

              {!isActive && (
                <div className="mt-6 rounded-md bg-amber-50 p-4 text-sm text-amber-800">
                  This partner is not currently listed as an active MartPoint Partner.
                </div>
              )}

              {/* QR */}
              <div className="mt-8 pt-6 border-t border-border flex flex-col sm:flex-row items-center gap-4">
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrDataUrl} alt={`QR code for ${partner.partnerId}`} className="w-28 h-28 rounded-md border border-border" />
                  <div>
                    <p className="text-sm font-medium flex items-center gap-1"><QrCode className="w-4 h-4" /> Verification QR</p>
                    <p className="text-xs text-muted-foreground mt-1">Scan to open this verification page.</p>
                    <p className="text-xs text-muted-foreground font-mono mt-1 break-all">{verifyUrl}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
              <a href="/partners/directory" className="inline-flex items-center justify-center rounded-lg border border-border px-4 py-2 text-sm font-semibold">Browse Directory</a>
              <a href="/partners/verify" className="inline-flex items-center justify-center rounded-lg border border-border px-4 py-2 text-sm font-semibold">Verify Another Partner</a>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
