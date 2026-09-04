"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, ShieldCheck, X } from "lucide-react"

interface ComplianceRecord {
  id: string
  subject_type: "BUSINESS" | "PARTNER"
  business_id?: string | null
  business_name?: string | null
  partner_id?: string | null
  partner_name?: string | null
  requirement_type: string
  status: "NOT_REQUIRED" | "REQUESTED" | "SUBMITTED" | "UNDER_REVIEW" | "VERIFIED" | "REJECTED" | "EXPIRED"
  requested_at?: string | null
  submitted_at?: string | null
  reviewed_at?: string | null
  reviewed_by?: string | null
  reviewer_name?: string | null
  expires_at?: string | null
  internal_notes?: string | null
  public_note?: string | null
  document_path?: string | null
}

interface ComplianceRequirement {
  id: string
  subject_type: "BUSINESS" | "PARTNER"
  requirement_type: string
}

const VIEWS = [
  { key: "ALL", label: "All" },
  { key: "REQUESTED", label: "Awaiting Submission" },
  { key: "SUBMITTED", label: "Submitted" },
  { key: "UNDER_REVIEW", label: "Under Review" },
  { key: "VERIFIED", label: "Verified" },
  { key: "REJECTED", label: "Rejected" },
  { key: "EXPIRING", label: "Expiring" },
  { key: "EXPIRED", label: "Expired" },
] as const

const STATUS_COLORS: Record<string, string> = {
  NOT_REQUIRED: "bg-gray-100 text-gray-700",
  REQUESTED: "bg-amber-100 text-amber-700",
  SUBMITTED: "bg-blue-100 text-blue-700",
  UNDER_REVIEW: "bg-indigo-100 text-indigo-700",
  VERIFIED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
  EXPIRED: "bg-gray-100 text-gray-700",
}

function fmtDate(iso?: string | null) {
  if (!iso) return "—"
  try { return new Date(iso).toLocaleDateString() } catch { return iso }
}

function isExpiring(record: ComplianceRecord): boolean {
  if (record.status === "EXPIRED" || record.status === "REJECTED" || record.status === "NOT_REQUIRED") return false
  if (!record.expires_at) return false
  const days = (new Date(record.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  return days <= 30
}

function isExpired(record: ComplianceRecord): boolean {
  if (record.status === "EXPIRED") return true
  if (!record.expires_at) return false
  return new Date(record.expires_at).getTime() < Date.now()
}

export default function CompliancePage() {
  const [records, setRecords] = useState<ComplianceRecord[]>([])
  const [requirements, setRequirements] = useState<ComplianceRequirement[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState("")
  const [view, setView] = useState<string>("ALL")
  const [subjectType, setSubjectType] = useState<string>("")
  const [businessFilter, setBusinessFilter] = useState<string>("")
  const [requirementFilter, setRequirementFilter] = useState<string>("")

  const [showRequest, setShowRequest] = useState(false)
  const [requestForm, setRequestForm] = useState({
    subject_type: "BUSINESS" as "BUSINESS" | "PARTNER",
    business_id: "",
    partner_id: "",
    requirement_type: "",
    public_note: "",
  })

  const [selectedRecord, setSelectedRecord] = useState<ComplianceRecord | null>(null)
  const [actionForm, setActionForm] = useState({
    status: "" as ComplianceRecord["status"] | "",
    public_note: "",
    internal_notes: "",
    expires_at: "",
    document_path: "",
    reason: "",
  })
  const [submitting, setSubmitting] = useState(false)

  async function loadData() {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/compliance")
      const data = await res.json()
      if (data.success) {
        setRecords((data.records || []) as ComplianceRecord[])
        setRequirements((data.requirements || []) as ComplianceRequirement[])
      } else {
        setMessage(data.error || "Failed to load compliance")
      }
    } catch {
      setMessage("Failed to load compliance")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const businesses = useMemo(() => {
    const map = new Map<string, string>()
    for (const r of records) {
      if (r.business_id && r.business_name) map.set(r.business_id, r.business_name)
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]))
  }, [records])

  const requirementOptions = useMemo(() => {
    const set = new Set<string>()
    for (const r of records) set.add(r.requirement_type)
    for (const q of requirements) set.add(q.requirement_type)
    return Array.from(set).sort()
  }, [records, requirements])

  const filtered = useMemo(() => {
    return records.filter((r) => {
      if (subjectType && r.subject_type !== subjectType) return false
      if (businessFilter && r.business_id !== businessFilter) return false
      if (requirementFilter && r.requirement_type !== requirementFilter) return false
      if (view === "ALL") return true
      if (view === "EXPIRING") return isExpiring(r)
      if (view === "EXPIRED") return isExpired(r)
      return r.status === view
    })
  }, [records, subjectType, businessFilter, requirementFilter, view])

  async function doAction(action: string, payload: Record<string, unknown>) {
    setSubmitting(true)
    setMessage("")
    try {
      const res = await fetch("/api/admin/compliance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, data: payload }),
      })
      const data = await res.json()
      if (data.success) {
        setMessage("Updated.")
        setSelectedRecord(null)
        loadData()
      } else {
        setMessage(data.error || "Failed")
      }
    } catch {
      setMessage("Failed to update")
    } finally {
      setSubmitting(false)
      setTimeout(() => setMessage(""), 2000)
    }
  }

  async function submitRequest() {
    if (!requestForm.requirement_type) return
    setSubmitting(true)
    try {
      const payload: Record<string, unknown> = {
        subject_type: requestForm.subject_type,
        requirement_type: requestForm.requirement_type,
        public_note: requestForm.public_note,
      }
      if (requestForm.subject_type === "BUSINESS") payload.business_id = requestForm.business_id
      else payload.partner_id = requestForm.partner_id
      const res = await fetch("/api/admin/compliance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create_record", data: payload }),
      })
      const data = await res.json()
      if (data.success) {
        setMessage("Record requested.")
        setShowRequest(false)
        loadData()
      } else {
        setMessage(data.error || "Failed to request")
      }
    } catch {
      setMessage("Failed to request")
    } finally {
      setSubmitting(false)
    }
  }

  function openAction(record: ComplianceRecord) {
    setSelectedRecord(record)
    setActionForm({
      status: "",
      public_note: record.public_note || "",
      internal_notes: record.internal_notes || "",
      expires_at: record.expires_at ? record.expires_at.slice(0, 10) : "",
      document_path: record.document_path || "",
      reason: "",
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-5 h-5" />
            Compliance
          </h2>
          <p className="text-muted-foreground">Track business and partner compliance records.</p>
        </div>
        <Button size="sm" onClick={() => setShowRequest(true)}>Request Record</Button>
      </div>

      {message && (
        <p className={`text-sm ${message.includes("Failed") ? "text-red-500" : "text-green-600"}`}>{message}</p>
      )}

      <div className="flex flex-wrap gap-2 border-b border-border pb-2">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            onClick={() => setView(v.key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              view === v.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium mb-1">Subject type</label>
          <select
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={subjectType}
            onChange={(e) => setSubjectType(e.target.value)}
          >
            <option value="">All</option>
            <option value="BUSINESS">Business</option>
            <option value="PARTNER">Partner</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Business</label>
          <select
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={businessFilter}
            onChange={(e) => setBusinessFilter(e.target.value)}
          >
            <option value="">All</option>
            {businesses.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Requirement</label>
          <select
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={requirementFilter}
            onChange={(e) => setRequirementFilter(e.target.value)}
          >
            <option value="">All</option>
            {requirementOptions.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <Button variant="outline" size="sm" onClick={loadData}>Refresh</Button>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Compliance Records</CardTitle></CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">No records match this view.</p>
          ) : (
            <div className="overflow-x-auto -mx-6">
              <table className="w-full text-sm">
                <thead className="bg-muted text-left">
                  <tr>
                    <th className="px-4 py-2">Subject</th>
                    <th className="px-4 py-2">Type</th>
                    <th className="px-4 py-2">Requirement</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2">Submitted</th>
                    <th className="px-4 py-2">Reviewed</th>
                    <th className="px-4 py-2">Expires</th>
                    <th className="px-4 py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.id} className="border-t border-border">
                      <td className="px-4 py-2">
                        {r.business_name || r.partner_name || "—"}
                        <span className="block text-[10px] text-muted-foreground uppercase">{r.subject_type}</span>
                      </td>
                      <td className="px-4 py-2">{r.subject_type}</td>
                      <td className="px-4 py-2">{r.requirement_type}</td>
                      <td className="px-4 py-2">
                        <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium ${STATUS_COLORS[r.status]}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="px-4 py-2">{fmtDate(r.submitted_at)}</td>
                      <td className="px-4 py-2">{r.reviewer_name ? `${r.reviewer_name} · ${fmtDate(r.reviewed_at)}` : "—"}</td>
                      <td className="px-4 py-2">{fmtDate(r.expires_at)}</td>
                      <td className="px-4 py-2">
                        <Button size="sm" variant="outline" onClick={() => openAction(r)}>Update</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {showRequest && (
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">Request Compliance Record</CardTitle>
            <button onClick={() => setShowRequest(false)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1">Subject type</label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={requestForm.subject_type}
                  onChange={(e) => setRequestForm({ ...requestForm, subject_type: e.target.value as "BUSINESS" | "PARTNER" })}
                >
                  <option value="BUSINESS">Business</option>
                  <option value="PARTNER">Partner</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">{requestForm.subject_type === "BUSINESS" ? "Business" : "Partner"} ID</label>
                <input
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={requestForm.subject_type === "BUSINESS" ? requestForm.business_id : requestForm.partner_id}
                  onChange={(e) => setRequestForm({
                    ...requestForm,
                    [requestForm.subject_type === "BUSINESS" ? "business_id" : "partner_id"]: e.target.value,
                  })}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Requirement</label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={requestForm.requirement_type}
                  onChange={(e) => setRequestForm({ ...requestForm, requirement_type: e.target.value })}
                >
                  <option value="">Select</option>
                  {requirements.map((q) => (
                    <option key={q.id} value={q.requirement_type}>{q.requirement_type}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Public note</label>
                <input
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={requestForm.public_note}
                  onChange={(e) => setRequestForm({ ...requestForm, public_note: e.target.value })}
                />
              </div>
            </div>
            <Button size="sm" onClick={submitRequest} disabled={submitting}>{submitting ? "Requesting..." : "Request"}</Button>
          </CardContent>
        </Card>
      )}

      {selectedRecord && (
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-medium">Update Record · {selectedRecord.requirement_type}</CardTitle>
            <button onClick={() => setSelectedRecord(null)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1">Status</label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={actionForm.status}
                  onChange={(e) => setActionForm({ ...actionForm, status: e.target.value as ComplianceRecord["status"] })}
                >
                  <option value="">No change</option>
                  <option value="VERIFIED">Verified</option>
                  <option value="REJECTED">Rejected</option>
                  <option value="EXPIRED">Expired</option>
                  <option value="UNDER_REVIEW">Under Review</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Expires at</label>
                <input
                  type="date"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={actionForm.expires_at}
                  onChange={(e) => setActionForm({ ...actionForm, expires_at: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Document path</label>
                <input
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={actionForm.document_path}
                  onChange={(e) => setActionForm({ ...actionForm, document_path: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Public note</label>
                <input
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={actionForm.public_note}
                  onChange={(e) => setActionForm({ ...actionForm, public_note: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium mb-1">Internal notes</label>
                <input
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={actionForm.internal_notes}
                  onChange={(e) => setActionForm({ ...actionForm, internal_notes: e.target.value })}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {actionForm.document_path && (
                <Button size="sm" variant="outline" onClick={() => doAction("submit_document", {
                  record_id: selectedRecord.id,
                  document_path: actionForm.document_path,
                })} disabled={submitting}>Submit Document</Button>
              )}
              {actionForm.status && (
                <Button size="sm" onClick={() => doAction("review", {
                  record_id: selectedRecord.id,
                  status: actionForm.status,
                  public_note: actionForm.public_note,
                  internal_notes: actionForm.internal_notes,
                  expires_at: actionForm.expires_at ? `${actionForm.expires_at}T00:00:00.000Z` : undefined,
                })} disabled={submitting}>Review / Save</Button>
              )}
              <Button size="sm" variant="outline" onClick={() => doAction("set_expiry", {
                record_id: selectedRecord.id,
                expires_at: actionForm.expires_at ? `${actionForm.expires_at}T00:00:00.000Z` : undefined,
              })} disabled={submitting}>Set Expiry</Button>
              <Button size="sm" variant="outline" onClick={() => doAction("request_replacement", {
                record_id: selectedRecord.id,
                reason: actionForm.public_note || "Please resubmit",
              })} disabled={submitting}>Request Replacement</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
