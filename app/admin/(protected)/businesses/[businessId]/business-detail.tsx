"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  ArrowLeft, Save, Loader2, Building2, ClipboardCheck, Activity, Lock, Landmark,
  Headset, HeartHandshake, ShieldCheck, AlertTriangle, Trash2, Pencil, X,
  CheckCircle2, MapPin, Users, CreditCard, Plus, Rocket,
} from "lucide-react"
import type { Business, BusinessStatus, BusinessBranch, BusinessUser, OnboardingStages, OnboardingStageKey } from "@/lib/businesses"
import { ONBOARDING_STAGES } from "@/lib/businesses"
import { LocationFields } from "@/components/location-fields"

interface Props {
  business: Business
  onboardingRecords: Array<Record<string, unknown>>
  trainingSessions: Array<Record<string, unknown>>
  activity: Array<{ action: string; actorName: string | null; createdAt: string; metadata: Record<string, unknown> | null }>
  branches: BusinessBranch[]
  businessUsers: BusinessUser[]
  subscription: Record<string, unknown> | null
  entitlement: Record<string, unknown> | null
  licence: Record<string, unknown> | null
  invoiceSummary: { total: number; outstanding: number; count: number }
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
  { key: "branches", label: "Branches", icon: MapPin, enabled: true },
  { key: "users", label: "Users", icon: Users, enabled: true },
  { key: "subscription", label: "Subscription", icon: CreditCard, enabled: true },
  { key: "activity", label: "Activity", icon: Activity, enabled: true },
  { key: "finance", label: "Finance", icon: Landmark, enabled: true, href: (id: string) => `/admin/businesses/${id}/finance` },
  { key: "deployment", label: "Deployment", icon: Lock, enabled: false },
  { key: "partner", label: "Partner", icon: Lock, enabled: false },
  { key: "support", label: "Support", icon: Headset, enabled: true, href: (id: string) => `/admin/businesses/${id}/support` },
  { key: "customer-success", label: "Customer Success", icon: HeartHandshake, enabled: true, href: (id: string) => `/admin/businesses/${id}/customer-success` },
  { key: "compliance", label: "Compliance", icon: ShieldCheck, enabled: true, href: (id: string) => `/admin/businesses/${id}/compliance` },
  { key: "incidents", label: "Incidents", icon: AlertTriangle, enabled: true, href: (id: string) => `/admin/businesses/${id}/incidents` },
]

const STATUS_OPTIONS = ["PROSPECT", "ONBOARDING", "ACTIVE", "SUSPENDED", "INACTIVE", "CHURNED"]

const STATUS_COLORS: Record<string, string> = {
  PROSPECT: "bg-gray-100 text-gray-700",
  ONBOARDING: "bg-blue-50 text-blue-700",
  ACTIVE: "bg-green-50 text-green-700",
  SUSPENDED: "bg-amber-50 text-amber-700",
  INACTIVE: "bg-gray-100 text-gray-500",
  CHURNED: "bg-red-50 text-red-700",
}

const USER_ROLES = ["OWNER", "MANAGER", "CASHIER", "STAFF", "ACCOUNTANT"] as const

function fmt(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    })
  } catch { return iso }
}

function fmtMoney(amount: number, currency = "NGN") {
  try {
    return new Intl.NumberFormat("en-NG", { style: "currency", currency }).format(amount)
  } catch {
    return `${currency} ${amount.toLocaleString()}`
  }
}

export function BusinessDetail({
  business, onboardingRecords, trainingSessions: initialTrainingSessions, activity, branches: initialBranches,
  businessUsers: initialUsers, subscription, entitlement, licence, invoiceSummary, actorName,
}: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<string>("overview")
  const [deleting, setDeleting] = useState(false)
  const [editing, setEditing] = useState(false)
  const [stages, setStages] = useState<OnboardingStages>(business.onboardingStages || {})
  const [stageSaving, setStageSaving] = useState<string | null>(null)
  const [branches, setBranches] = useState<BusinessBranch[]>(initialBranches)
  const [users, setUsers] = useState<BusinessUser[]>(initialUsers)
  const [showBranchForm, setShowBranchForm] = useState(false)
  const [showUserForm, setShowUserForm] = useState(false)
  const [branchForm, setBranchForm] = useState({ name: "", address: "", city: "", state: "", country: "", phone: "", isHeadquarters: false })
  const [userForm, setUserForm] = useState({ fullName: "", email: "", phone: "", role: "STAFF" as string, branchId: "" })
  const [savingBranch, setSavingBranch] = useState(false)
  const [savingUser, setSavingUser] = useState(false)
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
  const [trainingSessions, setTrainingSessions] = useState<Record<string, unknown>[]>(initialTrainingSessions)
  const [showTrainingForm, setShowTrainingForm] = useState(false)
  const [trainingForm, setTrainingForm] = useState({
    sessionNumber: 1,
    trainingDate: "",
    mode: "Remote" as "Remote" | "Onsite",
    trainer: "",
    attendees: "",
    notes: "",
    modulesCompleted: "" as string,
    completed: false,
  })
  const [savingTraining, setSavingTraining] = useState(false)
  const [healthForm, setHealthForm] = useState({
    onboardingOwner: business.onboardingOwner || "",
    onboardingHealth: business.onboardingHealth,
    onboardingWaitingOn: business.onboardingWaitingOn,
    blockerReason: business.blockerReason || "",
    targetGoLive: business.targetGoLive ? business.targetGoLive.slice(0, 10) : "",
  })
  const [savingHealth, setSavingHealth] = useState(false)

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
        setEditing(false)
        router.refresh()
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

  const cancelEdit = () => {
    setEditing(false)
    setForm({
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
  }

  const deleteBusiness = async () => {
    if (!confirm("Delete this business? This cannot be undone.")) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/admin/businesses?id=${encodeURIComponent(business.id)}`, { method: "DELETE" })
      const data = await res.json()
      if (data.success) {
        router.push("/admin/businesses")
      } else {
        setMessage(data.error || "Failed to delete business")
      }
    } catch {
      setMessage("Failed to delete business")
    } finally {
      setDeleting(false)
    }
  }

  const toggleStage = async (stage: OnboardingStageKey, completed: boolean, force = false) => {
    setStageSaving(stage)
    setMessage("")
    try {
      const res = await fetch(`/api/admin/businesses/${business.id}/onboarding-stage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage, completed, force }),
      })
      const data = await res.json()
      if (data.success) {
        setStages(data.stages || {})
        router.refresh()
      } else {
        setMessage(data.error || "Failed to update stage")
      }
    } catch {
      setMessage("Failed to update stage")
    } finally {
      setStageSaving(null)
    }
  }

  const initiateOnboarding = async () => {
    setMessage("")
    try {
      const res = await fetch(`/api/admin/businesses/${business.id}/onboarding-stage/initiate`, { method: "POST" })
      const data = await res.json()
      if (data.success) {
        if (data.stages) setStages(data.stages)
        router.refresh()
      } else {
        setMessage(data.error || "Failed to initiate onboarding")
      }
    } catch {
      setMessage("Failed to initiate onboarding")
    }
  }

  const updateHealth = async () => {
    setSavingHealth(true)
    setMessage("")
    try {
      const res = await fetch(`/api/admin/businesses/${business.id}/onboarding-stage/health`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          onboardingOwner: healthForm.onboardingOwner || null,
          onboardingHealth: healthForm.onboardingHealth,
          onboardingWaitingOn: healthForm.onboardingWaitingOn,
          blockerReason: healthForm.blockerReason || null,
          targetGoLive: healthForm.targetGoLive || null,
        }),
      })
      const data = await res.json()
      if (data.success) {
        router.refresh()
        setMessage("Saved.")
      } else {
        setMessage(data.error || "Failed to save")
      }
    } catch {
      setMessage("Failed to save")
    } finally {
      setSavingHealth(false)
    }
  }

  const saveTraining = async () => {
    setSavingTraining(true)
    setMessage("")
    try {
      const modules = trainingForm.modulesCompleted.split(",").map((s) => s.trim()).filter(Boolean)
      const res = await fetch(`/api/admin/businesses/${business.id}/onboarding-stage/training`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...trainingForm,
          modulesCompleted: modules,
          trainingDate: trainingForm.trainingDate ? new Date(trainingForm.trainingDate).toISOString() : null,
        }),
      })
      const data = await res.json()
      if (data.success && data.session) {
        setTrainingSessions((prev) => [...prev, data.session])
        setTrainingForm({ sessionNumber: 1, trainingDate: "", mode: "Remote", trainer: "", attendees: "", notes: "", modulesCompleted: "", completed: false })
        setShowTrainingForm(false)
        setMessage("Training session saved.")
      } else {
        setMessage(data.error || "Failed to save training")
      }
    } catch {
      setMessage("Failed to save training")
    } finally {
      setSavingTraining(false)
    }
  }

  const addBranch = async () => {
    setSavingBranch(true)
    setMessage("")
    try {
      const res = await fetch(`/api/admin/businesses/${business.id}/branches`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(branchForm),
      })
      const data = await res.json()
      if (data.success && data.branch) {
        setBranches((prev) => [...prev, data.branch])
        setBranchForm({ name: "", address: "", city: "", state: "", country: "", phone: "", isHeadquarters: false })
        setShowBranchForm(false)
      } else {
        setMessage(data.error || "Failed to add branch")
      }
    } catch {
      setMessage("Failed to add branch")
    } finally {
      setSavingBranch(false)
    }
  }

  const removeBranch = async (id: string) => {
    if (!confirm("Delete this branch?")) return
    try {
      const res = await fetch(`/api/admin/businesses/${business.id}/branches?id=${encodeURIComponent(id)}`, { method: "DELETE" })
      const data = await res.json()
      if (data.success) {
        setBranches((prev) => prev.filter((b) => b.id !== id))
      } else {
        setMessage(data.error || "Failed to delete branch")
      }
    } catch {
      setMessage("Failed to delete branch")
    }
  }

  const addUser = async () => {
    setSavingUser(true)
    setMessage("")
    try {
      const res = await fetch(`/api/admin/businesses/${business.id}/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...userForm, branchId: userForm.branchId || null }),
      })
      const data = await res.json()
      if (data.success && data.user) {
        setUsers((prev) => [...prev, data.user])
        setUserForm({ fullName: "", email: "", phone: "", role: "STAFF", branchId: "" })
        setShowUserForm(false)
      } else {
        setMessage(data.error || "Failed to add user")
      }
    } catch {
      setMessage("Failed to add user")
    } finally {
      setSavingUser(false)
    }
  }

  const removeUser = async (id: string) => {
    if (!confirm("Remove this user?")) return
    try {
      const res = await fetch(`/api/admin/businesses/${business.id}/users?id=${encodeURIComponent(id)}`, { method: "DELETE" })
      const data = await res.json()
      if (data.success) {
        setUsers((prev) => prev.filter((u) => u.id !== id))
      } else {
        setMessage(data.error || "Failed to remove user")
      }
    } catch {
      setMessage("Failed to remove user")
    }
  }

  const completedCount = ONBOARDING_STAGES.filter((s) => stages[s.key]).length
  const plan = subscription?.plans as { name?: string; code?: string; billing_type?: string } | null | undefined

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/businesses" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Businesses
        </Link>
        <h2 className="text-2xl font-bold tracking-tight mt-2 flex items-center gap-2">
          <Building2 className="w-5 h-5" /> {business.businessName}
          <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium ${STATUS_COLORS[business.status] || "bg-gray-100 text-gray-700"}`}>{business.status}</span>
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
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">Business Overview</CardTitle>
            {!editing ? (
              <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                <Pencil className="w-3.5 h-3.5" /> Edit
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={cancelEdit}>
                <X className="w-3.5 h-3.5" /> Cancel
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            {!editing ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
                  <Detail label="Business name" value={business.businessName} />
                  <Detail label="Legal name" value={business.legalName} />
                  <Detail label="Primary contact" value={business.primaryContactName} />
                  <Detail label="Email" value={business.primaryEmail} />
                  <Detail label="Phone" value={business.primaryPhone} />
                  <Detail label="Website" value={business.website} />
                  <Detail label="Business type" value={business.businessType} />
                  <Detail label="Industry" value={business.industry} />
                  <Detail label="Country" value={business.country} />
                  <Detail label="State" value={business.state} />
                  <Detail label="City" value={business.city} />
                  <Detail label="Address" value={business.address} />
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-0.5">Status</p>
                    <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium ${STATUS_COLORS[business.status] || "bg-gray-100 text-gray-700"}`}>{business.status}</span>
                  </div>
                  <Detail label="Source" value={business.source} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm border-t border-border pt-4">
                  <div><span className="text-muted-foreground">Source lead: </span>{business.sourceLeadId ? <code className="bg-muted px-1 rounded">{business.sourceLeadId}</code> : "None"}</div>
                  <div><span className="text-muted-foreground">Created: </span>{fmt(business.createdAt)}</div>
                  <div><span className="text-muted-foreground">Onboarding progress: </span>{completedCount}/{ONBOARDING_STAGES.length} stages</div>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="outline" onClick={deleteBusiness} disabled={deleting} className="text-red-600 hover:text-red-700 hover:bg-red-50">
                    {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />} Delete
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Business name"><input className={inputCls} value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} /></Field>
                  <Field label="Legal name"><input className={inputCls} value={form.legalName} onChange={(e) => setForm({ ...form, legalName: e.target.value })} /></Field>
                  <Field label="Primary contact"><input className={inputCls} value={form.primaryContactName} onChange={(e) => setForm({ ...form, primaryContactName: e.target.value })} /></Field>
                  <Field label="Email"><input className={inputCls} value={form.primaryEmail} onChange={(e) => setForm({ ...form, primaryEmail: e.target.value })} /></Field>
                  <Field label="Phone"><input className={inputCls} value={form.primaryPhone} onChange={(e) => setForm({ ...form, primaryPhone: e.target.value })} /></Field>
                  <Field label="Website"><input className={inputCls} value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} /></Field>
                  <Field label="Business type"><input className={inputCls} value={form.businessType} onChange={(e) => setForm({ ...form, businessType: e.target.value })} /></Field>
                  <Field label="Industry"><input className={inputCls} value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} /></Field>
                  <LocationFields
                    country={form.country}
                    state={form.state}
                    city={form.city}
                    onChange={(vals) => setForm({ ...form, ...vals })}
                    inputClassName={inputCls}
                  />
                  <Field label="Address"><input className={inputCls} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
                  <Field label="Status">
                    <select className={inputCls} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as BusinessStatus })}>
                      {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </Field>
                  <Field label="Source"><input className={inputCls} value={business.source} disabled /></Field>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={save} disabled={saving}>
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save Changes
                  </Button>
                  <Button size="sm" variant="outline" onClick={cancelEdit}>Cancel</Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "onboarding" && (
        <div className="space-y-4">
          {/* Initiate Onboarding CTA */}
          {business.status === "PROSPECT" && (
            <Card className="border-dashed border-primary/30 bg-primary/5">
              <CardContent className="p-4 flex items-center justify-between flex-wrap gap-3">
                <div>
                  <p className="text-sm font-medium">Onboarding not started</p>
                  <p className="text-xs text-muted-foreground">Convert this business into the onboarding pipeline and begin tracking stages.</p>
                </div>
                <Button size="sm" onClick={initiateOnboarding}>
                  <Rocket className="w-3.5 h-3.5 mr-1" /> Initiate Onboarding
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Progress + Health */}
          {(business.onboardingStartedAt || business.status === "ONBOARDING") && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="md:col-span-2">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium flex items-center justify-between">
                    <span>Onboarding Progress</span>
                    <span className="text-xs text-muted-foreground">{completedCount}/{ONBOARDING_STAGES.length}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${(completedCount / ONBOARDING_STAGES.length) * 100}%` }} />
                  </div>
                  <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Health</p>
                      <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${healthColor(business.onboardingHealth)}`}>{business.onboardingHealth}</span>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Waiting on</p>
                      <p className="font-medium">{business.onboardingWaitingOn}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Owner</p>
                      <p className="font-medium truncate">{business.onboardingOwner || "Unassigned"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider">Target Go-Live</p>
                      <p className="font-medium">{business.targetGoLive ? new Date(business.targetGoLive).toLocaleDateString() : "—"}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Update Health</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <select className={inputCls} value={healthForm.onboardingHealth} onChange={(e) => setHealthForm({ ...healthForm, onboardingHealth: e.target.value as Business["onboardingHealth"] })}>
                      <option>On Track</option>
                      <option>At Risk</option>
                      <option>Blocked</option>
                    </select>
                    <select className={inputCls} value={healthForm.onboardingWaitingOn} onChange={(e) => setHealthForm({ ...healthForm, onboardingWaitingOn: e.target.value as Business["onboardingWaitingOn"] })}>
                      <option>None</option>
                      <option>Customer</option>
                      <option>MartPoint</option>
                      <option>Partner</option>
                    </select>
                  </div>
                  <Field label="Owner" hideLabel><input className={inputCls} placeholder="Owner" value={healthForm.onboardingOwner} onChange={(e) => setHealthForm({ ...healthForm, onboardingOwner: e.target.value })} /></Field>
                  <Field label="Blocker reason" hideLabel><input className={inputCls} placeholder="Blocker reason (if any)" value={healthForm.blockerReason} onChange={(e) => setHealthForm({ ...healthForm, blockerReason: e.target.value })} /></Field>
                  <Field label="Target go-live" hideLabel><input type="date" className={inputCls} value={healthForm.targetGoLive} onChange={(e) => setHealthForm({ ...healthForm, targetGoLive: e.target.value })} /></Field>
                  <Button size="sm" onClick={updateHealth} disabled={savingHealth}>{savingHealth ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}Save</Button>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Kanban Board */}
          {(business.onboardingStartedAt || business.status === "ONBOARDING") && (
            <div className="overflow-x-auto pb-2">
              <div className="flex gap-3 min-w-[1400px]">
                {ONBOARDING_STAGES.map((s, i) => {
                  const progress = stages[s.key]
                  const done = !!progress
                  const isCurrent = !done && ONBOARDING_STAGES.slice(0, i).every((p) => stages[p.key])
                  return (
                    <div key={s.key} className="w-[220px] shrink-0">
                      <div className={`rounded-t-md px-3 py-2 text-xs font-semibold flex items-center justify-between ${isCurrent ? "bg-primary text-primary-foreground" : done ? "bg-green-100 text-green-800" : "bg-muted text-muted-foreground"}`}>
                        <span>{s.label}</span>
                        {done ? <CheckCircle2 className="w-3.5 h-3.5" /> : null}
                      </div>
                      <div className="rounded-b-md border border-t-0 border-border bg-muted/20 p-2 min-h-[160px]">
                        {isCurrent ? (
                          <div className="p-2 rounded-md bg-card border border-border shadow-sm space-y-2">
                            <p className="text-sm font-medium">{business.businessName}</p>
                            <p className="text-xs text-muted-foreground">{business.onboardingHealth} · {business.onboardingWaitingOn !== "None" ? `Waiting: ${business.onboardingWaitingOn}` : "No blockers"}</p>
                            <div className="pt-1 flex gap-2">
                              <Button size="sm" className="h-7 text-xs flex-1" onClick={() => toggleStage(s.key, true)} disabled={stageSaving === s.key}>
                                {stageSaving === s.key ? <Loader2 className="w-3 h-3 animate-spin" /> : "Complete"}
                              </Button>
                              {s.key === "PROVISIONING" && (
                                <Button size="sm" variant="outline" className="h-7 text-xs flex-1" onClick={() => { if (confirm("Bypass payment confirmation? This is an admin override.")) toggleStage(s.key, true, true) }} disabled={stageSaving === s.key}>Force</Button>
                              )}
                            </div>
                          </div>
                        ) : done ? (
                          <div className="text-xs text-muted-foreground p-1">
                            Completed {fmt(progress.completedAt)}{progress.completedBy ? ` · ${progress.completedBy}` : ""}
                            <Button size="sm" variant="ghost" className="h-6 text-xs mt-1" onClick={() => toggleStage(s.key, false)}>Reopen</Button>
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground text-center py-6">Not started</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Training */}
          {(business.onboardingStartedAt || business.status === "ONBOARDING") && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-medium">Training Sessions ({trainingSessions.length})</CardTitle>
                <Button size="sm" variant="outline" onClick={() => setShowTrainingForm((v) => !v)}><Plus className="w-3.5 h-3.5 mr-1" /> Add Session</Button>
              </CardHeader>
              <CardContent className="space-y-3">
                {showTrainingForm && (
                  <div className="p-3 rounded-md border border-border space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Field label="Session #"><input type="number" className={inputCls} value={trainingForm.sessionNumber} onChange={(e) => setTrainingForm({ ...trainingForm, sessionNumber: Number(e.target.value) })} /></Field>
                      <Field label="Mode">
                        <select className={inputCls} value={trainingForm.mode} onChange={(e) => setTrainingForm({ ...trainingForm, mode: e.target.value as typeof trainingForm.mode })}>
                          <option>Remote</option>
                          <option>Onsite</option>
                        </select>
                      </Field>
                      <Field label="Date"><input type="datetime-local" className={inputCls} value={trainingForm.trainingDate} onChange={(e) => setTrainingForm({ ...trainingForm, trainingDate: e.target.value })} /></Field>
                      <Field label="Trainer"><input className={inputCls} value={trainingForm.trainer} onChange={(e) => setTrainingForm({ ...trainingForm, trainer: e.target.value })} /></Field>
                    </div>
                    <Field label="Attendees"><input className={inputCls} value={trainingForm.attendees} onChange={(e) => setTrainingForm({ ...trainingForm, attendees: e.target.value })} /></Field>
                    <Field label="Modules completed (comma separated)"><input className={inputCls} value={trainingForm.modulesCompleted} onChange={(e) => setTrainingForm({ ...trainingForm, modulesCompleted: e.target.value })} /></Field>
                    <Field label="Notes"><textarea className={inputCls} rows={2} value={trainingForm.notes} onChange={(e) => setTrainingForm({ ...trainingForm, notes: e.target.value })} /></Field>
                    <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={trainingForm.completed} onChange={(e) => setTrainingForm({ ...trainingForm, completed: e.target.checked })} /> Completed</label>
                    <Button size="sm" onClick={saveTraining} disabled={savingTraining}>{savingTraining ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}Save Session</Button>
                  </div>
                )}
                {trainingSessions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No training sessions recorded.</p>
                ) : (
                  <div className="space-y-2">
                    {trainingSessions.map((s) => (
                      <div key={s.id as string} className="p-3 rounded-md border border-border bg-muted/10 text-sm">
                        <p className="font-medium">Session {(s.session_number as number) || 1} · {s.mode as string} · {s.completed ? "Completed" : "Scheduled"}</p>
                        <p className="text-xs text-muted-foreground">{s.trainer as string} · {s.attendees as string}</p>
                        {!!s.training_date && <p className="text-xs text-muted-foreground">{fmt(String(s.training_date))}</p>}
                        {!!s.notes && <p className="text-xs text-muted-foreground mt-1">{String(s.notes)}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><CardTitle className="text-sm font-medium">Linked onboarding records</CardTitle></CardHeader>
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
        </div>
      )}

      {tab === "branches" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">Branches ({branches.length})</CardTitle>
            <Button size="sm" variant="outline" onClick={() => setShowBranchForm((v) => !v)}>
              <Plus className="w-3.5 h-3.5" /> Add Branch
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {showBranchForm && (
              <div className="p-3 rounded-md border border-border space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Branch name *"><input className={inputCls} value={branchForm.name} onChange={(e) => setBranchForm({ ...branchForm, name: e.target.value })} /></Field>
                  <Field label="Phone"><input className={inputCls} value={branchForm.phone} onChange={(e) => setBranchForm({ ...branchForm, phone: e.target.value })} /></Field>
                  <Field label="City"><input className={inputCls} value={branchForm.city} onChange={(e) => setBranchForm({ ...branchForm, city: e.target.value })} /></Field>
                  <Field label="State"><input className={inputCls} value={branchForm.state} onChange={(e) => setBranchForm({ ...branchForm, state: e.target.value })} /></Field>
                  <Field label="Country"><input className={inputCls} value={branchForm.country} onChange={(e) => setBranchForm({ ...branchForm, country: e.target.value })} /></Field>
                  <Field label="Address"><input className={inputCls} value={branchForm.address} onChange={(e) => setBranchForm({ ...branchForm, address: e.target.value })} /></Field>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={branchForm.isHeadquarters} onChange={(e) => setBranchForm({ ...branchForm, isHeadquarters: e.target.checked })} />
                  Headquarters
                </label>
                <Button size="sm" onClick={addBranch} disabled={savingBranch || !branchForm.name.trim()}>
                  {savingBranch ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save Branch
                </Button>
              </div>
            )}
            {branches.length === 0 ? (
              <p className="text-sm text-muted-foreground">No branches yet. Add the first location for this business.</p>
            ) : (
              <div className="space-y-2">
                {branches.map((b) => (
                  <div key={b.id} className="flex items-center justify-between gap-3 p-3 rounded-md border border-border bg-muted/10 text-sm">
                    <div>
                      <p className="font-medium flex items-center gap-2">
                        {b.name}
                        {b.isHeadquarters && <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">HQ</span>}
                        <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded font-medium ${b.status === "ACTIVE" ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>{b.status}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">{[b.address, b.city, b.state, b.country].filter(Boolean).join(", ") || "No address"}</p>
                      {b.phone && <p className="text-xs text-muted-foreground">{b.phone}</p>}
                    </div>
                    <button onClick={() => removeBranch(b.id)} className="p-1.5 rounded-md text-muted-foreground hover:text-red-600 hover:bg-red-50" title="Delete branch">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "users" && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">Business Users ({users.length})</CardTitle>
            <Button size="sm" variant="outline" onClick={() => setShowUserForm((v) => !v)}>
              <Plus className="w-3.5 h-3.5" /> Add User
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {showUserForm && (
              <div className="p-3 rounded-md border border-border space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Full name *"><input className={inputCls} value={userForm.fullName} onChange={(e) => setUserForm({ ...userForm, fullName: e.target.value })} /></Field>
                  <Field label="Email"><input className={inputCls} value={userForm.email} onChange={(e) => setUserForm({ ...userForm, email: e.target.value })} /></Field>
                  <Field label="Phone"><input className={inputCls} value={userForm.phone} onChange={(e) => setUserForm({ ...userForm, phone: e.target.value })} /></Field>
                  <Field label="Role">
                    <select className={inputCls} value={userForm.role} onChange={(e) => setUserForm({ ...userForm, role: e.target.value })}>
                      {USER_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </Field>
                  <Field label="Branch">
                    <select className={inputCls} value={userForm.branchId} onChange={(e) => setUserForm({ ...userForm, branchId: e.target.value })}>
                      <option value="">— None —</option>
                      {branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </Field>
                </div>
                <Button size="sm" onClick={addUser} disabled={savingUser || !userForm.fullName.trim()}>
                  {savingUser ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save User
                </Button>
              </div>
            )}
            {users.length === 0 ? (
              <p className="text-sm text-muted-foreground">No users yet. Add staff who will use the system at this business.</p>
            ) : (
              <div className="space-y-2">
                {users.map((u) => (
                  <div key={u.id} className="flex items-center justify-between gap-3 p-3 rounded-md border border-border bg-muted/10 text-sm">
                    <div>
                      <p className="font-medium flex items-center gap-2">
                        {u.fullName}
                        <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">{u.role}</span>
                        <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded font-medium ${u.status === "ACTIVE" ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>{u.status}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">{[u.email, u.phone].filter(Boolean).join(" · ") || "No contact info"}</p>
                      {u.branchId && <p className="text-xs text-muted-foreground">Branch: {branches.find((b) => b.id === u.branchId)?.name || u.branchId}</p>}
                    </div>
                    <button onClick={() => removeUser(u.id)} className="p-1.5 rounded-md text-muted-foreground hover:text-red-600 hover:bg-red-50" title="Remove user">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "subscription" && (
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-sm font-medium">Subscription</CardTitle></CardHeader>
            <CardContent>
              {!subscription ? (
                <p className="text-sm text-muted-foreground">
                  No subscription yet. Create one under{" "}
                  <Link href="/admin/finance/commercial" className="text-primary underline">Finance → Commercial</Link>.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
                  <Detail label="Plan" value={plan?.name || (plan?.code ?? null)} />
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-0.5">Status</p>
                    <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium ${subscription.status === "ACTIVE" ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-600"}`}>{subscription.status as string}</span>
                  </div>
                  <Detail label="Billing interval" value={subscription.billing_interval as string} />
                  <Detail label="Price" value={fmtMoney(Number(subscription.price_at_activation) || 0, (subscription.currency as string) || "NGN")} />
                  <Detail label="Current period" value={`${subscription.current_period_start || "—"} → ${subscription.current_period_end || "—"}`} />
                  <Detail label="Renewal date" value={(subscription.renewal_date as string) || "—"} />
                  <Detail label="Auto-renew" value={subscription.auto_renew ? "Yes" : "No"} />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm font-medium">Entitlements &amp; Licence</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {!entitlement && !licence ? (
                <p className="text-sm text-muted-foreground">No entitlements or licence recorded for this business.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 text-sm">
                  {entitlement && (
                    <>
                      <Detail label="Max branches" value={String(entitlement.max_branches ?? "—")} />
                      <Detail label="Max users" value={String(entitlement.max_users ?? "—")} />
                      <Detail label="Online store" value={entitlement.online_store_enabled ? "Enabled" : "Disabled"} />
                      <Detail label="Subscription status" value={(entitlement.subscription_status as string) || "—"} />
                    </>
                  )}
                  {licence && (
                    <>
                      <Detail label="Licence type" value={(licence.licence_type as string) || "—"} />
                      <Detail label="Licence status" value={(licence.status as string) || "—"} />
                      <Detail label="Expires" value={(licence.expires_at as string) || "—"} />
                    </>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm font-medium">Billing summary</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                <Detail label="Invoices" value={String(invoiceSummary.count)} />
                <Detail label="Total billed" value={fmtMoney(invoiceSummary.total)} />
                <Detail label="Outstanding" value={fmtMoney(invoiceSummary.outstanding)} />
              </div>
              <Link href={`/admin/businesses/${business.id}/finance`} className="inline-block mt-3 text-xs text-primary underline">
                Open Finance tab →
              </Link>
            </CardContent>
          </Card>
        </div>
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

function Field({ label, hideLabel, children }: { label: string; hideLabel?: boolean; children: React.ReactNode }) {
  return (
    <div>
      {!hideLabel && <label className="block text-xs font-medium mb-1">{label}</label>}
      {children}
    </div>
  )
}

function healthColor(health: Business["onboardingHealth"]) {
  if (health === "On Track") return "bg-green-100 text-green-700"
  if (health === "At Risk") return "bg-amber-100 text-amber-700"
  return "bg-red-100 text-red-700"
}

function Detail({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground mb-0.5">{label}</p>
      <p className="text-sm">{value || <span className="text-muted-foreground">—</span>}</p>
    </div>
  )
}
