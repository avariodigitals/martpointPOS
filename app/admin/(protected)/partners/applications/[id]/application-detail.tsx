"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Loader2, ArrowLeft, FileText, Download, Save, UserCheck, X, Check,
  AlertTriangle, ShieldCheck, RefreshCw, Send, CheckCircle, XCircle,
  Clock, AlertCircle, Pencil, type LucideIcon,
} from "lucide-react"
import { LocationFields } from "@/components/location-fields"

const TYPE_LABELS: Record<string, string> = {
  REFERRAL: "Referral Partner", CHANNEL: "Channel Partner", IMPLEMENTATION: "Implementation Partner",
  CHANNEL_IMPLEMENTATION: "Channel + Implementation", TECHNOLOGY: "Technology Partner", PAYMENT: "Payment Partner",
}

const COMPLIANCE_DOCUMENT_TYPES = [
  "Certificate of Incorporation",
  "Tax Clearance Certificate",
  "Identification Document",
  "Proof of Address",
  "Bank Account Confirmation",
  "Business Registration",
  "CAC Certificate",
  "Partner Agreement",
]

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-800",
  APPROVED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-50 text-red-700",
  COMPLIANCE_REQUIRED: "bg-amber-50 text-amber-700",
  MORE_INFORMATION_REQUIRED: "bg-amber-50 text-amber-700",
}

interface ComplianceDocRow {
  id: string
  document_type: string
  verification_status: string
  storage_path: string | null
  original_filename: string | null
  mime_type: string | null
  file_size: number | null
  required: boolean
  uploaded_at: string | null
  signedUrl: string | null
  latestToken: { hash: string; expiresAt: string; usedAt: string | null } | null
  notes: string | null
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

type TabKey = "overview" | "timeline" | "compliance" | "actions"

const TABS: { key: TabKey; label: string; icon: LucideIcon }[] = [
  { key: "overview", label: "Overview", icon: FileText },
  { key: "timeline", label: "Timeline", icon: Clock },
  { key: "compliance", label: "Compliance Docs", icon: ShieldCheck },
  { key: "actions", label: "Actions & Notes", icon: UserCheck },
]

/** Editable application fields shown in Overview edit mode. */
const EDITABLE_FIELDS: { key: string; label: string; textarea?: boolean }[] = [
  { key: "full_name", label: "Contact Name" },
  { key: "business_name", label: "Business Name" },
  { key: "email", label: "Email" },
  { key: "phone", label: "Phone" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "country", label: "Country" },
  { key: "state", label: "State" },
  { key: "city", label: "City" },
  { key: "business_address", label: "Business Address" },
  { key: "website", label: "Website" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "social_profile", label: "Social Profile" },
  { key: "registration_number", label: "Registration #" },
  { key: "year_established", label: "Year Established" },
  { key: "team_size", label: "Team Size" },
  { key: "estimated_customer_base", label: "Customer Base" },
  { key: "expected_monthly_opportunities", label: "Expected Opportunities" },
  { key: "current_products_services", label: "Current Products/Services", textarea: true },
  { key: "reason_for_applying", label: "Reason for Applying", textarea: true },
  { key: "relevant_experience", label: "Relevant Experience", textarea: true },
]

export function ApplicationDetail({ id }: { id: string }) {
  const [loading, setLoading] = useState(true)
  const [app, setApp] = useState<AppDetail | null>(null)
  const [docs, setDocs] = useState<DocRow[]>([])
  const [complianceDocs, setComplianceDocs] = useState<ComplianceDocRow[]>([])
  const [history, setHistory] = useState<HistoryRow[]>([])
  const [error, setError] = useState("")
  const [tab, setTab] = useState<TabKey>("overview")

  const [editMode, setEditMode] = useState(false)
  const [editForm, setEditForm] = useState<Record<string, string>>({})
  const [savingEdit, setSavingEdit] = useState(false)

  const [internalNotes, setInternalNotes] = useState("")
  const [riskNotes, setRiskNotes] = useState("")
  const [savingNotes, setSavingNotes] = useState(false)

  const [actionStatus, setActionStatus] = useState("")
  const [reason, setReason] = useState("")
  const [infoMessage, setInfoMessage] = useState("")
  const [rejectionPublic, setRejectionPublic] = useState("")
  const [acting, setActing] = useState(false)
  const [actionMsg, setActionMsg] = useState("")

  const [selectedDocTypes, setSelectedDocTypes] = useState<string[]>([])
  const [customDocType, setCustomDocType] = useState("")
  const [requestingDocs, setRequestingDocs] = useState(false)

  const [reviewDocId, setReviewDocId] = useState<string | null>(null)
  const [reviewStatus, setReviewStatus] = useState("VERIFIED")
  const [reviewNotes, setReviewNotes] = useState("")
  const [reviewing, setReviewing] = useState(false)

  const [activatePublic, setActivatePublic] = useState(false)
  const [activateEmail, setActivateEmail] = useState("")
  const [activatePhone, setActivatePhone] = useState("")
  const [activateWebsite, setActivateWebsite] = useState("")
  const [activateDisplay, setActivateDisplay] = useState("")
  const [activating, setActivating] = useState(false)

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
      setComplianceDocs(data.complianceDocuments || [])
      setSelectedDocTypes(data.requiredComplianceDocuments || [])
      setHistory(data.history || [])
    } catch {
      setError("Failed to load application")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchDetail()
  }, [])

  function startEdit() {
    if (!app) return
    const form: Record<string, string> = {}
    for (const f of EDITABLE_FIELDS) {
      const v = app[f.key as keyof AppDetail]
      form[f.key] = typeof v === "string" ? v : v == null ? "" : String(v)
    }
    setEditForm(form)
    setEditMode(true)
  }

  async function saveEdit() {
    setSavingEdit(true)
    setActionMsg("")
    try {
      const res = await fetch(`/api/admin/partners/applications/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      })
      const data = await res.json()
      if (data.success) {
        setApp(data.application)
        setEditMode(false)
        setActionMsg("Application updated.")
      } else {
        setActionMsg(data.error || "Failed to save")
      }
    } finally {
      setSavingEdit(false)
      setTimeout(() => setActionMsg(""), 3000)
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

  async function requestComplianceDocuments() {
    const documentTypes = [...selectedDocTypes]
    if (customDocType.trim()) documentTypes.push(customDocType.trim())
    if (documentTypes.length === 0) {
      setActionMsg("Select at least one compliance document type")
      return
    }
    setRequestingDocs(true)
    setActionMsg("")
    try {
      const res = await fetch(`/api/admin/partners/applications/${id}/compliance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentTypes }),
      })
      const data = await res.json()
      if (data.success) {
        setActionMsg("Compliance documents requested — application moved to Compliance Required and upload links emailed.")
        setCustomDocType("")
        fetchDetail()
      } else {
        setActionMsg(data.error || "Failed to request documents")
      }
    } finally {
      setRequestingDocs(false)
      setTimeout(() => setActionMsg(""), 4000)
    }
  }

  async function reviewComplianceDoc(docId: string) {
    setReviewing(true)
    setActionMsg("")
    try {
      const res = await fetch(`/api/admin/partners/applications/${id}/compliance`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docId, status: reviewStatus, notes: reviewNotes }),
      })
      const data = await res.json()
      if (data.success) {
        setActionMsg(`Document marked ${reviewStatus.toLowerCase().replace(/_/g, " ")}.`)
        setReviewDocId(null)
        setReviewNotes("")
        fetchDetail()
      } else {
        setActionMsg(data.error || "Failed to update document")
      }
    } finally {
      setReviewing(false)
      setTimeout(() => setActionMsg(""), 3000)
    }
  }

  async function resendUploadLink(docId: string) {
    setActionMsg("")
    try {
      const res = await fetch(`/api/admin/partners/applications/${id}/compliance`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docId }),
      })
      const data = await res.json()
      if (data.success) {
        setActionMsg("Upload link resent.")
        fetchDetail()
      } else {
        setActionMsg(data.error || "Failed to resend link")
      }
    } finally {
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

  function toggleDocType(t: string) {
    setSelectedDocTypes((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]
    )
  }

  function complianceScore() {
    const required = complianceDocs.filter((d) => d.required)
    if (required.length === 0) return { total: 0, verified: 0, percent: 100, complete: true, missing: [] as ComplianceDocRow[] }
    const verified = required.filter((d) => d.verification_status === "VERIFIED" || d.verification_status === "APPROVED")
    const missing = required.filter((d) => d.verification_status !== "VERIFIED" && d.verification_status !== "APPROVED")
    return {
      total: required.length,
      verified: verified.length,
      percent: Math.round((verified.length / required.length) * 100),
      complete: missing.length === 0,
      missing,
    }
  }

  function statusBadge(status: string) {
    const color =
      status === "VERIFIED" || status === "APPROVED" ? "bg-green-100 text-green-800" :
      status === "REJECTED" || status === "EXPIRED" ? "bg-red-50 text-red-700" :
      status === "SUBMITTED" || status === "UNDER_REVIEW" ? "bg-blue-50 text-blue-700" :
      "bg-amber-50 text-amber-700"
    return <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded-full font-medium ${color}`}>{status.replace(/_/g, " ")}</span>
  }

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
  }
  if (error || !app) {
    return <div className="text-center py-20"><p className="text-red-500">{error || "Not found"}</p><Link href="/admin/partners" className="text-sm text-retail mt-2 inline-block">Back to partners</Link></div>
  }

  const score = complianceScore()
  const canActivate = ["APPROVED", "AGREEMENT_PENDING", "TRAINING", "CERTIFICATION_PENDING", "ACTIVE"].includes(app.status) && score.complete

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/partners" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="w-4 h-4 mr-1" /> Back to Partners</Link>
        <div className="flex items-center justify-between mt-2">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">{app.reference_number}</h2>
            <p className="text-muted-foreground text-sm">{app.full_name} · {app.business_name || "Individual"}</p>
          </div>
          <span className={`text-xs uppercase px-2 py-1 rounded font-medium ${STATUS_COLORS[app.status] || "bg-blue-50 text-blue-700"}`}>{app.status.replace(/_/g, " ")}</span>
        </div>
      </div>

      {actionMsg && <p className={`text-sm ${actionMsg.includes("failed") || actionMsg.includes("Failed") ? "text-red-500" : "text-green-600"}`}>{actionMsg}</p>}

      {/* Tab bar */}
      <div className="flex flex-wrap gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-md border-b-2 -mb-px transition-colors ${
              tab === t.key
                ? "border-retail text-retail"
                : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40"
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
            {t.key === "compliance" && complianceDocs.length > 0 && (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px]">{score.verified}/{score.total}</span>
            )}
          </button>
        ))}
      </div>

      {/* ─────────── Overview ─────────── */}
      {tab === "overview" && (
        <div className="space-y-6">
          <div className="flex items-center justify-end gap-2">
            {editMode ? (
              <>
                <Button size="sm" variant="outline" onClick={() => setEditMode(false)} disabled={savingEdit}>
                  <X className="w-3.5 h-3.5 mr-1" /> Cancel
                </Button>
                <Button size="sm" onClick={saveEdit} disabled={savingEdit}>
                  {savingEdit ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Save className="w-3.5 h-3.5 mr-1" />}
                  Save Changes
                </Button>
              </>
            ) : (
              <Button size="sm" variant="outline" onClick={startEdit}>
                <Pencil className="w-3.5 h-3.5 mr-1" /> Edit Application
              </Button>
            )}
          </div>

          {editMode ? (
            <Card>
              <CardHeader><CardTitle className="text-sm font-medium">Edit Application Details</CardTitle></CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {EDITABLE_FIELDS.map((f) => {
                    if (f.key === "country") {
                      return (
                        <LocationFields
                          key={f.key}
                          country={editForm.country || ""}
                          state={editForm.state || ""}
                          city={editForm.city || ""}
                          onChange={(vals) => setEditForm((prev) => ({ ...prev, ...vals }))}
                          inputClassName="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        />
                      )
                    }
                    if (f.key === "state" || f.key === "city") return null
                    return (
                    <div key={f.key} className={f.textarea ? "sm:col-span-2" : ""}>
                      <label className="block text-xs font-medium mb-1">{f.label}</label>
                      {f.textarea ? (
                        <textarea
                          rows={3}
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={editForm[f.key] || ""}
                          onChange={(e) => setEditForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                        />
                      ) : (
                        <input
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          value={editForm[f.key] || ""}
                          onChange={(e) => setEditForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                        />
                      )}
                    </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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

              <Card>
                <CardHeader><CardTitle className="text-sm font-medium flex items-center gap-2"><FileText className="w-4 h-4" /> Uploaded Documents</CardTitle></CardHeader>
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
          )}
        </div>
      )}

      {/* ─────────── Timeline ─────────── */}
      {tab === "timeline" && (
        <Card>
          <CardHeader><CardTitle className="text-sm font-medium">Application Timeline</CardTitle></CardHeader>
          <CardContent>
            {history.length === 0 ? <p className="text-sm text-muted-foreground">No history yet.</p> : (
              <ol className="relative border-l border-border ml-2 space-y-4">
                {history.map((h, i) => (
                  <li key={i} className="ml-5">
                    <span className="absolute -left-1.5 mt-1.5 w-3 h-3 rounded-full bg-retail ring-4 ring-background" />
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="font-medium text-sm">{(h.new_status || "").replace(/_/g, " ")}</span>
                      {h.previous_status && <span className="text-xs text-muted-foreground">from {h.previous_status.replace(/_/g, " ")}</span>}
                      <span className="text-xs text-muted-foreground ml-auto">{new Date(h.created_at).toLocaleString()}</span>
                    </div>
                    {h.reason && <p className="text-xs text-muted-foreground mt-0.5">{h.reason}</p>}
                  </li>
                ))}
              </ol>
            )}
            <p className="text-xs text-muted-foreground mt-4">Submitted {new Date(app.submitted_at).toLocaleString()}{app.reviewed_at ? ` · last reviewed ${new Date(app.reviewed_at).toLocaleString()}` : ""}</p>
          </CardContent>
        </Card>
      )}

      {/* ─────────── Compliance Docs ─────────── */}
      {tab === "compliance" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2"><ShieldCheck className="w-4 h-4" /> Compliance Documents</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {app.status === "COMPLIANCE_REQUIRED" && (
              <div className="flex items-start gap-2 rounded-md bg-amber-50 text-amber-800 p-3 text-sm">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>This application is awaiting compliance documents from the applicant (status: Compliance Required).</span>
              </div>
            )}

            {/* Score */}
            {score.total > 0 && (
              <div className="rounded-md border border-border p-4">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="font-medium">Compliance Score</span>
                  <span className={`font-semibold ${score.complete ? "text-green-700" : "text-amber-700"}`}>{score.percent}% ({score.verified}/{score.total})</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full ${score.complete ? "bg-green-600" : "bg-amber-500"}`} style={{ width: `${score.percent}%` }} />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {score.complete
                    ? "All required compliance documents are verified and approved. The partner can be activated."
                    : `Missing or pending documents: ${score.missing.map((d) => d.document_type).join(", ")}.`}
                </p>
              </div>
            )}

            {/* Request checklist */}
            <div className="space-y-3">
              <p className="text-sm font-medium">Request compliance documents</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {COMPLIANCE_DOCUMENT_TYPES.map((t) => (
                  <label key={t} className="flex items-center gap-2 text-sm p-2 rounded-md border border-border hover:bg-muted/30 cursor-pointer">
                    <input type="checkbox" className="rounded border-border" checked={selectedDocTypes.includes(t)} onChange={() => toggleDocType(t)} />
                    {t}
                  </label>
                ))}
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Other document type</label>
                <input
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={customDocType}
                  onChange={(e) => setCustomDocType(e.target.value)}
                  placeholder="Custom document name"
                />
              </div>
              <Button onClick={requestComplianceDocuments} disabled={requestingDocs} size="sm">
                {requestingDocs ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : <Send className="w-3.5 h-3.5 mr-2" />}
                Request Selected Documents
              </Button>
              <p className="text-xs text-muted-foreground">Requesting documents moves the application to &quot;Compliance Required&quot; and emails one-time upload links to the applicant.</p>
            </div>

            {/* Compliance documents list */}
            <div className="space-y-2">
              {complianceDocs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No compliance documents requested yet.</p>
              ) : (
                complianceDocs.map((d) => (
                  <div key={d.id} className="rounded-md border border-border p-3 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2">
                        {d.verification_status === "VERIFIED" || d.verification_status === "APPROVED" ? <CheckCircle className="w-4 h-4 text-green-600" /> :
                         d.verification_status === "REJECTED" ? <XCircle className="w-4 h-4 text-red-600" /> :
                         d.verification_status === "SUBMITTED" || d.verification_status === "UNDER_REVIEW" ? <Clock className="w-4 h-4 text-blue-600" /> :
                         <AlertCircle className="w-4 h-4 text-amber-600" />}
                        <span className="font-medium text-sm">{d.document_type}</span>
                      </div>
                      {statusBadge(d.verification_status)}
                    </div>

                    <div className="text-xs text-muted-foreground">
                      {d.original_filename ? `${d.original_filename} · ${d.file_size ? (d.file_size / 1024).toFixed(0) + " KB" : ""} · ` : ""}
                      {d.uploaded_at ? new Date(d.uploaded_at).toLocaleString() : "Not submitted"}
                      {d.latestToken ? ` · link ${d.latestToken.usedAt ? "used" : "active"}` : ""}
                    </div>

                    {d.signedUrl && (
                      <a href={d.signedUrl} target="_blank" rel="noopener noreferrer" className="inline-flex">
                        <Button size="sm" variant="outline"><Download className="w-3.5 h-3.5 mr-1" /> View File</Button>
                      </a>
                    )}

                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {d.verification_status !== "VERIFIED" && d.verification_status !== "APPROVED" && (
                        <Button size="sm" variant="outline" onClick={() => resendUploadLink(d.id)}><RefreshCw className="w-3.5 h-3.5 mr-1" /> Resend Link</Button>
                      )}
                      {(d.verification_status === "SUBMITTED" || d.verification_status === "UNDER_REVIEW" || d.verification_status === "REJECTED") && (
                        <Button size="sm" variant="outline" onClick={() => { setReviewDocId(d.id); setReviewStatus("VERIFIED"); setReviewNotes(d.notes || "") }}><Check className="w-3.5 h-3.5 mr-1" /> Review</Button>
                      )}
                    </div>

                    {reviewDocId === d.id && (
                      <div className="rounded-md bg-muted/30 p-3 space-y-2">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <select className="rounded-md border border-input bg-background px-3 py-2 text-sm" value={reviewStatus} onChange={(e) => setReviewStatus(e.target.value)}>
                            <option value="VERIFIED">Verified &amp; Approved</option>
                            <option value="APPROVED">Approved</option>
                            <option value="REJECTED">Rejected</option>
                            <option value="UNDER_REVIEW">Under Review</option>
                          </select>
                          <input className="sm:col-span-2 rounded-md border border-input bg-background px-3 py-2 text-sm" value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} placeholder="Review notes" />
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => reviewComplianceDoc(d.id)} disabled={reviewing}>{reviewing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Save Review</Button>
                          <Button size="sm" variant="outline" onClick={() => setReviewDocId(null)}><X className="w-3.5 h-3.5" /> Cancel</Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─────────── Actions & Notes ─────────── */}
      {tab === "actions" && (
        <div className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-sm font-medium">Internal Notes</CardTitle></CardHeader>
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
                    <option value="COMPLIANCE_REQUIRED">Compliance Documents Required</option>
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

              {(actionStatus === "MORE_INFORMATION_REQUIRED" || actionStatus === "COMPLIANCE_REQUIRED") && (
                <div>
                  <label className="block text-xs font-medium mb-1">Message to applicant</label>
                  <textarea className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" rows={3} value={infoMessage} onChange={(e) => setInfoMessage(e.target.value)} />
                </div>
              )}
              {actionStatus === "REJECTED" && (
                <div>
                  <label className="block text-xs font-medium mb-1">Applicant-facing rejection message</label>
                  <textarea className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" rows={3} value={rejectionPublic} onChange={(e) => setRejectionPublic(e.target.value)} />
                </div>
              )}

              <Button onClick={performAction} disabled={acting || !actionStatus}>
                {acting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Apply Action
              </Button>
            </CardContent>
          </Card>

          {["APPROVED", "AGREEMENT_PENDING", "TRAINING", "CERTIFICATION_PENDING", "ACTIVE"].includes(app.status) && (
            <Card>
              <CardHeader><CardTitle className="text-sm font-medium flex items-center gap-2"><UserCheck className="w-4 h-4" /> Partner Activation</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className={`flex items-start gap-2 rounded-md p-3 text-sm ${score.complete ? "bg-green-50 text-green-800" : "bg-amber-50 text-amber-800"}`}>
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>
                    {score.complete
                      ? "All required compliance documents are verified. You can activate this partner."
                      : `Activation is blocked until all required compliance documents are verified/approved (${score.verified}/${score.total}).`}
                  </span>
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
                <Button onClick={activatePartner} disabled={activating || !canActivate}>
                  {activating ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserCheck className="w-4 h-4" />} Activate Partner
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex gap-2"><span className="text-muted-foreground w-32 shrink-0">{label}:</span><span className="font-medium">{value}</span></div>
}
