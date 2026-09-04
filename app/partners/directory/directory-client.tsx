"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Search, BadgeCheck, MapPin, Globe, Calendar } from "lucide-react"

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
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Filters */}
      <div className="rounded-xl border border-border bg-background p-4 md:p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <input placeholder="Search name or Partner ID" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
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
        <div className="mt-3 flex gap-2">
          <Button onClick={apply}><Search className="w-4 h-4 mr-1" /> Search</Button>
          <Button variant="outline" onClick={() => { setF({ country: "", state: "", city: "", type: "", q: "" }); router.push("/partners/directory") }}>Clear</Button>
        </div>
      </div>

      {partners.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-sm">No partners match your search. <Link href="/partners/apply" className="text-retail hover:underline">Become a partner</Link>.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {partners.map((p) => (
            <Link
              key={p.id}
              href={`/partners/${p.partnerId}`}
              className="rounded-xl border border-border bg-background p-6 transition-all hover:border-retail/30 hover:shadow-sm flex flex-col"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-12 h-12 rounded-lg bg-retail-soft flex items-center justify-center text-retail font-bold">
                  {(p.displayName || p.businessName).charAt(0).toUpperCase()}
                </div>
                <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-green-50 text-green-700 font-medium">
                  <BadgeCheck className="w-3 h-3" /> Verified
                </span>
              </div>
              <h3 className="text-base font-semibold text-foreground">{p.displayName || p.businessName}</h3>
              <p className="text-xs text-muted-foreground font-mono mt-0.5">{p.partnerId}</p>
              <p className="text-xs text-retail mt-1">{typeLabels[p.partnerType as keyof typeof typeLabels] || p.partnerType}</p>
              <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                <p className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {[p.city, p.state, p.country].filter(Boolean).join(", ") || "—"}</p>
                {p.partnerSince && <p className="flex items-center gap-1"><Calendar className="w-3 h-3" /> Partner since {new Date(p.partnerSince).toLocaleDateString()}</p>}
                {p.website && <p className="flex items-center gap-1"><Globe className="w-3 h-3" /> {p.website}</p>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
