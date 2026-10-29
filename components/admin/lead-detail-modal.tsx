"use client"

import { useState, useEffect, useRef } from "react"
import { base64ByteLength, LEAD_EMAIL_ATTACHMENT_HINT, MAX_LEAD_EMAIL_ATTACHMENT_BYTES, MAX_LEAD_EMAIL_ATTACHMENTS } from "@/lib/lead-email-attachments"
import { EmailDraftControls, useEmailDraft } from "@/components/admin/email-draft-controls"
import EmailRichEditor from "@/components/admin/email-rich-editor"
import { EmailLayoutSwitch } from "@/components/admin/email-layout-switch"
import type { EmailLayout } from "@/lib/email-layout"
import { htmlToText, textToHtml } from "@/lib/email-html"
import { leadReplyRecipients } from "@/lib/lead-email-reply"
import { SupportTicketsPanel } from "@/components/admin/support-tickets-panel"
import { Button } from "@/components/ui/button"
import { businessTypeOptions, industryOptions, resolveIndustryName } from "@/lib/industries"
import { buildLeadEmailTemplate, buildLeadEmailSubject, LEAD_EMAIL_STAGES, type LeadEmailStageKey } from "@/lib/lead-email-templates"
import { cloneTemplateFields, getLeadAdditionalQuestionTemplate, LEAD_ADDITIONAL_QUESTION_TEMPLATES } from "@/lib/lead-additional-question-templates"
import type { StoredEstimate } from "@/lib/estimate-calculator"
import {
  X,
  Mail,
  Reply,
  ReplyAll,
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
  ChevronDown,
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
  Paperclip,
  Bell,
  Ban,
  Eye,
  RefreshCw,
} from "lucide-react"
import { LEAD_SOURCE_OPTIONS, leadSourceLabel, normalizeLeadSource } from "@/lib/lead-sources"

export interface Lead {
  id: string
  fullName: string
  businessName: string
  email: string
  additionalEmail?: string | null
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
  remindersPaused?: boolean
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

type Tab = "overview" | "edit" | "notes" | "email" | "questionnaire" | "additional" | "meeting" | "actions" | "support"

interface LeadEmailMessage {
  id: string
  direction: "inbound" | "outbound"
  fromEmail: string | null
  toEmail: string | null
  subject: string | null
  bodyText: string | null
  bodyHtml: string | null
  status: string
  providerMessageId?: string | null
  metadata?: Record<string, unknown> | null
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

/** ISO instant → value for <input type="datetime-local"> in the admin's browser timezone. */
function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
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

interface LeadNote {
  id: string
  note: string
  authorName: string | null
  createdAt: string
}

interface LeadDetailModalProps {
  lead: Lead
  onClose: () => void
  onUpdateStatus: (id: string, status: Lead["status"]) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onUpdateLead: (id: string, data: Record<string, unknown>) => Promise<Lead | null>
  onConvertToBusiness: (lead: Lead) => Promise<void>
  onCreateQuote: (lead: Lead) => void
  onOpenQuestionnaire: (lead: Lead) => Promise<void>
  onMarkQuestionnaireReviewed: (lead: Lead) => Promise<void>
  /** People this lead can be assigned to (admin users + owners already in use). */
  assignees?: string[]
}

export function LeadDetailModal({
  lead,
  onClose,
  onUpdateStatus,
  onDelete,
  onUpdateLead,
  onConvertToBusiness,
  onCreateQuote,
  onOpenQuestionnaire,
  onMarkQuestionnaireReviewed,
  assignees = [],
}: LeadDetailModalProps) {
  const [tab, setTab] = useState<Tab>("overview")
  const [leadNoteDraft, setLeadNoteDraft] = useState("")
  const [leadNotes, setLeadNotes] = useState<LeadNote[]>([])
  const [leadNotesLoading, setLeadNotesLoading] = useState(false)
  const [leadNotesMessage, setLeadNotesMessage] = useState("")
  const [savingLeadNote, setSavingLeadNote] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    fullName: lead.fullName,
    businessName: lead.businessName,
    email: lead.email,
    additionalEmail: lead.additionalEmail || "",
    phone: lead.phone,
    businessType: lead.businessType,
    industry: lead.industry || resolveIndustryName(lead.businessType) || "",
    productInterest: lead.productInterest,
    branches: lead.branches,
    staffSize: lead.staffSize,
    challenge: lead.challenge || "",
    message: lead.message || "",
    source: normalizeLeadSource(lead.source),
    status: lead.status,
    assignedTo: lead.assignedTo || "",
  })
  const [converting, setConverting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [remindersPaused, setRemindersPaused] = useState(Boolean(lead.remindersPaused))
  const [togglingReminders, setTogglingReminders] = useState(false)
  const [questionnaireLoading, setQuestionnaireLoading] = useState(false)
  const [questionnaireData, setQuestionnaireData] = useState<{ fields: QuestionnaireField[]; responses: Record<string, unknown> } | null>(null)
  const [questionRounds, setQuestionRounds] = useState<QuestionRound[]>([])
  const [roundsLoading, setRoundsLoading] = useState(false)
  const [roundFields, setRoundFields] = useState<QuestionnaireField[]>([])
  const [selectedQuestionTemplateIndustry, setSelectedQuestionTemplateIndustry] = useState("")
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
  const [emailsReloadKey, setEmailsReloadKey] = useState(0)
  const [expandedEmailId, setExpandedEmailId] = useState<string | null>(null)
  const [replyContext, setReplyContext] = useState<{ emailId: string; replyAll: boolean } | null>(null)
  const [ownEmailAddresses, setOwnEmailAddresses] = useState<string[] | null>(null)
  // True once the admin types their own subject; auto-fill then stands down.
  const [emailSubjectEdited, setEmailSubjectEdited] = useState(false)
  const [inboxMailbox, setInboxMailbox] = useState<{ configured: boolean; mailbox: string } | null>(null)
  const [inboxChecking, setInboxChecking] = useState(false)
  const [inboxSummary, setInboxSummary] = useState("")
  const [emailForm, setEmailForm] = useState({ subject: "", body: "" })
  const [emailLayout, setEmailLayout] = useState<EmailLayout>("normal")
  const emailDraft = useEmailDraft("leads", lead.id)
  const [emailTemplateKey, setEmailTemplateKey] = useState<LeadEmailStageKey | null>(null)
  const [emailTemplateIndustry, setEmailTemplateIndustry] = useState(
    lead.industry || resolveIndustryName(lead.businessType) || "",
  )
  const [emailAttachments, setEmailAttachments] = useState<{ filename: string; content: string; size: number }[]>([])
  const [readingAttachments, setReadingAttachments] = useState(false)
  const attachmentInput = useRef<HTMLInputElement>(null)
  const attachmentReadLock = useRef(false)
  const [sendingEmail, setSendingEmail] = useState(false)
  const [emailPreview, setEmailPreview] = useState<{ subject: string; html: string } | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
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
  const [followup, setFollowup] = useState<{ meetingId: string; subject: string; body: string } | null>(null)
  const [editingMeetingId, setEditingMeetingId] = useState<string | null>(null)
  const [editMeetingForm, setEditMeetingForm] = useState({
    title: "",
    scheduledAt: "",
    durationMinutes: 30,
    timezone: "Africa/Lagos",
    notes: "",
  })

  const leadTemplate = getLeadAdditionalQuestionTemplate(lead.industry || lead.businessType || "")

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
          setEmails([...(data.emails || [])].reverse())
          setOwnEmailAddresses(Array.isArray(data.ownAddresses) ? data.ownAddresses : null)
        }
      })
      .catch(() => {
        if (!cancelled) setEmailsError("Failed to load email thread")
      })
      .finally(() => {
        if (!cancelled) setEmailsLoading(false)
      })

    // Seed the composer with a generated subject so the admin never faces a
    // blank field — but never overwrite a subject they've already typed.
    const seedTimer=window.setTimeout(()=>{
      setEmailSubjectEdited(false)
      setEmailForm((p) => (p.subject.trim() ? p : { ...p, subject: buildLeadEmailSubject(null, lead.businessName) }))
    },0)

    return () => { cancelled = true;window.clearTimeout(seedTimer) }
  }, [tab, lead.id, lead.businessName, emailsReloadKey])

  useEffect(() => {
    if (tab !== "email" || inboxMailbox) return
    fetch("/api/admin/email-inbox")
      .then((res) => res.json())
      .then((data) => {
        if (data && typeof data.configured === "boolean") {
          setInboxMailbox({ configured: data.configured, mailbox: data.mailbox || "" })
        }
      })
      .catch(() => {})
  }, [tab, inboxMailbox])

  const checkLeadMailbox = async () => {
    setInboxChecking(true)
    setInboxSummary("")
    try {
      const res = await fetch("/api/admin/email-inbox", { method: "POST" })
      const data = await res.json()
      setInboxSummary(data.summary || data.error || "Could not reach the mailbox.")
      if (res.ok) {
        setEmailsReloadKey((key) => key + 1)
        setEmailsLoading(true)
      }
    } catch {
      setInboxSummary("Could not reach the mailbox.")
    } finally {
      setInboxChecking(false)
    }
  }

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

  useEffect(() => {
    if (tab !== "notes") return
    let cancelled = false
    const loadingTimer=window.setTimeout(()=>setLeadNotesLoading(true),0)
    fetch(`/api/admin/leads/${lead.id}/notes`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return
        if (data.error) setLeadNotesMessage(data.error)
        else setLeadNotes(data.notes || [])
      })
      .catch(() => {
        if (!cancelled) setLeadNotesMessage("Failed to load notes")
      })
      .finally(() => {
        window.clearTimeout(loadingTimer)
        if (!cancelled) setLeadNotesLoading(false)
      })
    return () => { cancelled = true;window.clearTimeout(loadingTimer) }
  }, [tab, lead.id])

  const flashLeadNotes = (text: string) => {
    setLeadNotesMessage(text)
    setTimeout(() => setLeadNotesMessage(""), 4000)
  }

  const handleAddNote = async () => {
    const note = leadNoteDraft.trim()
    if (!note) {
      flashLeadNotes("Write a note before saving.")
      return
    }
    setSavingLeadNote(true)
    try {
      const res = await fetch(`/api/admin/leads/${lead.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        flashLeadNotes(data.error || "Failed to save note")
        return
      }
      setLeadNotes((prev) => [data.note, ...prev])
      setLeadNoteDraft("")
      flashLeadNotes("Note added.")
    } catch {
      flashLeadNotes("Failed to save note")
    } finally {
      setSavingLeadNote(false)
    }
  }

  const handleSaveEdit = async () => {
    setEditing(true)
    const updated = await onUpdateLead(lead.id, editForm)
    if (updated) {
      setEditForm({
        fullName: updated.fullName,
        businessName: updated.businessName,
        email: updated.email,
        additionalEmail: updated.additionalEmail || "",
        phone: updated.phone,
        businessType: updated.businessType,
        industry: updated.industry || resolveIndustryName(updated.businessType) || "",
        productInterest: updated.productInterest,
        branches: updated.branches,
        staffSize: updated.staffSize,
        challenge: updated.challenge || "",
        message: updated.message || "",
        source: normalizeLeadSource(updated.source),
        status: updated.status,
        assignedTo: updated.assignedTo || "",
      })
      setTab("overview")
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

  const handleToggleReminders = async (scope: "reminders" | "do_not_contact" = "reminders") => {
    const next = !remindersPaused
    setTogglingReminders(true)
    try {
      const res = await fetch("/api/admin/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "lead", id: lead.id, paused: next, scope }),
      })
      if (res.ok) setRemindersPaused(next)
    } catch {
      // best-effort; leave state unchanged on failure
    } finally {
      setTogglingReminders(false)
    }
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

  const applyQuestionTemplate = (industry: string) => {
    setSelectedQuestionTemplateIndustry(industry)
    if (!industry) return

    const template = getLeadAdditionalQuestionTemplate(industry)
    if (!template) return
    if (roundFields.length > 0 && !confirm("Loading this template will replace the questions currently in this round. Continue?")) return

    setRoundFields(cloneTemplateFields(template))
    setRoundMessage(`${template.label} template loaded. Review or remove questions before sending.`)
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

  const handleMeetingAction = async (m: Meeting, action: "cancel" | "resend_invite" | "set_status", status?: Meeting["status"]) => {
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
      } else {
        setMeetingMessage(data.error || "Action failed")
      }
    } catch {
      setMeetingMessage("Action failed")
    } finally {
      setMeetingActionId(null)
    }
  }

  const startEditingMeeting = (m: Meeting) => {
    setEditingMeetingId(m.id)
    setEditMeetingForm({
      title: m.title,
      scheduledAt: m.scheduledAt ? toDatetimeLocalValue(m.scheduledAt) : "",
      durationMinutes: m.durationMinutes,
      timezone: m.timezone,
      notes: m.notes || "",
    })
    setMeetingMessage("")
  }

  const handleUpdateMeeting = async (m: Meeting) => {
    setMeetingActionId(m.id)
    setMeetingMessage("")
    try {
      const res = await fetch(`/api/admin/leads/${lead.id}/meetings/${m.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
          title: editMeetingForm.title.trim() || m.title,
          scheduledAt: editMeetingForm.scheduledAt ? new Date(editMeetingForm.scheduledAt).toISOString() : undefined,
          durationMinutes: Number(editMeetingForm.durationMinutes) || m.durationMinutes,
          timezone: editMeetingForm.timezone.trim() || m.timezone,
          notes: editMeetingForm.notes,
        }),
      })
      const data = await res.json()
      if (data.success && data.meeting) {
        setMeetings((prev) => prev.map((x) => (x.id === m.id ? data.meeting : x)))
        setEditingMeetingId(null)
        setMeetingMessage(
          data.warning ||
            (data.scheduleChanged
              ? data.emailSent
                ? "Meeting updated — the lead was emailed the new time."
                : "Meeting updated, but the email to the lead could not be sent."
              : "Meeting updated."),
        )
      } else {
        setMeetingMessage(data.error || "Could not update the meeting")
      }
    } catch {
      setMeetingMessage("Could not update the meeting")
    } finally {
      setMeetingActionId(null)
    }
  }

  const handleCreateMeet = async (m: Meeting) => {
    setMeetingActionId(m.id)
    setMeetingMessage("")
    try {
      const res = await fetch(`/api/admin/leads/${lead.id}/meetings/${m.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create_meet" }),
      })
      const data = await res.json()
      if (data.success && data.meeting) {
        setMeetings((prev) => prev.map((x) => (x.id === m.id ? data.meeting : x)))
        setMeetingMessage(data.emailSent ? "Google Meet link created — the lead was emailed." : "Google Meet link created.")
      } else {
        setMeetingMessage(data.error || "Could not create a Google Meet link")
      }
    } catch {
      setMeetingMessage("Could not create a Google Meet link")
    } finally {
      setMeetingActionId(null)
    }
  }

  const draftMeetingFollowup = async (m: Meeting) => {
    setMeetingActionId(m.id)
    setMeetingMessage("")
    try {
      const res = await fetch(`/api/admin/leads/${lead.id}/meetings/${m.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "draft_followup" }),
      })
      const data = await res.json()
      if (data.success && data.draft) {
        setFollowup({ meetingId: m.id, subject: data.draft.subject, body: data.draft.body })
      } else {
        setMeetingMessage(data.error || "Could not draft the email")
      }
    } catch {
      setMeetingMessage("Could not draft the email")
    } finally {
      setMeetingActionId(null)
    }
  }

  const sendMeetingFollowup = async (m: Meeting) => {
    if (!followup || !followup.subject.trim() || !followup.body.trim()) return
    setMeetingActionId(m.id)
    setMeetingMessage("")
    try {
      const res = await fetch(`/api/admin/leads/${lead.id}/meetings/${m.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send_followup", subject: followup.subject, body: followup.body }),
      })
      const data = await res.json()
      if (data.success && data.meeting) {
        setMeetings((prev) => prev.map((x) => (x.id === m.id ? data.meeting : x)))
        setFollowup(null)
        setMeetingMessage(data.emailSent ? "Follow-up email sent to the lead." : "Could not send the email.")
      } else {
        setMeetingMessage(data.error || "Could not send the email")
      }
    } catch {
      setMeetingMessage("Could not send the email")
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

  const emailTemplateVars = {
    firstName: lead.fullName.trim().split(/\s+/)[0] || lead.fullName,
    fullName: lead.fullName,
    businessName: lead.businessName,
  }
  const replyOriginal = replyContext ? emails.find((email) => email.id === replyContext.emailId) : null
  const replyRecipients = replyOriginal && ownEmailAddresses
    ? leadReplyRecipients(replyOriginal, lead, ownEmailAddresses, !!replyContext?.replyAll)
    : null
  const replyReady = !replyContext || !!replyRecipients
  const appliedEmailTemplate = emailTemplateKey
    ? buildLeadEmailTemplate(emailTemplateKey, emailTemplateIndustry, emailTemplateVars)
    : null
  const emailTemplateUnedited = Boolean(
    appliedEmailTemplate &&
      emailForm.subject === appliedEmailTemplate.subject &&
      htmlToText(emailForm.body) === htmlToText(textToHtml(appliedEmailTemplate.text)),
  )

  const applyEmailTemplate = (key: LeadEmailStageKey, industry = emailTemplateIndustry) => {
    const tpl = buildLeadEmailTemplate(key, industry, emailTemplateVars)
    setEmailTemplateKey(key)
    setEmailForm((p) => ({
      subject: emailSubjectEdited ? p.subject : tpl.subject,
      body: textToHtml(tpl.text),
    }))
  }

  /* Server-side render of the exact message the send route would deliver —
   * branded template shell or plain body + settings signature — shown in the
   * Preview panel without sending anything. */
  const handlePreviewEmail = async () => {
    if (!emailForm.subject.trim() || !htmlToText(emailForm.body).trim()) return
    setPreviewLoading(true)
    setEmailsError("")
    try {
      const res = await fetch(`/api/admin/leads/${lead.id}/emails/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: emailForm.subject.trim(),
          body: htmlToText(emailForm.body),
          bodyHtml: emailForm.body,
          layout: emailLayout,
          template:
            emailTemplateKey && emailTemplateUnedited
              ? { key: emailTemplateKey, industry: emailTemplateIndustry || undefined }
              : undefined,
        }),
      })
      const data = await res.json()
      if (data.html) setEmailPreview({ subject: data.subject || emailForm.subject.trim(), html: data.html })
      else setEmailsError(data.error || "Failed to render preview")
    } catch {
      setEmailsError("Failed to render preview")
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleSendEmail = async () => {
    if (sendingEmail || attachmentReadLock.current || !replyReady || !emailForm.subject.trim() || !htmlToText(emailForm.body).trim()) return
    setSendingEmail(true)
    setEmailsError("")
    try {
      const res = await fetch(`/api/admin/leads/${lead.id}/emails`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: emailForm.subject.trim(),
          body: htmlToText(emailForm.body),
          bodyHtml: emailForm.body,
          layout: emailLayout,
          template:
            emailTemplateKey && emailTemplateUnedited
              ? { key: emailTemplateKey, industry: emailTemplateIndustry || undefined }
              : undefined,
          attachments: emailAttachments.length
            ? emailAttachments.map((a) => ({ filename: a.filename, content: a.content }))
            : undefined,
          replyToEmailId: replyContext?.emailId,
          replyAll: replyContext?.replyAll || undefined,
        }),
      })
      const data = await res.json()
      if (data.email) {
        setEmails((prev) => [data.email, ...prev])
        if (!data.sent) {
          setEmailsError("Delivery failed — check email settings. Your message and attachments have been kept for retry.")
          return
        }
        await emailDraft.remove()
        setEmailSubjectEdited(false)
        setEmailForm({ subject: buildLeadEmailSubject(null, lead.businessName), body: "" })
        setEmailTemplateKey(null)
        setEmailAttachments([])
        setEmailPreview(null)
        setReplyContext(null)
      } else {
        setEmailsError(data.error || "Failed to send email")
      }
    } catch {
      setEmailsError("Failed to send email")
    } finally {
      setSendingEmail(false)
    }
  }

  const handleAddAttachments = async (files: FileList | null) => {
    if (!files || files.length === 0 || sendingEmail || attachmentReadLock.current) return
    const selected = Array.from(files)
    if (emailAttachments.length + selected.length > MAX_LEAD_EMAIL_ATTACHMENTS) {
      setEmailsError("Up to 5 attachments per email. Remove a file before adding more.")
      return
    }
    if (emailAttachments.reduce((sum, file) => sum + file.size, 0) + selected.reduce((sum, file) => sum + file.size, 0) > MAX_LEAD_EMAIL_ATTACHMENT_BYTES) {
      setEmailsError("Attachments must be 3 MB combined or smaller. Choose smaller files or remove an attachment.")
      return
    }
    setEmailsError("")
    attachmentReadLock.current = true
    setReadingAttachments(true)
    const next: { filename: string; content: string; size: number }[] = []
    try {
      for (const file of selected) {
        if (!file.size) throw new Error(`"${file.name}" is empty. Choose a non-empty file.`)
        if (emailAttachments.some((item) => item.filename === file.name) || next.some((item) => item.filename === file.name)) {
          throw new Error(`"${file.name}" is already attached. Rename it to attach a different document with the same name.`)
        }
        const content = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => {
            const result = String(reader.result || "")
            resolve(result.includes(",") ? result.slice(result.indexOf(",") + 1) : result)
          }
          reader.onerror = () => reject(new Error(`Could not read "${file.name}". Please select it again.`))
          reader.onabort = () => reject(new Error(`Reading "${file.name}" was cancelled.`))
          reader.readAsDataURL(file)
        })
        if (!content) throw new Error(`Could not read "${file.name}". Please select it again.`)
        next.push({ filename: file.name, content, size: file.size })
      }
      setEmailAttachments((prev) => [...prev, ...next])
    } catch (error) {
      setEmailsError(error instanceof Error ? error.message : "Could not read the selected files. Please try again.")
    } finally {
      attachmentReadLock.current = false
      setReadingAttachments(false)
    }
  }

  const removeAttachment = (filename: string) => {
    setEmailAttachments((prev) => prev.filter((a) => a.filename !== filename))
  }

  const copyEmailBody = (msg: LeadEmailMessage) => {
    const text = msg.bodyText || msg.subject || ""
    if (!text) return
    navigator.clipboard.writeText(text).then(() => {
      setCopiedEmailId(msg.id)
      setTimeout(() => setCopiedEmailId(null), 2000)
    })
  }

  const startEmailReply = (msg: LeadEmailMessage, replyAll: boolean) => {
    const originalSubject = (msg.subject || "").trim()
    const subject = originalSubject && /^re:/i.test(originalSubject) ? originalSubject : `Re: ${originalSubject || "(no subject)"}`
    setReplyContext({ emailId: msg.id, replyAll })
    setEmailTemplateKey(null)
    setEmailAttachments([])
    setEmailPreview(null)
    setEmailSubjectEdited(true)
    setEmailForm({ subject, body: "" })
    setExpandedEmailId(msg.id)
    requestAnimationFrame(() => document.getElementById("lead-email-composer")?.scrollIntoView({ behavior: "smooth", block: "start" }))
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
      setExpandedEmailId(null)
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
    { id: "support", label: "Support tickets", icon: <MessageSquare className="w-3.5 h-3.5" /> },
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
                <select
                  value={lead.status}
                  onChange={(e) => onUpdateStatus(lead.id, e.target.value as Lead["status"])}
                  title="Pipeline status — click to change"
                  className={`appearance-none cursor-pointer text-[11px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-full text-white ${STAGE_COLORS[lead.status]}`}
                >
                  {PIPELINE_STAGES.map((s) => (
                    <option key={s} value={s} style={{ color: "#111", backgroundColor: "#fff" }}>{s}</option>
                  ))}
                </select>
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
          {tab === "support" && <SupportTicketsPanel type="lead" id={lead.id}/>}
          {/* ─── Overview ─── */}
          {tab === "overview" && (
            <div className="space-y-6">
              {/* Pipeline status — first thing on the overview, one click to change */}
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
                  <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-retail/10 pt-4">
                    <Button size="sm" onClick={() => onCreateQuote(lead)}>
                      <Rocket className="w-3.5 h-3.5 mr-1.5" />
                      Create quote from estimate
                    </Button>
                    <p className="text-[11px] text-muted-foreground">
                      Opens the quotation builder with this lead selected and the estimator pre-filled from their answers.
                    </p>
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
                  <label className={labelClass}>Additional Email (copy)</label>
                  <input type="email" value={editForm.additionalEmail} onChange={(e) => setEditForm((p) => ({ ...p, additionalEmail: e.target.value }))} className={inputClass} placeholder="copy@example.com" />
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
                    {LEAD_SOURCE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    <option value="estimate-calculator">Estimate Calculator</option>
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
                <div>
                  <label className={labelClass}>Assigned to</label>
                  <select
                    value={editForm.assignedTo}
                    onChange={(e) => setEditForm((p) => ({ ...p, assignedTo: e.target.value }))}
                    className={inputClass}
                  >
                    <option value="">Unassigned</option>
                    {assignees.map((a) => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>
                  <p className="mt-1 text-[11px] text-muted-foreground">The salesperson who owns this lead.</p>
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
                <label className={labelClass}>Add an internal note</label>
                <textarea
                  rows={5}
                  value={leadNoteDraft}
                  onChange={(e) => setLeadNoteDraft(e.target.value)}
                  className={`${inputClass} resize-y`}
                  placeholder="Call summary, next steps, context for the team… Each save is kept as its own dated note — earlier ones are never overwritten."
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">Internal only — never shown to the lead.</p>
                <Button size="sm" onClick={handleAddNote} disabled={savingLeadNote || !leadNoteDraft.trim()}>
                  {savingLeadNote ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Plus className="w-4 h-4 mr-1.5" />}
                  Add note
                </Button>
              </div>
              {leadNotesMessage && (
                <p className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-xs">{leadNotesMessage}</p>
              )}
              <div>
                <p className={labelClass}>Note history {leadNotes.length > 0 ? `(${leadNotes.length})` : ""}</p>
                {leadNotesLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : leadNotes.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                    No notes yet. The first one you add will appear here.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {leadNotes.map((n) => (
                      <div key={n.id} className="rounded-lg border border-border bg-muted/20 p-4">
                        <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{n.note}</p>
                        <p className="mt-2 text-[11px] text-muted-foreground">
                          {n.authorName || "—"} ·{" "}
                          {new Date(n.createdAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ─── Email ─── */}
          {tab === "email" && (
            <div className="space-y-5">
              <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
                <div className="flex items-start gap-2 text-xs text-muted-foreground">
                  <Mail className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>
                    Two-way thread with <span className="font-medium text-foreground">{lead.email}</span>
                    {lead.additionalEmail ? <> (copy: <span className="font-medium text-foreground">{lead.additionalEmail}</span>)</> : null}.
                    Replies pulled from <span className="font-medium text-foreground">{inboxMailbox?.mailbox || "the lead mailbox"}</span> land here.
                  </span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">
                    {inboxSummary || (inboxMailbox === null
                      ? "Checking mailbox status…"
                      : inboxMailbox.configured
                        ? "Mailbox connected — new replies are imported every 10 minutes."
                        : "Mailbox not connected. Add the IMAP details in Settings → Email to collect replies.")}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={checkLeadMailbox}
                    disabled={inboxChecking || inboxMailbox?.configured === false}
                  >
                    {inboxChecking ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
                    Check mailbox for replies
                  </Button>
                </div>
              </div>

              {emailsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : emails.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No emails in this thread yet.</p>
              ) : (
                <div className="rounded-lg border border-border divide-y divide-border overflow-hidden">
                  {emails.map((msg) => {
                    const open = expandedEmailId === msg.id
                    const preview = (msg.bodyText || "").replace(/\s+/g, " ").trim()
                    const attachments = Array.isArray(msg.metadata?.attachments)
                      ? msg.metadata.attachments.flatMap((file: unknown) => {
                          if (!file || typeof file !== "object" || !("filename" in file) || typeof file.filename !== "string") return []
                          return [{ filename: file.filename, size: "size" in file && typeof file.size === "number" ? file.size : null }]
                        })
                      : []
                    return (
                      <div key={msg.id} className={open ? "bg-muted/20" : "bg-background"}>
                        <button
                          type="button"
                          onClick={() => setExpandedEmailId(open ? null : msg.id)}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/40 transition-colors"
                        >
                          <span
                            className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium shrink-0 ${
                              msg.direction === "outbound"
                                ? msg.status === "failed"
                                  ? "bg-red-100 text-red-700"
                                  : "bg-blue-100 text-blue-700"
                                : "bg-emerald-100 text-emerald-700"
                            }`}
                          >
                            {msg.direction === "outbound" ? (msg.status === "failed" ? "Failed" : "Sent") : "Received"}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-medium truncate">{msg.subject || "(no subject)"}</span>
                            {!open && preview && (
                              <span className="block text-xs text-muted-foreground truncate">{preview}</span>
                            )}
                          </span>
                          <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                            {new Date(msg.createdAt).toLocaleString()}
                          </span>
                          <ChevronDown className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
                        </button>
                        {open && (
                          <div className="px-4 pb-4 space-y-3">
                            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                              <span className="min-w-0 break-all">
                                {msg.direction === "outbound" ? "You" : msg.fromEmail || "Lead"} → {msg.direction === "outbound" ? msg.toEmail : "you"}
                              </span>
                              <div className="flex items-center gap-3 shrink-0">
                                {msg.direction === "inbound" && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => startEmailReply(msg, false)}
                                      className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
                                      title="Reply to the sender"
                                    >
                                      <Reply className="w-3.5 h-3.5" />
                                      Reply
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => startEmailReply(msg, true)}
                                      className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
                                      title="Reply to the sender and other participants"
                                    >
                                      <ReplyAll className="w-3.5 h-3.5" />
                                      Reply all
                                    </button>
                                  </>
                                )}
                                {(msg.bodyText || msg.subject) && (
                                  <button
                                    type="button"
                                    onClick={() => copyEmailBody(msg)}
                                    className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
                                    title="Copy message body"
                                  >
                                    {copiedEmailId === msg.id ? <CheckCircle2 className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
                                    {copiedEmailId === msg.id ? "Copied" : "Copy"}
                                  </button>
                                )}
                              </div>
                            </div>
                            {typeof msg.metadata?.cc === "string" && msg.metadata.cc && (
                              <p className="break-all text-xs text-muted-foreground"><span className="font-medium">Cc:</span> {msg.metadata.cc}</p>
                            )}
                            {msg.bodyText ? (
                              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{msg.bodyText}</p>
                            ) : (
                              <p className="text-sm text-muted-foreground italic">No message body stored for this entry.</p>
                            )}
                            {attachments.length > 0 && (
                              <div className="rounded-md border border-border p-3">
                                <p className="mb-2 text-xs font-medium">Attachments</p>
                                <ul className="space-y-1 text-xs text-muted-foreground">
                                  {attachments.map((file, index) => (
                                    <li key={`${file.filename}-${index}`} className="flex items-center gap-1.5">
                                      <Paperclip className="h-3.5 w-3.5 shrink-0" />
                                      <span className="break-all">{file.filename}{file.size !== null ? ` (${Math.max(1, Math.round(file.size / 1024))} KB)` : ""}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {emailsError && (
                <p role="alert" className="text-sm text-destructive">{emailsError}</p>
              )}

                <div id="lead-email-composer" className="rounded-lg border border-border p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className={labelClass}>{replyContext ? (replyContext.replyAll ? "Reply all" : "Reply") : "New message"}</p>
                  {replyContext && (
                    <button
                      type="button"
                      onClick={() => {
                        setReplyContext(null)
                        setEmailSubjectEdited(false)
                        setEmailForm({ subject: buildLeadEmailSubject(null, lead.businessName), body: "" })
                      }}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Cancel reply
                    </button>
                  )}
                </div>

                {/* Packaged, industry-specific email templates */}
                <div className="space-y-2 rounded-md border bg-muted/10 p-3">
                  <div>
                    <p className="text-xs font-medium">To</p>
                    <div aria-label="Email To recipients" className={`${inputClass} mt-1 flex flex-wrap gap-1.5`}>
                      {(replyContext ? replyRecipients?.to || [] : [lead.email, lead.additionalEmail].filter(Boolean)).map((address) => <span key={address} className="break-all rounded bg-muted px-2 py-1">{address}</span>)}
                      {replyContext && !replyReady && <span>Loading reply recipients…</span>}
                    </div>
                  </div>
                  {(replyContext?.replyAll || !!replyRecipients?.cc.length) && (
                    <div>
                      <p className="text-xs font-medium">Cc</p>
                      <div aria-label="Email Cc recipients" className={`${inputClass} mt-1 flex flex-wrap gap-1.5`}>
                        {replyRecipients?.cc.map((address) => <span key={address} className="break-all rounded bg-muted px-2 py-1">{address}</span>)}
                        {!replyRecipients?.cc.length && <span className="text-muted-foreground">{replyReady ? "No additional Cc recipients" : "Loading copied recipients…"}</span>}
                      </div>
                    </div>
                  )}
                  {replyContext && <p className="text-xs text-muted-foreground">{replyReady ? "These are the recipients that will receive your reply. Your own mailbox and duplicate addresses are excluded." : "Load the email thread to confirm recipients before sending."}</p>}
                </div>
                <EmailLayoutSwitch value={emailLayout} disabled={sendingEmail || previewLoading} onChange={(layout) => { setEmailLayout(layout); setEmailPreview(null) }} />
                <EmailDraftControls manager={emailDraft} disabled={sendingEmail || readingAttachments || previewLoading}
                  getDraft={() => ({ subject: emailForm.subject, bodyHtml: emailForm.body, layout: emailLayout, replyContext, attachments: emailAttachments.map(({ filename, content }) => ({ filename, content })) })}
                  onRestore={(draft) => {
                    setEmailForm({ subject: draft.subject, body: draft.bodyHtml })
                    setEmailLayout(draft.layout)
                    setEmailSubjectEdited(true)
                    setReplyContext(draft.replyContext || null)
                    setEmailTemplateKey(null)
                    setEmailAttachments(draft.attachments.map((file) => ({ ...file, size: base64ByteLength(file.content) })))
                    setEmailPreview(null)
                  }} />
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">Templates</p>
                    <select
                      value={emailTemplateIndustry}
                      onChange={(e) => {
                        const value = e.target.value
                        setEmailTemplateIndustry(value)
                        if (emailTemplateKey && emailTemplateUnedited) applyEmailTemplate(emailTemplateKey, value)
                      }}
                      className="h-7 rounded-md border border-border bg-background px-2 text-xs text-foreground max-w-[220px]"
                      title="Industry the template copy is tailored to"
                    >
                      <option value="">General (no industry)</option>
                      {industryOptions.map((name) => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {LEAD_EMAIL_STAGES.map((stage) => (
                      <button
                        key={stage.key}
                        type="button"
                        title={stage.description}
                        onClick={() => applyEmailTemplate(stage.key)}
                        className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                          emailTemplateKey === stage.key
                            ? "border-retail bg-retail-soft text-retail"
                            : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30"
                        }`}
                      >
                        {stage.key === "introduction" && <Rocket className="w-3.5 h-3.5" />}
                        {stage.key === "follow_up" && <Bell className="w-3.5 h-3.5" />}
                        {stage.key === "nurture" && <TrendingUp className="w-3.5 h-3.5" />}
                        {stage.key === "thank_you" && <CheckCircle2 className="w-3.5 h-3.5" />}
                        {stage.label}
                      </button>
                    ))}
                  </div>
                  {appliedEmailTemplate && (
                    <p className="text-[11px] text-muted-foreground">
                      {emailTemplateUnedited ? (
                        <>
                          Template copy loaded
                          {appliedEmailTemplate.industry ? (
                            <> tailored to <span className="font-medium text-foreground">{appliedEmailTemplate.industry}</span></>
                          ) : null}
                          . Edit it below and choose either email style.
                        </>
                      ) : (
                        <>Your edited copy and formatting will be kept in the selected email style.</>
                      )}{" "}
                      <button
                        type="button"
                        onClick={() => setEmailTemplateKey(null)}
                        className="underline hover:text-foreground"
                      >
                        Detach template
                      </button>
                    </p>
                  )}
                </div>

                <input
                  type="text"
                  value={emailForm.subject}
                  onChange={(e) => {
                    setEmailSubjectEdited(true)
                    setEmailForm((p) => ({ ...p, subject: e.target.value }))
                  }}
                  placeholder={`Subject — e.g. MartPoint for ${lead.businessName || "your business"}`}
                  className={inputClass}
                />
                <EmailRichEditor
                  value={emailForm.body}
                  onChange={(html) => { setEmailForm((p) => ({ ...p, body: html })); setEmailPreview(null) }}
                  allowImages={false}
                  disabled={sendingEmail}
                  minHeight={280}
                />
                <p className="text-xs text-muted-foreground">Your signature, MartPoint footer and banner are added automatically. Preview shows the email as it will be sent.</p>

                {/* Documents sent with this message. */}
                <div className="space-y-2">
                  {emailAttachments.length > 0 && (
                    <ul className="space-y-1.5">
                      {emailAttachments.map((a) => (
                        <li key={a.filename} className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/20 px-3 py-1.5 text-xs">
                          <span className="flex items-center gap-1.5 min-w-0">
                            <Paperclip className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
                            <span className="truncate">{a.filename}</span>
                            <span className="text-muted-foreground shrink-0">({Math.max(1, Math.round(a.size / 1024))} KB)</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => removeAttachment(a.filename)}
                            disabled={sendingEmail || readingAttachments}
                            className="text-muted-foreground hover:text-destructive shrink-0"
                            title="Remove attachment"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <Button type="button" variant="outline" size="sm" disabled={sendingEmail || readingAttachments || emailAttachments.length >= MAX_LEAD_EMAIL_ATTACHMENTS} onClick={() => attachmentInput.current?.click()}>
                    {readingAttachments ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Paperclip className="mr-1.5 h-4 w-4" />}
                    {readingAttachments ? "Preparing attachments…" : "Attach documents"}
                  </Button>
                  <p className="text-xs text-muted-foreground">{LEAD_EMAIL_ATTACHMENT_HINT}</p>
                    <input
                      ref={attachmentInput}
                      type="file"
                      multiple
                      aria-label="Attach documents to lead email"
                      disabled={sendingEmail || readingAttachments}
                      className="hidden"
                      onChange={(e) => {
                        void handleAddAttachments(e.target.files)
                        e.target.value = ""
                      }}
                    />
                </div>

                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] text-muted-foreground">
                    {replyContext
                      ? `Replying ${replyContext.replyAll ? "to all participants" : "to the sender"} in this thread.`
                      : `Sent to ${lead.email}${lead.additionalEmail ? ` and copied to ${lead.additionalEmail}` : ""}`}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handlePreviewEmail}
                      disabled={sendingEmail || previewLoading || !emailForm.subject.trim() || !htmlToText(emailForm.body).trim()}
                    >
                      {previewLoading ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Eye className="w-4 h-4 mr-1.5" />}
                      Preview
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSendEmail}
                      disabled={sendingEmail || readingAttachments || emailDraft.busy || emailDraft.loading || !replyReady || emailForm.body.length > 50000 || !emailForm.subject.trim() || !htmlToText(emailForm.body).trim()}
                    >
                      {sendingEmail ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Mail className="w-4 h-4 mr-1.5" />}
                      Send Email
                    </Button>
                  </div>
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
                {lead.additionalEmail ? ` The email is also copied to ${lead.additionalEmail}.` : ""}
              </p>

              <div className="rounded-lg border border-border p-4 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">New Questions</p>

                <div>
                  <label className={labelClass}>Question template by industry</label>
                  <select
                    value={selectedQuestionTemplateIndustry}
                    onChange={(e) => applyQuestionTemplate(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">Select an industry template...</option>
                    {LEAD_ADDITIONAL_QUESTION_TEMPLATES.map((template) => (
                      <option key={template.industry} value={template.industry}>
                        {template.label}{leadTemplate?.industry === template.industry ? " (lead industry)" : ""}
                      </option>
                    ))}
                  </select>
                  {leadTemplate && !selectedQuestionTemplateIndustry && (
                    <p className="mt-1.5 text-xs text-muted-foreground">This lead is in {lead.industry}; select “{leadTemplate.label}” above to load its questions.</p>
                  )}
                </div>

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
                        {editingMeetingId === m.id ? (
                          <div className="rounded-md border border-border p-3 space-y-3">
                            <p className="text-sm font-medium">Edit meeting</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div className="sm:col-span-2">
                                <label className={labelClass}>Title</label>
                                <input
                                  type="text"
                                  value={editMeetingForm.title}
                                  onChange={(e) => setEditMeetingForm((p) => ({ ...p, title: e.target.value }))}
                                  className={inputClass}
                                />
                              </div>
                              {m.status === "SCHEDULED" && (
                                <div>
                                  <label className={labelClass}>Date &amp; time</label>
                                  <input
                                    type="datetime-local"
                                    value={editMeetingForm.scheduledAt}
                                    onChange={(e) => setEditMeetingForm((p) => ({ ...p, scheduledAt: e.target.value }))}
                                    className={inputClass}
                                  />
                                  <p className="mt-1 text-[11px] text-muted-foreground">
                                    Entered in your browser time; the meeting displays in {editMeetingForm.timezone}.
                                  </p>
                                </div>
                              )}
                              <div>
                                <label className={labelClass}>Duration (minutes)</label>
                                <input
                                  type="number"
                                  min={10}
                                  max={240}
                                  value={editMeetingForm.durationMinutes}
                                  onChange={(e) =>
                                    setEditMeetingForm((p) => ({ ...p, durationMinutes: Number(e.target.value) }))
                                  }
                                  className={inputClass}
                                />
                              </div>
                              <div>
                                <label className={labelClass}>Timezone</label>
                                <input
                                  type="text"
                                  value={editMeetingForm.timezone}
                                  onChange={(e) => setEditMeetingForm((p) => ({ ...p, timezone: e.target.value }))}
                                  className={inputClass}
                                  placeholder="Africa/Lagos"
                                />
                              </div>
                              <div className="sm:col-span-2">
                                <label className={labelClass}>Internal notes</label>
                                <textarea
                                  rows={2}
                                  value={editMeetingForm.notes}
                                  onChange={(e) => setEditMeetingForm((p) => ({ ...p, notes: e.target.value }))}
                                  className={`${inputClass} resize-none`}
                                  placeholder="Agenda, talking points, preparation..."
                                />
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <Button
                                size="sm"
                                disabled={busy || (m.status === "SCHEDULED" && !editMeetingForm.scheduledAt)}
                                onClick={() => handleUpdateMeeting(m)}
                              >
                                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : null}
                                Save changes
                              </Button>
                              <Button size="sm" variant="ghost" disabled={busy} onClick={() => setEditingMeetingId(null)}>
                                Cancel
                              </Button>
                              <span className="text-[11px] text-muted-foreground">
                                {m.status === "SCHEDULED"
                                  ? "Changing the time or duration emails the lead an updated invite."
                                  : "The invite page picks up these changes automatically."}
                              </span>
                            </div>
                          </div>
                        ) : (
                          <>
                        {m.meetingLink ? (
                          <a href={m.meetingLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-retail hover:underline">
                            <Video className="w-3.5 h-3.5" />
                            {m.provider || "Meeting link"} · {m.meetingLink}
                          </a>
                        ) : m.status === "SCHEDULED" ? (
                          <p className="text-xs text-amber-700">
                            No meeting link yet.{googleConnected ? " Use Generate Meet link below." : " Connect Google Meet in Settings, then generate one."}
                          </p>
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
                            {(m.summary || m.transcript || m.actionItems?.length) && lead.email && (
                              <div className="space-y-2 pt-1">
                                {followup?.meetingId !== m.id ? (
                                  <div className="flex items-center gap-2">
                                    <Button size="sm" variant="outline" disabled={busy} onClick={() => draftMeetingFollowup(m)}>
                                      {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Mail className="w-3.5 h-3.5 mr-1" />}
                                      Draft follow-up email
                                    </Button>
                                    {m.summarySentAt && (
                                      <span className="text-[11px] text-muted-foreground">
                                        Last sent {new Date(m.summarySentAt).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <div className="rounded-md border border-border p-3 space-y-2">
                                    <p className={labelClass}>Follow-up to {lead.email}</p>
                                    <input
                                      value={followup.subject}
                                      onChange={(e) => setFollowup((p) => (p ? { ...p, subject: e.target.value } : p))}
                                      className={inputClass}
                                      placeholder="Subject"
                                    />
                                    <textarea
                                      rows={9}
                                      value={followup.body}
                                      onChange={(e) => setFollowup((p) => (p ? { ...p, body: e.target.value } : p))}
                                      className={`${inputClass} resize-y`}
                                    />
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <Button size="sm" disabled={busy || !followup.subject.trim() || !followup.body.trim()} onClick={() => sendMeetingFollowup(m)}>
                                        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Mail className="w-3.5 h-3.5 mr-1" />}
                                        Send to lead
                                      </Button>
                                      <Button size="sm" variant="ghost" onClick={() => setFollowup(null)}>
                                        Discard
                                      </Button>
                                      <span className="text-[11px] text-muted-foreground">Edit freely — it sends exactly as shown.</span>
                                    </div>
                                  </div>
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
                            <Button size="sm" variant="outline" disabled={busy} onClick={() => startEditingMeeting(m)}>
                              <Pencil className="w-3.5 h-3.5 mr-1" />
                              {m.status === "SCHEDULED" ? "Edit / reschedule" : "Edit"}
                            </Button>
                            {m.status === "SCHEDULED" && !m.meetingLink && googleConnected && (
                              <Button size="sm" variant="outline" disabled={busy} onClick={() => handleCreateMeet(m)}>
                                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Video className="w-3.5 h-3.5 mr-1" />}
                                Generate Meet link
                              </Button>
                            )}
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
                          </>
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

              <ActionCard
                icon={<Bell className="w-5 h-5 text-warning" />}
                title={remindersPaused ? "Reminders paused" : "Automated reminders on"}
                description={
                  remindersPaused
                    ? "This lead has opted out of follow-up reminders. Resume to let the 48h sequences reach them again."
                    : "This lead receives automated 48h follow-ups (questionnaire, quote, estimate). Pause if they ask us to stop notifying them."
                }
                buttonText={remindersPaused ? "Resume reminders" : "Pause reminders"}
                onClick={() => handleToggleReminders("reminders")}
                loading={togglingReminders}
                accent={remindersPaused ? "success" : "warning"}
              />

              <div className="flex items-start justify-between gap-4 rounded-xl border border-border bg-muted/10 p-4 hover:bg-muted/20 transition-colors">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="shrink-0 mt-0.5 p-2 rounded-lg bg-background border border-border/50">
                    <Ban className="w-5 h-5 text-destructive" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">Do not contact</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Stop <strong>all</strong> MartPoint email to this lead — reminders <em>and</em> marketing. Use when they ask to be left alone entirely. Transactional messages (invoices, receipts) are still delivered.
                    </p>
                  </div>
                </div>
                <div className="shrink-0 flex flex-col gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleToggleReminders("do_not_contact")}
                    disabled={togglingReminders}
                    className="border-destructive/30 text-destructive hover:bg-destructive/5"
                  >
                    {togglingReminders ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
                    Stop all contact
                  </Button>
                </div>
              </div>

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

      {/* ─── Email client preview ─── */}
      {emailPreview && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4"
          onClick={() => setEmailPreview(null)}
        >
          <div
            className="w-full max-w-3xl max-h-[92vh] flex flex-col rounded-2xl border border-border bg-background shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="shrink-0 flex items-start justify-between gap-3 border-b border-border px-5 py-4">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Client preview</p>
                <p className="mt-0.5 text-sm font-semibold truncate">Subject: {emailPreview.subject}</p>
                <p className="text-xs text-muted-foreground truncate">Will be delivered to {lead.email}</p>
              </div>
              <button
                onClick={() => setEmailPreview(null)}
                className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
                title="Close preview (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 min-h-0 bg-neutral-100 p-4">
              <iframe
                title="Email preview as the client sees it"
                srcDoc={emailPreview.html}
                sandbox=""
                className="h-full max-h-[70vh] w-full rounded-lg border border-border bg-white"
              />
            </div>
            <div className="shrink-0 flex items-center justify-between gap-3 border-t border-border bg-muted/30 px-5 py-3">
              <p className="text-[11px] text-muted-foreground">
                Rendered by the same code that sends the email — nothing has been sent yet.
              </p>
              <Button variant="outline" size="sm" onClick={() => setEmailPreview(null)}>
                Back to composer
              </Button>
            </div>
          </div>
        </div>
      )}
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
  accent: "retail" | "erp" | "proposal" | "info" | "success" | "destructive" | "warning"
}) {
  const btnVariant = accent === "destructive" ? "outline" : accent === "retail" ? "retail" : "outline"
  const btnClass =
    accent === "destructive"
      ? "border-destructive/30 text-destructive hover:bg-destructive/5"
      : accent === "warning"
        ? "border-amber-300 text-amber-700 hover:bg-amber-50"
        : ""

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

  return { sourceLabel: leadSourceLabel(source) }
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
