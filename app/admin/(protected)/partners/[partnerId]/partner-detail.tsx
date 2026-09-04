"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, ArrowLeft, Users, Shield, FileText, Network, Activity, Settings, Check, X, Target, Wrench, LifeBuoy, Coins, BarChart3 } from "lucide-react"
import { PARTNER_USER_ROLES, PARTNER_ROLE_LABELS, type PartnerUserRole, ORG_CAPABILITY_LABELS, type PartnerOrgCapability, relevantPartnerTabs } from "@/lib/partner-permissions"

const CAPABILITIES = Object.keys(ORG_CAPABILITY_LABELS) as PartnerOrgCapability[]

const TAB_LABELS: Record<string, string> = {
  overview: "Overview",
  users: "Users",
  capabilities: "Capabilities",
  leads: "Leads",
  customers: "Customers",
  onboarding: "Onboarding",
  support: "Support",
  compliance: "Compliance",
  commissions: "Commissions",
  performance: "Performance",
  activity: "Activity",
}

export function PartnerDetail({ partnerId }: { partnerId: string }) {
  const router = useRouter()
  const [tab, setTab] = useState("overview")
  const [loading, setLoading] = useState(true)
  const [partner, setPartner] = useState<Record<string, unknown> | null>(null)
  const [capabilities, setCapabilities] = useState<string[]>([])
  const [users, setUsers] = useState<Record<string, unknown>[]>([])
  const [invitations, setInvitations] = useState<Record<string, unknown>[]>([])
  const [documents, setDocuments] = useState<Record<string, unknown>[]>([])
  const [assignments, setAssignments] = useState<Record<string, unknown>[]>([])
  const [activity, setActivity] = useState<Record<string, unknown>[]>([])
  const [pendingRequests, setPendingRequests] = useState<Record<string, unknown>[]>([])
  const [d360, setD360] = useState<Record<string, unknown> | null>(null)
  const [loading360, setLoading360] = useState(false)
  const [message, setMessage] = useState("")

  // Forms
  const [invite, setInvite] = useState({ fullName: "", email: "", role: "PARTNER_MANAGER" as PartnerUserRole })
  const [capabilityToGrant, setCapabilityToGrant] = useState<PartnerOrgCapability>("REFERRALS")
  const [docType, setDocType] = useState("Certificate of Incorporation")
  const [businessQuery, setBusinessQuery] = useState("")
  const [businessResults, setBusinessResults] = useState<Record<string, unknown>[]>([])
  const [selectedBusiness, setSelectedBusiness] = useState<Record<string, unknown> | null>(null)
  const [relationshipType, setRelationshipType] = useState("REFERRED")
  const [accessLevel, setAccessLevel] = useState("VIEW_ONLY")

  useEffect(() => {
    fetchOverview()
    fetch360()
  }, [])

  async function fetch360() {
    setLoading360(true)
    try {
      const res = await fetch(`/api/admin/partners/${partnerId}/360`)
      const data = await res.json()
      if (!data.error) setD360(data)
    } finally {
      setLoading360(false)
    }
  }

  async function fetchOverview() {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/partners/${partnerId}`)
      const data = await res.json()
      if (data.partner) {
        setPartner(data.partner)
        setCapabilities(data.capabilities || [])
        setPendingRequests(data.pendingProfileUpdates || [])
      }
    } finally {
      setLoading(false)
    }
  }

  async function fetchUsers() {
    const res = await fetch(`/api/admin/partners/${partnerId}/users`)
    const data = await res.json()
    setUsers(data.users || [])
    setInvitations(data.invitations || [])
  }

  async function fetchCapabilities() {
    const res = await fetch(`/api/admin/partners/${partnerId}/capabilities`)
    const data = await res.json()
    setCapabilities(data.capabilities || [])
  }

  async function fetchCompliance() {
    const res = await fetch(`/api/admin/partners/${partnerId}/compliance`)
    const data = await res.json()
    setDocuments(data.documents || [])
  }

  async function fetchAssignments() {
    const res = await fetch(`/api/admin/partners/${partnerId}/assignments`)
    const data = await res.json()
    setAssignments(data.assignments || [])
  }

  async function fetchActivity() {
    const res = await fetch(`/api/admin/partners/${partnerId}/activity`)
    const data = await res.json()
    setActivity(data.activity || [])
  }

  useEffect(() => {
    if (tab === "users") fetchUsers()
    if (tab === "capabilities") fetchCapabilities()
    if (tab === "compliance") fetchCompliance()
    if (tab === "customers") fetchAssignments()
    if (tab === "activity") fetchActivity()
    if (["leads", "onboarding", "support", "commissions", "performance"].includes(tab)) fetch360()
  }, [tab])

  async function updatePartner(e: React.FormEvent) {
    e.preventDefault()
    setMessage("")
    const body: Record<string, unknown> = {
      display_name: (partner?.display_name as string) || "",
      public_email: partner?.public_email,
      public_phone: partner?.public_phone,
      website: partner?.website,
      city: partner?.city,
      state: partner?.state,
      country: partner?.country,
    }
    const res = await fetch(`/api/admin/partners/${partnerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    setMessage(data.success ? "Partner updated." : data.error || "Update failed.")
    if (data.success) fetchOverview()
  }

  async function inviteUser(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch(`/api/admin/partners/${partnerId}/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(invite),
    })
    const data = await res.json()
    setMessage(data.success ? "Invitation sent." : data.error || "Failed to invite user.")
    if (data.success) { setInvite({ fullName: "", email: "", role: "PARTNER_MANAGER" }); fetchUsers() }
  }

  async function grantCapability() {
    const res = await fetch(`/api/admin/partners/${partnerId}/capabilities`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ capability: capabilityToGrant }),
    })
    const data = await res.json()
    setMessage(data.success ? "Capability granted." : data.error || "Failed.")
    if (data.success) fetchCapabilities()
  }

  async function revokeCapability(cap: string) {
    const res = await fetch(`/api/admin/partners/${partnerId}/capabilities?capability=${encodeURIComponent(cap)}`, { method: "DELETE" })
    const data = await res.json()
    setMessage(data.success ? "Capability revoked." : data.error || "Failed.")
    if (data.success) fetchCapabilities()
  }

  async function requestDocument() {
    const res = await fetch(`/api/admin/partners/${partnerId}/compliance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentType: docType }),
    })
    const data = await res.json()
    setMessage(data.success ? "Document requested." : data.error || "Failed.")
    if (data.success) fetchCompliance()
  }

  async function searchBusinesses() {
    if (!businessQuery.trim()) return
    const res = await fetch(`/api/admin/businesses?search=${encodeURIComponent(businessQuery)}`)
    const data = await res.json()
    setBusinessResults(data.businesses || [])
  }

  async function assignBusiness(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedBusiness) return
    const res = await fetch(`/api/admin/partners/${partnerId}/assignments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessId: selectedBusiness.id,
        relationshipType,
        accessLevel,
      }),
    })
    const data = await res.json()
    setMessage(data.success ? "Assignment created." : data.error || "Failed.")
    if (data.success) { setSelectedBusiness(null); setBusinessQuery(""); setBusinessResults([]); fetchAssignments() }
  }

  async function revokeAssignment(assignmentId: string) {
    const res = await fetch(`/api/admin/partners/${partnerId}/assignments?assignmentId=${assignmentId}`, { method: "DELETE" })
    const data = await res.json()
    if (data.success) { setMessage("Assignment revoked."); fetchAssignments() }
    else setMessage(data.error || "Failed.")
  }

  async function approveRequest(requestId: string, action: "approve" | "reject") {
    const res = await fetch(`/api/admin/partners/${partnerId}/profile-updates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId, action }),
    })
    const data = await res.json()
    if (data.success) { setMessage(`Request ${action}d.`); fetchOverview() }
    else setMessage(data.error || "Failed.")
  }

  if (loading || !partner) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
  }

  const visibleTabs = relevantPartnerTabs(capabilities as PartnerOrgCapability[])
  const perf = (d360?.performance as Record<string, unknown> | null) || null
  const complianceStatus = (perf?.complianceStatus as string) || "NOT_REQUIRED"
  const location = [partner.city, partner.state, partner.country].filter(Boolean).join(", ")

  function money(amount: unknown, currency = "NGN"): string {
    try {
      return new Intl.NumberFormat("en-NG", { style: "currency", currency, maximumFractionDigits: 0 }).format(Number(amount) || 0)
    } catch {
      return `${currency} ${Number(amount || 0).toLocaleString()}`
    }
  }

  function th(label: string, right = false) {
    return <th className={`px-3 py-2 font-medium ${right ? "text-right" : "text-left"}`}>{label}</th>
  }

  const inputCls = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm"

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/partners" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="w-4 h-4 mr-1" /> Back to Partners</Link>
        <div className="flex items-center justify-between mt-2">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">{(partner.business_name as string) || (partner.display_name as string)}</h2>
            <p className="text-muted-foreground text-sm font-mono">{partner.partner_id as string} · {partner.partner_type as string}</p>
          </div>
          <span className={`text-[10px] uppercase px-2 py-1 rounded font-medium ${(partner.status as string) === "ACTIVE" ? "bg-green-100 text-green-800" : "bg-amber-50 text-amber-700"}`}>{partner.status as string}</span>
        </div>
      </div>

      {message && <p className={`text-sm ${message.includes(".") && !message.includes("Failed") && !message.includes("failed") ? "text-green-600" : "text-red-500"}`}>{message}</p>}

      <div className="flex gap-2 border-b border-border pb-2 flex-wrap">
        {visibleTabs.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 text-sm font-medium rounded-md ${tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"}`}
          >
            {TAB_LABELS[t] || t}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-sm font-medium">Partner 360</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                <div><p className="text-xs text-muted-foreground">Business Name</p><p className="font-medium">{(partner.business_name as string) || "—"}</p></div>
                <div><p className="text-xs text-muted-foreground">Partner ID</p><p className="font-mono">{(partner.partner_id as string) || "—"}</p></div>
                <div><p className="text-xs text-muted-foreground">Type</p><p>{(partner.partner_type as string) || "—"}</p></div>
                <div><p className="text-xs text-muted-foreground">Status</p><p>{(partner.status as string) || "—"}</p></div>
                <div><p className="text-xs text-muted-foreground">Partner Since</p><p>{partner.partner_since ? new Date(partner.partner_since as string).toLocaleDateString() : "—"}</p></div>
                <div><p className="text-xs text-muted-foreground">Location</p><p>{location || "—"}</p></div>
                <div>
                  <p className="text-xs text-muted-foreground">Capabilities</p>
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {capabilities.length === 0 ? <span>—</span> : capabilities.map((c) => (
                      <span key={c} className="text-[10px] uppercase px-1.5 py-0.5 rounded-full bg-retail-soft text-retail">{ORG_CAPABILITY_LABELS[c as PartnerOrgCapability] || c}</span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Compliance Status</p>
                  <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded-full ${complianceStatus === "COMPLIANT" ? "bg-green-100 text-green-800" : complianceStatus === "ATTENTION" ? "bg-red-50 text-red-700" : complianceStatus === "PENDING" ? "bg-amber-50 text-amber-700" : "bg-gray-50 text-gray-500"}`}>
                    {complianceStatus.replace(/_/g, " ")}
                  </span>
                </div>
              </div>

              <div className="border-t border-border pt-4">
                <p className="text-xs font-medium text-muted-foreground mb-2">Operational Summary</p>
                {loading360 && !perf ? (
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                ) : perf ? (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                    {(perf.hasLeadCapability as boolean) && (
                      <>
                        <div><p className="text-xs text-muted-foreground">Leads</p><p className="font-medium">{perf.leadsRegistered as number} ({perf.protectedLeads as number} protected)</p></div>
                        <div><p className="text-xs text-muted-foreground">Won Businesses</p><p className="font-medium">{perf.wonBusinesses as number}</p></div>
                      </>
                    )}
                    {(perf.hasCustomerCapability as boolean) && (
                      <div><p className="text-xs text-muted-foreground">Customers</p><p className="font-medium">{perf.assignedCustomers as number}</p></div>
                    )}
                    {(perf.hasImplementationCapability as boolean) && (
                      <div><p className="text-xs text-muted-foreground">Onboarding</p><p className="font-medium">{perf.onboardingCompleted as number}/{perf.onboardingTotal as number} completed</p></div>
                    )}
                    {(perf.hasSupportCapability as boolean) && (
                      <div><p className="text-xs text-muted-foreground">Support</p><p className="font-medium">{perf.supportTicketsHandled as number} tickets · {perf.escalations as number} escalations</p></div>
                    )}
                    {(perf.hasCommercialCapability as boolean) && (
                      <>
                        <div><p className="text-xs text-muted-foreground">Attributed Revenue</p><p className="font-medium">{money(perf.attributedRevenue, perf.currency as string)}</p></div>
                        <div><p className="text-xs text-muted-foreground">Commission</p><p className="font-medium">{money(perf.commissionEarned, perf.currency as string)} earned · {money(perf.commissionPaid, perf.currency as string)} paid</p></div>
                      </>
                    )}
                    <div><p className="text-xs text-muted-foreground">Outstanding Actions</p><p className="font-medium">{pendingRequests.length} profile request{pendingRequests.length === 1 ? "" : "s"}</p></div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No performance data.</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm font-medium">Partner Details</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={updatePartner} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { label: "Display Name", key: "display_name" },
                  { label: "Public Email", key: "public_email" },
                  { label: "Public Phone", key: "public_phone" },
                  { label: "Website", key: "website" },
                  { label: "City", key: "city" },
                  { label: "State", key: "state" },
                  { label: "Country", key: "country" },
                ].map((f) => (
                  <div key={f.key}>
                    <label className="block text-xs font-medium mb-1">{f.label}</label>
                    <input
                      value={(partner[f.key] as string) || ""}
                      onChange={(e) => setPartner({ ...partner, [f.key]: e.target.value })}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                ))}
                <div className="sm:col-span-2 flex gap-2">
                  <Button type="submit"><Settings className="w-4 h-4 mr-2" /> Update Partner</Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {pendingRequests.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-sm font-medium">Pending Profile Update Requests</CardTitle></CardHeader>
              <CardContent>
                {pendingRequests.map((r) => (
                  <div key={r.id as string} className="flex items-center justify-between p-3 border-b border-border last:border-0">
                    <div className="text-sm">
                      <span className="font-medium">{new Date(r.created_at as string).toLocaleDateString()}</span>
                      <span className="text-muted-foreground ml-2">{Object.keys((r.changes as Record<string, unknown>) || {}).join(", ")}</span>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => approveRequest(r.id as string, "approve")}><Check className="w-3.5 h-3.5" /></Button>
                      <Button size="sm" variant="outline" onClick={() => approveRequest(r.id as string, "reject")}><X className="w-3.5 h-3.5" /></Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {tab === "users" && (
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-sm font-medium flex items-center gap-2"><Users className="w-4 h-4" /> Invite Partner User</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={inviteUser} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <input placeholder="Full Name" value={invite.fullName} onChange={(e) => setInvite({ ...invite, fullName: e.target.value })} required className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
                <input type="email" placeholder="Email" value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} required className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
                <select value={invite.role} onChange={(e) => setInvite({ ...invite, role: e.target.value as PartnerUserRole })} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
                  {PARTNER_USER_ROLES.map((r) => <option key={r} value={r}>{PARTNER_ROLE_LABELS[r]}</option>)}
                </select>
                <div className="sm:col-span-3"><Button type="submit">Send Invitation</Button></div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm font-medium">Users</CardTitle></CardHeader>
            <CardContent>
              {(users || []).length === 0 ? <p className="text-sm text-muted-foreground">No users.</p> : (
                <div className="space-y-2">
                  {users.map((u: any) => (
                    <div key={u.id} className="flex items-center justify-between text-sm p-2 border-b border-border last:border-0">
                      <span>{u.fullName} · {u.email} · {u.role}</span>
                      <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded-full ${u.status === "ACTIVE" ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"}`}>{u.status}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm font-medium">Invitations</CardTitle></CardHeader>
            <CardContent>
              {invitations.filter((i: any) => !i.accepted_at && !i.revoked_at).length === 0 ? <p className="text-sm text-muted-foreground">No pending invitations.</p> : (
                <div className="space-y-2">
                  {invitations.filter((i: any) => !i.accepted_at && !i.revoked_at).map((i: any) => (
                    <div key={i.id} className="flex items-center justify-between text-sm p-2 border-b border-border last:border-0">
                      <span>{i.fullName || i.email} · {i.role} · Expires {new Date(i.expires_at).toLocaleDateString()}</span>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => router.refresh()}>Resend</Button>
                        <Button size="sm" variant="outline" onClick={() => router.refresh()}>Revoke</Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {tab === "capabilities" && (
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium flex items-center gap-2"><Shield className="w-4 h-4" /> Capabilities</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <select value={capabilityToGrant} onChange={(e) => setCapabilityToGrant(e.target.value as PartnerOrgCapability)} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
                {CAPABILITIES.map((c) => <option key={c} value={c}>{ORG_CAPABILITY_LABELS[c]}</option>)}
              </select>
              <Button onClick={grantCapability}>Grant Capability</Button>
            </div>
            <div className="space-y-2">
              {capabilities.length === 0 ? <p className="text-sm text-muted-foreground">No capabilities granted.</p> : capabilities.map((c) => (
                <div key={c} className="flex items-center justify-between text-sm p-2 border-b border-border last:border-0">
                  <span>{ORG_CAPABILITY_LABELS[c as PartnerOrgCapability]}</span>
                  <Button size="sm" variant="outline" onClick={() => revokeCapability(c)}>Revoke</Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {tab === "compliance" && (
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium flex items-center gap-2"><FileText className="w-4 h-4" /> Compliance</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <input value={docType} onChange={(e) => setDocType(e.target.value)} placeholder="Document type" className="rounded-md border border-input bg-background px-3 py-2 text-sm" />
              <Button onClick={requestDocument}>Request Document</Button>
            </div>
            <div className="space-y-2">
              {documents.length === 0 ? <p className="text-sm text-muted-foreground">No documents.</p> : documents.map((d: any) => (
                <div key={d.id} className="flex items-center justify-between text-sm p-2 border-b border-border last:border-0">
                  <span>{d.document_type} · {d.original_filename || "—"} · {d.verification_status}</span>
                  {d.signedUrl && <a href={d.signedUrl} target="_blank" rel="noopener noreferrer" className="text-retail hover:underline">View</a>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {tab === "leads" && (
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium flex items-center gap-2"><Target className="w-4 h-4" /> Leads</CardTitle></CardHeader>
          <CardContent>
            {loading360 ? <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /> : ((d360?.leads as Record<string, unknown>[]) || []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No leads registered.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border text-xs text-muted-foreground">
                    {th("Business")}{th("Contact")}{th("Location")}{th("Status")}{th("Protection")}{th("Est. Value", true)}{th("Submitted")}
                  </tr></thead>
                  <tbody>
                    {((d360?.leads as Record<string, unknown>[]) || []).map((l) => (
                      <tr key={l.id as string} className="border-b border-border last:border-0">
                        <td className="px-3 py-2 font-medium">{l.business_name as string}</td>
                        <td className="px-3 py-2">{l.contact_name as string}</td>
                        <td className="px-3 py-2 text-muted-foreground">{[l.city, l.state, l.country].filter(Boolean).join(", ") || "—"}</td>
                        <td className="px-3 py-2"><span className={`text-[10px] uppercase px-1.5 py-0.5 rounded-full ${l.status === "WON" ? "bg-green-100 text-green-800" : l.status === "LOST" ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-700"}`}>{l.status as string}</span></td>
                        <td className="px-3 py-2"><span className={`text-[10px] uppercase px-1.5 py-0.5 rounded-full ${l.protection_status === "PROTECTED" ? "bg-green-50 text-green-700" : "bg-gray-50 text-gray-600"}`}>{l.protection_status as string}</span></td>
                        <td className="px-3 py-2 text-right">{l.estimated_deal_value ? money(l.estimated_deal_value) : "—"}</td>
                        <td className="px-3 py-2 text-muted-foreground text-xs">{l.created_at ? new Date(l.created_at as string).toLocaleDateString() : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "onboarding" && (
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium flex items-center gap-2"><Wrench className="w-4 h-4" /> Onboarding</CardTitle></CardHeader>
          <CardContent>
            {loading360 ? <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /> : ((d360?.onboardingTasks as Record<string, unknown>[]) || []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No onboarding tasks assigned.</p>
            ) : (
              <div className="space-y-2">
                {((d360?.onboardingTasks as Record<string, unknown>[]) || []).map((t) => (
                  <div key={t.id as string} className="flex items-center justify-between text-sm p-2 border-b border-border last:border-0">
                    <span>{t.title as string} · <span className="text-muted-foreground">{(t.businesses as Record<string, unknown>)?.business_name as string} · {t.category as string}{t.required ? " · required" : ""}</span></span>
                    <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded-full ${t.status === "COMPLETED" || t.status === "VERIFIED" ? "bg-green-100 text-green-800" : t.status === "BLOCKED" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>{t.status as string}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "support" && (
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium flex items-center gap-2"><LifeBuoy className="w-4 h-4" /> Support Tickets</CardTitle></CardHeader>
          <CardContent>
            {loading360 ? <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /> : ((d360?.supportTickets as Record<string, unknown>[]) || []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No support tickets linked to this partner.</p>
            ) : (
              <div className="space-y-2">
                {((d360?.supportTickets as Record<string, unknown>[]) || []).map((t) => (
                  <div key={t.id as string} className="flex items-center justify-between text-sm p-2 border-b border-border last:border-0">
                    <span><span className="font-mono text-xs">{t.ticket_number as string}</span> · {t.subject as string} <span className="text-muted-foreground">· {(t.businesses as Record<string, unknown>)?.business_name as string} · {t.priority as string}</span></span>
                    <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded-full ${t.status === "ESCALATED" ? "bg-red-50 text-red-700" : t.status === "RESOLVED" || t.status === "CLOSED" ? "bg-green-100 text-green-800" : "bg-blue-50 text-blue-700"}`}>{t.status as string}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "commissions" && (
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium flex items-center gap-2"><Coins className="w-4 h-4" /> Commissions</CardTitle></CardHeader>
          <CardContent>
            {loading360 ? <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /> : ((d360?.commissions as Record<string, unknown>[]) || []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No commissions recorded.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b border-border text-xs text-muted-foreground">
                    {th("Business")}{th("Type")}{th("Basis", true)}{th("Amount", true)}{th("Status")}{th("Earned")}
                  </tr></thead>
                  <tbody>
                    {((d360?.commissions as Record<string, unknown>[]) || []).map((c) => (
                      <tr key={c.id as string} className="border-b border-border last:border-0">
                        <td className="px-3 py-2">{(c.businesses as Record<string, unknown>)?.business_name as string || "—"}</td>
                        <td className="px-3 py-2 text-muted-foreground">{c.attribution_type as string}</td>
                        <td className="px-3 py-2 text-right">{money(c.basis_amount, c.currency as string)}</td>
                        <td className="px-3 py-2 text-right font-medium">{money(c.commission_amount, c.currency as string)}</td>
                        <td className="px-3 py-2"><span className={`text-[10px] uppercase px-1.5 py-0.5 rounded-full ${c.status === "PAID" ? "bg-green-100 text-green-800" : c.status === "REVERSED" || c.status === "CANCELLED" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>{c.status as string}</span></td>
                        <td className="px-3 py-2 text-muted-foreground text-xs">{c.earned_at ? new Date(c.earned_at as string).toLocaleDateString() : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "performance" && (
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium flex items-center gap-2"><BarChart3 className="w-4 h-4" /> Performance</CardTitle></CardHeader>
          <CardContent>
            {loading360 ? <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /> : !perf ? (
              <p className="text-sm text-muted-foreground">No performance data.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                {(perf.hasLeadCapability as boolean) && (
                  <>
                    <div><p className="text-xs text-muted-foreground">Leads Registered</p><p className="text-lg font-semibold">{perf.leadsRegistered as number}</p></div>
                    <div><p className="text-xs text-muted-foreground">Protected Leads</p><p className="text-lg font-semibold">{perf.protectedLeads as number}</p></div>
                    <div><p className="text-xs text-muted-foreground">Won Businesses</p><p className="text-lg font-semibold">{perf.wonBusinesses as number}</p></div>
                  </>
                )}
                {(perf.hasCustomerCapability as boolean) && (
                  <div><p className="text-xs text-muted-foreground">Assigned Customers</p><p className="text-lg font-semibold">{perf.assignedCustomers as number}</p></div>
                )}
                {(perf.hasCommercialCapability as boolean) && (
                  <>
                    <div><p className="text-xs text-muted-foreground">Attributed Revenue</p><p className="text-lg font-semibold">{money(perf.attributedRevenue, perf.currency as string)}</p></div>
                    <div><p className="text-xs text-muted-foreground">Commission Earned</p><p className="text-lg font-semibold">{money(perf.commissionEarned, perf.currency as string)}</p></div>
                    <div><p className="text-xs text-muted-foreground">Commission Paid</p><p className="text-lg font-semibold">{money(perf.commissionPaid, perf.currency as string)}</p></div>
                  </>
                )}
                {(perf.hasImplementationCapability as boolean) && (
                  <div><p className="text-xs text-muted-foreground">Onboarding Completed</p><p className="text-lg font-semibold">{perf.onboardingCompleted as number}/{perf.onboardingTotal as number}</p></div>
                )}
                {(perf.hasSupportCapability as boolean) && (
                  <>
                    <div><p className="text-xs text-muted-foreground">Tickets Handled</p><p className="text-lg font-semibold">{perf.supportTicketsHandled as number}</p></div>
                    <div><p className="text-xs text-muted-foreground">Escalations</p><p className="text-lg font-semibold">{perf.escalations as number}</p></div>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tab === "customers" && (
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium flex items-center gap-2"><Network className="w-4 h-4" /> Customer Assignments</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <form onSubmit={assignBusiness} className="space-y-2">
              <div className="flex gap-2">
                <input value={businessQuery} onChange={(e) => setBusinessQuery(e.target.value)} placeholder="Search businesses" className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm" />
                <Button type="button" variant="outline" onClick={searchBusinesses}>Search</Button>
              </div>
              {businessResults.length > 0 && (
                <div className="rounded-md border border-border p-2 space-y-1 max-h-40 overflow-auto">
                  {businessResults.map((b: any) => (
                    <button key={b.id} type="button" onClick={() => setSelectedBusiness(b)} className={`w-full text-left text-sm p-2 rounded ${selectedBusiness?.id === b.id ? "bg-retail-soft" : "hover:bg-muted"}`}>
                      {b.business_name} · {b.primary_email}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <select value={relationshipType} onChange={(e) => setRelationshipType(e.target.value)} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
                  {["REFERRED", "SOLD", "IMPLEMENTATION", "SUPPORT", "ACCOUNT_MANAGER"].map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <select value={accessLevel} onChange={(e) => setAccessLevel(e.target.value)} className="rounded-md border border-input bg-background px-3 py-2 text-sm">
                  {["VIEW_ONLY", "SALES", "ONBOARDING_MANAGER", "SUPPORT"].map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <Button type="submit" disabled={!selectedBusiness}>Create Assignment</Button>
            </form>
            <div className="space-y-2">
              {assignments.length === 0 ? <p className="text-sm text-muted-foreground">No assignments.</p> : assignments.map((a: any) => (
                <div key={a.id} className="flex items-center justify-between text-sm p-2 border-b border-border last:border-0">
                  <span>{a.businesses?.business_name} · {a.relationship_type} · {a.access_level} · {a.status}</span>
                  {a.status === "ACTIVE" && <Button size="sm" variant="outline" onClick={() => revokeAssignment(a.id)}>Revoke</Button>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {tab === "activity" && (
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium flex items-center gap-2"><Activity className="w-4 h-4" /> Activity</CardTitle></CardHeader>
          <CardContent>
            {activity.length === 0 ? <p className="text-sm text-muted-foreground">No activity.</p> : (
              <div className="space-y-2">
                {activity.map((a: any, i: number) => (
                  <div key={i} className="flex items-center justify-between text-sm border-b border-border last:border-0 pb-2">
                    <span className="font-medium">{a.action}</span>
                    <span className="text-xs text-muted-foreground">{a.created_at ? new Date(a.created_at).toLocaleString() : "—"}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
