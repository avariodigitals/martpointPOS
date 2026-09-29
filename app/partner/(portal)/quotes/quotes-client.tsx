"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"

export function QuoteRequestForm({ leads }: { leads: { id: string; businessName: string }[] }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [partnerLeadId, setPartnerLeadId] = useState(leads[0]?.id || "")
  const [planName, setPlanName] = useState("")
  const [locations, setLocations] = useState("")
  const [usersEstimate, setUsersEstimate] = useState("")
  const [servicesRequested, setServicesRequested] = useState("")
  const [notes, setNotes] = useState("")

  async function submit() {
    setBusy(true)
    setError(null)
    const res = await fetch("/api/partner/quote-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ partnerLeadId, planName, locations, usersEstimate, servicesRequested, notes }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (res.ok) {
      setPlanName("")
      setLocations("")
      setUsersEstimate("")
      setServicesRequested("")
      setNotes("")
      router.refresh()
    } else {
      setError(data.error || "Request failed")
    }
  }

  const inputCls = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm"

  return (
    <div className="space-y-2">
      <select className={inputCls} value={partnerLeadId} onChange={(e) => setPartnerLeadId(e.target.value)}>
        {leads.map((l) => (
          <option key={l.id} value={l.id}>{l.businessName}</option>
        ))}
      </select>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <input className={inputCls} placeholder="Plan / product" value={planName} onChange={(e) => setPlanName(e.target.value)} />
        <input className={inputCls} placeholder="Locations" value={locations} onChange={(e) => setLocations(e.target.value)} />
        <input className={inputCls} placeholder="Estimated users" value={usersEstimate} onChange={(e) => setUsersEstimate(e.target.value)} />
      </div>
      <input className={inputCls} placeholder="Services requested (e.g. implementation, training)" value={servicesRequested} onChange={(e) => setServicesRequested(e.target.value)} />
      <textarea className={inputCls} rows={2} placeholder="Notes or assumptions (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={submit} disabled={busy || !partnerLeadId}>
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
          Request quote
        </Button>
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    </div>
  )
}
