"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import { COUNTRIES, getStatesForCountry, getCitiesForState } from "@/lib/locations"

const inputCls = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
const labelCls = "block text-sm font-medium mb-1"

interface Lead {
  id: string
  businessName: string
  contactName: string
  phone: string | null
  email: string | null
  country: string
  state: string
  city: string
  industry: string
  businessType: string
  interestedProduct: string
  estimatedBranches: number | null
  estimatedUsers: number | null
  estimatedDealValue: number | null
  notes: string | null
  status: string
}

export default function EditLeadPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const id = params.id

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lead, setLead] = useState<Lead | null>(null)

  const [country, setCountry] = useState("")
  const [state, setState] = useState("")
  const [city, setCity] = useState("")

  const countries = useMemo(() => COUNTRIES.map((c) => c.name), [])
  const states = useMemo(() => getStatesForCountry(country), [country])
  const cities = useMemo(() => getCitiesForState(country, state), [country, state])
  const stateIsSelect = states.length > 0
  const cityIsSelect = cities.length > 0

  useEffect(() => {
    fetch(`/api/partner/leads/${id}`)
      .then((res) => res.json())
      .then((json) => {
        if (!json.lead) {
          setError("Lead not found")
          setLoading(false)
          return
        }
        const l = json.lead as Lead
        setLead(l)
        setCountry(l.country)
        setState(l.state)
        setCity(l.city)
        setLoading(false)
      })
      .catch(() => {
        setError("Failed to load lead")
        setLoading(false)
      })
  }, [id])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!lead) return
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
    const res = await fetch(`/api/partner/leads/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    const json = await res.json()
    if (!res.ok) {
      setError(json.error || "Failed to update lead")
      setSaving(false)
      return
    }
    router.push(`/partner/leads/${id}`)
  }

  if (loading) {
    return (
      <div className="space-y-4 max-w-2xl">
        <h2 className="text-2xl font-bold">Edit Lead</h2>
        <p className="text-sm text-muted-foreground">Loading lead...</p>
      </div>
    )
  }

  if (!lead) {
    return (
      <div className="space-y-4 max-w-2xl">
        <h2 className="text-2xl font-bold">Edit Lead</h2>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    )
  }

  const editable = ["REGISTERED", "UNDER_REVIEW"].includes(lead.status)

  return (
    <div className="space-y-4 max-w-2xl">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Edit Lead</h2>
        <Link href={`/partner/leads/${id}`} className="text-sm text-muted-foreground hover:underline">
          ← Back to lead
        </Link>
      </div>

      {!editable && (
        <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-3">
          This lead is under review by MartPoint and can no longer be edited.
        </p>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={labelCls}>Business name *</label>
          <input
            required
            name="businessName"
            defaultValue={lead.businessName}
            className={inputCls}
            disabled={!editable}
          />
        </div>
        <div>
          <label className={labelCls}>Contact name *</label>
          <input
            required
            name="contactName"
            defaultValue={lead.contactName}
            className={inputCls}
            disabled={!editable}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Phone *</label>
            <input
              required
              name="phone"
              defaultValue={lead.phone ?? ""}
              className={inputCls}
              disabled={!editable}
            />
          </div>
          <div>
            <label className={labelCls}>Email *</label>
            <input
              required
              name="email"
              type="email"
              defaultValue={lead.email ?? ""}
              className={inputCls}
              disabled={!editable}
            />
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
              disabled={!editable}
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
                disabled={!editable}
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
                disabled={!editable}
                onChange={(e) => setState(e.target.value)}
                placeholder="Type state"
              />
            )}
          </div>
          <div>
            <label className={labelCls}>City *</label>
            <input
              required
              name="city"
              className={inputCls}
              list={cityIsSelect ? "city-list" : undefined}
              value={city}
              disabled={!editable}
              onChange={(e) => setCity(e.target.value)}
              placeholder={cityIsSelect ? "Select or type city" : "Type city"}
            />
            {cityIsSelect && (
              <datalist id="city-list">
                {cities.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Industry *</label>
            <input
              required
              name="industry"
              defaultValue={lead.industry}
              className={inputCls}
              disabled={!editable}
            />
          </div>
          <div>
            <label className={labelCls}>Business type *</label>
            <input
              required
              name="businessType"
              defaultValue={lead.businessType}
              className={inputCls}
              disabled={!editable}
            />
          </div>
        </div>
        <div>
          <label className={labelCls}>Interested product *</label>
          <input
            required
            name="interestedProduct"
            defaultValue={lead.interestedProduct}
            className={inputCls}
            disabled={!editable}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className={labelCls}>Estimated branches</label>
            <input
              name="estimatedBranches"
              type="number"
              min={1}
              defaultValue={lead.estimatedBranches ?? ""}
              className={inputCls}
              disabled={!editable}
            />
          </div>
          <div>
            <label className={labelCls}>Estimated users</label>
            <input
              name="estimatedUsers"
              type="number"
              min={1}
              defaultValue={lead.estimatedUsers ?? ""}
              className={inputCls}
              disabled={!editable}
            />
          </div>
          <div>
            <label className={labelCls}>Estimated deal value</label>
            <input
              name="estimatedDealValue"
              type="number"
              min={0}
              step="0.01"
              defaultValue={lead.estimatedDealValue ?? ""}
              className={inputCls}
              disabled={!editable}
            />
          </div>
        </div>
        <div>
          <label className={labelCls}>Notes</label>
          <textarea
            name="notes"
            rows={3}
            defaultValue={lead.notes ?? ""}
            className={inputCls}
            disabled={!editable}
          />
        </div>
        {editable && (
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-retail px-4 py-2 text-white text-sm font-medium disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        )}
      </form>
    </div>
  )
}
