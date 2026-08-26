"use client"

import { useState, useEffect, useMemo } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { generateSetupQuestions } from "@/lib/onboarding"
import { Button } from "@/components/ui/button"
import {
  Loader2,
  ClipboardCheck,
  Users,
  Phone,
  Mail,
  CheckCircle2,
  AlertCircle,
  Rocket,
  FileText,
  X,
  Send,
  Clock,
  Check,
  Trash2,
} from "lucide-react"

interface Lead {
  id: string
  fullName: string
  businessName: string
  email: string
  phone: string
  productInterest: string
  status: string
}

interface OnboardingRecord {
  id: string
  leadId: string
  fullName: string
  businessName: string
  email: string
  phone: string
  productInterest: string
  status: "Pending" | "In Progress" | "Completed" | "Rejected"
  setupQuestionsSent: boolean
  clientResponses: Record<string, unknown>
  documents: Array<{ name: string; url: string; uploadedAt: string }>
  signatureUrl: string
  notes: string
  createdAt: string
  updatedAt: string
}

export default function AdminOnboardingPage() {
  const searchParams = useSearchParams()
  const initiateLeadId = searchParams.get("initiate")

  const [leads, setLeads] = useState<Lead[]>([])
  const [records, setRecords] = useState<OnboardingRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState("")

  // Modal states
  const [showInitiateModal, setShowInitiateModal] = useState(false)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [initiating, setInitiating] = useState(false)
  const [emailDraft, setEmailDraft] = useState("")

  const buildEmailDraft = (lead: Lead) => {
    const questions = generateSetupQuestions(lead.productInterest)
    return `Hi ${lead.fullName},\n\nWelcome to MartPoint! To get your system up and running, we need a few critical details.\n\n${questions}\n\nBest regards,\nMartPoint Team`
  }

  const openInitiate = (lead: Lead) => {
    setSelectedLead(lead)
    setEmailDraft(buildEmailDraft(lead))
    setShowInitiateModal(true)
  }

  // Expanded record
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [statusDraft, setStatusDraft] = useState("")
  const [noteDraft, setNoteDraft] = useState("")
  const [updating, setUpdating] = useState(false)

  // Invoice modal
  const [showInvoiceModal, setShowInvoiceModal] = useState(false)
  const [invoiceRecord, setInvoiceRecord] = useState<OnboardingRecord | null>(null)
  const [sendingInvoice, setSendingInvoice] = useState(false)
  const [invoiceForm, setInvoiceForm] = useState({
    description: "",
    amount: "",
    tax: "",
    dueDate: "",
    message: "",
  })

  const loadData = async () => {
    setLoading(true)
    try {
      // Fetch Won leads
      const leadsRes = await fetch("/api/admin/leads")
      const leadsData = await leadsRes.json()
      const wonLeads = leadsData.leads ? (leadsData.leads as Lead[]).filter((l) => l.status === "Won") : []
      setLeads(wonLeads)

      // Fetch onboarding records
      const onboardingRes = await fetch("/api/admin/onboarding")
      const onboardingData = await onboardingRes.json()
      const fetchedRecords = onboardingData.records ? (onboardingData.records as OnboardingRecord[]) : []
      setRecords(fetchedRecords)

      // Auto-open initiate modal if ?initiate=leadId is present
      if (initiateLeadId) {
        const lead = wonLeads.find((l) => l.id === initiateLeadId)
        if (lead && !fetchedRecords.some((r) => r.leadId === lead.id)) {
          openInitiate(lead)
        }
      }
    } catch {
      setMessage("Failed to load data")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const wonLeadIds = useMemo(() => new Set(records.map((r) => r.leadId)), [records])
  const pendingLeads = leads.filter((l) => !wonLeadIds.has(l.id))

  const stats = useMemo(() => {
    const total = records.length
    const pending = records.filter((r) => r.status === "Pending").length
    const inProgress = records.filter((r) => r.status === "In Progress").length
    const completed = records.filter((r) => r.status === "Completed").length
    return { total, pending, inProgress, completed }
  }, [records])

  const initiateOnboarding = async () => {
    if (!selectedLead) return
    setInitiating(true)
    setMessage("")
    try {
      const res = await fetch("/api/admin/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: selectedLead.id,
          fullName: selectedLead.fullName,
          businessName: selectedLead.businessName,
          email: selectedLead.email,
          phone: selectedLead.phone,
          productInterest: selectedLead.productInterest,
          message: emailDraft,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setRecords((prev) => [data.record, ...prev])
        setShowInitiateModal(false)
        setSelectedLead(null)
        setMessage("Onboarding initiated. Setup questions sent via email and WhatsApp.")
      } else {
        setMessage(data.error || "Failed to initiate onboarding")
      }
    } catch {
      setMessage("Failed to initiate onboarding")
    } finally {
      setInitiating(false)
      setTimeout(() => setMessage(""), 4000)
    }
  }

  const updateRecord = async (id: string) => {
    setUpdating(true)
    try {
      const res = await fetch("/api/admin/onboarding", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: statusDraft, notes: noteDraft }),
      })
      const data = await res.json()
      if (data.success) {
        setRecords((prev) => prev.map((r) => (r.id === id ? { ...r, status: statusDraft as OnboardingRecord["status"], notes: noteDraft } : r)))
        setMessage("Record updated.")
        setTimeout(() => setMessage(""), 2000)
      }
    } catch {
      setMessage("Failed to update record")
    } finally {
      setUpdating(false)
    }
  }

  const deleteRecord = async (id: string) => {
    if (!confirm("Delete this onboarding record?")) return
    try {
      const res = await fetch(`/api/admin/onboarding?id=${id}`, { method: "DELETE" })
      const data = await res.json()
      if (data.success) {
        setRecords((prev) => prev.filter((r) => r.id !== id))
      }
    } catch {
      setMessage("Failed to delete record")
    }
  }

  const openInvoice = (record: OnboardingRecord) => {
    setInvoiceRecord(record)
    const desc = `MartPoint ${record.productInterest === "erp" ? "ERP" : "Retail"} Setup & Implementation`
    const due = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]
    const baseMessage = `Hi ${record.fullName},\n\nThank you for choosing MartPoint. Please find your invoice below:\n\nDescription: ${desc}\nAmount: ₦0\nTax: ₦0\nTotal Due: ₦0\nDue Date: ${due}\n\nBest regards,\nMartPoint Team`
    setInvoiceForm({
      description: desc,
      amount: "",
      tax: "",
      dueDate: due,
      message: baseMessage,
    })
    setShowInvoiceModal(true)
  }

  const sendInvoice = async () => {
    if (!invoiceRecord) return
    if (!invoiceForm.description || !invoiceForm.amount) return
    setSendingInvoice(true)
    setMessage("")
    try {
      const res = await fetch("/api/admin/onboarding/invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recordId: invoiceRecord.id,
          description: invoiceForm.description,
          amount: Number(invoiceForm.amount),
          tax: invoiceForm.tax ? Number(invoiceForm.tax) : 0,
          dueDate: invoiceForm.dueDate,
          message: invoiceForm.message,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setShowInvoiceModal(false)
        setInvoiceRecord(null)
        setMessage("Invoice sent and recorded as income.")
        setTimeout(() => setMessage(""), 3000)
      } else {
        setMessage(data.error || "Failed to send invoice")
      }
    } catch {
      setMessage("Failed to send invoice")
    } finally {
      setSendingInvoice(false)
    }
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5" />
            Onboarding
          </h2>
          <p className="text-muted-foreground">Convert won leads into paying clients and track their setup journey.</p>
        </div>
      </div>

      {message && (
        <p className={`text-sm ${message.includes("success") || message.includes("initiated") || message.includes("updated") ? "text-green-600" : "text-red-500"}`}>
          {message}
        </p>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Total</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <Users className="w-5 h-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Pending</p>
                <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
              </div>
              <Clock className="w-5 h-5 text-amber-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">In Progress</p>
                <p className="text-2xl font-bold text-blue-600">{stats.inProgress}</p>
              </div>
              <Rocket className="w-5 h-5 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Completed</p>
                <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
              </div>
              <CheckCircle2 className="w-5 h-5 text-green-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Ready for Onboarding */}
      {pendingLeads.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Rocket className="w-4 h-4 text-muted-foreground" />
              Ready for Onboarding
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingLeads.map((lead) => (
                <div key={lead.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-border bg-muted/20 p-4">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{lead.fullName}</p>
                    <p className="text-xs text-muted-foreground">{lead.businessName} · {lead.productInterest === "retail" ? "Retail" : "ERP"}</p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {lead.email}</span>
                      <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {lead.phone}</span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="retail"
                    onClick={() => openInitiate(lead)}
                  >
                    <Send className="w-3.5 h-3.5 mr-1" />
                    Initiate Onboarding
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Onboarding Records */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4 text-muted-foreground" />
            Onboarding Clients
          </CardTitle>
        </CardHeader>
        <CardContent>
          {records.length === 0 ? (
            <div className="text-center py-8">
              <ClipboardCheck className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No onboarding records yet.</p>
              <p className="text-xs text-muted-foreground mt-1">Click &quot;Initiate Onboarding&quot; on a Won lead to start the process.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {records.map((record) => (
                <div key={record.id}>
                  <div
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-border bg-muted/20 p-4 cursor-pointer hover:bg-muted/40 transition-colors"
                    onClick={() => {
                      setExpandedId(expandedId === record.id ? null : record.id)
                      setStatusDraft(record.status)
                      setNoteDraft(record.notes || "")
                    }}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-foreground">{record.fullName}</p>
                        <StatusBadge status={record.status} />
                      </div>
                      <p className="text-xs text-muted-foreground">{record.businessName || "No business name"} · {record.productInterest === "retail" ? "Retail" : "ERP"}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {record.email}</span>
                        <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {record.phone}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {record.setupQuestionsSent && (
                        <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-green-50 text-green-700 font-medium flex items-center gap-1">
                          <Check className="w-3 h-3" /> Questions Sent
                        </span>
                      )}
                      {record.documents && record.documents.length > 0 && (
                        <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-medium flex items-center gap-1">
                          <FileText className="w-3 h-3" /> {record.documents.length} Doc{record.documents.length > 1 ? "s" : ""}
                        </span>
                      )}
                      {record.signatureUrl && (
                        <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-violet-50 text-violet-700 font-medium flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Signed
                        </span>
                      )}
                    </div>
                  </div>

                  {expandedId === record.id && (
                    <div className="border border-t-0 border-border rounded-b-lg bg-muted/10 p-4 space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium mb-1">Status</label>
                          <select
                            value={statusDraft}
                            onChange={(e) => setStatusDraft(e.target.value)}
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          >
                            <option value="Pending">Pending</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Completed">Completed</option>
                            <option value="Rejected">Rejected</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium mb-1">Setup Questions</label>
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            {record.setupQuestionsSent ? (
                              <><Check className="w-3.5 h-3.5 text-green-600" /> Sent on {new Date(record.createdAt).toLocaleDateString()}</>
                            ) : (
                              <><AlertCircle className="w-3.5 h-3.5 text-amber-500" /> Not sent</>
                            )}
                          </p>
                        </div>
                      </div>

                      {Object.keys(record.clientResponses).length > 0 && (
                        <div>
                          <label className="block text-xs font-medium mb-1">Client Responses</label>
                          <div className="rounded-md border border-border bg-background p-3 space-y-2">
                            {Object.entries(record.clientResponses).map(([key, value]) => (
                              <div key={key} className="text-sm">
                                <span className="font-medium text-muted-foreground">{key}:</span>{" "}
                                <span className="text-foreground">{String(value)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div>
                        <label className="block text-xs font-medium mb-1">Documents</label>
                        {record.documents && record.documents.length > 0 ? (
                          <div className="space-y-1">
                            {record.documents.map((doc, i) => (
                              <a key={i} href={doc.url} target="_blank" rel="noopener noreferrer" className="text-sm text-retail hover:underline flex items-center gap-1">
                                <FileText className="w-3.5 h-3.5" /> {doc.name}
                              </a>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-medium mb-1">Internal Notes</label>
                        <textarea
                          value={noteDraft}
                          onChange={(e) => setNoteDraft(e.target.value)}
                          rows={2}
                          placeholder="Add notes about this client..."
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
                        />
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Button size="sm" onClick={() => updateRecord(record.id)} disabled={updating}>
                            {updating ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Check className="w-3.5 h-3.5 mr-1" />}
                            Save Changes
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => openInvoice(record)}>
                            <FileText className="w-3.5 h-3.5 mr-1" />
                            Generate Invoice
                          </Button>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteRecord(record.id)
                          }}
                          className="p-2 rounded-md text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Delete record"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Initiate Modal */}
      {showInitiateModal && selectedLead && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl border border-border bg-background shadow-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Initiate Onboarding</h3>
              <button
                onClick={() => { setShowInitiateModal(false); setSelectedLead(null) }}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-2 text-sm">
              <p className="text-muted-foreground">You are about to onboard:</p>
              <div className="rounded-lg bg-muted/30 p-3 space-y-1">
                <p className="font-semibold">{selectedLead.fullName}</p>
                <p className="text-muted-foreground text-xs">{selectedLead.businessName}</p>
                <p className="text-muted-foreground text-xs flex items-center gap-1"><Mail className="w-3 h-3" /> {selectedLead.email}</p>
                <p className="text-muted-foreground text-xs flex items-center gap-1"><Phone className="w-3 h-3" /> {selectedLead.phone}</p>
              </div>
              <p className="text-muted-foreground">This will immediately:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                <li>Create an onboarding record</li>
                <li>Email the client the editable questionnaire below</li>
                <li>Send a WhatsApp message (if configured)</li>
              </ul>
              <div>
                <label className="block text-xs font-medium mb-1">Onboarding Email</label>
                <textarea
                  value={emailDraft}
                  onChange={(e) => setEmailDraft(e.target.value)}
                  rows={8}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none font-mono"
                  />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => { setShowInitiateModal(false); setSelectedLead(null) }}>Cancel</Button>
              <Button size="sm" variant="retail" onClick={initiateOnboarding} disabled={initiating}>
                {initiating ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Send className="w-3.5 h-3.5 mr-1" />}
                {initiating ? "Sending..." : "Confirm & Send"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Modal */}
      {showInvoiceModal && invoiceRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl border border-border bg-background shadow-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Generate Invoice</h3>
              <button
                onClick={() => { setShowInvoiceModal(false); setInvoiceRecord(null) }}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1">Description</label>
                <input
                  type="text"
                  value={invoiceForm.description}
                  onChange={(e) => setInvoiceForm((prev) => ({ ...prev, description: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1">Amount (₦)</label>
                  <input
                    type="number"
                    min="0"
                    value={invoiceForm.amount}
                    onChange={(e) => setInvoiceForm((prev) => ({ ...prev, amount: e.target.value }))}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Tax (₦)</label>
                  <input
                    type="number"
                    min="0"
                    value={invoiceForm.tax}
                    onChange={(e) => setInvoiceForm((prev) => ({ ...prev, tax: e.target.value }))}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Due Date</label>
                <input
                  type="date"
                  value={invoiceForm.dueDate}
                  onChange={(e) => setInvoiceForm((prev) => ({ ...prev, dueDate: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Invoice Email</label>
                <textarea
                  value={invoiceForm.message}
                  onChange={(e) => setInvoiceForm((prev) => ({ ...prev, message: e.target.value }))}
                  rows={8}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none font-mono"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => { setShowInvoiceModal(false); setInvoiceRecord(null) }}>Cancel</Button>
              <Button size="sm" variant="retail" onClick={sendInvoice} disabled={sendingInvoice || !invoiceForm.description || !invoiceForm.amount}>
                {sendingInvoice ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Send className="w-3.5 h-3.5 mr-1" />}
                {sendingInvoice ? "Sending..." : "Send Invoice"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    Pending: "bg-amber-50 text-amber-700 border-amber-200",
    "In Progress": "bg-blue-50 text-blue-700 border-blue-200",
    Completed: "bg-green-50 text-green-700 border-green-200",
    Rejected: "bg-red-50 text-red-700 border-red-200",
  }
  return (
    <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border font-medium ${colors[status] || colors.Pending}`}>
      {status}
    </span>
  )
}
