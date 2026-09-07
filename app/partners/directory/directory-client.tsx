"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Search, BadgeCheck, MapPin, Globe, Calendar, Phone, Mail, ArrowUpRight, ShoppingBag, Flag, AlertTriangle, Wrench } from "lucide-react"
import { trackPartnerEvent } from "@/components/partners/partner-tracker"

interface PublicPartner {
  id: string
  partnerId: string
  businessName: string
  displayName: string
  partnerType: string
  country: string
  state: string
  city: string
  website: string | null
  logoUrl: string | null
  publicEmail: string | null
  publicPhone: string | null
  publicAddress: string | null
  serviceAreas: string
  services: string[]
  partnerSince: string | null
}

interface Props {
  partners: PublicPartner[]
  countries: string[]
  states: string[]
  types: string[]
  typeLabels: Record<string, string>
  initialFilters: { country: string; state: string; city: string; type: string; q: string }
}

export function PartnerDirectoryClient({ partners, countries, states, types, typeLabels, initialFilters }: Props) {
  const router = useRouter()
  const [f, setF] = useState(initialFilters)

  const apply = () => {
    const params = new URLSearchParams()
    if (f.q) params.set("q", f.q)
    if (f.country) params.set("country", f.country)
    if (f.state) params.set("state", f.state)
    if (f.city) params.set("city", f.city)
    if (f.type) params.set("type", f.type)
    router.push(`/partners/directory?${params.toString()}`)
  }

  const selectCls = "rounded-md border border-input bg-background px-3 py-2 text-sm"

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Filters */}
      <div className="rounded-2xl border border-border bg-background shadow-sm p-4 md:p-6 -mt-24 md:-mt-28 relative z-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="relative lg:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              placeholder="Search name or Partner ID"
              value={f.q}
              onChange={(e) => setF({ ...f, q: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && apply()}
              className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm"
            />
          </div>
          <select className={selectCls} value={f.country} onChange={(e) => setF({ ...f, country: e.target.value })}>
            <option value="">All countries</option>
            {countries.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className={selectCls} value={f.state} onChange={(e) => setF({ ...f, state: e.target.value })}>
            <option value="">All states</option>
            {states.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className={selectCls} value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
            <option value="">All types</option>
            {types.map((t) => <option key={t} value={t}>{typeLabels[t as keyof typeof typeLabels] || t}</option>)}
          </select>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Button onClick={apply}><Search className="w-4 h-4 mr-1" /> Search</Button>
          <Button variant="outline" onClick={() => { setF({ country: "", state: "", city: "", type: "", q: "" }); router.push("/partners/directory") }}>Clear</Button>
          <p className="ml-auto text-xs text-muted-foreground hidden sm:block">
            {partners.length} verified partner{partners.length === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      {partners.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-sm">No partners match your search. <Link href="/partners/apply" className="text-retail hover:underline">Become a partner</Link>.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {partners.map((p) => (
            <div
              key={p.id}
              className="group rounded-2xl border border-border bg-background p-6 transition-all hover:border-retail/40 hover:shadow-md flex flex-col"
            >
              <div className="flex items-start justify-between mb-4">
                {p.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.logoUrl} alt={p.displayName || p.businessName} className="w-12 h-12 rounded-lg object-contain border border-border bg-white" />
                ) : (
                  <div className="w-12 h-12 rounded-lg bg-[#0A0F1C] flex items-center justify-center text-white font-bold text-lg">
                    {(p.displayName || p.businessName).charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold">
                  <BadgeCheck className="w-3 h-3" /> Verified
                </span>
              </div>

              <h3 className="text-base font-semibold text-foreground group-hover:text-retail transition-colors">
                {p.displayName || p.businessName}
              </h3>
              <p className="text-xs text-muted-foreground font-mono mt-0.5">{p.partnerId}</p>
              <p className="text-xs text-retail font-medium mt-1">{typeLabels[p.partnerType as keyof typeof typeLabels] || p.partnerType}</p>

              {p.services.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {p.services.map((s) => (
                    <span key={s} className="inline-flex items-center gap-1 rounded-full bg-retail-soft px-2 py-0.5 text-[10px] font-medium text-retail">
                      <Wrench className="w-2.5 h-2.5" /> {s}
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-4 space-y-1.5 text-xs text-muted-foreground flex-1">
                {p.serviceAreas && (
                  <p className="flex items-center gap-1.5"><Globe className="w-3.5 h-3.5 shrink-0" /> Serves: {p.serviceAreas}</p>
                )}
                {p.publicAddress && (
                  <p className="flex items-start gap-1.5"><MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" /> {p.publicAddress}</p>
                )}
                <p className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 shrink-0" /> {[p.city, p.state, p.country].filter(Boolean).join(", ") || "—"}</p>
                {p.publicPhone && (
                  <p className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 shrink-0" /> {p.publicPhone}</p>
                )}
                {p.publicEmail && (
                  <p className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 shrink-0" /> {p.publicEmail}</p>
                )}
                {p.partnerSince && (
                  <p className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 shrink-0" /> Partner since {new Date(p.partnerSince).toLocaleDateString()}</p>
                )}
                {p.website && (
                  <p className="flex items-center gap-1.5"><Globe className="w-3.5 h-3.5 shrink-0" /> {p.website}</p>
                )}
              </div>

              <div className="mt-5 pt-4 border-t border-border flex items-center gap-2">
                <Link
                  href={`/partners/${p.partnerId}`}
                  onClick={() => trackPartnerEvent(p.partnerId, "directory_click")}
                  className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-[#0A0F1C] text-white px-3 py-2 text-xs font-semibold hover:bg-[#0A0F1C]/90 transition-colors"
                >
                  View Profile <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
                <Link
                  href={`/request-quote?partner=${encodeURIComponent(p.partnerId)}`}
                  onClick={() => trackPartnerEvent(p.partnerId, "sales_cta_click", { placement: "directory_card" })}
                  className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg bg-retail text-white px-3 py-2 text-xs font-semibold hover:bg-retail/90 transition-colors"
                >
                  <ShoppingBag className="w-3.5 h-3.5" /> Buy via Partner
                </Link>
              </div>

              <div className="mt-3 flex items-center justify-between text-[10px] text-muted-foreground">
                <a
                  href={`mailto:support@martpoint.com.ng?subject=${encodeURIComponent(`Report partner ${p.partnerId}`)}`}
                  className="inline-flex items-center gap-1 hover:text-destructive transition-colors"
                >
                  <Flag className="w-3 h-3" /> Report this partner
                </a>
                <span className="inline-flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-amber-500" /> Verify before paying
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Status warning + become-a-partner CTA */}
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <p className="text-sm text-amber-900">
          Partner status can change. Always verify a partner&apos;s ID on our{" "}
          <Link href="/partners/verify" className="font-semibold underline">verification page</Link>{" "}
          before making any payment, and only pay through the authorised MartPoint payment channel stated on your invoice.
        </p>
      </div>

      <div className="rounded-2xl bg-[#0A0F1C] text-white p-8 md:p-10 flex flex-col md:flex-row md:items-center gap-6">
        <div className="flex-1">
          <h2 className="text-xl md:text-2xl font-bold">Become a MartPoint Partner</h2>
          <p className="mt-2 text-sm text-white/70 max-w-lg">
            Join a vetted network of businesses helping African retailers run on MartPoint. Approved partners get a verifiable public profile and a unique Partner ID.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <Link href="/partners/apply" className="inline-flex items-center justify-center rounded-lg bg-retail text-white px-5 py-3 text-sm font-semibold hover:bg-retail/90 transition-colors">
            Apply now
          </Link>
          <Link href="/partners" className="inline-flex items-center justify-center rounded-lg border border-white/20 px-5 py-3 text-sm font-semibold hover:bg-white/10 transition-colors">
            Explore partnership types
          </Link>
        </div>
      </div>
    </div>
  )
}
