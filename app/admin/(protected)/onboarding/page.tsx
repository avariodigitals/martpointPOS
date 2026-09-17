"use client"

import { useState, useEffect, useMemo } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
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
  KeyRound,
} from "lucide-react"

const STAGES = [
  { key: "INTAKE_RECEIVED", label: "Intake Received" },
  { key: "AWAITING_PAYMENT", label: "Payment Confirmed" },
  { key: "INFO_RECEIVED", label: "Info Received" },
  { key: "SETUP_REVIEW", label: "Setup Review" },
  { key: "PROVISIONING", label: "Provisioning" },
  { key: "BUSINESS_SETUP", label: "Business Setup" },
  { key: "READY_FOR_TRAINING", label: "Ready for Training" },
  { key: "TRAINING_IN_PROGRESS", label: "Training in Progress" },
  { key: "ONBOARDING_COMPLETE", label: "Onboarding Complete" },
]

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
  businessId?: string
  onboardingStages?: Record<string, unknown>
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
  const [stageSaving, setStageSaving] = useState<string | null>(null)

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

  // Access details modal
  const [showAccessModal, setShowAccessModal] = useState(false)
  const [accessRecord, setAccessRecord] = useState<OnboardingRecord | null>(null)
  const [sendingAccess, setSendingAccess] = useState(false)
  const [accessDirty, setAccessDirty] = useState(false)
  const [accessForm, setAccessForm] = useState({
    recipients: "",
    softwareUrl: "",
    adminUsername: "",
    tempPassword: "",
    onlineStoreUrl: "",
    supportGroupUrl: "",
    supportContact: "",
    trainingSchedule: "",
    attachStoreQr: true,
    attachLoginQr: false,
    message: "",
  })
  const [accessFiles, setAccessFiles] = useState<Array<{ name: string; content: string; size: number }>>([])

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
      let fetchedRecords = onboardingData.records ? (onboardingData.records as OnboardingRecord[]) : []

      // Fetch linked businesses to show onboarding stages
      const leadIds = fetchedRecords.map((r) => r.leadId).filter(Boolean)
      let businessMap = new Map<string, { id: string; onboarding_stages: Record<string, unknown> }>()
      if (leadIds.length > 0) {
        const businessesRes = await fetch(`/api/admin/businesses?sourceLeadIds=${leadIds.join(",")}`)
        const businessesData = await businessesRes.json()
        const businesses = (businessesData.businesses || []) as { id: string; source_lead_id: string; onboarding_stages: Record<string, unknown> }[]
        businessMap = new Map(businesses.map((b) => [b.source_lead_id, { id: b.id, onboarding_stages: b.onboarding_stages }]))
      }
      fetchedRecords = fetchedRecords.map((r) => {
        const b = businessMap.get(r.leadId)
        return b ? { ...r, businessId: b.id, onboardingStages: b.onboarding_stages } : r
      })
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

  const toggleRecordStage = async (record: OnboardingRecord, stage: string, completed: boolean) => {
    if (!record.businessId) {
      setMessage("No linked business to update stages.")
      return
    }
    setStageSaving(`${record.id}-${stage}`)
    setMessage("")
    try {
      const res = await fetch(`/api/admin/businesses/${record.businessId}/onboarding-stage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage, completed }),
      })
      const data = await res.json()
      if (data.success) {
        setRecords((prev) =>
          prev.map((r) =>
            r.id === record.id
              ? { ...r, onboardingStages: data.stages as Record<string, unknown> }
              : r
          )
        )
      } else {
        setMessage(data.error || "Failed to update stage")
      }
    } catch {
      setMessage("Failed to update stage")
    } finally {
      setStageSaving(null)
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

  const buildAccessMessage = (record: OnboardingRecord, form: typeof accessForm, files: Array<{ name: string; content: string; size: number }> = accessFiles) => {
    const productLabel = record.productInterest === "erp" ? "ERP" : "Retail"
    const storeBlock = form.onlineStoreUrl ? `Online Store: ${form.onlineStoreUrl}\n\n` : ""
    const groupBlock = form.supportGroupUrl
      ? `Your MartPoint Support Group\n\nJoin your dedicated support group here:\n${form.supportGroupUrl}\n\nThe group is used for:\n\n• MartPoint onboarding and training coordination\n• Guidance on using the MartPoint software\n• Reporting software-related issues\n• Updates on reported issues\n• Important MartPoint service information\n\n`
      : ""
    const kitItems: string[] = []
    if (form.attachStoreQr && form.onlineStoreUrl) kitItems.push("Store QR code — print and display at your counter")
    if (form.attachLoginQr && form.softwareUrl) kitItems.push("Login QR code — quick sign-in on staff devices")
    for (const f of files) kitItems.push(f.name)
    const kitBlock = kitItems.length
      ? `Your Welcome Kit — see attachments\n\n${kitItems.map((i) => `• ${i}`).join("\n")}\n\n`
      : ""
    return `Hi ${record.fullName},

Welcome to MartPoint! We're pleased to confirm that your MartPoint ${productLabel} system is ready.

Your MartPoint Access Details

Software URL: ${form.softwareUrl}
Admin Username/Email: ${form.adminUsername}
Temporary Password: ${form.tempPassword}

For security, please change the temporary password after your first login and do not share your login credentials with anyone who is not authorised to access your business account.

${storeBlock}${kitBlock}Your training session will be arranged according to the agreed schedule, and our team will guide you through the system, your initial setup and the key features your team will be using.

${groupBlock}Support Hours
Monday–Friday: 9:00 a.m.–5:00 p.m.
Time Zone: West Africa Time (WAT)

Messages received outside these hours will be attended to on the next business day.

What Standard MartPoint Support Covers

Your MartPoint licence and standard support cover the MartPoint Retail software and assistance with using the system.

Hardware, computers, printers, internet connections, power supply, data entry, third-party applications and services outside the MartPoint software are not covered under standard support.

Online Store & Marketing Services

Please note that Online Store services and Marketing services are not included in the standard MartPoint licence fee.

These are optional add-on services that can be requested separately depending on your business needs. This may include online store setup or customisation, product uploads, marketing campaigns, and other related digital services. Where required, the scope and cost will be provided separately before any additional service begins.

When reporting an issue, please include a clear description together with a screenshot or short screen recording where possible.

For security, please do not share passwords, payment information or sensitive customer information in the support group or over email.

Your MartPoint Support Contact: ${form.supportContact}
Training Date & Time: ${form.trainingSchedule}

Our commitment does not end with providing the software. We will guide your team through onboarding and continue to support the proper use of MartPoint so your business can operate confidently.

We appreciate your patronage.

Best regards,
MartPoint Team`
  }

  const openAccess = (record: OnboardingRecord) => {
    const slug = (record.businessName || record.fullName).toLowerCase().replace(/[^a-z0-9]+/g, "")
    const form = {
      recipients: record.email,
      softwareUrl: slug ? `https://${slug}.martpoint.com.ng/login` : "",
      adminUsername: record.email,
      tempPassword: "",
      onlineStoreUrl: "",
      supportGroupUrl: "",
      supportContact: "Blessing / 08036028069",
      trainingSchedule: "Please share a suitable date with us.",
      attachStoreQr: true,
      attachLoginQr: false,
      message: "",
    }
    setAccessRecord(record)
    setAccessFiles([])
    setAccessForm({ ...form, message: buildAccessMessage(record, form) })
    setAccessDirty(false)
    setShowAccessModal(true)
  }

  const updateAccessField = (key: keyof typeof accessForm, value: string | boolean) => {
    setAccessForm((prev) => {
      const next = { ...prev, [key]: value }
      if (!accessDirty && accessRecord) {
        next.message = buildAccessMessage(accessRecord, next)
      }
      return next
    })
  }

  const MAX_ACCESS_FILES_BYTES = 3 * 1024 * 1024

  const addAccessFiles = (list: FileList | null) => {
    if (!list || !accessRecord) return
    let running = accessFiles.reduce((s, f) => s + f.size, 0)
    const readers = Array.from(list).map((file) => new Promise<{ name: string; content: string; size: number } | null>((resolve) => {
      if (running + file.size > MAX_ACCESS_FILES_BYTES) {
        resolve(null)
        return
      }
      running += file.size
      const reader = new FileReader()
      reader.onload = () => {
        const dataUrl = String(reader.result || "")
        resolve({ name: file.name, content: dataUrl.split(",")[1] || "", size: file.size })
      }
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(file)
    }))
    Promise.all(readers).then((results) => {
      const ok = results.filter((r): r is { name: string; content: string; size: number } => !!r)
      const next = [...accessFiles, ...ok]
      setAccessFiles(next)
      if (ok.length < results.length) {
        setMessage("Some files were skipped — total attachment limit is 3 MB.")
        setTimeout(() => setMessage(""), 4000)
      }
      if (!accessDirty) {
        setAccessForm((prev) => ({ ...prev, message: buildAccessMessage(accessRecord, prev, next) }))
      }
    })
  }

  const removeAccessFile = (index: number) => {
    if (!accessRecord) return
    const next = accessFiles.filter((_, i) => i !== index)
    setAccessFiles(next)
    if (!accessDirty) {
      setAccessForm((prev) => ({ ...prev, message: buildAccessMessage(accessRecord, prev, next) }))
    }
  }

  const sendAccess = async () => {
    if (!accessRecord) return
    setSendingAccess(true)
    setMessage("")
    try {
      const res = await fetch("/api/admin/onboarding/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recordId: accessRecord.id,
          recipients: accessForm.recipients,
          softwareUrl: accessForm.softwareUrl,
          adminUsername: accessForm.adminUsername,
          tempPassword: accessForm.tempPassword,
          onlineStoreUrl: accessForm.onlineStoreUrl,
          supportGroupUrl: accessForm.supportGroupUrl,
          supportContact: accessForm.supportContact,
          trainingSchedule: accessForm.trainingSchedule,
          attachStoreQr: accessForm.attachStoreQr,
          attachLoginQr: accessForm.attachLoginQr,
          attachments: accessFiles.map((f) => ({ name: f.name, content: f.content })),
          message: accessForm.message,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setShowAccessModal(false)
        setAccessRecord(null)
        setMessage(data.sent
          ? "Access details sent to client."
          : "Email logged but not delivered — check Email Settings.")
        setTimeout(() => setMessage(""), 4000)
      } else {
        setMessage(data.error || "Failed to send access details")
      }
    } catch {
      setMessage("Failed to send access details")
    } finally {
      setSendingAccess(false)
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
                      {record.businessId && (
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/admin/businesses/${record.businessId}`}>
                            View Business
                          </Link>
                        </Button>
                      )}
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
                        <label className="block text-xs font-medium mb-1">Onboarding Stages</label>
                        <div className="rounded-md border border-border bg-background p-3">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {STAGES.map((s) => {
                              const stage = (record.onboardingStages as Record<string, { completedAt?: string }> | undefined)?.[s.key]
                              const saving = stageSaving === `${record.id}-${s.key}`
                              const completed = !!stage?.completedAt
                              return (
                                <button
                                  key={s.key}
                                  type="button"
                                  disabled={!record.businessId || saving}
                                  onClick={() => toggleRecordStage(record, s.key, !completed)}
                                  className="flex items-center gap-2 text-sm text-left w-full disabled:cursor-not-allowed disabled:opacity-60 group"
                                  title={record.businessId ? (completed ? "Click to reopen" : "Click to complete") : "No linked business"}
                                >
                                  {saving ? (
                                    <Loader2 className="w-4 h-4 animate-spin text-muted-foreground shrink-0" />
                                  ) : completed ? (
                                    <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                                  ) : (
                                    <div className="w-4 h-4 rounded-full border-2 border-gray-300 bg-background group-hover:border-retail shrink-0" />
                                  )}
                                  <span className={completed ? "text-foreground font-medium" : "text-muted-foreground group-hover:text-foreground"}>
                                    {s.label}
                                  </span>
                                  {completed && (
                                    <span className="text-[10px] text-muted-foreground ml-auto shrink-0">
                                      {new Date(stage.completedAt!).toLocaleDateString()}
                                    </span>
                                  )}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      </div>

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
                          <Button size="sm" variant="outline" onClick={() => openAccess(record)}>
                            <KeyRound className="w-3.5 h-3.5 mr-1" />
                            Send Access Details
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

      {/* Access Details Modal */}
      {showAccessModal && accessRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl border border-border bg-background shadow-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Send Access Details</h3>
              <button
                onClick={() => { setShowAccessModal(false); setAccessRecord(null) }}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1">Send To (comma-separated)</label>
                <input
                  type="text"
                  value={accessForm.recipients}
                  onChange={(e) => updateAccessField("recipients", e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Software URL</label>
                <input
                  type="text"
                  value={accessForm.softwareUrl}
                  onChange={(e) => updateAccessField("softwareUrl", e.target.value)}
                  placeholder="https://clientname.martpoint.com.ng/login"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1">Admin Username/Email</label>
                  <input
                    type="text"
                    value={accessForm.adminUsername}
                    onChange={(e) => updateAccessField("adminUsername", e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Temporary Password</label>
                  <input
                    type="text"
                    value={accessForm.tempPassword}
                    onChange={(e) => updateAccessField("tempPassword", e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Online Store URL (optional)</label>
                <input
                  type="text"
                  value={accessForm.onlineStoreUrl}
                  onChange={(e) => updateAccessField("onlineStoreUrl", e.target.value)}
                  placeholder="https://clientname.martpoint.com.ng/store/slug"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Support Group Link (optional)</label>
                <input
                  type="text"
                  value={accessForm.supportGroupUrl}
                  onChange={(e) => updateAccessField("supportGroupUrl", e.target.value)}
                  placeholder="https://chat.whatsapp.com/..."
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="rounded-md border border-border bg-muted/10 p-3 space-y-2">
                <label className="block text-xs font-medium">Welcome Kit Attachments</label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={accessForm.attachStoreQr}
                    onChange={(e) => updateAccessField("attachStoreQr", e.target.checked)}
                    disabled={!accessForm.onlineStoreUrl}
                    className="rounded border-input"
                  />
                  <span className={!accessForm.onlineStoreUrl ? "text-muted-foreground" : ""}>
                    Store QR code{!accessForm.onlineStoreUrl ? " (needs Online Store URL)" : " — generated from the Online Store URL"}
                  </span>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={accessForm.attachLoginQr}
                    onChange={(e) => updateAccessField("attachLoginQr", e.target.checked)}
                    disabled={!accessForm.softwareUrl}
                    className="rounded border-input"
                  />
                  <span className={!accessForm.softwareUrl ? "text-muted-foreground" : ""}>
                    Login QR code{!accessForm.softwareUrl ? " (needs Software URL)" : " — generated from the Software URL"}
                  </span>
                </label>
                <div>
                  <input
                    type="file"
                    multiple
                    onChange={(e) => {
                      addAccessFiles(e.target.files)
                      e.target.value = ""
                    }}
                    className="block w-full text-xs text-muted-foreground file:mr-3 file:rounded-md file:border file:border-input file:bg-background file:px-3 file:py-1.5 file:text-xs file:font-medium hover:file:bg-muted"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Welcome card, digital card, brand kit, etc. — 3 MB total max.</p>
                </div>
                {accessFiles.length > 0 && (
                  <ul className="space-y-1">
                    {accessFiles.map((f, i) => (
                      <li key={`${f.name}-${i}`} className="flex items-center justify-between text-xs rounded bg-muted/30 px-2 py-1">
                        <span className="truncate flex items-center gap-1">
                          <FileText className="w-3 h-3 shrink-0" /> {f.name}
                          <span className="text-muted-foreground">({Math.ceil(f.size / 1024)} KB)</span>
                        </span>
                        <button
                          type="button"
                          onClick={() => removeAccessFile(i)}
                          className="p-0.5 text-muted-foreground hover:text-red-600"
                          title="Remove"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1">Support Contact</label>
                  <input
                    type="text"
                    value={accessForm.supportContact}
                    onChange={(e) => updateAccessField("supportContact", e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Training Date & Time</label>
                  <input
                    type="text"
                    value={accessForm.trainingSchedule}
                    onChange={(e) => updateAccessField("trainingSchedule", e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-medium">Welcome Email</label>
                  {accessDirty && (
                    <button
                      type="button"
                      onClick={() => {
                        if (accessRecord) {
                          setAccessForm((prev) => ({ ...prev, message: buildAccessMessage(accessRecord, prev) }))
                          setAccessDirty(false)
                        }
                      }}
                      className="text-xs text-retail hover:underline"
                    >
                      Rebuild from fields
                    </button>
                  )}
                </div>
                <textarea
                  value={accessForm.message}
                  onChange={(e) => {
                    setAccessDirty(true)
                    setAccessForm((prev) => ({ ...prev, message: e.target.value }))
                  }}
                  rows={16}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none font-mono"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  The message rebuilds automatically as you edit the fields above until you edit it manually.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => { setShowAccessModal(false); setAccessRecord(null) }}>Cancel</Button>
              <Button
                size="sm"
                variant="retail"
                onClick={sendAccess}
                disabled={sendingAccess || !accessForm.softwareUrl || !accessForm.adminUsername || !accessForm.tempPassword || !accessForm.recipients}
              >
                {sendingAccess ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Send className="w-3.5 h-3.5 mr-1" />}
                {sendingAccess ? "Sending..." : "Send Access Details"}
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
