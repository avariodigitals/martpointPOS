"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export default function NewLeadPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    const form = e.currentTarget
    const formData = new FormData(form)
    const payload = {
      businessName: formData.get("businessName"),
      contactName: formData.get("contactName"),
      phone: formData.get("phone"),
      email: formData.get("email"),
      country: formData.get("country"),
      state: formData.get("state"),
      city: formData.get("city"),
      industry: formData.get("industry"),
      businessType: formData.get("businessType"),
      interestedProduct: formData.get("interestedProduct"),
      estimatedBranches: formData.get("estimatedBranches") || null,
      estimatedUsers: formData.get("estimatedUsers") || null,
      estimatedDealValue: formData.get("estimatedDealValue") || null,
      notes: formData.get("notes"),
    }
    const res = await fetch("/api/partner/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    const json = await res.json()
    if (!res.ok) {
      setError(json.error || "Failed to register lead")
      setSaving(false)
      return
    }
    router.push("/partner/leads")
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Register Lead</h2>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
        <input required name="businessName" placeholder="Business name" className="w-full rounded border px-3 py-2" />
        <input required name="contactName" placeholder="Contact name" className="w-full rounded border px-3 py-2" />
        <div className="grid grid-cols-2 gap-4">
          <input required name="phone" placeholder="Phone" className="w-full rounded border px-3 py-2" />
          <input required name="email" type="email" placeholder="Email" className="w-full rounded border px-3 py-2" />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <input required name="country" placeholder="Country" className="w-full rounded border px-3 py-2" />
          <input required name="state" placeholder="State" className="w-full rounded border px-3 py-2" />
          <input required name="city" placeholder="City" className="w-full rounded border px-3 py-2" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <input required name="industry" placeholder="Industry" className="w-full rounded border px-3 py-2" />
          <input required name="businessType" placeholder="Business type" className="w-full rounded border px-3 py-2" />
        </div>
        <input required name="interestedProduct" placeholder="Interested product" className="w-full rounded border px-3 py-2" />
        <div className="grid grid-cols-3 gap-4">
          <input name="estimatedBranches" type="number" placeholder="Estimated branches" className="w-full rounded border px-3 py-2" />
          <input name="estimatedUsers" type="number" placeholder="Estimated users" className="w-full rounded border px-3 py-2" />
          <input name="estimatedDealValue" type="number" placeholder="Estimated deal value" className="w-full rounded border px-3 py-2" />
        </div>
        <textarea name="notes" placeholder="Notes" className="w-full rounded border px-3 py-2" />
        <button type="submit" disabled={saving} className="rounded-md bg-retail px-4 py-2 text-white disabled:opacity-50">
          {saving ? "Registering..." : "Register Lead"}
        </button>
      </form>
    </div>
  )
}
