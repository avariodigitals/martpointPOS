"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, ArrowLeft, FileText, Download, Save, UserCheck, X, Check, AlertTriangle } from "lucide-react"

const TYPE_LABELS: Record<string, string> = {
  REFERRAL: "Referral Partner", CHANNEL: "Channel Partner", IMPLEMENTATION: "Implementation Partner",
  CHANNEL_IMPLEMENTATION: "Channel + Implementation", TECHNOLOGY: "Technology Partner", PAYMENT: "Payment Partner",
}

interface DocRow {
  id: string
  document_type: string
  storage_path: string
  original_filename: string
  mime_type: string
  file_size: number
  verification_status: string
  signedUrl: string | null
  uploaded_at: string
}

interface HistoryRow {
  previous_status: string | null
  new_status: string
  reason: string | null
  created_at: string
}

interface AppDetail {
  id: string
  reference_number: string
  applicant_type: string
  requested_partner_type: string
  full_name: string
  business_name: string
  email: string
  phone: string
  whatsapp: string
  country: string
  state: string
  city: string
  business_address: string
  website: string
  linkedin: string
  social_profile: string
  registration_number: string
  year_established: string
  team_size: string
  estimated_customer_base: string
  industries_served: string[]
  geographic_coverage: string[]
  current_products_services: string
  reason_for_applying: string
  relevant_experience: string
  expected_monthly_opportunities: string | null
  additional_answers: Record<string, string>
  status: string
  submitted_at: string
  reviewed_at: string | null
  internal_notes: string
  risk_compliance_notes: string
  rejection_message_public: string
  information_request_message: string
  created_at: string
}

export function ApplicationDetail({ id }: { id: string }) {
  const [loading, setLoading] = useState(true)
  const [app, setApp] = useState<AppDetail | null>(null)
  const [docs, setDocs] = useState<DocRow[]>([])
  const [history, setHistory] = useState<HistoryRow[]>([])
  const [error, setError] = useState("")

  const [internalNotes, setInternalNotes] = useState("")
  const [riskNotes, setRiskNotes] = useState("")
  const [savingNotes, setSavingNotes] = useState(false)

  const [actionStatus, setActionStatus] = useState("")
  const [reason, setReason] = useState("")
  const [infoMessage, setInfoMessage] = useState("")
  const [rejectionPublic, setRejectionPublic] = useState("")
  const [acting, setActing] = useState(false)
  const [actionMsg, setActionMsg] = useState("")

  const [activatePublic, setActivatePublic] = useState(false)
  const [activateEmail, setActivateEmail] = useState("")
  const [activatePhone, setActivatePhone] = useState("")
  const [activateWebsite, setActivateWebsite] = useState("")
  const [activateDisplay, setActivateDisplay] = useState("")
  const [activating, setActivating] = useState(false)

  useEffect(() => {
    fetchDetail()
  }, [])

  async function fetchDetail() {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/partners/applications/${id}`)
      const data = await res.json()
      if (data.application) {
        setApp(data.application)
        setInternalNotes(data.application.internal_notes || "")
        setRiskNotes(data.application.risk_compliance_notes || "")
        setRejectionPublic(data.application.rejection_message_public || "")
        setInfoMessage(data.application.information_request_message || "")
        setActivateEmail(data.application.email || "")
        setActivatePhone(data.application.phone || "")
        setActivateWebsite(data.application.website || "")
        setActivateDisplay(data.application.business_name || data.application.full_name || "")
      } else {
        setError(data.error || "Failed to load")
      }
      setDocs(data.documents || [])
      setHistory(data.history || [])
    } catch {
      setError("Failed to load application")
    } finally {
      setLoading(false)
    }
  }

  async function saveNotes() {
    setSavingNotes(true)
    try {
      const res = await fetch(`/api/admin/partners/applications/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: app!.status, internalNotes, riskComplianceNotes: riskNotes }),
      })
      const data = await res.json()
      if (data.success) setActionMsg("Notes saved.")
      else setActionMsg(data.error || "Failed to save notes")
    } finally {
      setSavingNotes(false)
      setTimeout(() => setActionMsg(""), 2500)
    }
  }

  async function performAction() {
    if (!actionStatus) { setActionMsg("Choose an action"); return }
    if (actionStatus === "REJECTED" && !reason) { setActionMsg("Internal reason required for rejection"); return }
    setActing(true)
    setActionMsg("")
    try {
      const body: Record<string, unknown> = { status: actionStatus, reason }
      if (actionStatus === "MORE_INFORMATION_REQUIRED") body.informationRequestMessage = infoMessage
      if (actionStatus === "REJECTED") body.rejectionMessagePublic = rejectionPublic
      const res = await fetch(`/api/admin/partners/applications/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.success) {
        setActionMsg(`Status updated to ${data.statusLabel}.`)
        setReason("")
        fetchDetail()
      } else {
        setActionMsg(data.error || "Action failed")
      }
    } finally {
      setActing(false)
      setTimeout(() => setActionMsg(""), 3000)
    }
  }

  async function activatePartner() {
    setActivating(true)
    setActionMsg("")
    try {
      const res = await fetch(`/api/admin/partners/applications/${id}/activate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          publicProfileEnabled: activatePublic,
          publicEmail: activateEmail,
          publicPhone: activatePhone,
          website: activateWebsite,
          displayName: activateDisplay,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setActionMsg(`Partner activated! Partner ID: ${data.partner.partner_id}`)
        fetchDetail()
      } else {
        setActionMsg(data.error || "Activation failed")
      }
    } finally {
      setActivating(false)
    }
  }

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
  }
  if (error || !app) {
    return <div className="text-center py-20"><p className="text-red-500">{error || "Not found"}</p><Link href="/admin/partners" className="text-sm text-retail mt-2 inline-block">Back to partners</Link></div>
  }

  const canActivate = ["APPROVED", "AGREEMENT_PENDING", "TRAINING", "CERTIFICATION_PENDING", "ACTIVE"].includes(app.status)

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/partners" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="w-4 h-4 mr-1" /> Back to Partners</Link>
        <div className="flex items-center justify-between mt-2">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">{app.reference_number}</h2>
            <p className="text-muted-foreground text-sm">{app.full_name} · {app.business_name || "Individual"}</p>
          </div>
          <span className={`text-xs uppercase px-2 py-1 rounded font-medium ${app.status === "ACTIVE" ? "bg-green-100 text-green-800" : app.status === "REJECTED" ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-700"}`}>{app.status.replace(/_/g, " ")}</span>
        </div>
      </div>

      {actionMsg && <p className={`text-sm ${actionMsg.includes("activated") || actionMsg.includes("updated") || actionMsg.includes("saved") ? "text-green-600" : "text-red-500"}`}>{actionMsg}</p>}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Applicant details */}
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">Applicant Details</CardTitle></CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <Row label="Type" value={app.applicant_type === "INDIVIDUAL" ? "Individual" : "Company"} />
            <Row label="Name" value={app.full_name} />
            <Row label="Business" value={app.business_name || "—"} />
            <Row label="Email" value={app.email} />
            <Row label="Phone" value={app.phone} />
            <Row label="WhatsApp" value={app.whatsapp || "—"} />
            <Row label="Location" value={[app.city, app.state, app.country].filter(Boolean).join(", ") || "—"} />
            <Row label="Address" value={app.business_address || "—"} />
            <Row label="Website" value={app.website || "—"} />
            <Row label="LinkedIn" value={app.linkedin || "—"} />
            <Row label="Social" value={app.social_profile || "—"} />
          </CardContent>
        </Card>

        {/* Business capability */}
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">Business Capability</CardTitle></CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <Row label="Registration #" value={app.registration_number || "—"} />
            <Row label="Year established" value={app.year_established || "—"} />
            <Row label="Team size" value={app.team_size || "—"} />
            <Row label="Customer base" value={app.estimated_customer_base || "—"} />
            <Row label="Industries" value={(app.industries_served || []).join(", ") || "—"} />
            <Row label="Coverage" value={(app.geographic_coverage || []).join(", ") || "—"} />
            <div className="pt-2"><span className="text-muted-foreground">Current products/services:</span><p className="mt-1 whitespace-pre-wrap">{app.current_products_services || "—"}</p></div>
          </CardContent>
        </Card>

        {/* Partnership information */}
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">Partnership Information</CardTitle></CardHeader>
          <CardContent className="space-y-1.5 text-sm">
            <Row label="Requested type" value={TYPE_LABELS[app.requested_partner_type] || app.requested_partner_type} />
            <Row label="Expected opportunities" value={app.expected_monthly_opportunities || "—"} />
            <div className="pt-2"><span className="text-muted-foreground">Why MartPoint:</span><p className="mt-1 whitespace-pre-wrap">{app.reason_for_applying}</p></div>
            <div className="pt-2"><span className="text-muted-foreground">Relevant experience:</span><p className="mt-1 whitespace-pre-wrap">{app.relevant_experience || "—"}</p></div>
            {Object.keys(app.additional_answers || {}).length > 0 && (
              <div className="pt-2">
                <span className="text-muted-foreground">Additional answers:</span>
                <ul className="mt-1 space-y-1">
                  {Object.entries(app.additional_answers).map(([k, v]) => <li key={k}><span className="text-xs text-muted-foreground">{k}:</span> {v}</li>)}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Documents */}
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium flex items-center gap-2"><FileText className="w-4 h-4" /> Documents</CardTitle></CardHeader>
          <CardContent>
            {docs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No documents uploaded.</p>
            ) : (
              <div className="space-y-2">
                {docs.map((d) => (
                  <div key={d.id} className="flex items-center justify-between p-3 rounded-md border border-border bg-muted/10">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{d.original_filename}</p>
                      <p className="text-xs text-muted-foreground">{d.document_type} · {(d.file_size / 1024).toFixed(0)} KB · {d.verification_status}</p>
                    </div>
                    {d.signedUrl ? (
                      <a href={d.signedUrl} target="_blank" rel="noopener noreferrer"><Button size="sm" variant="outline"><Download className="w-3.5 h-3.5 mr-1" /> View</Button></a>
                    ) : <span className="text-xs text-muted-foreground">unavailable</span>}
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-2">Signed URLs expire after 60 seconds.</p>
          </CardContent>
        </Card>
      </div>

      {/* Timeline */}
      <Card>
        <CardHeader><CardTitle className="text-sm font-medium">Application Timeline</CardTitle></CardHeader>
        <CardContent>
          {history.length === 0 ? <p className="text-sm text-muted-foreground">No history yet.</p> : (
            <div className="space-y-2">
              {history.map((h, i) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <div className="w-2 h-2 rounded-full bg-retail" />
                  <span className="font-medium">{(h.new_status || "").replace(/_/g, " ")}</span>
                  {h.previous_status && <span className="text-muted-foreground">from {h.previous_status.replace(/_/g, " ")}</span>}
                  <span className="text-xs text-muted-foreground ml-auto">{new Date(h.created_at).toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Internal section */}
      <Card>
        <CardHeader><CardTitle className="text-sm font-medium">Internal Review</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1">Internal notes (never shown to applicant)</label>
            <textarea className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" rows={3} value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Risk / compliance notes (internal)</label>
            <textarea className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" rows={3} value={riskNotes} onChange={(e) => setRiskNotes(e.target.value)} />
          </div>
          <Button size="sm" onClick={saveNotes} disabled={savingNotes}>{savingNotes ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Save Notes</Button>
        </CardContent>
      </Card>

      {/* Admin actions */}
      <Card>
        <CardHeader><CardTitle className="text-sm font-medium">Admin Actions</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-1">Action</label>
              <select className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={actionStatus} onChange={(e) => setActionStatus(e.target.value)}>
                <option value="">Select action…</option>
                <option value="UNDER_REVIEW">Mark Under Review</option>
                <option value="MORE_INFORMATION_REQUIRED">Request Information</option>
                <option value="DISCOVERY_CALL">Move to Discovery</option>
                <option value="APPROVED_CONDITIONAL">Conditional Approval</option>
                <option value="APPROVED">Approve</option>
                <option value="REJECTED">Reject</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Internal reason {actionStatus === "REJECTED" && "(required)"}</label>
              <input className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Internal note (not shown to applicant)" />
            </div>
          </div>

          {actionStatus === "MORE_INFORMATION_REQUIRED" && (
            <div>
              <label className="block text-xs font-medium mb-1">Message to applicant (what information is needed)</label>
              <textarea className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" rows={3} value={infoMessage} onChange={(e) => setInfoMessage(e.target.value)} />
            </div>
          )}
          {actionStatus === "REJECTED" && (
            <div>
              <label className="block text-xs font-medium mb-1">Applicant-facing rejection message (separate from internal reason)</label>
              <textarea className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" rows={3} value={rejectionPublic} onChange={(e) => setRejectionPublic(e.target.value)} />
            </div>
          )}

          <Button onClick={performAction} disabled={acting || !actionStatus}>
            {acting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Apply Action
          </Button>
        </CardContent>
      </Card>

      {/* Activation */}
      {canActivate && (
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium flex items-center gap-2"><UserCheck className="w-4 h-4" /> Partner Activation</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-2 rounded-md bg-amber-50 p-3 text-sm text-amber-800">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>Activation creates an immutable Partner ID and marks the partner ACTIVE. This does not create partner login or customer access.</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div><label className="block text-xs font-medium mb-1">Display name</label><input className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={activateDisplay} onChange={(e) => setActivateDisplay(e.target.value)} /></div>
              <div><label className="block text-xs font-medium mb-1">Public email</label><input className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={activateEmail} onChange={(e) => setActivateEmail(e.target.value)} /></div>
              <div><label className="block text-xs font-medium mb-1">Public phone</label><input className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={activatePhone} onChange={(e) => setActivatePhone(e.target.value)} /></div>
              <div><label className="block text-xs font-medium mb-1">Website</label><input className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={activateWebsite} onChange={(e) => setActivateWebsite(e.target.value)} /></div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={activatePublic} onChange={(e) => setActivatePublic(e.target.checked)} className="w-4 h-4 rounded border-border" />
              Show this partner in the public directory
            </label>
            <Button onClick={activatePartner} disabled={activating}>
              {activating ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />} Activate Partner
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex gap-2"><span className="text-muted-foreground w-32 shrink-0">{label}:</span><span className="font-medium">{value}</span></div>
}
