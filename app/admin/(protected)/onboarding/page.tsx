"use client"

/* This page hydrates its legacy workflow state from the admin APIs. */
/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */

import { useState, useEffect, useMemo, useRef } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { generateSetupQuestions } from "@/lib/onboarding"
import { Button } from "@/components/ui/button"
import { accessEmailSubject, recipientEmails, updateAccessMessageField, accessLink } from "@/lib/access-email"
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
  CreditCard,
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
  commercial: {
    businessId: string | null
    quoteId: string | null
    quoteNumber: string | null
    quoteStatus: string | null
    invoiceId: string | null
    invoiceNumber: string | null
    invoiceStatus: string | null
    invoiceCount: number
    totalAmount: number | null
    amountPaid: number | null
    balanceDue: number | null
    canCreateInvoice: boolean
  }
  accessDetails?: {
    recipients?: string
    subject?: string
    additionalNote?: string
    attachmentNames?: string[]
    sendCount?: number
    softwareUrl?: string
    adminUsername?: string
    tempPassword?: string
    onlineStoreUrl?: string
    supportGroupUrl?: string
    supportContact?: string
    trainingSchedule?: string
    attachStoreQr?: boolean
    attachLoginQr?: boolean
    additionalUsers?: string
    message?: string
    lastSentAt?: string
  } | null
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
  const [editingNote, setEditingNote] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [stageSaving, setStageSaving] = useState<string | null>(null)
  const [formSendingId, setFormSendingId] = useState<string | null>(null)

  // Access details modal
  const [showAccessModal, setShowAccessModal] = useState(false)
  const [accessRecord, setAccessRecord] = useState<OnboardingRecord | null>(null)
  const [sendingAccess, setSendingAccess] = useState(false)
  const [accessDirty, setAccessDirty] = useState(false)
  const [accessError, setAccessError] = useState("")
  const accessDialogRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!showAccessModal) return
    const previousFocus = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    accessDialogRef.current?.querySelector<HTMLTextAreaElement>("#access-recipients")?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !sendingAccess) {
        setShowAccessModal(false)
        setAccessRecord(null)
      }
      if (event.key !== "Tab") return
      const items = Array.from(accessDialogRef.current?.querySelectorAll<HTMLElement>("button, input, textarea, a[href], [tabindex='0']") || [])
        .filter((element) => !element.matches(":disabled") && element.getClientRects().length > 0)
      const first = items[0], last = items[items.length - 1]
      if (!first) { event.preventDefault(); return }
      if ((event.shiftKey && document.activeElement === first) || (!event.shiftKey && document.activeElement === last)) {
        event.preventDefault()
        ;(event.shiftKey ? last : first)?.focus()
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener("keydown", onKeyDown)
      previousFocus?.focus()
    }
  }, [showAccessModal, sendingAccess])
  const [accessForm, setAccessForm] = useState({
    recipients: "",
    subject: "",
    additionalNote: "",
    softwareUrl: "",
    adminUsername: "",
    tempPassword: "",
    onlineStoreUrl: "",
    supportGroupUrl: "",
    supportContact: "",
    trainingSchedule: "",
    attachStoreQr: true,
    attachLoginQr: false,
    additionalUsers: "",
    message: "",
  })
  const [accessLinksConfirmed, setAccessLinksConfirmed] = useState(false)
  const [loadingAccessLinks, setLoadingAccessLinks] = useState(false)
  const [accessLinkSource, setAccessLinkSource] = useState("")
  const accessLinkRequest = useRef<AbortController | null>(null)
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
        setMessage(
          data.emailSent === false
            ? "Onboarding initiated, but the email failed to send — use Send Form on the Info Received stage to retry."
            : "Onboarding initiated. Setup questions sent via email and WhatsApp."
        )
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

  const sendOnboardingForm = async (record: OnboardingRecord) => {
    setFormSendingId(record.id)
    setMessage("")
    try {
      const res = await fetch("/api/admin/onboarding", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: record.id, resendForm: true }),
      })
      const data = await res.json()
      if (data.success) {
        setRecords((prev) => prev.map((r) => (r.id === record.id ? { ...r, setupQuestionsSent: !!data.emailSent } : r)))
        setMessage(data.emailSent ? "Onboarding form sent to client." : "Email delivery failed — check email settings.")
      } else {
        setMessage(data.error || "Failed to send onboarding form")
      }
    } catch {
      setMessage("Failed to send onboarding form")
    } finally {
      setFormSendingId(null)
      setTimeout(() => setMessage(""), 4000)
    }
  }

  const updateRecord = async (id: string) => {
    setUpdating(true)
    try {
      const res = await fetch("/api/admin/onboarding", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: statusDraft }),
      })
      const data = await res.json()
      if (data.success) {
        setRecords((prev) => prev.map((r) => (r.id === id ? { ...r, status: statusDraft as OnboardingRecord["status"] } : r)))
        setMessage("Record updated.")
        setTimeout(() => setMessage(""), 2000)
      }
    } catch {
      setMessage("Failed to update record")
    } finally {
      setUpdating(false)
    }
  }

  const saveNote = async (id: string) => {
    setUpdating(true)
    try {
      const res = await fetch("/api/admin/onboarding", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, notes: noteDraft }),
      })
      const data = await res.json()
      if (data.success) {
        setRecords((prev) => prev.map((r) => (r.id === id ? { ...r, notes: noteDraft } : r)))
        setEditingNote(false)
        setMessage("Note saved.")
        setTimeout(() => setMessage(""), 2000)
      }
    } catch {
      setMessage("Failed to save note")
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

  const buildAccessMessage = (record: OnboardingRecord, form: typeof accessForm, files: Array<{ name: string; content: string; size: number }> = accessFiles) => {
    const productLabel = record.productInterest === "erp" ? "MartPoint ERP" : "MartPoint Retail"
    const storeBlock = form.onlineStoreUrl ? `Online Store: ${form.onlineStoreUrl}\n\n` : ""
    const groupBlock = form.supportGroupUrl
      ? `Your MartPoint Support Group\n\nJoin your dedicated support group here:\n${form.supportGroupUrl}\n\nThe group is used for:\n\n• MartPoint onboarding and training coordination\n• Guidance on using the MartPoint software\n• Reporting software-related issues\n• Updates on reported issues\n• Important MartPoint service information\n\n`
      : ""
    const usersBlock = form.additionalUsers.trim()
      ? `Additional Users:\n${form.additionalUsers.trim()}\n`
      : ""
    const kitItems: string[] = []
    if (form.attachStoreQr && form.onlineStoreUrl) kitItems.push("Store QR code — print and display at your counter")
    if (form.attachLoginQr && form.softwareUrl) kitItems.push("Login QR code — quick sign-in on staff devices")
    for (const f of files) kitItems.push(f.name)
    const kitBlock = kitItems.length
      ? `Your Welcome Kit — see attachments\n\n${kitItems.map((i) => `• ${i}`).join("\n")}\n\n`
      : ""
    return `Hi ${record.fullName},

Welcome to MartPoint! We're pleased to confirm that your ${productLabel} system is ready.

Your MartPoint Access Details

Software URL: ${form.softwareUrl}
Admin Username/Email: ${form.adminUsername}
Temporary Password: ${form.tempPassword}
${usersBlock}
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
    accessLinkRequest.current?.abort()
    const controller = new AbortController()
    accessLinkRequest.current = controller
    setAccessLinksConfirmed(false)
    setLoadingAccessLinks(true)
    setAccessLinkSource("Checking saved deployment links…")
    const saved = record.accessDetails
    const form = {
      recipients: saved?.recipients || record.email,
      subject: saved?.subject || accessEmailSubject(record.businessName || record.fullName),
      additionalNote: saved?.additionalNote || "",
      softwareUrl: saved?.softwareUrl || "",
      adminUsername: saved?.adminUsername || record.email,
      tempPassword: saved?.tempPassword || "",
      onlineStoreUrl: saved?.onlineStoreUrl || "",
      supportGroupUrl: saved?.supportGroupUrl || "",
      supportContact: saved?.supportContact || "Blessing / 08037978230",
      trainingSchedule: saved?.trainingSchedule || "Please share a suitable date with us.",
      attachStoreQr: saved?.attachStoreQr ?? true,
      attachLoginQr: saved?.attachLoginQr ?? false,
      additionalUsers: saved?.additionalUsers || "",
      message: "",
    }
    setAccessRecord(record)
    setAccessError("")
    setAccessFiles([])
    setAccessForm({ ...form, message: saved?.message || buildAccessMessage(record, form, []) })
    setAccessDirty(!!saved?.message)
    setShowAccessModal(true)
    const lookupTimeout = window.setTimeout(() => {
      if (!controller.signal.aborted) {
        setAccessLinkSource("Deployment lookup timed out. Enter and confirm the actual login address manually.")
        setLoadingAccessLinks(false)
        controller.abort()
      }
    }, 10_000)
    void fetch(`/api/admin/onboarding/access?recordId=${encodeURIComponent(record.id)}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || "Could not load deployment links")
        if (controller.signal.aborted) return
        setAccessForm((previous) => {
          const softwareUrl = data.softwareUrl || previous.softwareUrl
          const onlineStoreUrl = data.onlineStoreUrl || previous.onlineStoreUrl
          let message = updateAccessMessageField(previous.message, "softwareUrl", softwareUrl, previous.softwareUrl)
          if (onlineStoreUrl !== previous.onlineStoreUrl) message = updateAccessMessageField(message, "onlineStoreUrl", onlineStoreUrl, previous.onlineStoreUrl)
          return { ...previous, softwareUrl, onlineStoreUrl, message }
        })
        setAccessLinkSource(data.softwareUrl ? "Loaded the business deployment’s Admin URL. Open it and confirm it belongs to this business." : "No deployment Admin URL is saved. Enter the exact installed login address; any previous resend URL is unverified. We do not guess URLs from business names.")
      })
      .catch((error) => { if (!controller.signal.aborted) setAccessLinkSource(error instanceof Error ? error.message : "Enter and confirm the actual login address manually.") })
      .finally(() => { window.clearTimeout(lookupTimeout); if (!controller.signal.aborted) setLoadingAccessLinks(false) })
  }

  const updateAccessField = (key: keyof typeof accessForm, value: string | boolean) => {
    if (["softwareUrl", "onlineStoreUrl", "supportGroupUrl", "additionalNote"].includes(key)) setAccessLinksConfirmed(false)
    setAccessForm((prev) => {
      const next = { ...prev, [key]: value }
      if (["recipients", "subject", "additionalNote"].includes(key)) return next
      if (!accessDirty && accessRecord) {
        next.message = buildAccessMessage(accessRecord, next)
      } else if (typeof value === "string") {
        next.message = updateAccessMessageField(prev.message, key, value, String(prev[key]))
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
    if (!accessRecord || sendingAccess) return
    try {
      recipientEmails(accessForm.recipients)
      accessLink(accessForm.softwareUrl)
      accessLink(accessForm.onlineStoreUrl, "online store URL", true)
      accessLink(accessForm.supportGroupUrl, "support group URL", true)
      if (!accessLinksConfirmed || loadingAccessLinks) throw new Error("Open and confirm the business login link before sending.")
      if (!accessForm.subject.trim() || /[\r\n]/.test(accessForm.subject)) throw new Error("Enter a valid email subject.")
      if (!accessForm.message.trim()) throw new Error("Enter an email message.")
    } catch (error) {
      setAccessError(error instanceof Error ? error.message : "Check the email fields.")
      return
    }
    setSendingAccess(true)
    setAccessError("")
    setMessage("")
    try {
      const res = await fetch("/api/admin/onboarding/access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recordId: accessRecord.id,
          recipients: accessForm.recipients,
          subject: accessForm.subject,
          additionalNote: accessForm.additionalNote,
          softwareUrl: accessForm.softwareUrl,
          linksConfirmed: accessLinksConfirmed,
          adminUsername: accessForm.adminUsername,
          tempPassword: accessForm.tempPassword,
          onlineStoreUrl: accessForm.onlineStoreUrl,
          supportGroupUrl: accessForm.supportGroupUrl,
          supportContact: accessForm.supportContact,
          trainingSchedule: accessForm.trainingSchedule,
          attachStoreQr: accessForm.attachStoreQr,
          attachLoginQr: accessForm.attachLoginQr,
          additionalUsers: accessForm.additionalUsers,
          attachments: accessFiles.map((f) => ({ name: f.name, content: f.content })),
          message: accessForm.message,
        }),
      })
      const data = await res.json()
      if (res.ok && data.success && data.sent) {
        setRecords((prev) => prev.map((record) => record.id === accessRecord.id ? { ...record, accessDetails: data.accessDetails } : record))
        setShowAccessModal(false)
        setAccessRecord(null)
        setMessage(data.warning || "Access email successfully accepted by the email provider. Check Email Logs for the send record.")
      } else {
        setAccessError(data.error || "Failed to send access details. Your edits have been kept open.")
      }
    } catch {
      setAccessError("We could not confirm the send result. Check Email Logs before trying again to avoid a duplicate. Your edits are still open.")
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
                    <p className="text-xs text-muted-foreground">{lead.businessName} · {lead.productInterest === "retail" ? "MartPoint Retail" : "MartPoint ERP"}</p>
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
                      setEditingNote(false)
                    }}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-foreground">{record.fullName}</p>
                        <StatusBadge status={record.status} />
                      </div>
                      <p className="text-xs text-muted-foreground">{record.businessName || "No business name"} · {record.productInterest === "retail" ? "MartPoint Retail" : "MartPoint ERP"}</p>
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
                                <span className="font-medium text-muted-foreground">{humanizeKey(key)}:</span>{" "}
                                {typeof value === "string" && value.startsWith("data:") ? (
                                  <span className="inline-flex items-center gap-3 align-middle">
                                    {value.startsWith("data:image/") && (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img src={value} alt={humanizeKey(key)} className="h-12 w-12 rounded border border-border bg-white object-contain" />
                                    )}
                                    <a href={value} download={dataUrlFileName(key, value)} className="text-xs text-retail hover:underline">
                                      Download
                                    </a>
                                  </span>
                                ) : (
                                  <span className="text-foreground whitespace-pre-wrap">{formatResponseValue(value)}</span>
                                )}
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
                              const hasResponses = Object.keys(record.clientResponses || {}).length > 0
                              const needsForm = s.key === "INFO_RECEIVED" && !completed && !record.setupQuestionsSent && !hasResponses
                              return (
                                <div key={s.key} className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    disabled={!record.businessId || saving || needsForm}
                                    onClick={() => toggleRecordStage(record, s.key, !completed)}
                                    className="flex items-center gap-2 text-sm text-left flex-1 disabled:cursor-not-allowed disabled:opacity-60 group"
                                    title={needsForm ? "Send the onboarding form first" : record.businessId ? (completed ? "Click to reopen" : "Click to complete") : "No linked business"}
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
                                  {s.key === "INFO_RECEIVED" && (
                                    <button
                                      type="button"
                                      onClick={(e) => { e.stopPropagation(); void sendOnboardingForm(record) }}
                                      disabled={formSendingId === record.id}
                                      className="shrink-0 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded border border-retail/30 text-retail hover:bg-retail/5 font-medium disabled:opacity-50"
                                    >
                                      {formSendingId === record.id ? "Sending…" : record.setupQuestionsSent ? "Resend Form" : "Send Form"}
                                    </button>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-medium mb-1">Documents</label>
                        {record.documents && record.documents.length > 0 ? (
                          <div className="space-y-2">
                            {record.documents.map((doc, i) => {
                              const isDataUrl = doc.url.startsWith("data:")
                              return (
                                <div key={i} className="flex items-center gap-3">
                                  {doc.url.startsWith("data:image/") && (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={doc.url} alt={doc.name} className="h-10 w-10 rounded border border-border bg-white object-contain" />
                                  )}
                                  <a
                                    href={doc.url}
                                    {...(isDataUrl ? { download: doc.name } : { target: "_blank", rel: "noopener noreferrer" })}
                                    className="text-sm text-retail hover:underline flex items-center gap-1"
                                  >
                                    <FileText className="w-3.5 h-3.5" /> {doc.name}
                                  </a>
                                </div>
                              )
                            })}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">No documents uploaded yet.</p>
                        )}
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-xs font-medium">Internal Notes</label>
                          {!editingNote && (
                            <button
                              type="button"
                              onClick={() => {
                                setNoteDraft(record.notes || "")
                                setEditingNote(true)
                              }}
                              className="text-xs text-retail hover:underline"
                            >
                              Edit
                            </button>
                          )}
                        </div>
                        {editingNote ? (
                          <div className="space-y-2">
                            <textarea
                              value={noteDraft}
                              onChange={(e) => setNoteDraft(e.target.value)}
                              rows={3}
                              placeholder="Add notes about this client..."
                              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
                            />
                            <div className="flex items-center gap-2">
                              <Button size="sm" onClick={() => saveNote(record.id)} disabled={updating}>
                                {updating ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Check className="w-3.5 h-3.5 mr-1" />}
                                Save Note
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setEditingNote(false)
                                  setNoteDraft(record.notes || "")
                                }}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm whitespace-pre-wrap rounded-md border border-border bg-background px-3 py-2 min-h-[38px]">
                            {record.notes ? record.notes : <span className="text-muted-foreground">No notes yet.</span>}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Button size="sm" onClick={() => updateRecord(record.id)} disabled={updating || statusDraft === record.status}>
                            {updating ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Check className="w-3.5 h-3.5 mr-1" />}
                            Save Status
                          </Button>
                          {record.commercial.invoiceId && Number(record.commercial.balanceDue || 0) > 0 && ["ISSUED", "PARTIALLY_PAID", "OVERDUE"].includes(record.commercial.invoiceStatus || "") ? (
                            <Button asChild size="sm" variant="outline">
                              <Link href={`/admin/finance/commercial/payments?invoice_id=${record.commercial.invoiceId}`}>
                                <CreditCard className="w-3.5 h-3.5 mr-1" />
                                Make Payment
                              </Link>
                            </Button>
                          ) : record.commercial.invoiceId ? (
                            <Button asChild size="sm" variant="outline">
                              <Link href={`/admin/finance/commercial/invoices?invoice_id=${record.commercial.invoiceId}`}>
                                <FileText className="w-3.5 h-3.5 mr-1" />
                                {record.commercial.invoiceStatus === "PAID" ? "Invoice Paid" : "Open Invoice"}
                              </Link>
                            </Button>
                          ) : record.commercial.canCreateInvoice && record.commercial.quoteId ? (
                            <Button asChild size="sm" variant="outline">
                              <Link href={`/admin/finance/commercial/quotes?quote_id=${record.commercial.quoteId}`}>
                                <FileText className="w-3.5 h-3.5 mr-1" />
                                Create Invoice from Quote
                              </Link>
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {record.commercial.quoteStatus ? `Quote ${record.commercial.quoteStatus.toLowerCase()}` : "Commercial quote required"}
                            </span>
                          )}
                          <Button size="sm" variant="outline" onClick={() => openAccess(record)}>
                            <KeyRound className="w-3.5 h-3.5 mr-1" />
                            {record.accessDetails?.lastSentAt ? "Edit & resend access" : "Send access details"}
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

      {/* Access Details Modal */}
      {showAccessModal && accessRecord && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4">
          <div ref={accessDialogRef} role="dialog" aria-modal="true" aria-labelledby="access-email-title" className="flex w-full max-w-2xl max-h-[90dvh] flex-col overflow-hidden rounded-xl border border-border bg-background shadow-lg [&_input]:text-base [&_textarea]:text-base sm:[&_input]:text-sm sm:[&_textarea]:text-sm">
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-4 sm:px-6">
              <div>
                <h3 id="access-email-title" className="text-lg font-semibold">{accessRecord.accessDetails?.lastSentAt ? "Edit & resend access details" : "Send access details"}</h3>
                <p className="text-sm text-muted-foreground break-words">{accessRecord.businessName || accessRecord.fullName}</p>
                {accessRecord.accessDetails?.lastSentAt && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Last sent {new Date(accessRecord.accessDetails.lastSentAt).toLocaleString()} — previous values are prefilled.
                  </p>
                )}
              </div>
              <button
                onClick={() => { setShowAccessModal(false); setAccessRecord(null) }}
                disabled={sendingAccess}
                aria-label="Close access email"
                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="min-h-0 overflow-y-auto px-4 py-4 sm:px-6 space-y-3">
              {accessError && <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{accessError}</p>}
              <p className="rounded-md bg-muted/40 p-3 text-sm text-muted-foreground">Review the recipient and message before sending. Editing these details changes this email only; it does not create users or reset their passwords.</p>
              <fieldset disabled={sendingAccess} className="min-w-0 space-y-3">
              <div>
                <label htmlFor="access-recipients" className="block text-sm font-medium mb-1">Recipient email address(es) *</label>
                <textarea
                  id="access-recipients"
                  inputMode="email"
                  autoCapitalize="none"
                  spellCheck={false}
                  rows={2}
                  value={accessForm.recipients}
                  onChange={(e) => updateAccessField("recipients", e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
                <p className="mt-1 text-xs text-muted-foreground">Only these recipients receive the access details. Separate addresses with commas, semicolons or new lines.</p>
              </div>
              <div>
                <label htmlFor="access-subject" className="block text-sm font-medium mb-1">Email subject *</label>
                <input id="access-subject" maxLength={300} value={accessForm.subject} onChange={(e) => updateAccessField("subject", e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
              </div>
              <div>
                <label htmlFor="access-url" className="block text-xs font-medium mb-1">Software URL</label>
                <input
                  id="access-url"
                  type="text"
                  value={accessForm.softwareUrl}
                  onChange={(e) => updateAccessField("softwareUrl", e.target.value)}
                  disabled={loadingAccessLinks}
                  placeholder="Paste the exact deployed login URL, including its path"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
                <p className="mt-1 text-xs text-muted-foreground">{accessLinkSource}</p>
                {!loadingAccessLinks && /^https?:\/\//i.test(accessForm.softwareUrl) && <a href={(() => { try { return accessLink(accessForm.softwareUrl) } catch { return undefined } })()} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex text-sm font-medium text-retail underline">Open login link to verify</a>}
                <label className="mt-3 flex items-start gap-2 text-sm"><input type="checkbox" disabled={loadingAccessLinks || !accessForm.softwareUrl} checked={accessLinksConfirmed} onChange={(event) => setAccessLinksConfirmed(event.target.checked)} /><span>I opened the login URL and confirmed it belongs to {accessRecord.businessName || accessRecord.fullName}. I also checked any store/support links included below.</span></label>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="access-username" className="block text-xs font-medium mb-1">Admin Username/Email</label>
                  <input
                    id="access-username"
                    type="text"
                    value={accessForm.adminUsername}
                    onChange={(e) => updateAccessField("adminUsername", e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="access-password" className="block text-xs font-medium mb-1">Temporary Password</label>
                  <input
                    id="access-password"
                    type="text"
                    value={accessForm.tempPassword}
                    onChange={(e) => updateAccessField("tempPassword", e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="access-users" className="block text-xs font-medium mb-1">Additional Users (optional — included in the email)</label>
                <textarea
                  id="access-users"
                  value={accessForm.additionalUsers}
                  onChange={(e) => updateAccessField("additionalUsers", e.target.value)}
                  rows={2}
                  placeholder={"One per line, e.g.\nCashier — temi / Temp@123\nManager — bola / Temp@456"}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none font-mono"
                />
              </div>
              <div>
                <label htmlFor="access-store" className="block text-xs font-medium mb-1">Online Store URL (optional)</label>
                <input
                  id="access-store"
                  type="text"
                  value={accessForm.onlineStoreUrl}
                  onChange={(e) => updateAccessField("onlineStoreUrl", e.target.value)}
                  placeholder="https://clientname.martpoint.com.ng/store/slug"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="access-group" className="block text-xs font-medium mb-1">Support Group Link (optional)</label>
                <input
                  id="access-group"
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
                  {accessRecord.accessDetails?.lastSentAt && <p className="mt-2 text-xs text-amber-700 break-words">Uploaded files are not stored for resending. Attach them again if needed{accessRecord.accessDetails.attachmentNames?.length ? ` (previous attachments: ${accessRecord.accessDetails.attachmentNames.join(", ")})` : ""}. Selected QR codes are generated again automatically.</p>}
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
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="access-support" className="block text-xs font-medium mb-1">Support Contact</label>
                  <input
                    id="access-support"
                    type="text"
                    value={accessForm.supportContact}
                    onChange={(e) => updateAccessField("supportContact", e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="access-training" className="block text-xs font-medium mb-1">Training Date & Time</label>
                  <input
                    id="access-training"
                    type="text"
                    value={accessForm.trainingSchedule}
                    onChange={(e) => updateAccessField("trainingSchedule", e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="access-message" className="block text-sm font-medium">Email message *</label>
                  {accessDirty && (
                    <button
                      type="button"
                      onClick={() => {
                        if (accessRecord) {
                          if (!window.confirm("Rebuild the message from the fields above? This replaces any custom changes in the message.")) return
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
                  id="access-message"
                  maxLength={50000}
                  value={accessForm.message}
                  onChange={(e) => {
                    setAccessDirty(true)
                    setAccessForm((prev) => ({ ...prev, message: e.target.value }))
                  }}
                  rows={16}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Review the exact message here. Labelled access fields update without removing your custom text. Use Rebuild only to replace the message with the standard copy.
                </p>
              </div>
              <div>
                <label htmlFor="access-note" className="block text-sm font-medium mb-1">Additional note (optional)</label>
                <textarea id="access-note" rows={3} maxLength={10000} value={accessForm.additionalNote} onChange={(e) => updateAccessField("additionalNote", e.target.value)} placeholder="Add instructions or anything else the business needs to know." className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
                <p className="mt-1 text-xs text-muted-foreground">Added after the message above and saved for your next resend.</p>
              </div>
              </fieldset>
            </div>
            <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-border px-4 py-4 sm:px-6">
              <Button disabled={sendingAccess} variant="outline" size="sm" onClick={() => { setShowAccessModal(false); setAccessRecord(null) }}>Cancel</Button>
              <Button
                size="sm"
                variant="retail"
                onClick={sendAccess}
                disabled={sendingAccess || loadingAccessLinks || !accessLinksConfirmed || !accessForm.softwareUrl || !accessForm.adminUsername || !accessForm.tempPassword || !accessForm.recipients.trim() || !accessForm.subject.trim() || !accessForm.message.trim()}
              >
                {sendingAccess ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Send className="w-3.5 h-3.5 mr-1" />}
                {sendingAccess ? "Sending..." : accessRecord.accessDetails?.lastSentAt ? "Resend access email" : "Send access email"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function humanizeKey(key: string): string {
  const label = key
    .replace(/^section/, "")
    .replace(/([A-Z])/g, " $1")
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/^./, (c) => c.toUpperCase())
  return label.replace(/\b(Rc|Tin|Vat|Cac|Api|Pos)\b/g, (m) => m.toUpperCase())
}

function dataUrlFileName(key: string, dataUrl: string): string {
  const mime = dataUrl.slice(5, dataUrl.indexOf(";"))
  const ext = mime.split("/")[1]?.replace("jpeg", "jpg") || "bin"
  return `${key}.${ext}`
}

function formatResponseValue(value: unknown): string {
  if (typeof value === "string" && value.startsWith("data:")) return "[uploaded file]"
  if (Array.isArray(value)) {
    return value
      .map((item) =>
        item && typeof item === "object"
          ? Object.values(item).filter(Boolean).join(" — ")
          : String(item)
      )
      .join("\n")
  }
  if (value && typeof value === "object") {
    return Object.entries(value)
      .map(([k, v]) => `${humanizeKey(k)}: ${String(v)}`)
      .join("\n")
  }
  return String(value ?? "")
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
