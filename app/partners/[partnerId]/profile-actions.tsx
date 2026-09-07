"use client"

import { Globe, Phone, Mail, ShoppingBag } from "lucide-react"
import { trackPartnerEvent } from "@/components/partners/partner-tracker"

/** Tracked contact links + sales CTA on the public partner profile. */
export function PartnerContactLinks({
  partnerId,
  website,
  publicPhone,
  publicEmail,
}: {
  partnerId: string
  website: string | null
  publicPhone: string | null
  publicEmail: string | null
}) {
  return (
    <>
      {website && (
        <a
          href={website}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => trackPartnerEvent(partnerId, "website_click")}
          className="flex items-center gap-2 text-muted-foreground hover:text-retail transition-colors"
        >
          <Globe className="w-4 h-4" /> <span className="text-retail hover:underline">{website}</span>
        </a>
      )}
      {publicPhone && (
        <a
          href={`tel:${publicPhone}`}
          onClick={() => trackPartnerEvent(partnerId, "phone_click")}
          className="flex items-center gap-2 text-muted-foreground hover:text-retail transition-colors"
        >
          <Phone className="w-4 h-4" /> {publicPhone}
        </a>
      )}
      {publicEmail && (
        <a
          href={`mailto:${publicEmail}`}
          onClick={() => trackPartnerEvent(partnerId, "email_click")}
          className="flex items-center gap-2 text-muted-foreground hover:text-retail transition-colors"
        >
          <Mail className="w-4 h-4" /> {publicEmail}
        </a>
      )}
    </>
  )
}

export function PartnerSalesCta({ partnerId }: { partnerId: string }) {
  return (
    <a
      href={`/request-quote?partner=${encodeURIComponent(partnerId)}`}
      onClick={() => trackPartnerEvent(partnerId, "sales_cta_click", { placement: "profile" })}
      className="inline-flex items-center justify-center gap-2 rounded-lg bg-retail text-white px-5 py-2.5 text-sm font-semibold hover:bg-retail/90 transition-colors"
    >
      <ShoppingBag className="w-4 h-4" /> Buy MartPoint via this partner
    </a>
  )
}
