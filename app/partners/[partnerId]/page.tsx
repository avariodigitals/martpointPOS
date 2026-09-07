import type { Metadata } from "next"
import QRCode from "qrcode"
import { Header } from "@/components/layout/header"
import { Footer } from "@/components/layout/footer"
import { getPublicPartnerByPartnerId, PARTNER_TYPE_LABELS } from "@/lib/partners"
import { BadgeCheck, MapPin, Calendar, ShieldAlert, QrCode, Copy, Globe2, Wrench, Flag, AlertTriangle } from "lucide-react"
import { TrackPartnerEvent } from "@/components/partners/partner-tracker"
import { PartnerContactLinks, PartnerSalesCta } from "./profile-actions"

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
  searchParams,
}: {
  params: Promise<{ partnerId: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { partnerId: rawId } = await params
  const sp = await searchParams
  const src = typeof sp.src === "string" ? sp.src : ""
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
  const location = [partner.city, partner.state, partner.country].filter(Boolean).join(", ")

  return (
    <>
      <Header />
      <TrackPartnerEvent partnerId={partner.partnerId} event={src === "verify" ? "verify_lookup" : "profile_view"} />
      <main className="flex-1 bg-muted/30">
        <div className="container-martpoint py-12 md:py-16">
          <div className="max-w-3xl mx-auto">
            <div className="rounded-2xl border border-border bg-background shadow-sm overflow-hidden">
              {/* Status ribbon */}
              <div className={`px-6 md:px-8 py-3 text-xs font-semibold uppercase tracking-widest flex items-center gap-2 ${isActive ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                {isActive ? (
                  <><BadgeCheck className="w-4 h-4" /> Verified Active Partner — this ID is authentic</>
                ) : (
                  <><ShieldAlert className="w-4 h-4" /> Not currently listed as an active partner</>
                )}
              </div>

              <div className="p-6 md:p-8">
                <div className="flex flex-col sm:flex-row gap-6">
                  <div className="w-16 h-16 rounded-xl bg-[#0A0F1C] flex items-center justify-center text-white font-bold text-2xl shrink-0">
                    {partner.displayName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <h1 className="text-2xl font-bold tracking-tight">{partner.displayName}</h1>
                    <p className="text-sm text-muted-foreground font-mono mt-1 flex items-center gap-1.5">
                      <Copy className="w-3.5 h-3.5" /> {partner.partnerId}
                    </p>
                    <p className="text-sm text-retail font-medium mt-1">{PARTNER_TYPE_LABELS[partner.partnerType] || partner.partnerType}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6 text-sm">
                  {partner.publicAddress && (
                    <div className="flex items-start gap-2 text-muted-foreground sm:col-span-2"><MapPin className="w-4 h-4 mt-0.5 shrink-0" /> {partner.publicAddress}</div>
                  )}
                  <div className="flex items-center gap-2 text-muted-foreground"><MapPin className="w-4 h-4" /> {location || "—"}</div>
                  {partner.serviceAreas && (
                    <div className="flex items-center gap-2 text-muted-foreground"><Globe2 className="w-4 h-4" /> Serves: {partner.serviceAreas}</div>
                  )}
                  {partner.partnerSince && <div className="flex items-center gap-2 text-muted-foreground"><Calendar className="w-4 h-4" /> Partner since {new Date(partner.partnerSince).toLocaleDateString()}</div>}
                  {isActive && (
                    <PartnerContactLinks
                      partnerId={partner.partnerId}
                      website={partner.website}
                      publicPhone={partner.publicPhone}
                      publicEmail={partner.publicEmail}
                    />
                  )}
                </div>

                {!isActive && (
                  <div className="mt-6 rounded-md bg-amber-50 p-4 text-sm text-amber-800">
                    This partner is not currently listed as an active MartPoint Partner. If someone
                    presented this ID to you, please contact MartPoint before making any payment.
                  </div>
                )}

                {isActive && (
                  <div className="mt-6 rounded-xl border border-retail/20 bg-retail-soft p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-foreground">Ready to buy MartPoint?</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Request a quote through {partner.displayName} — your purchase is handled and invoiced by MartPoint directly.
                      </p>
                    </div>
                    <PartnerSalesCta partnerId={partner.partnerId} />
                  </div>
                )}

                {isActive && partner.services.length > 0 && (
                  <div className="mt-6 rounded-md border border-border p-4">
                    <p className="text-sm font-medium text-foreground flex items-center gap-1.5"><Wrench className="w-4 h-4 text-retail" /> Authorised services</p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {partner.services.map((s) => (
                        <span key={s} className="inline-flex items-center rounded-full bg-retail-soft px-2.5 py-1 text-xs font-medium text-retail">{s}</span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-6 rounded-md border border-amber-200 bg-amber-50 p-4 flex items-start gap-2.5 text-sm text-amber-900">
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" />
                  <p>
                    Partner status can change — verify this ID before making any payment. MartPoint issues all software
                    invoices and licences directly; only pay through the authorised MartPoint payment channel stated on your invoice.
                  </p>
                </div>

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
            </div>

            <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
              <a href="/partners/directory" className="inline-flex items-center justify-center rounded-lg border border-border px-4 py-2 text-sm font-semibold">Browse Directory</a>
              <a href="/partners/verify" className="inline-flex items-center justify-center rounded-lg border border-border px-4 py-2 text-sm font-semibold">Verify Another Partner</a>
            </div>

            <p className="mt-4 text-center">
              <a
                href={`mailto:support@martpoint.com.ng?subject=${encodeURIComponent(`Report partner ${partner.partnerId}`)}`}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors"
              >
                <Flag className="w-3.5 h-3.5" /> Report this partner
              </a>
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}
