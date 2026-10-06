"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { businessTypeOptions, industryOptions, resolveIndustryName } from "@/lib/industries"
import type { StoredEstimate } from "@/lib/estimate-calculator"
import {
  X,
  Mail,
  Phone,
  Building2,
  Calendar,
  Pencil,
  Trash2,
  Rocket,
  FileText,
  CheckCircle2,
  Loader2,
  MessageSquare,
  ClipboardList,
  MessageSquarePlus,
  Plus,
  ExternalLink,
  Copy,
  User,
  Tag,
  Layers,
  GitBranch,
  Users,
  ShoppingBag,
  Clock,
  Wallet,
  TrendingUp,
  Smartphone,
  Globe,
  ArrowUpRight,
  Video,
  Search,
} from "lucide-react"

export interface Lead {
  id: string
  fullName: string
  businessName: string
  email: string
  phone: string
  businessType: string
  industry?: string
  productInterest: string
  branches: string
  staffSize: string
  challenge?: string
  estimate?: StoredEstimate | null
  message?: string
  source: string
  status: "New" | "Contacted" | "Qualified" | "Proposal" | "Won" | "Lost"
  assignedTo?: string
  notes?: string
  questionnaireToken?: string | null
  questionnaireStatus?: string
  questionnaireSentAt?: string | null
  questionnaireSubmittedAt?: string | null
  businessId?: string | null
  submittedAt: string
  updatedAt: string
}

export interface QuestionnaireField {
  name: string
  label: string
  type: string
  options?: string[]
  optionStatuses?: Record<string, string>
  required?: boolean
  default?: string | number | boolean
  helpText?: string
  selected?: boolean
}

interface QuestionRound {
  id: string
  token: string
  title: string
  status: "Sent" | "Submitted" | "Reviewed"
  fields: QuestionnaireField[]
  responses: Record<string, unknown>
  sentAt: string | null
  submittedAt: string | null
  reviewedAt: string | null
  createdAt: string | null
}

type Tab = "overview" | "edit" | "notes" | "email" | "questionnaire" | "additional" | "meeting" | "actions"

interface LeadEmailMessage {
  id: string
  direction: "inbound" | "outbound"
  fromEmail: string | null
  toEmail: string | null
  subject: string | null
  bodyText: string | null
  bodyHtml: string | null
  status: string
  createdAt: string
}

interface Meeting {
  id: string
  customerToken: string
  title: string
  scheduledAt: string | null
  durationMinutes: number
  timezone: string
  meetingLink: string | null
  provider: string | null
  status: "PENDING" | "SCHEDULED" | "COMPLETED" | "CANCELLED" | "NO_SHOW"
  proposedSlots: string[] | null
  leadTimezone: string | null
  inviteSentAt: string | null
  expiresAt: string | null
  googleEventId: string | null
  notes: string | null
  summary: string | null
  actionItems: string[] | null
  transcript: string | null
  transcriptUrl: string | null
  recordingUrl: string | null
  notesProvider: string | null
  summarySentAt: string | null
}

const MEETING_STATUS_COLORS: Record<Meeting["status"], string> = {
  PENDING: "bg-amber-50 text-amber-700",
  SCHEDULED: "bg-blue-50 text-blue-700",
  COMPLETED: "bg-green-50 text-green-700",
  CANCELLED: "bg-red-50 text-red-700",
  NO_SHOW: "bg-gray-100 text-gray-700",
}

const PIPELINE_STAGES: Lead["status"][] = ["New", "Contacted", "Qualified", "Proposal", "Won", "Lost"]

const STAGE_COLORS: Record<string, string> = {
  New: "bg-info",
  Contacted: "bg-warning",
  Qualified: "bg-retail",
  Proposal: "bg-proposal",
  Won: "bg-success",
  Lost: "bg-destructive",
}

const BUSINESS_TYPES = businessTypeOptions

const inputClass =
  "w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-retail/30 focus:border-retail"

const labelClass = "block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5"

interface LeadDetailModalProps {
  lead: Lead
  onClose: () => void
  onUpdateStatus: (id: string, status: Lead["status"]) => Promise<void>
  onSaveNotes: (id: string, notes: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onUpdateLead: (id: string, data: Record<string, unknown>) => Promise<Lead | null>
  onConvertToBusiness: (lead: Lead) => Promise<void>
  onCreateQuote: (lead: Lead) => void
  onOpenQuestionnaire: (lead: Lead) => Promise<void>
  onMarkQuestionnaireReviewed: (lead: Lead) => Promise<void>
}

export function LeadDetailModal({
  lead,
  onClose,
  onUpdateStatus,
  onSaveNotes,
  onDelete,
  onUpdateLead,
  onConvertToBusiness,
  onCreateQuote,
  onOpenQuestionnaire,
  onMarkQuestionnaireReviewed,
}: LeadDetailModalProps) {
  const [tab, setTab] = useState<Tab>("overview")
  const [noteDraft, setNoteDraft] = useState(lead.notes || "")
  const [savingNotes, setSavingNotes] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    fullName: lead.fullName,
    businessName: lead.businessName,
    email: lead.email,
    phone: lead.phone,
    businessType: lead.businessType,
    industry: lead.industry || resolveIndustryName(lead.businessType) || "",
    productInterest: lead.productInterest,
    branches: lead.branches,
    staffSize: lead.staffSize,
    challenge: lead.challenge || "",
    message: lead.message || "",
    source: lead.source,
    status: lead.status,
    notes: lead.notes || "",
  })
  const [converting, setConverting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [questionnaireLoading, setQuestionnaireLoading] = useState(false)
  const [questionnaireData, setQuestionnaireData] = useState<{ fields: QuestionnaireField[]; responses: Record<string, unknown> } | null>(null)
  const [questionRounds, setQuestionRounds] = useState<QuestionRound[]>([])
  const [roundsLoading, setRoundsLoading] = useState(false)
  const [roundFields, setRoundFields] = useState<QuestionnaireField[]>([])
  const [roundDraft, setRoundDraft] = useState({ label: "", type: "text", options: "", required: false })
  const [showRoundComposer, setShowRoundComposer] = useState(false)
  const [sendingRound, setSendingRound] = useState(false)
  const [roundUrl, setRoundUrl] = useState<string | null>(null)
  const [roundMessage, setRoundMessage] = useState("")
  const [copiedRoundToken, setCopiedRoundToken] = useState<string | null>(null)
  const [copiedRoundUrl, setCopiedRoundUrl] = useState(false)
  const [reviewingRoundId, setReviewingRoundId] = useState<string | null>(null)
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [meetingLoading, setMeetingLoading] = useState(false)
  const [emails, setEmails] = useState<LeadEmailMessage[]>([])
  const [emailsLoading, setEmailsLoading] = useState(false)
  const [emailsError, setEmailsError] = useState("")
  const [emailForm, setEmailForm] = useState({ subject: "", body: "" })
  const [sendingEmail, setSendingEmail] = useState(false)
  const [copiedEmailId, setCopiedEmailId] = useState<string | null>(null)
  const [meetingMode, setMeetingMode] = useState<"invite" | "direct">("invite")
  const [meetingForm, setMeetingForm] = useState({
    title: "MartPoint Demo",
    scheduledAt: "",
    durationMinutes: 30,
    timezone: "Africa/Lagos",
    meetingLink: "",
    provider: "",
    notes: "",
    createMeet: true,
    expiresInDays: 7,
  })
  const [proposedSlots, setProposedSlots] = useState<string[]>([])
  const [newSlot, setNewSlot] = useState("")
  const [googleConnected, setGoogleConnected] = useState(false)
  const [meetingMessage, setMeetingMessage] = useState("")
  const [meetingActionId, setMeetingActionId] = useState<string | null>(null)
  const [notesOpenId, setNotesOpenId] = useState<string | null>(null)
  const [notesDraft, setNotesDraft] = useState({ summary: "", actionItems: "", transcriptUrl: "", recordingUrl: "" })

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handler)
    document.body.style.overflow = "hidden"
    return () => {
      window.removeEventListener("keydown", handler)
      document.body.style.overflow = ""
    }
  }, [onClose])

  useEffect(() => {
    if (tab !== "meeting") return
    let cancelled = false
    fetch(`/api/admin/leads/${lead.id}/meetings`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return
        setMeetings(data.meetings || [])
        setGoogleConnected(Boolean(data.googleConnected))
      })
      .catch(() => {
        if (!cancelled) setMeetings([])
      })
    return () => { cancelled = true }
  }, [tab, lead.id])

  useEffect(() => {
    if (tab !== "email") return
    let cancelled = false
    fetch(`/api/admin/leads/${lead.id}/emails`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return
        if (data.error) {
          setEmailsError(data.detail ? `${data.error} — ${data.detail}` : data.error)
          setEmails([])
        } else {
          setEmails(data.emails || [])
        }
      })
      .catch(() => {
        if (!cancelled) setEmailsError("Failed to load email thread")
      })
      .finally(() => {
        if (!cancelled) setEmailsLoading(false)
      })
    return () => { cancelled = true }
  }, [tab, lead.id])

  useEffect(() => {
    if (tab !== "questionnaire") return
    let cancelled = false
    fetch(`/api/admin/leads/${lead.id}/questionnaire`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data.fields && data.responses) {
          setQuestionnaireData({ fields: data.fields, responses: data.responses })
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [tab, lead.id])

  useEffect(() => {
    if (tab !== "additional") return
    let cancelled = false
    fetch(`/api/admin/leads/${lead.id}/questions`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return
        if (data.error) {
          setRoundMessage(data.error)
          setQuestionRounds([])
        } else {
          setQuestionRounds(data.rounds || [])
        }
      })
      .catch(() => {
        if (!cancelled) setRoundMessage("Failed to load additional questions")
      })
      .finally(() => {
        if (!cancelled) setRoundsLoading(false)
      })
    return () => { cancelled = true }
  }, [tab, lead.id])

  const handleSaveNotes = async () => {
    setSavingNotes(true)
    await onSaveNotes(lead.id, noteDraft)
    setSavingNotes(false)
  }

  const handleSaveEdit = async () => {
    setEditing(true)
    const updated = await onUpdateLead(lead.id, editForm)
    if (updated) {
      setEditForm({
        fullName: updated.fullName,
        businessName: updated.businessName,
        email: updated.email,
        phone: updated.phone,
        businessType: updated.businessType,
        industry: updated.industry || resolveIndustryName(updated.businessType) || "",
        productInterest: updated.productInterest,
        branches: updated.branches,
        staffSize: updated.staffSize,
        challenge: updated.challenge || "",
        message: updated.message || "",
        source: updated.source,
        status: updated.status,
        notes: updated.notes || "",
      })
    }
    setEditing(false)
  }

  const handleDelete = async () => {
    if (!confirm("Delete this lead permanently? This cannot be undone.")) return
    setDeleting(true)
    await onDelete(lead.id)
    setDeleting(false)
  }

  const handleConvert = async () => {
    setConverting(true)
    await onConvertToBusiness(lead)
    setConverting(false)
  }

  const handleQuestionnaire = async () => {
    setQuestionnaireLoading(true)
    await onOpenQuestionnaire(lead)
    setQuestionnaireLoading(false)
  }

  const handleReview = async () => {
    setQuestionnaireLoading(true)
    await onMarkQuestionnaireReviewed(lead)
    setQuestionnaireLoading(false)
  }

  const refreshQuestionRounds = async () => {
    const res = await fetch(`/api/admin/leads/${lead.id}/questions`)
    const data = await res.json()
    setQuestionRounds(data.rounds || [])
  }

  const addRoundQuestion = () => {
    const label = roundDraft.label.trim()
    if (!label) return
    const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "question"
    let name = `q_${slug}`
    let i = 2
    while (roundFields.some((f) => f.name === name)) name = `q_${slug}_${i++}`
    const options = roundDraft.options.split(",").map((s) => s.trim()).filter(Boolean)
    setRoundFields((prev) => [
      ...prev,
      {
        name,
        label,
        type: roundDraft.type,
        options: roundDraft.type === "select" || roundDraft.type === "multiselect" ? options : undefined,
        required: roundDraft.required,
      },
    ])
    setRoundDraft({ label: "", type: "text", options: "", required: false })
    setShowRoundComposer(false)
  }

  const sendRoundQuestions = async () => {
    if (roundFields.length === 0) return
    setSendingRound(true)
    setRoundMessage("")
    try {
      const res = await fetch(`/api/admin/leads/${lead.id}/questions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ send: true, fields: roundFields }),
      })
      const data = await res.json()
      if (data.token && data.url) {
        setRoundUrl(data.url)
        setRoundFields([])
        setRoundMessage("Additional questions sent — copy the link below if you want to share it directly.")
        await refreshQuestionRounds()
      } else {
        setRoundMessage(data.error || "Failed to send additional questions")
      }
    } catch {
      setRoundMessage("Failed to send additional questions")
    } finally {
      setSendingRound(false)
    }
  }

  const reviewRound = async (roundId: string) => {
    setReviewingRoundId(roundId)
    setRoundMessage("")
    try {
      const res = await fetch(`/api/admin/leads/${lead.id}/questions`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roundId }),
      })
      const data = await res.json()
      if (!data.success) setRoundMessage(data.error || "Failed to mark round reviewed")
      await refreshQuestionRounds()
    } catch {
      setRoundMessage("Failed to mark round reviewed")
    } finally {
      setReviewingRoundId(null)
    }
  }

  const copyRoundLink = (token: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/questions/${token}`).then(() => {
      setCopiedRoundToken(token)
      setTimeout(() => setCopiedRoundToken(null), 2000)
    })
  }

  const handleScheduleMeeting = async () => {
    if (meetingMode === "direct" && !meetingForm.scheduledAt) return
    setMeetingLoading(true)
    setMeetingMessage("")
    try {
      const common = {
        title: meetingForm.title,
        durationMinutes: Number(meetingForm.durationMinutes) || 30,
        timezone: meetingForm.timezone,
        notes: meetingForm.notes,
      }
      const payload =
        meetingMode === "invite"
          ? {
              mode: "invite",
              ...common,
              proposedSlots: proposedSlots.map((s) => new Date(s).toISOString()),
              expiresInDays: Number(meetingForm.expiresInDays) || 7,
            }
          : {
              mode: "direct",
              ...common,
              scheduledAt: new Date(meetingForm.scheduledAt).toISOString(),
              meetingLink: meetingForm.meetingLink,
              provider: meetingForm.meetingLink ? meetingForm.provider : "",
              createMeet: meetingForm.createMeet && !meetingForm.meetingLink,
            }
      const res = await fetch(`/api/admin/leads/${lead.id}/meetings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (data.success && data.meeting) {
        setMeetings((prev) => [data.meeting, ...prev])
        setMeetingForm((p) => ({ ...p, scheduledAt: "", meetingLink: "", provider: "", notes: "" }))
        setProposedSlots([])
        if (meetingMode === "invite") {
          setMeetingMessage(data.emailSent ? "Invitation sent — the lead can now pick a time." : "Invitation created, but the email could not be sent. Copy the link below and share it manually.")
        } else if (data.meetError) {
          setMeetingMessage(`Meeting saved. Google Meet: ${data.meetError}`)
        } else {
          setMeetingMessage(data.meeting.meetingLink ? "Meeting scheduled with a Google Meet link." : "Meeting scheduled.")
        }
      } else {
        setMeetingMessage(data.error || "Failed to schedule meeting")
      }
    } catch {
      setMeetingMessage("Failed to schedule meeting")
    } finally {
      setMeetingLoading(false)
    }
  }

  const handleMeetingAction = async (m: Meeting, action: "cancel" | "resend_invite" | "set_status" | "email_summary", status?: Meeting["status"]) => {
    if (action === "cancel" && !confirm("Cancel this meeting? The lead's calendar invite will be removed.")) return
    setMeetingActionId(m.id)
    setMeetingMessage("")
    try {
      const res = await fetch(`/api/admin/leads/${lead.id}/meetings/${m.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, status }),
      })
      const data = await res.json()
      if (data.success && data.meeting) {
        setMeetings((prev) => prev.map((x) => (x.id === m.id ? data.meeting : x)))
        if (action === "resend_invite") setMeetingMessage(data.emailSent ? "Invitation re-sent." : "Could not send the invitation email.")
        if (action === "email_summary") setMeetingMessage(data.emailSent ? "Summary sent to the lead." : "Could not send the summary email.")
      } else {
        setMeetingMessage(data.error || "Action failed")
      }
    } catch {
      setMeetingMessage("Action failed")
    } finally {
      setMeetingActionId(null)
    }
  }

  const toggleNotesEditor = (m: Meeting) => {
    if (notesOpenId === m.id) {
      setNotesOpenId(null)
      return
    }
    setNotesDraft({
      summary: m.summary ?? "",
      actionItems: (m.actionItems ?? []).join("\n"),
      transcriptUrl: m.transcriptUrl ?? "",
      recordingUrl: m.recordingUrl ?? "",
    })
    setNotesOpenId(m.id)
  }

  const saveMeetingNotes = async (m: Meeting) => {
    setMeetingActionId(m.id)
    setMeetingMessage("")
    try {
      const res = await fetch(`/api/admin/leads/${lead.id}/meetings/${m.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "save_notes",
          summary: notesDraft.summary.trim() || null,
          actionItems: notesDraft.actionItems.split(/\r?\n/).map((l) => l.trim()).filter(Boolean),
          transcriptUrl: notesDraft.transcriptUrl.trim() || null,
          recordingUrl: notesDraft.recordingUrl.trim() || null,
        }),
      })
      const data = await res.json()
      if (data.success && data.meeting) {
        setMeetings((prev) => prev.map((x) => (x.id === m.id ? data.meeting : x)))
        setNotesOpenId(null)
        setMeetingMessage("Notes saved.")
      } else {
        setMeetingMessage(data.error || "Failed to save notes")
      }
    } catch {
      setMeetingMessage("Failed to save notes")
    } finally {
      setMeetingActionId(null)
    }
  }

  const addProposedSlot = () => {
    if (!newSlot || Number.isNaN(new Date(newSlot).getTime())) return
    setProposedSlots((prev) => (prev.includes(newSlot) ? prev : [...prev, newSlot].sort()))
    setNewSlot("")
  }

  const copyMeetingLink = (token: string) => {
    const url = `${window.location.origin}/meeting/${token}`
    navigator.clipboard.writeText(url)
  }

  const handleSendEmail = async () => {
    if (!emailForm.subject.trim() || !emailForm.body.trim()) return
    setSendingEmail(true)
    setEmailsError("")
    try {
      const res = await fetch(`/api/admin/leads/${lead.id}/emails`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: emailForm.subject.trim(), body: emailForm.body }),
      })
      const data = await res.json()
      if (data.email) {
        setEmails((prev) => [...prev, data.email])
        setEmailForm({ subject: "", body: "" })
        if (!data.sent) setEmailsError("Email saved to thread but delivery failed — check email settings.")
      } else {
        setEmailsError(data.error || "Failed to send email")
      }
    } catch {
      setEmailsError("Failed to send email")
    } finally {
      setSendingEmail(false)
    }
  }

  const copyEmailBody = (msg: LeadEmailMessage) => {
    const text = msg.bodyText || msg.subject || ""
    if (!text) return
    navigator.clipboard.writeText(text).then(() => {
      setCopiedEmailId(msg.id)
      setTimeout(() => setCopiedEmailId(null), 2000)
    })
  }

  const productLabel =
    lead.productInterest === "retail"
      ? "MartPoint Retail"
      : lead.productInterest === "erp"
      ? "MartPoint ERP"
      : "Not Sure"

  const { sourceLabel, sourcePartner } = formatSource(lead.source)

  const estimate =
    normalizeEstimate(lead.estimate) ??
    (lead.source.includes("estimate") ? parseEstimate(lead.challenge) : null)

  const selectTab = (t: Tab) => {
    setTab(t)
    if (t === "email") {
      setEmailsLoading(true)
      setEmailsError("")
    }
    if (t === "questionnaire") {
      setQuestionnaireData(null)
    }
    if (t === "additional") {
      setRoundsLoading(true)
      setRoundMessage("")
    }
  }

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "overview", label: "Overview", icon: <User className="w-3.5 h-3.5" /> },
    { id: "edit", label: "Edit", icon: <Pencil className="w-3.5 h-3.5" /> },
    { id: "notes", label: "Notes", icon: <MessageSquare className="w-3.5 h-3.5" /> },
    { id: "email", label: "Email", icon: <Mail className="w-3.5 h-3.5" /> },
    { id: "questionnaire", label: "Questionnaire", icon: <ClipboardList className="w-3.5 h-3.5" /> },
    { id: "additional", label: "Additional Questions", icon: <MessageSquarePlus className="w-3.5 h-3.5" /> },
    { id: "meeting", label: "Meeting", icon: <Video className="w-3.5 h-3.5" /> },
    { id: "actions", label: "Actions", icon: <Rocket className="w-3.5 h-3.5" /> },
  ]

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-5xl max-h-[92vh] flex flex-col rounded-2xl border border-border bg-background shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ─── Header ─── */}
        <div className="shrink-0 border-b border-border bg-gradient-to-r from-background to-muted/40">
          <div className="px-6 pt-6 pb-4">
            {/* Top row: name + status + close */}
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-2xl font-bold tracking-tight text-foreground truncate">
                  {lead.fullName}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {lead.email}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span
                  className={`inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full text-white ${STAGE_COLORS[lead.status]}`}
                >
                  {lead.status}
                </span>
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  title="Close (Esc)"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Contact / source strip */}
          <div className="px-6 pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6">
              <span
                className="inline-flex items-center gap-1.5 self-start text-[11px] font-semibold uppercase tracking-wider px-3 py-1.5 rounded-full border border-border bg-background"
                title="Lead source"
              >
                {sourceIcon(lead.source)}
                {sourceLabel}
                {sourcePartner && (
                  <span className="ml-1 text-proposal">· {sourcePartner}</span>
                )}
              </span>

              <div className="h-px sm:h-4 sm:w-px bg-border sm:block" />

              <a
                href={`mailto:${lead.email}`}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-retail transition-colors"
              >
                <Mail className="w-3.5 h-3.5" />
                <span className="truncate">{lead.email}</span>
              </a>
              <a
                href={`tel:${lead.phone}`}
                className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-retail transition-colors"
              >
                <Phone className="w-3.5 h-3.5" />
                <span className="truncate">{lead.phone}</span>
              </a>
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Calendar className="w-3.5 h-3.5" />
                <span>{new Date(lead.submittedAt).toLocaleDateString()}</span>
              </span>
            </div>
          </div>

          {/* ─── Tabs ─── */}
          <div className="flex items-center gap-1 px-6 overflow-x-auto border-t border-border/60">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => selectTab(t.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                  tab === t.id
                    ? "border-retail text-retail"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40"
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* ─── Body ─── */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* ─── Overview ─── */}
          {tab === "overview" && (
            <div className="space-y-6">
              {estimate && (
                <div className="rounded-xl border border-retail/20 bg-retail-soft/40 p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Wallet className="w-4 h-4 text-retail" />
                    <p className="text-sm font-bold text-foreground">Cost Estimate</p>
                    <span className="ml-auto text-[10px] uppercase tracking-wider text-muted-foreground">From calculator</span>
                  </div>
                  <div className={`grid grid-cols-1 gap-4 ${estimate.erpPlan ? "sm:grid-cols-2" : ""}`}>
                    <div className="rounded-lg border border-retail/10 bg-background p-4">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Retail Recommendation</p>
                      <p className="text-sm font-semibold text-foreground">{estimate.retailPlan}</p>
                      <p className="text-xl font-extrabold text-retail mt-1">{estimate.retailRange}</p>
                      {estimate.retailTier && (
                        <p className="mt-1 text-[11px] text-muted-foreground">License tier: {estimate.retailTier}</p>
                      )}
                      {estimate.retailRationale && (
                        <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{estimate.retailRationale}</p>
                      )}
                      {estimate.retailInclusions && estimate.retailInclusions.length > 0 && (
                        <ul className="mt-2 space-y-1">
                          {estimate.retailInclusions.map((inc) => (
                            <li key={inc} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                              <CheckCircle2 className="w-3 h-3 mt-0.5 shrink-0 text-retail" />
                              {inc}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    {estimate.erpPlan && (
                      <div className="rounded-lg border border-erp/10 bg-background p-4">
                        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">ERP Recommendation</p>
                        <p className="text-sm font-semibold text-foreground">{estimate.erpPlan}</p>
                        <p className="text-xl font-extrabold text-erp mt-1">{estimate.erpRange}</p>
                        {estimate.erpTier && (
                          <p className="mt-1 text-[11px] text-muted-foreground">License tier: {estimate.erpTier}</p>
                        )}
                        {estimate.erpRationale && (
                          <p className="mt-2 text-xs text-muted-foreground leading-relaxed">{estimate.erpRationale}</p>
                        )}
                        {estimate.erpInclusions && estimate.erpInclusions.length > 0 && (
                          <ul className="mt-2 space-y-1">
                            {estimate.erpInclusions.map((inc) => (
                              <li key={inc} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                                <CheckCircle2 className="w-3 h-3 mt-0.5 shrink-0 text-erp" />
                                {inc}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <InfoCard icon={<Building2 className="w-4 h-4" />} label="Business Name" value={lead.businessName} />
                <InfoCard icon={<Tag className="w-4 h-4" />} label="Business Type" value={lead.businessType || "—"} />
                <InfoCard icon={<Layers className="w-4 h-4" />} label="Industry" value={lead.industry || resolveIndustryName(lead.businessType) || "—"} />
                <InfoCard icon={<ShoppingBag className="w-4 h-4" />} label="Product Interest" value={productLabel} />
                <InfoCard icon={<GitBranch className="w-4 h-4" />} label="Branches" value={lead.branches} />
                <InfoCard icon={<Users className="w-4 h-4" />} label="Staff Size" value={lead.staffSize} />
                <InfoCard icon={<Calendar className="w-4 h-4" />} label="Submitted" value={new Date(lead.submittedAt).toLocaleString()} />
              </div>

              {lead.challenge && !lead.challenge.startsWith("Estimate —") && (
                <div>
                  <p className={labelClass}>Challenge / Pain Point</p>
                  <div className="rounded-lg border border-border bg-muted/20 p-4 text-sm text-foreground leading-relaxed">
                    {lead.challenge}
                  </div>
                </div>
              )}
              {lead.message && (
                <div>
                  <p className={labelClass}>Message</p>
                  <div className="rounded-lg border border-border bg-muted/20 p-4 text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                    {lead.message}
                  </div>
                </div>
              )}
              {lead.notes && (
                <div>
                  <p className={labelClass}>Existing Notes</p>
                  <div className="rounded-lg border border-border bg-muted/20 p-4 text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                    {lead.notes}
                  </div>
                </div>
              )}

              {/* Pipeline status selector */}
              <div>
                <p className={labelClass}>Pipeline Status</p>
                <div className="flex flex-wrap gap-2">
                  {PIPELINE_STAGES.map((s) => (
                    <button
                      key={s}
                      onClick={() => onUpdateStatus(lead.id, s)}
                      className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-all ${
                        lead.status === s
                          ? `${STAGE_COLORS[s]} text-white border-transparent shadow-sm`
                          : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ─── Edit ─── */}
          {tab === "edit" && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Full Name *</label>
                  <input
                    type="text"
                    value={editForm.fullName}
                    onChange={(e) => setEditForm((p) => ({ ...p, fullName: e.target.value }))}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Business Name *</label>
                  <input
                    type="text"
                    value={editForm.businessName}
                    onChange={(e) => setEditForm((p) => ({ ...p, businessName: e.target.value }))}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Email *</label>
                  <input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Phone *</label>
                  <input
                    type="tel"
                    value={editForm.phone}
                    onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Business Type *</label>
                  <select
                    value={editForm.businessType}
                    onChange={(e) =>
                      setEditForm((p) => ({
                        ...p,
                        businessType: e.target.value,
                        industry: resolveIndustryName(e.target.value) || p.industry,
                      }))
                    }
                    className={inputClass}
                  >
                    <option value="">Select...</option>
                    {BUSINESS_TYPES.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Industry</label>
                  <select
                    value={editForm.industry}
                    onChange={(e) => setEditForm((p) => ({ ...p, industry: e.target.value }))}
                    className={inputClass}
                  >
                    <option value="">Unspecified</option>
                    {industryOptions.map((i) => (
                      <option key={i} value={i}>{i}</option>
                    ))}
                    {editForm.industry && !industryOptions.includes(editForm.industry) && (
                      <option value={editForm.industry}>{editForm.industry}</option>
                    )}
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Product Interest *</label>
                  <select
                    value={editForm.productInterest}
                    onChange={(e) => setEditForm((p) => ({ ...p, productInterest: e.target.value }))}
                    className={inputClass}
                  >
                    <option value="retail">MartPoint Retail</option>
                    <option value="erp">MartPoint ERP</option>
                    <option value="not-sure">Not Sure — Need Guidance</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Branches *</label>
                  <select
                    value={editForm.branches}
                    onChange={(e) => setEditForm((p) => ({ ...p, branches: e.target.value }))}
                    className={inputClass}
                  >
                    <option value="1">1</option>
                    <option value="2-3">2-3</option>
                    <option value="4-6">4-6</option>
                    <option value="7-10">7-10</option>
                    <option value="10+">10+</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Staff Size *</label>
                  <select
                    value={editForm.staffSize}
                    onChange={(e) => setEditForm((p) => ({ ...p, staffSize: e.target.value }))}
                    className={inputClass}
                  >
                    <option value="1-5">1-5</option>
                    <option value="6-15">6-15</option>
                    <option value="16-30">16-30</option>
                    <option value="31-50">31-50</option>
                    <option value="50+">50+</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Source *</label>
                  <select
                    value={editForm.source}
                    onChange={(e) => setEditForm((p) => ({ ...p, source: e.target.value }))}
                    className={inputClass}
                  >
                    <option value="manual">Manual Entry</option>
                    <option value="website">Website</option>
                    <option value="google-search">Google Search</option>
                    <option value="whatsapp">WhatsApp</option>
                    <option value="referral">Referral</option>
                    <option value="social-media">Social Media</option>
                    <option value="cold-call">Cold Call</option>
                    <option value="email">Email</option>
                    <option value="event">Event</option>
                    <option value="estimate-calculator">Estimate Calculator</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className={labelClass}>Status</label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm((p) => ({ ...p, status: e.target.value as Lead["status"] }))}
                    className={inputClass}
                  >
                    {PIPELINE_STAGES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className={labelClass}>Challenge / Pain Point</label>
                <input
                  type="text"
                  value={editForm.challenge}
                  onChange={(e) => setEditForm((p) => ({ ...p, challenge: e.target.value }))}
                  className={inputClass}
                  placeholder="What problem are they trying to solve?"
                />
              </div>
              <div>
                <label className={labelClass}>Message</label>
                <textarea
                  rows={3}
                  value={editForm.message}
                  onChange={(e) => setEditForm((p) => ({ ...p, message: e.target.value }))}
                  className={`${inputClass} resize-none`}
                  placeholder="Additional context from the lead..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-2 border-t border-border">
                <Button variant="outline" size="sm" onClick={() => setTab("overview")} disabled={editing}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSaveEdit} disabled={editing}>
                  {editing ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <CheckCircle2 className="w-4 h-4 mr-1.5" />}
                  Save Changes
                </Button>
              </div>
            </div>
          )}

          {/* ─── Notes ─── */}
          {tab === "notes" && (
            <div className="space-y-4">
              <div>
                <label className={labelClass}>Internal Notes</label>
                <textarea
                  rows={10}
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  className={`${inputClass} resize-y`}
                  placeholder="Add internal notes about this lead — call summaries, next steps, context for the team..."
                />
              </div>
              <div className="flex justify-end">
                <Button size="sm" onClick={handleSaveNotes} disabled={savingNotes}>
                  {savingNotes ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <CheckCircle2 className="w-4 h-4 mr-1.5" />}
                  Save Notes
                </Button>
              </div>
              {lead.notes && (
                <div>
                  <p className={labelClass}>Previous Notes (saved in DB)</p>
                  <div className="rounded-lg border border-border bg-muted/20 p-4 text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                    {lead.notes}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─── Email ─── */}
          {tab === "email" && (
            <div className="space-y-5">
              <div className="rounded-lg border border-border bg-muted/20 p-3 flex items-center gap-2 text-xs text-muted-foreground">
                <Mail className="w-3.5 h-3.5 shrink-0" />
                <span>
                  Two-way thread with <span className="font-medium text-foreground">{lead.email}</span>.
                  Replies from the lead appear here once inbound email is connected.
                </span>
              </div>

              {emailsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : emails.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No emails in this thread yet.</p>
              ) : (
                <div className="space-y-3">
                  {emails.map((msg) => (
                    <div
                      key={msg.id}
                      className={`rounded-lg border p-4 space-y-2 ${
                        msg.direction === "outbound"
                          ? "border-retail/20 bg-retail-soft/30 ml-8"
                          : "border-border bg-muted/20 mr-8"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate">{msg.subject || "(no subject)"}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {msg.direction === "outbound" ? "You" : msg.fromEmail || "Lead"} → {msg.direction === "outbound" ? msg.toEmail : "you"}
                            {" "}· {new Date(msg.createdAt).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium ${
                              msg.direction === "outbound"
                                ? msg.status === "failed"
                                  ? "bg-red-100 text-red-700"
                                  : "bg-blue-100 text-blue-700"
                                : "bg-emerald-100 text-emerald-700"
                            }`}
                          >
                            {msg.direction === "outbound" ? (msg.status === "failed" ? "Failed" : "Sent") : "Received"}
                          </span>
                          {(msg.bodyText || msg.subject) && (
                            <button
                              type="button"
                              onClick={() => copyEmailBody(msg)}
                              className="text-muted-foreground hover:text-foreground p-1"
                              title="Copy message body"
                            >
                              {copiedEmailId === msg.id ? <CheckCircle2 className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          )}
                        </div>
                      </div>
                      {msg.bodyText && (
                        <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{msg.bodyText}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {emailsError && (
                <p className="text-sm text-destructive">{emailsError}</p>
              )}

              <div className="rounded-lg border border-border p-4 space-y-3">
                <p className={labelClass}>New message</p>
                <input
                  type="text"
                  value={emailForm.subject}
                  onChange={(e) => setEmailForm((p) => ({ ...p, subject: e.target.value }))}
                  placeholder={`Subject — e.g. Re: MartPoint for ${lead.businessName}`}
                  className={inputClass}
                />
                <textarea
                  rows={5}
                  value={emailForm.body}
                  onChange={(e) => setEmailForm((p) => ({ ...p, body: e.target.value }))}
                  placeholder={`Write your reply to ${lead.fullName}...`}
                  className={`${inputClass} resize-y`}
                />
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] text-muted-foreground">Sent to {lead.email}</p>
                  <Button
                    size="sm"
                    onClick={handleSendEmail}
                    disabled={sendingEmail || !emailForm.subject.trim() || !emailForm.body.trim()}
                  >
                    {sendingEmail ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Mail className="w-4 h-4 mr-1.5" />}
                    Send Email
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ─── Questionnaire ─── */}
          {tab === "questionnaire" && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-lg border border-border bg-muted/20 p-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Status</p>
                  <p className="text-sm font-semibold">{lead.questionnaireStatus || "Not Sent"}</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/20 p-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Sent At</p>
                  <p className="text-sm font-semibold">
                    {lead.questionnaireSentAt ? new Date(lead.questionnaireSentAt).toLocaleString() : "—"}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-muted/20 p-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Submitted At</p>
                  <p className="text-sm font-semibold">
                    {lead.questionnaireSubmittedAt ? new Date(lead.questionnaireSubmittedAt).toLocaleString() : "—"}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-muted/20 p-4">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Token</p>
                  <p className="text-sm font-mono truncate" title={lead.questionnaireToken || ""}>
                    {lead.questionnaireToken ? lead.questionnaireToken.slice(0, 12) + "…" : "—"}
                  </p>
                </div>
              </div>

              {lead.questionnaireToken && (
                <div className="rounded-lg border border-border bg-muted/20 p-4">
                  <p className="text-xs font-semibold text-muted-foreground mb-2">Questionnaire Link</p>
                  <div className="flex items-center gap-2">
                    <input
                      readOnly
                      value={`${typeof window !== "undefined" ? window.location.origin : ""}/questionnaire/${lead.questionnaireToken}`}
                      className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-xs font-mono"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const url = `${window.location.origin}/questionnaire/${lead.questionnaireToken}`
                        navigator.clipboard.writeText(url)
                      }}
                    >
                      <Copy className="w-3.5 h-3.5 mr-1" />
                      Copy
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(`/questionnaire/${lead.questionnaireToken}`, "_blank")}
                    >
                      <ExternalLink className="w-3.5 h-3.5 mr-1" />
                      Open
                    </Button>
                  </div>
                </div>
              )}

              {(lead.questionnaireStatus === "Submitted" || lead.questionnaireStatus === "Reviewed") && questionnaireData && Object.keys(questionnaireData.responses).length > 0 && (
                <div className="space-y-3 pt-2 border-t border-border">
                  <p className={labelClass}>Submitted Responses</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {questionnaireData.fields.filter((f) => f.type !== "section").map((field) => (
                      <div key={field.name} className="rounded-lg border border-border bg-muted/20 p-4">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                          {field.label}
                        </p>
                        <p className="text-sm text-foreground whitespace-pre-wrap">
                          {questionnaireData.responses[field.name] !== undefined
                            ? Array.isArray(questionnaireData.responses[field.name])
                              ? (questionnaireData.responses[field.name] as string[]).join(", ")
                              : String(questionnaireData.responses[field.name])
                            : "—"}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-3 pt-2 border-t border-border">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleQuestionnaire}
                  disabled={questionnaireLoading}
                >
                  {questionnaireLoading ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <ClipboardList className="w-4 h-4 mr-1.5" />}
                  {lead.questionnaireToken ? "Resend Questionnaire" : "Send Questionnaire"}
                </Button>
                {lead.questionnaireStatus === "Submitted" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleReview}
                    disabled={questionnaireLoading}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-1.5" />
                    Mark Reviewed
                  </Button>
                )}
                {(lead.questionnaireStatus === "Submitted" || lead.questionnaireStatus === "Reviewed") && (
                  <Button
                    size="sm"
                    variant="retail"
                    onClick={() => onCreateQuote(lead)}
                  >
                    <FileText className="w-4 h-4 mr-1.5" />
                    Create Quote
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* ─── Additional Questions ─── */}
          {tab === "additional" && (
            <div className="space-y-5">
              <p className="text-sm text-muted-foreground">
                Send a short follow-up round when you need more details from this lead. They answer only these questions —
                the original requirements questionnaire stays as submitted. Every round is kept below for documentation.
              </p>

              <div className="rounded-lg border border-border p-4 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">New Questions</p>

                {roundFields.length > 0 && (
                  <ul className="space-y-1.5">
                    {roundFields.map((f) => (
                      <li key={f.name} className="flex items-center gap-2 text-sm rounded-md border border-border bg-muted/20 px-3 py-2">
                        <span className="flex-1 min-w-0 truncate">{f.label}</span>
                        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{f.type}</span>
                        {f.required && <span className="shrink-0 text-red-500 text-xs">*</span>}
                        <button
                          type="button"
                          onClick={() => setRoundFields((prev) => prev.filter((x) => x.name !== f.name))}
                          className="shrink-0 text-muted-foreground hover:text-destructive p-0.5"
                          title="Remove question"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {showRoundComposer ? (
                  <div className="rounded-md border border-dashed border-border p-3 space-y-2">
                    <input
                      value={roundDraft.label}
                      onChange={(e) => setRoundDraft((p) => ({ ...p, label: e.target.value }))}
                      placeholder="Question (e.g. Which branch needs the loyalty module first?)"
                      className={inputClass}
                    />
                    <div className="flex items-center gap-3 flex-wrap">
                      <select
                        value={roundDraft.type}
                        onChange={(e) => setRoundDraft((p) => ({ ...p, type: e.target.value }))}
                        className="rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        <option value="text">Short text</option>
                        <option value="textarea">Long text</option>
                        <option value="select">Dropdown</option>
                        <option value="multiselect">Checkboxes (multi-select)</option>
                        <option value="number">Number</option>
                        <option value="date">Date</option>
                        <option value="boolean">Yes / No</option>
                        <option value="email">Email</option>
                        <option value="tel">Phone</option>
                      </select>
                      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <input
                          type="checkbox"
                          checked={roundDraft.required}
                          onChange={(e) => setRoundDraft((p) => ({ ...p, required: e.target.checked }))}
                          className="rounded border-input"
                        />
                        Required
                      </label>
                    </div>
                    {(roundDraft.type === "select" || roundDraft.type === "multiselect") && (
                      <input
                        value={roundDraft.options}
                        onChange={(e) => setRoundDraft((p) => ({ ...p, options: e.target.value }))}
                        placeholder="Options, comma separated"
                        className={inputClass}
                      />
                    )}
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => setShowRoundComposer(false)}>
                        Cancel
                      </Button>
                      <Button size="sm" onClick={addRoundQuestion} disabled={!roundDraft.label.trim()}>
                        <Plus className="w-3.5 h-3.5 mr-1" />
                        Add Question
                      </Button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowRoundComposer(true)}
                    className="flex items-center gap-1.5 text-xs font-medium text-retail hover:underline"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add a question
                  </button>
                )}

                <div className="flex items-center justify-between gap-3 pt-1">
                  <span className="text-xs text-muted-foreground">
                    {roundFields.length > 0
                      ? `${roundFields.length} question${roundFields.length > 1 ? "s" : ""} ready to send`
                      : "Add at least one question to send a round."}
                  </span>
                  <Button size="sm" onClick={sendRoundQuestions} disabled={sendingRound || roundFields.length === 0}>
                    {sendingRound ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                    Send Questions
                  </Button>
                </div>

                {roundMessage && <p className="text-xs text-muted-foreground">{roundMessage}</p>}

                {roundUrl && (
                  <div className="p-3 rounded-md bg-muted/30 space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Additional questions link</p>
                    <div className="flex items-center gap-2">
                      <input
                        readOnly
                        value={roundUrl.startsWith("http") ? roundUrl : `${typeof window !== "undefined" ? window.location.origin : ""}${roundUrl}`}
                        className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-xs"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const full = roundUrl.startsWith("http") ? roundUrl : `${window.location.origin}${roundUrl}`
                          navigator.clipboard.writeText(full).then(() => {
                            setCopiedRoundUrl(true)
                            setTimeout(() => setCopiedRoundUrl(false), 2000)
                          })
                        }}
                      >
                        {copiedRoundUrl ? "Copied" : "Copy"}
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <p className={labelClass}>Sent Rounds</p>
                {roundsLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : questionRounds.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No additional questions sent yet.</p>
                ) : (
                  questionRounds.map((round) => (
                    <div key={round.id} className="rounded-lg border border-border p-4 space-y-3">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold">{round.title}</span>
                          <span
                            className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                              round.status === "Reviewed"
                                ? "bg-green-50 text-green-700"
                                : round.status === "Submitted"
                                ? "bg-blue-50 text-blue-700"
                                : "bg-amber-50 text-amber-700"
                            }`}
                          >
                            {round.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-muted-foreground">
                            Sent {round.sentAt ? new Date(round.sentAt).toLocaleString() : "—"}
                            {round.submittedAt ? ` · Answered ${new Date(round.submittedAt).toLocaleString()}` : ""}
                          </span>
                          {round.status === "Sent" && (
                            <Button size="sm" variant="ghost" onClick={() => copyRoundLink(round.token)}>
                              <Copy className="w-3.5 h-3.5 mr-1" />
                              {copiedRoundToken === round.token ? "Copied" : "Copy Link"}
                            </Button>
                          )}
                          {round.status === "Submitted" && (
                            <Button size="sm" variant="outline" onClick={() => reviewRound(round.id)} disabled={reviewingRoundId === round.id}>
                              {reviewingRoundId === round.id ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CheckCircle2 className="w-4 h-4 mr-1" />}
                              Mark Reviewed
                            </Button>
                          )}
                        </div>
                      </div>
                      {round.status === "Sent" ? (
                        <p className="text-sm text-muted-foreground">Waiting for the lead to answer.</p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {round.fields.filter((f) => f.type !== "section").map((field) => (
                            <div key={field.name} className="rounded-md border border-border bg-muted/20 p-3">
                              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">{field.label}</p>
                              <p className="text-sm text-foreground whitespace-pre-wrap">
                                {round.responses[field.name] !== undefined
                                  ? Array.isArray(round.responses[field.name])
                                    ? (round.responses[field.name] as string[]).join(", ")
                                    : String(round.responses[field.name])
                                  : "—"}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* ─── Meeting ─── */}
          {tab === "meeting" && (
            <div className="space-y-5">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="inline-flex rounded-lg border border-border p-0.5 bg-muted/40">
                  {(["invite", "direct"] as const).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setMeetingMode(mode)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                        meetingMode === mode ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {mode === "invite" ? "Let lead pick a time" : "Schedule directly"}
                    </button>
                  ))}
                </div>
                <span className={`inline-flex items-center gap-1.5 text-xs ${googleConnected ? "text-green-700" : "text-amber-700"}`}>
                  <Video className="w-3.5 h-3.5" />
                  {googleConnected ? "Google Meet connected" : "Google Meet not connected"}
                  {!googleConnected && (
                    <a href="/admin/settings#google-meet" className="underline ml-1" target="_blank" rel="noreferrer">
                      Connect
                    </a>
                  )}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Title</label>
                  <input
                    type="text"
                    value={meetingForm.title}
                    onChange={(e) => setMeetingForm((p) => ({ ...p, title: e.target.value }))}
                    className={inputClass}
                    placeholder="e.g. MartPoint Demo"
                  />
                </div>
                <div>
                  <label className={labelClass}>Duration (minutes)</label>
                  <input
                    type="number"
                    min={10}
                    max={240}
                    value={meetingForm.durationMinutes}
                    onChange={(e) => setMeetingForm((p) => ({ ...p, durationMinutes: Number(e.target.value) }))}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Timezone</label>
                  <input
                    type="text"
                    value={meetingForm.timezone}
                    onChange={(e) => setMeetingForm((p) => ({ ...p, timezone: e.target.value }))}
                    className={inputClass}
                  />
                </div>

                {meetingMode === "direct" ? (
                  <>
                    <div>
                      <label className={labelClass}>Scheduled At *</label>
                      <input
                        type="datetime-local"
                        value={meetingForm.scheduledAt}
                        onChange={(e) => setMeetingForm((p) => ({ ...p, scheduledAt: e.target.value }))}
                        className={inputClass}
                      />
                    </div>
                    <div className="sm:col-span-2 flex items-center gap-2 rounded-lg border border-border p-3">
                      <input
                        id="create-meet"
                        type="checkbox"
                        checked={meetingForm.createMeet && !meetingForm.meetingLink}
                        disabled={!googleConnected || Boolean(meetingForm.meetingLink)}
                        onChange={(e) => setMeetingForm((p) => ({ ...p, createMeet: e.target.checked }))}
                        className="h-4 w-4"
                      />
                      <label htmlFor="create-meet" className="text-sm">
                        Generate a Google Meet link and send the lead a calendar invite
                        {!googleConnected && <span className="text-muted-foreground"> (connect Google first)</span>}
                      </label>
                    </div>
                    <div>
                      <label className={labelClass}>Or paste a meeting link</label>
                      <input
                        type="url"
                        value={meetingForm.meetingLink}
                        onChange={(e) => setMeetingForm((p) => ({ ...p, meetingLink: e.target.value }))}
                        className={inputClass}
                        placeholder="https://meet.google.com/... or Zoom link"
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Provider</label>
                      <select
                        value={meetingForm.provider}
                        onChange={(e) => setMeetingForm((p) => ({ ...p, provider: e.target.value }))}
                        className={inputClass}
                        disabled={!meetingForm.meetingLink}
                      >
                        <option value="">Select...</option>
                        <option value="Google Meet">Google Meet</option>
                        <option value="Zoom">Zoom</option>
                        <option value="Microsoft Teams">Microsoft Teams</option>
                        <option value="WhatsApp">WhatsApp</option>
                        <option value="Custom">Custom</option>
                      </select>
                    </div>
                  </>
                ) : (
                  <div className="sm:col-span-2 rounded-lg border border-border p-3 space-y-3">
                    <div>
                      <p className="text-sm font-medium">Time options</p>
                      <p className="text-xs text-muted-foreground">
                        Leave empty to let the lead choose from your weekly availability (Settings → Meeting Availability), or hand-pick a few slots below — hand-picked slots can be any future time, including same-day for urgent leads.
                      </p>
                    </div>
                    <div>
                      <label className={labelClass}>Invite expires after (days)</label>
                      <input
                        type="number"
                        min={1}
                        max={60}
                        value={meetingForm.expiresInDays}
                        onChange={(e) => setMeetingForm((p) => ({ ...p, expiresInDays: Number(e.target.value) }))}
                        className={`${inputClass} max-w-[120px]`}
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="datetime-local"
                        value={newSlot}
                        onChange={(e) => setNewSlot(e.target.value)}
                        className={inputClass}
                      />
                      <Button type="button" size="sm" variant="outline" onClick={addProposedSlot} disabled={!newSlot}>
                        Add
                      </Button>
                    </div>
                    {proposedSlots.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {proposedSlots.map((s) => (
                          <span key={s} className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs">
                            {new Date(s).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
                            <button type="button" onClick={() => setProposedSlots((p) => p.filter((x) => x !== s))} aria-label="Remove slot">
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div>
                <label className={labelClass}>Internal Notes</label>
                <textarea
                  rows={3}
                  value={meetingForm.notes}
                  onChange={(e) => setMeetingForm((p) => ({ ...p, notes: e.target.value }))}
                  className={`${inputClass} resize-none`}
                  placeholder="Agenda, talking points, preparation..."
                />
              </div>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                {meetingMessage ? <p className="text-xs text-muted-foreground">{meetingMessage}</p> : <span />}
                <Button
                  size="sm"
                  onClick={handleScheduleMeeting}
                  disabled={meetingLoading || (meetingMode === "direct" ? !meetingForm.scheduledAt : !lead.email)}
                  title={meetingMode === "invite" && !lead.email ? "Lead has no email address" : undefined}
                >
                  {meetingLoading ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : meetingMode === "invite" ? <Mail className="w-4 h-4 mr-1.5" /> : <Video className="w-4 h-4 mr-1.5" />}
                  {meetingMode === "invite" ? "Send Invitation" : "Schedule Meeting"}
                </Button>
              </div>

              {meetings.length > 0 && (
                <div className="space-y-3 pt-4 border-t border-border">
                  <p className={labelClass}>Meetings</p>
                  {meetings.map((m) => {
                    const busy = meetingActionId === m.id
                    const active = m.status === "PENDING" || m.status === "SCHEDULED"
                    return (
                      <div key={m.id} className="rounded-lg border border-border p-4 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium text-sm">{m.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {m.scheduledAt
                                ? `${new Date(m.scheduledAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: m.timezone })} · ${m.durationMinutes} mins · ${m.timezone}`
                                : m.proposedSlots?.length
                                ? `Awaiting lead — ${m.proposedSlots.length} proposed slot${m.proposedSlots.length === 1 ? "" : "s"}`
                                : "Awaiting lead — choosing from weekly availability"}
                            </p>
                            {m.status === "PENDING" && (
                              <p className="text-[11px] text-muted-foreground">
                                {m.inviteSentAt ? `Invite sent ${new Date(m.inviteSentAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}` : "Invite email not sent"}
                                {m.expiresAt ? ` · expires ${new Date(m.expiresAt).toLocaleDateString("en-GB", { dateStyle: "medium" })}` : ""}
                              </p>
                            )}
                          </div>
                          <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium ${MEETING_STATUS_COLORS[m.status]}`}>
                            {m.status === "PENDING" ? "Awaiting lead" : m.status.replace("_", " ")}
                          </span>
                        </div>
                        {m.meetingLink ? (
                          <a href={m.meetingLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-retail hover:underline">
                            <Video className="w-3.5 h-3.5" />
                            {m.provider || "Meeting link"} · {m.meetingLink}
                          </a>
                        ) : m.status === "SCHEDULED" ? (
                          <p className="text-xs text-amber-700">No meeting link yet.</p>
                        ) : null}
                        <div className="flex items-center gap-2">
                          <input
                            readOnly
                            value={`${typeof window !== "undefined" ? window.location.origin : ""}/meeting/${m.customerToken}`}
                            className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-xs font-mono"
                          />
                          <Button size="sm" variant="outline" onClick={() => copyMeetingLink(m.customerToken)}>
                            <Copy className="w-3.5 h-3.5 mr-1" />
                            Copy
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => window.open(`/meeting/${m.customerToken}`, "_blank")}>
                            <ExternalLink className="w-3.5 h-3.5 mr-1" />
                            Open
                          </Button>
                        </div>
                        {(m.summary || m.actionItems?.length || m.transcript || m.transcriptUrl || m.recordingUrl) && (
                          <div className="rounded-md bg-muted/40 p-3 space-y-2">
                            <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                              Meeting notes{m.notesProvider && m.notesProvider !== "manual" ? ` · ${m.notesProvider}` : ""}
                            </p>
                            {m.summary && <p className="text-xs whitespace-pre-wrap">{m.summary}</p>}
                            {m.actionItems && m.actionItems.length > 0 && (
                              <ul className="text-xs list-disc pl-4 space-y-0.5">
                                {m.actionItems.map((a, i) => (
                                  <li key={i}>{a}</li>
                                ))}
                              </ul>
                            )}
                            {(m.transcriptUrl || m.recordingUrl) && (
                              <div className="flex items-center gap-3 text-xs">
                                {m.transcriptUrl && (
                                  <a href={m.transcriptUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-retail hover:underline">
                                    <FileText className="w-3 h-3" />
                                    Transcript
                                  </a>
                                )}
                                {m.recordingUrl && (
                                  <a href={m.recordingUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-retail hover:underline">
                                    <Video className="w-3 h-3" />
                                    Recording
                                  </a>
                                )}
                              </div>
                            )}
                            {m.transcript && (
                              <details className="text-xs">
                                <summary className="cursor-pointer text-muted-foreground select-none">Transcript</summary>
                                <p className="mt-1 whitespace-pre-wrap max-h-48 overflow-y-auto">{m.transcript}</p>
                              </details>
                            )}
                            {m.summary && lead.email && (
                              <div className="flex items-center gap-2 pt-1">
                                <Button size="sm" variant="outline" disabled={busy} onClick={() => handleMeetingAction(m, "email_summary")}>
                                  {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Mail className="w-3.5 h-3.5 mr-1" />}
                                  {m.summarySentAt ? "Resend to lead" : "Share with lead"}
                                </Button>
                                {m.summarySentAt && (
                                  <span className="text-[11px] text-muted-foreground">
                                    Sent {new Date(m.summarySentAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                        {notesOpenId === m.id ? (
                          <div className="rounded-md border border-border p-3 space-y-2">
                            <p className={labelClass}>Meeting Notes</p>
                            <textarea
                              rows={3}
                              value={notesDraft.summary}
                              onChange={(e) => setNotesDraft((p) => ({ ...p, summary: e.target.value }))}
                              className={`${inputClass} resize-none`}
                              placeholder="Summary of the discussion..."
                            />
                            <textarea
                              rows={3}
                              value={notesDraft.actionItems}
                              onChange={(e) => setNotesDraft((p) => ({ ...p, actionItems: e.target.value }))}
                              className={`${inputClass} resize-none`}
                              placeholder="Action items — one per line"
                            />
                            <input
                              type="url"
                              value={notesDraft.transcriptUrl}
                              onChange={(e) => setNotesDraft((p) => ({ ...p, transcriptUrl: e.target.value }))}
                              className={inputClass}
                              placeholder="Transcript URL (optional)"
                            />
                            <input
                              type="url"
                              value={notesDraft.recordingUrl}
                              onChange={(e) => setNotesDraft((p) => ({ ...p, recordingUrl: e.target.value }))}
                              className={inputClass}
                              placeholder="Recording URL (optional)"
                            />
                            <div className="flex items-center gap-2">
                              <Button size="sm" disabled={busy} onClick={() => saveMeetingNotes(m)}>
                                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                                Save notes
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setNotesOpenId(null)}>
                                Close
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <Button size="sm" variant="ghost" className="px-0 h-auto text-xs text-muted-foreground hover:text-foreground" onClick={() => toggleNotesEditor(m)}>
                            <FileText className="w-3.5 h-3.5 mr-1" />
                            {m.summary || m.actionItems?.length ? "Edit notes" : "Add notes"}
                          </Button>
                        )}
                        {active && (
                          <div className="flex items-center gap-2 flex-wrap">
                            {m.status === "PENDING" && (
                              <Button size="sm" variant="outline" disabled={busy} onClick={() => handleMeetingAction(m, "resend_invite")}>
                                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Mail className="w-3.5 h-3.5 mr-1" />}
                                Resend invite
                              </Button>
                            )}
                            {m.status === "SCHEDULED" && (
                              <>
                                <Button size="sm" variant="outline" disabled={busy} onClick={() => handleMeetingAction(m, "set_status", "COMPLETED")}>
                                  <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                                  Completed
                                </Button>
                                <Button size="sm" variant="outline" disabled={busy} onClick={() => handleMeetingAction(m, "set_status", "NO_SHOW")}>
                                  No-show
                                </Button>
                              </>
                            )}
                            <Button size="sm" variant="ghost" className="text-destructive" disabled={busy} onClick={() => handleMeetingAction(m, "cancel")}>
                              <Trash2 className="w-3.5 h-3.5 mr-1" />
                              Cancel
                            </Button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ─── Actions ─── */}
          {tab === "actions" && (
            <div className="space-y-4">
              {lead.status === "Won" && (
                lead.businessId ? (
                  <ActionCard
                    icon={<CheckCircle2 className="w-5 h-5 text-success" />}
                    title="Converted to Business"
                    description="This lead already has a business record — conversion can only happen once."
                    buttonText="View Business"
                    onClick={() => (window.location.href = `/admin/businesses/${lead.businessId}`)}
                    accent="success"
                  />
                ) : (
                  <ActionCard
                    icon={<Rocket className="w-5 h-5 text-retail" />}
                    title="Convert to Business"
                    description="Create a full business record from this lead and start onboarding."
                    buttonText="Convert Now"
                    onClick={handleConvert}
                    loading={converting}
                    accent="retail"
                  />
                )
              )}

              <ActionCard
                icon={<FileText className="w-5 h-5 text-proposal" />}
                title="Create Quote"
                description={
                  lead.questionnaireStatus === "Submitted" || lead.questionnaireStatus === "Reviewed"
                    ? "Generate a formal quotation for this lead."
                    : "A questionnaire must be submitted before creating a quote. Send one from the Questionnaire tab."
                }
                buttonText="Create Quote"
                onClick={() => onCreateQuote(lead)}
                disabled={lead.questionnaireStatus !== "Submitted" && lead.questionnaireStatus !== "Reviewed"}
                accent="proposal"
              />

              <ActionCard
                icon={<Mail className="w-5 h-5 text-info" />}
                title="Email Lead"
                description={`Send an email directly to ${lead.email}.`}
                buttonText="Compose"
                onClick={() => (window.location.href = `mailto:${lead.email}`)}
                accent="info"
              />

              <ActionCard
                icon={<Phone className="w-5 h-5 text-success" />}
                title="Call Lead"
                description={`Call ${lead.fullName} at ${lead.phone}.`}
                buttonText="Call"
                onClick={() => (window.location.href = `tel:${lead.phone}`)}
                accent="success"
              />

              <div className="pt-4 border-t border-border">
                <ActionCard
                  icon={<Trash2 className="w-5 h-5 text-destructive" />}
                  title="Delete Lead"
                  description="Permanently remove this lead. This action cannot be undone."
                  buttonText="Delete"
                  onClick={handleDelete}
                  loading={deleting}
                  accent="destructive"
                />
              </div>
            </div>
          )}
        </div>

        {/* ─── Footer ─── */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-muted/30 shrink-0">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="w-3.5 h-3.5" />
            <span>Last updated:</span>
            <span className="font-medium">{new Date(lead.updatedAt || lead.submittedAt).toLocaleDateString()}</span>
          </div>
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  )
}

/* ─── Sub-components & helpers ─── */

function InfoCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-muted/10 p-4 hover:bg-muted/20 transition-colors">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-muted-foreground">{icon}</span>
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
      </div>
      <p className="text-sm font-semibold text-foreground break-words">{value}</p>
    </div>
  )
}

function ActionCard({
  icon,
  title,
  description,
  buttonText,
  onClick,
  loading,
  disabled,
  accent,
}: {
  icon: React.ReactNode
  title: string
  description: string
  buttonText: string
  onClick: () => void
  loading?: boolean
  disabled?: boolean
  accent: "retail" | "erp" | "proposal" | "info" | "success" | "destructive"
}) {
  const btnVariant = accent === "destructive" ? "outline" : accent === "retail" ? "retail" : "outline"
  const btnClass = accent === "destructive" ? "border-destructive/30 text-destructive hover:bg-destructive/5" : ""

  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-border bg-muted/10 p-4 hover:bg-muted/20 transition-colors">
      <div className="flex items-start gap-3 min-w-0">
        <div className="shrink-0 mt-0.5 p-2 rounded-lg bg-background border border-border/50">{icon}</div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
      </div>
      <Button
        size="sm"
        variant={btnVariant}
        onClick={onClick}
        disabled={disabled || loading}
        className={`shrink-0 ${btnClass}`}
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
        {buttonText}
      </Button>
    </div>
  )
}

function formatSource(source: string): { sourceLabel: string; sourcePartner?: string } {
  if (!source) return { sourceLabel: "Unknown" }

  if (source.startsWith("estimate-calculator:partner:")) {
    const partner = source.split(":partner:")[1]
    return { sourceLabel: "Estimate Calculator", sourcePartner: partner }
  }
  if (source === "estimate-calculator") {
    return { sourceLabel: "Estimate Calculator" }
  }
  if (source.startsWith("partner:")) {
    return { sourceLabel: "Partner Referral", sourcePartner: source.split(":partner:")[1] }
  }

  const map: Record<string, string> = {
    website: "Website",
    "google-search": "Google Search",
    whatsapp: "WhatsApp",
    referral: "Referral",
    "social-media": "Social Media",
    "cold-call": "Cold Call",
    email: "Email",
    event: "Event",
    manual: "Manual Entry",
  }
  return { sourceLabel: map[source] || source.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()) }
}

function sourceIcon(source: string): React.ReactNode {
  if (source.includes("estimate")) return <Wallet className="w-3 h-3" />
  if (source.includes("partner")) return <TrendingUp className="w-3 h-3" />
  if (source === "whatsapp") return <Smartphone className="w-3 h-3" />
  if (source === "website") return <Globe className="w-3 h-3" />
  if (source === "google-search") return <Search className="w-3 h-3" />
  if (source === "email") return <Mail className="w-3 h-3" />
  return <ArrowUpRight className="w-3 h-3" />
}

interface EstimateView {
  retailPlan: string
  retailRange: string
  retailTier?: string
  retailInclusions?: string[]
  retailRationale?: string
  erpPlan?: string
  erpRange?: string
  erpTier?: string
  erpInclusions?: string[]
  erpRationale?: string
}

function normalizeEstimate(estimate?: StoredEstimate | null): EstimateView | null {
  if (!estimate?.retail?.planName) return null
  return {
    retailPlan: estimate.retail.planName,
    retailRange: estimate.retail.range,
    retailTier: estimate.retail.tier,
    retailInclusions: estimate.retail.inclusions,
    retailRationale: estimate.retail.rationale,
    erpPlan: estimate.erp?.planName,
    erpRange: estimate.erp?.range,
    erpTier: estimate.erp?.tier,
    erpInclusions: estimate.erp?.inclusions,
    erpRationale: estimate.erp?.rationale,
  }
}

// Legacy rows stored the estimate as a formatted string in `challenge`.
function parseEstimate(challenge?: string): EstimateView | null {
  if (!challenge || !challenge.startsWith("Estimate —")) return null
  try {
    const body = challenge.replace("Estimate —", "").trim()
    const retailMatch = body.match(/Retail:\s*([^()]+)\s*\(([^)]+)\)/)
    const erpMatch = body.match(/ERP:\s*([^()]+)\s*\(([^)]+)\)/)
    if (!retailMatch || !erpMatch) return null
    return {
      retailPlan: retailMatch[1].trim(),
      retailRange: retailMatch[2].trim(),
      erpPlan: erpMatch[1].trim(),
      erpRange: erpMatch[2].trim(),
    }
  } catch {
    return null
  }
}
