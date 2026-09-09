"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { COUNTRIES, getStatesForCountry, getCitiesForState } from "@/lib/locations"
import { allIndustries } from "@/lib/industries"

const inputCls = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
const labelCls = "block text-sm font-medium mb-1"

const INDUSTRY_OPTIONS = [...allIndustries.map((i) => i.name), "Other"]
const BUSINESS_TYPE_OPTIONS = ["Retail", "Supermarket", "Pharmacy", "Restaurant", "Beauty/Salon", "Services", "Other"]
const PRODUCT_OPTIONS = ["MartPoint Retail", "MartPoint ERP", "Not Sure — Need Guidance"]

export default function NewLeadPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [country, setCountry] = useState("")
  const [state, setState] = useState("")
  const [city, setCity] = useState("")

  const countries = useMemo(() => COUNTRIES.map((c) => c.name), [])
  const states = useMemo(() => getStatesForCountry(country), [country])
  const cities = useMemo(() => getCitiesForState(country, state), [country, state])
  const stateIsSelect = states.length > 0
  const cityIsSelect = cities.length > 0

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

        {/* Country / State / City */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>Country *</label>
            <select
              required
              name="country"
              className={inputCls}
              value={country}
              onChange={(e) => {
                setCountry(e.target.value)
                setState("")
                setCity("")
              }}
            >
              <option value="">Select country</option>
              {countries.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>State *</label>
            {stateIsSelect ? (
              <select
                required
                name="state"
                className={inputCls}
                value={state}
                onChange={(e) => {
                  setState(e.target.value)
                  setCity("")
                }}
              >
                <option value="">Select state</option>
                {states.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            ) : (
              <input
                required
                name="state"
                className={inputCls}
                value={state}
                onChange={(e) => setState(e.target.value)}
                placeholder="Type state"
              />
            )}
          </div>
          <div>
            <label className={labelCls}>City *</label>
            {cityIsSelect ? (
              <select
                required
                name="city"
                className={inputCls}
                value={city}
                onChange={(e) => setCity(e.target.value)}
              >
                <option value="">Select city</option>
                {cities.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            ) : (
              <input
                required
                name="city"
                className={inputCls}
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Type city"
              />
            )}
          </div>
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
