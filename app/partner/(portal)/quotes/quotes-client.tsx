"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"

type LeadOption = {
  id: string
  businessName: string
  contactName: string
  email: string | null
  phone: string | null
  industry: string
  businessType: string
  country: string
  state: string
  city: string
  estimatedBranches: number | null
  estimatedUsers: number | null
  interestedProduct: string
  notes: string | null
}

type PlanOption = {
  id: string
  name: string
  code: string
  description: string | null
  billingType: string
  billingInterval: string
  currency: string
  basePrice: number
  includedBranches: number
  includedUsers: number
  onlineStoreIncluded: boolean
}

export function QuoteRequestForm({ leads, plans, initialLeadId }: { leads: LeadOption[]; plans: PlanOption[]; initialLeadId?: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [partnerLeadId, setPartnerLeadId] = useState(initialLeadId && leads.some((lead) => lead.id === initialLeadId) ? initialLeadId : leads[0]?.id || "")
  const [planId, setPlanId] = useState(plans[0]?.id || "")
  const [servicesRequested, setServicesRequested] = useState("")
  const [notes, setNotes] = useState("")

  const selectedLead = leads.find((lead) => lead.id === partnerLeadId) || leads[0]
  const selectedPlan = plans.find((plan) => plan.id === planId)
  const location = [selectedLead?.city, selectedLead?.state, selectedLead?.country].filter(Boolean).join(", ")

  async function submit() {
    setBusy(true)
    setError(null)
    const res = await fetch("/api/partner/quote-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        partnerLeadId,
        planId,
        planName: selectedPlan?.name || "",
        locations: location,
        usersEstimate: selectedLead?.estimatedUsers ? String(selectedLead.estimatedUsers) : "",
        servicesRequested,
        notes,
      }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (res.ok) {
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
      {selectedLead && (
        <div className="grid grid-cols-1 gap-2 rounded-md border border-border bg-muted/30 p-3 text-xs sm:grid-cols-2">
          <p><span className="text-muted-foreground">Contact:</span> {selectedLead.contactName} · {selectedLead.email || selectedLead.phone || "No contact detail"}</p>
          <p><span className="text-muted-foreground">Business:</span> {selectedLead.industry || selectedLead.businessType || "—"} · {selectedLead.interestedProduct || "Product not specified"}</p>
          <p><span className="text-muted-foreground">Location:</span> {location || "Not provided"}</p>
          <p><span className="text-muted-foreground">Estimated users/branches:</span> {selectedLead.estimatedUsers ?? "—"} / {selectedLead.estimatedBranches ?? "—"}</p>
          {selectedLead.notes && <p className="sm:col-span-2"><span className="text-muted-foreground">Lead notes:</span> {selectedLead.notes}</p>}
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <select className={inputCls} value={planId} onChange={(e) => setPlanId(e.target.value)} required>
          <option value="">Select a plan</option>
          {plans.map((plan) => (
            <option key={plan.id} value={plan.id}>{plan.name} · {plan.billingInterval}</option>
          ))}
        </select>
        <input className={`${inputCls} bg-muted/40`} placeholder="Location from lead" value={location} readOnly />
        <input className={`${inputCls} bg-muted/40`} placeholder="Estimated users from lead" value={selectedLead?.estimatedUsers ?? ""} readOnly />
      </div>
      {plans.length === 0 && <p className="text-xs text-amber-700">No active plans are available right now. MartPoint Admin must publish a plan before a quote request can be submitted.</p>}
      <input className={inputCls} placeholder="Services requested (e.g. implementation, training)" value={servicesRequested} onChange={(e) => setServicesRequested(e.target.value)} />
      <textarea className={inputCls} rows={2} placeholder="Notes or assumptions (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={submit} disabled={busy || !partnerLeadId || !planId}>
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
          Request quote
        </Button>
        {error && <span className="text-xs text-red-600">{error}</span>}
      </div>
    </div>
  )
}
