"use client"

import { useEffect, useState } from "react"
import { CheckCircle2, Loader2 } from "lucide-react"

type Offer = { id: string; offer_expires_at: string; business_growth_programmes: { name: string; sponsored_duration_months: number; activation_deadline_days: number; onboarding_scope: string; exclusions: string; renewal_price_note: string; plan_snapshot: { name?: string; base_price?: number; currency?: string } }; business_growth_applications: { business_name: string; applicant_name: string } }

export function OfferResponse({ token }: { token: string }) {
  const [offer, setOffer] = useState<Offer | null>(null)
  const [store, setStore] = useState("")
  const [announce, setAnnounce] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [decision, setDecision] = useState("")
  useEffect(() => {
    fetch(`/api/programmes/offers/${encodeURIComponent(token)}`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(data.error || "This offer has expired.")
        setOffer(data.award)
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "This offer link is invalid or expired."))
      .finally(() => setLoading(false))
  }, [token])
  async function respond(value: "accept" | "decline") {
    if (value === "accept" && !store.trim()) { setError("Enter the name or location of the single store that will use MartPoint."); return }
    setSaving(true); setError("")
    try {
      const response = await fetch(`/api/programmes/offers/${encodeURIComponent(token)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision: value, nominatedStore: store.trim(), publicAnnouncementConsent: announce }) })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.error || "Your response could not be saved.")
      setDecision(data.decision)
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Your response could not be saved.") }
    finally { setSaving(false) }
  }
  if (loading) return <p className="mt-6 text-sm text-slate-600">Loading offer…</p>
  if (!offer) return <p className="mt-6 rounded-lg bg-amber-50 p-4 text-sm text-amber-900">{error || "This offer link is invalid or expired."}</p>
  if (decision) return <div className="mt-6 rounded-xl bg-emerald-50 p-5 text-emerald-900"><CheckCircle2 className="mb-2 h-6 w-6" /><p className="font-semibold">{decision === "ACCEPTED" ? "Offer accepted" : "Offer declined"}</p><p className="mt-1 text-sm">{decision === "ACCEPTED" ? "We’ll contact you about onboarding. Your licence is not active until the MartPoint team confirms activation." : "Thank you for letting us know. The place may be offered to another applicant."}</p></div>
  const programme = offer.business_growth_programmes
  return <div className="mt-6 space-y-5">
    <p className="text-slate-700">Hello {offer.business_growth_applications.applicant_name}, MartPoint is offering <strong>{offer.business_growth_applications.business_name}</strong> a sponsored {programme.plan_snapshot.name || "Basic"} licence for one store for {programme.sponsored_duration_months} months.</p>
    <div className="rounded-xl bg-slate-50 p-4 text-sm"><p><strong>Standard onboarding:</strong> {programme.onboarding_scope}</p><p className="mt-2"><strong>Exclusions:</strong> {programme.exclusions}</p><p className="mt-2">Renewal is optional. {programme.renewal_price_note}</p><p className="mt-2">Please respond by {new Date(offer.offer_expires_at).toLocaleString("en-NG", { timeZone: "Africa/Lagos" })}. After acceptance, onboarding should begin within {programme.activation_deadline_days} days.</p></div>
    <label className="block text-sm font-medium">Name or location of the one nominated store<input maxLength={200} value={store} onChange={(event) => setStore(event.target.value)} className="mt-1 w-full rounded-lg border p-3" /></label>
    <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1" checked={announce} onChange={(event) => setAnnounce(event.target.checked)} /><span>I separately agree that MartPoint may publicly announce my business name as a selected programme participant. This is optional and does not affect the offer.</span></label>
    {error && <p role="alert" className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <div className="flex flex-wrap gap-3"><button disabled={saving} onClick={() => void respond("accept")} className="inline-flex min-h-11 items-center rounded-lg bg-retail px-5 font-semibold text-white disabled:opacity-60">{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Accept offer</button><button disabled={saving} onClick={() => void respond("decline")} className="min-h-11 rounded-lg border px-5 font-semibold disabled:opacity-60">Decline</button></div>
  </div>
}
