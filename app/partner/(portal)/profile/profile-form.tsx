"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Save, Building2, Globe, Phone, Mail, MapPin, Loader2, Upload } from "lucide-react"
import { LocationFields } from "@/components/location-fields"

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
  userEmail: string
  pendingRequests: Record<string, unknown>[]
}

export function PartnerProfileForm({ partner, userEmail, pendingRequests }: PartnerProfileFormProps) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [savingEmail, setSavingEmail] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState("")
  const [loginEmail, setLoginEmail] = useState(userEmail || "")
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

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    
    setUploading(true)
    const formData = new FormData()
    formData.append("file", file)
    formData.append("partnerId", partner.id)

    try {
      const res = await fetch("/api/partner/profile/upload-logo", {
        method: "POST",
        body: formData,
      })
      const data = await res.json()
      if (res.ok) {
        setForm(prev => ({ ...prev, logoUrl: data.url }))
        setMessage("Logo uploaded successfully. Please submit the profile update.")
      } else {
        setMessage(data.error || "Logo upload failed.")
      }
    } catch (err) {
      setMessage("Error uploading logo.")
    } finally {
      setUploading(false)
    }
  }

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

  async function submitLoginEmail() {
    setSavingEmail(true)
    setMessage("")
    try {
      const res = await fetch("/api/partner/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ loginEmail }),
      })
      const data = await res.json()
      if (res.ok) {
        setMessage("Login email updated. Use the new address the next time you sign in.")
        router.refresh()
      } else {
        setMessage(data.error || "Failed to update login email.")
      }
    } finally {
      setSavingEmail(false)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Partner Profile</h2>
          <p className="text-muted-foreground">View and request updates to your organisation profile.</p>
        </div>
        {partner.logoUrl && (
          <div className="flex items-center gap-3">
            <img src={partner.logoUrl} alt="Logo" className="h-12 w-12 rounded-lg object-cover border" />
            <span className="text-xs text-muted-foreground">Active Logo</span>
          </div>
        )}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm font-medium">Login Email</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">This is the email used to sign in to the Partner Portal. It is separate from your organisation&apos;s public contact email.</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="block text-xs font-medium mb-1">Portal login email</label>
              <input
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
            <Button onClick={submitLoginEmail} disabled={savingEmail || !loginEmail.trim()}>
              {savingEmail ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Mail className="w-4 h-4 mr-2" />}
              Update Login Email
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">You will remain signed in, but future logins and password resets will use the new address.</p>
        </CardContent>
      </Card>

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
          {message && <p className={`text-sm ${message.includes("submitted") || message.includes("successfully") ? "text-green-600" : "text-red-500"}`}>{message}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { label: "Display Name", key: "displayName" },
              { label: "Public Email", key: "publicEmail", type: "email" },
              { label: "Public Phone", key: "publicPhone" },
              { label: "Website", key: "website" },
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
            <div className="flex flex-col">
              <label className="block text-xs font-medium mb-1">Organization Logo</label>
              <div className="flex gap-2">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  id="logo-upload"
                  onChange={handleLogoUpload}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => document.getElementById("logo-upload")?.click()}
                  disabled={uploading}
                >
                  {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : <Upload className="w-3.5 h-3.5 mr-2" />}
                  {form.logoUrl ? "Change Logo" : "Upload Logo"}
                </Button>
                {form.logoUrl && (
                  <input
                    type="text"
                    value={form.logoUrl}
                    onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    placeholder="Or enter URL"
                  />
                )}
              </div>
            </div>
            <LocationFields
              country={form.country}
              state={form.state}
              city={form.city}
              onChange={(values) => setForm((p) => ({ ...p, ...values }))}
              inputClassName="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
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
                <div key={r.id as string} className="text-sm border-b border-border last:border-zero pb-2">
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
