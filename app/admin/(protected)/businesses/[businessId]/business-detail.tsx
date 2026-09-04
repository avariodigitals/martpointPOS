"use client"

import { useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Save, Loader2, Building2, ClipboardCheck, Activity, Lock, Landmark, Headset, HeartHandshake, ShieldCheck, AlertTriangle } from "lucide-react"
import type { Business, BusinessStatus } from "@/lib/businesses"

interface Props {
  business: Business
  onboardingRecords: Array<Record<string, unknown>>
  activity: Array<{ action: string; actorName: string | null; createdAt: string; metadata: Record<string, unknown> | null }>
  actorName: string
}

interface Tab {
  key: string
  label: string
  icon: React.ElementType
  enabled: boolean
  href?: (id: string) => string
}

const TABS: Tab[] = [
  { key: "overview", label: "Overview", icon: Building2, enabled: true },
  { key: "onboarding", label: "Onboarding", icon: ClipboardCheck, enabled: true },
  { key: "activity", label: "Activity", icon: Activity, enabled: true },
  // Future tabs — disabled with clear "Not yet available" handling
  { key: "branches", label: "Branches", icon: Lock, enabled: false },
  { key: "users", label: "Users", icon: Lock, enabled: false },
  { key: "subscription", label: "Subscription", icon: Lock, enabled: false },
  { key: "finance", label: "Finance", icon: Landmark, enabled: true, href: (id: string) => `/admin/businesses/${id}/finance` },
  { key: "deployment", label: "Deployment", icon: Lock, enabled: false },
  { key: "partner", label: "Partner", icon: Lock, enabled: false },
  { key: "support", label: "Support", icon: Headset, enabled: true, href: (id: string) => `/admin/businesses/${id}/support` },
  { key: "customer-success", label: "Customer Success", icon: HeartHandshake, enabled: true, href: (id: string) => `/admin/businesses/${id}/customer-success` },
  { key: "compliance", label: "Compliance", icon: ShieldCheck, enabled: true, href: (id: string) => `/admin/businesses/${id}/compliance` },
  { key: "incidents", label: "Incidents", icon: AlertTriangle, enabled: true, href: (id: string) => `/admin/businesses/${id}/incidents` },
]

const STATUS_OPTIONS = ["PROSPECT", "ONBOARDING", "ACTIVE", "SUSPENDED", "INACTIVE", "CHURNED"]

function fmt(iso: string) {
  try { return new Date(iso).toLocaleString() } catch { return iso }
}

export function BusinessDetail({ business, onboardingRecords, activity, actorName }: Props) {
  const [tab, setTab] = useState<string>("overview")
  const [form, setForm] = useState({
    businessName: business.businessName,
    legalName: business.legalName || "",
    primaryContactName: business.primaryContactName,
    primaryEmail: business.primaryEmail,
    primaryPhone: business.primaryPhone,
    businessType: business.businessType,
    industry: business.industry,
    country: business.country,
    state: business.state,
    city: business.city,
    address: business.address,
    website: business.website || "",
    status: business.status,
  })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")

  const save = async () => {
    setSaving(true)
    setMessage("")
    try {
      const res = await fetch("/api/admin/businesses", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: business.id, ...form }),
      })
      const data = await res.json()
      if (data.success) {
        setMessage("Saved.")
        setTimeout(() => setMessage(""), 2000)
      } else {
        setMessage(data.error || "Failed to save")
      }
    } catch {
      setMessage("Failed to save")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/businesses" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Businesses
        </Link>
        <h2 className="text-2xl font-bold tracking-tight mt-2 flex items-center gap-2">
          <Building2 className="w-5 h-5" /> {business.businessName}
        </h2>
        <p className="text-muted-foreground text-sm">360° Business Record · {actorName}</p>
      </div>

      {message && <p className={`text-sm ${message.includes("Saved") ? "text-green-600" : "text-red-500"}`}>{message}</p>}

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-border pb-2">
        {TABS.map((t) => {
          const Icon = t.icon
          const active = tab === t.key
          const linkHref = t.href?.(business.id)
          if (linkHref) {
            return (
              <Link
                key={t.key}
                href={linkHref}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors text-muted-foreground hover:bg-muted"
                title={t.label}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
              </Link>
            )
          }
          return (
            <button
              key={t.key}
              onClick={() => t.enabled && setTab(t.key)}
              disabled={!t.enabled}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                active ? "bg-primary text-primary-foreground"
                : t.enabled ? "text-muted-foreground hover:bg-muted"
                : "text-muted-foreground/40 cursor-not-allowed"
              }`}
              title={t.enabled ? t.label : `${t.label} — Not yet available`}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          )
        })}
      </div>

      {tab === "overview" && (
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">Business Overview</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Business name"><input className={inputCls} value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} /></Field>
              <Field label="Legal name"><input className={inputCls} value={form.legalName} onChange={(e) => setForm({ ...form, legalName: e.target.value })} /></Field>
              <Field label="Primary contact"><input className={inputCls} value={form.primaryContactName} onChange={(e) => setForm({ ...form, primaryContactName: e.target.value })} /></Field>
              <Field label="Email"><input className={inputCls} value={form.primaryEmail} onChange={(e) => setForm({ ...form, primaryEmail: e.target.value })} /></Field>
              <Field label="Phone"><input className={inputCls} value={form.primaryPhone} onChange={(e) => setForm({ ...form, primaryPhone: e.target.value })} /></Field>
              <Field label="Website"><input className={inputCls} value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} /></Field>
              <Field label="Business type"><input className={inputCls} value={form.businessType} onChange={(e) => setForm({ ...form, businessType: e.target.value })} /></Field>
              <Field label="Industry"><input className={inputCls} value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} /></Field>
              <Field label="Country"><input className={inputCls} value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} /></Field>
              <Field label="State"><input className={inputCls} value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} /></Field>
              <Field label="City"><input className={inputCls} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></Field>
              <Field label="Address"><input className={inputCls} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
              <Field label="Status">
                <select className={inputCls} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as BusinessStatus })}>
                  {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Source"><input className={inputCls} value={business.source} disabled /></Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div><span className="text-muted-foreground">Source lead: </span>{business.sourceLeadId ? <code className="bg-muted px-1 rounded">{business.sourceLeadId}</code> : "None"}</div>
              <div><span className="text-muted-foreground">Created: </span>{fmt(business.createdAt)}</div>
            </div>
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save Changes
            </Button>
          </CardContent>
        </Card>
      )}

      {tab === "onboarding" && (
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">Onboarding</CardTitle></CardHeader>
          <CardContent>
            {onboardingRecords.length === 0 ? (
              <p className="text-sm text-muted-foreground">No onboarding records linked to this business yet.</p>
            ) : (
              <div className="space-y-2">
                {onboardingRecords.map((r) => (
                  <div key={r.id as string} className="p-3 rounded-md border border-border bg-muted/10 text-sm">
                    <p className="font-medium">{(r.business_name as string) || (r.full_name as string)} · <span className="text-muted-foreground">{r.status as string}</span></p>
                    <p className="text-xs text-muted-foreground">{r.email as string} · {r.phone as string}</p>
                    <p className="text-xs text-muted-foreground">Created {fmt(r.created_at as string)}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "activity" && (
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">Activity (audit log)</CardTitle></CardHeader>
          <CardContent>
            {activity.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
            ) : (
              <div className="space-y-2">
                {activity.map((a, i) => (
                  <div key={i} className="p-3 rounded-md border border-border bg-muted/10 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{a.action}</span>
                      <span className="text-xs text-muted-foreground">{fmt(a.createdAt)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">by {a.actorName || "system"}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!TABS.find((t) => t.key === tab)?.enabled && (
        <Card><CardContent className="p-8 text-center text-muted-foreground">
          <Lock className="w-8 h-8 mx-auto mb-2" />
          <p className="text-sm">This section is not yet available.</p>
        </CardContent></Card>
      )}
    </div>
  )
}

const inputCls = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-60"

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1">{label}</label>
      {children}
    </div>
  )
}
