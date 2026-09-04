"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Save, Building2, Globe, Phone, Mail, MapPin, Loader2 } from "lucide-react"

interface PartnerProfileFormProps {
  partner: {
    id: string
    partnerId: string
    businessName: string
    displayName: string
    partnerType: string
    status: string
    publicEmail: string | null
    publicPhone: string | null
    website: string | null
    logoUrl: string | null
    city: string
    state: string
    country: string
    partnerSince: string | null
  }
  pendingRequests: Record<string, unknown>[]
}

export function PartnerProfileForm({ partner, pendingRequests }: PartnerProfileFormProps) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")
  const [form, setForm] = useState({
    displayName: partner.displayName || "",
    publicEmail: partner.publicEmail || "",
    publicPhone: partner.publicPhone || "",
    website: partner.website || "",
    city: partner.city || "",
    state: partner.state || "",
    country: partner.country || "",
    logoUrl: partner.logoUrl || "",
  })

  async function submitUpdate() {
    setSaving(true)
    setMessage("")
    try {
      const res = await fetch("/api/partner/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (res.ok) {
        setMessage("Update request submitted for approval.")
        router.refresh()
      } else {
        setMessage(data.error || "Failed to submit update.")
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Partner Profile</h2>
        <p className="text-muted-foreground">View and request updates to your organisation profile.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm font-medium">Approved Information</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex items-center gap-2"><Building2 className="w-4 h-4 text-muted-foreground" /> {partner.businessName}</div>
          <div className="flex items-center gap-2"><Globe className="w-4 h-4 text-muted-foreground" /> {partner.website || "—"}</div>
          <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-muted-foreground" /> {partner.publicPhone || "—"}</div>
          <div className="flex items-center gap-2"><Mail className="w-4 h-4 text-muted-foreground" /> {partner.publicEmail || "—"}</div>
          <div className="flex items-center gap-2"><MapPin className="w-4 h-4 text-muted-foreground" /> {[partner.city, partner.state, partner.country].filter(Boolean).join(", ") || "—"}</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm font-medium">Request Profile Update</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          {message && <p className={`text-sm ${message.includes("submitted") ? "text-green-600" : "text-red-500"}`}>{message}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { label: "Display Name", key: "displayName" },
              { label: "Public Email", key: "publicEmail", type: "email" },
              { label: "Public Phone", key: "publicPhone" },
              { label: "Website", key: "website" },
              { label: "City", key: "city" },
              { label: "State", key: "state" },
              { label: "Country", key: "country" },
              { label: "Logo URL", key: "logoUrl" },
            ].map((field) => (
              <div key={field.key}>
                <label className="block text-xs font-medium mb-1">{field.label}</label>
                <input
                  type={field.type || "text"}
                  value={(form as Record<string, string>)[field.key]}
                  onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
            ))}
          </div>
          <Button onClick={submitUpdate} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Submit for Approval
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm font-medium">Pending Update Requests</CardTitle></CardHeader>
        <CardContent>
          {pendingRequests.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pending requests.</p>
          ) : (
            <div className="space-y-2">
              {pendingRequests.map((r) => (
                <div key={r.id as string} className="text-sm border-b border-border last:border-0 pb-2">
                  <span className="font-medium">{new Date(r.created_at as string).toLocaleDateString()}</span>
                  <span className="text-xs text-muted-foreground ml-2">{Object.keys((r.changes as Record<string, unknown>) || {}).join(", ")}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
