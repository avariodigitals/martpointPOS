"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { LocationFields } from "@/components/location-fields"
import { allIndustries, businessTypeOptions } from "@/lib/industries"
import { PARTNER_PRODUCT_OPTIONS } from "@/lib/product-labels"

const inputCls = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
const labelCls = "block text-sm font-medium mb-1"

const INDUSTRY_OPTIONS = [...allIndustries.map((i) => i.name), "Other"]
const BUSINESS_TYPE_OPTIONS = businessTypeOptions
const PRODUCT_OPTIONS = PARTNER_PRODUCT_OPTIONS

export default function NewLeadPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [country, setCountry] = useState("")
  const [state, setState] = useState("")
  const [city, setCity] = useState("")

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
    if (res.status === 401) {
      router.push("/partner/login?expired=1")
      router.refresh()
      return
    }
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
      {error && <p className="text-sm text-red-600">{error}</p>}
      <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
        <div>
          <label className={labelCls}>Business name *</label>
          <input required name="businessName" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Contact name *</label>
          <input required name="contactName" className={inputCls} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Phone *</label>
            <input required name="phone" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Email *</label>
            <input required name="email" type="email" className={inputCls} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <LocationFields
            country={country}
            state={state}
            city={city}
            required
            inputClassName={inputCls}
            onChange={(values) => {
              setCountry(values.country ?? country)
              setState(values.state ?? state)
              setCity(values.city ?? city)
            }}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Industry *</label>
            <select required name="industry" className={inputCls} defaultValue="">
              <option value="" disabled>Select industry</option>
              {INDUSTRY_OPTIONS.map((i) => (
                <option key={i} value={i}>{i}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Business type *</label>
            <select required name="businessType" className={inputCls} defaultValue="">
              <option value="" disabled>Select business type</option>
              {BUSINESS_TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className={labelCls}>Interested product *</label>
          <select required name="interestedProduct" className={inputCls} defaultValue="">
            <option value="" disabled>Select product</option>
            {PRODUCT_OPTIONS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>Estimated branches</label>
            <input name="estimatedBranches" type="number" min={1} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Estimated users</label>
            <input name="estimatedUsers" type="number" min={1} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Estimated deal value</label>
            <input name="estimatedDealValue" type="number" min={0} step="0.01" className={inputCls} />
          </div>
        </div>
        <div>
          <label className={labelCls}>Notes</label>
          <textarea name="notes" rows={3} className={inputCls} />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-retail px-4 py-2 text-white text-sm font-medium disabled:opacity-50"
        >
          {saving ? "Registering..." : "Register Lead"}
        </button>
      </form>
    </div>
  )
}
