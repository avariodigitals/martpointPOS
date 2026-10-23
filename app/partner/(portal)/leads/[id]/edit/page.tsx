"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import Link from "next/link"
import { LocationFields } from "@/components/location-fields"
import { allIndustries, businessTypeOptions } from "@/lib/industries"
import { PARTNER_PRODUCT_OPTIONS } from "@/lib/product-labels"

const inputCls = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
const labelCls = "block text-sm font-medium mb-1"

const INDUSTRY_OPTIONS = [...allIndustries.map((i) => i.name), "Other"]
const BUSINESS_TYPE_OPTIONS = businessTypeOptions
const PRODUCT_OPTIONS = PARTNER_PRODUCT_OPTIONS

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

interface EditPolicy {
  canEdit: boolean
  commercialLocked: boolean
}

export default function EditLeadPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const id = params.id

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lead, setLead] = useState<Lead | null>(null)
  const [editPolicy, setEditPolicy] = useState<EditPolicy>({ canEdit: false, commercialLocked: false })

  const [country, setCountry] = useState("")
  const [state, setState] = useState("")
  const [city, setCity] = useState("")

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
        setEditPolicy(json.editPolicy || { canEdit: !["LOST", "EXPIRED", "WON"].includes(l.status), commercialLocked: false })
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
    const payload: Record<string, unknown> = {
      businessName: formData.get("businessName"),
      contactName: formData.get("contactName"),
      phone: formData.get("phone"),
      email: formData.get("email"),
      country: formData.get("country"),
      state: formData.get("state"),
      city: formData.get("city"),
    }
    if (!editPolicy.commercialLocked) {
      payload.industry = formData.get("industry")
      payload.businessType = formData.get("businessType")
      payload.interestedProduct = formData.get("interestedProduct")
      payload.estimatedBranches = formData.get("estimatedBranches") || null
      payload.estimatedUsers = formData.get("estimatedUsers") || null
      payload.estimatedDealValue = formData.get("estimatedDealValue") || null
      payload.notes = formData.get("notes")
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

  const editable = editPolicy.canEdit
  const commercialEditable = editable && !editPolicy.commercialLocked

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
          This lead is closed and can no longer be edited.
        </p>
      )}

      {commercialEditable === false && editable && (
        <p className="text-sm text-blue-800 bg-blue-50 border border-blue-200 rounded p-3">
          Finance has issued a quote. Correct the customer identity and contact details here; commercial requirements and the issued quote remain locked.
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

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <LocationFields
            country={country}
            state={state}
            city={city}
            required
            disabled={!editable}
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
            <select
              required
              name="industry"
              defaultValue={lead.industry}
              className={inputCls}
              disabled={!commercialEditable}
            >
              <option value="" disabled>Select industry</option>
              {lead.industry && !INDUSTRY_OPTIONS.includes(lead.industry) && (
                <option value={lead.industry}>{lead.industry}</option>
              )}
              {INDUSTRY_OPTIONS.map((i) => (
                <option key={i} value={i}>{i}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Business type *</label>
            <select
              required
              name="businessType"
              defaultValue={lead.businessType}
              className={inputCls}
              disabled={!commercialEditable}
            >
              <option value="" disabled>Select business type</option>
              {lead.businessType && !BUSINESS_TYPE_OPTIONS.includes(lead.businessType) && (
                <option value={lead.businessType}>{lead.businessType}</option>
              )}
              {BUSINESS_TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className={labelCls}>Interested product *</label>
          <select
            required
            name="interestedProduct"
            defaultValue={lead.interestedProduct}
            className={inputCls}
            disabled={!commercialEditable}
          >
            <option value="" disabled>Select product</option>
            {lead.interestedProduct && !PRODUCT_OPTIONS.some((option) => option === lead.interestedProduct) && (
              <option value={lead.interestedProduct}>{lead.interestedProduct}</option>
            )}
            {PRODUCT_OPTIONS.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
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
              disabled={!commercialEditable}
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
              disabled={!commercialEditable}
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
              disabled={!commercialEditable}
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
            disabled={!commercialEditable}
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
