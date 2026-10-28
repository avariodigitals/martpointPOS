"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import {
  ArrowUpRight,
  Check,
  ChevronRight,
  LifeBuoy,
  Loader2,
  Mail,
  MessageSquare,
  Paperclip,
  RefreshCw,
  Send,
  ShieldCheck,
  UserRound,
  X
} from "lucide-react"
import EmailRichEditor from "@/components/admin/email-rich-editor"
import { SupportRequesterPicker } from "@/components/admin/support-requester-picker"
import type { SupportRequester } from "@/lib/support-requester"
import { htmlToText } from "@/lib/email-html"
import { cn, enumLabel, supportCategoryLabel, ticketStatusLabel, ticketEventValueLabel } from "@/lib/utils"

export type Ticket = {
  id: string
  ticket_number: string
  subject: string
  description?: string
  status: string
  category: string
  priority: string
  requester_name?: string
  requester_email?: string
  requester_on_behalf_of?: string
  requester_profile: SupportRequester
  admin?: { name: string }
  partner?: { display_name: string }
  created_at: string
  updated_at: string
  first_response_due_at?: string
  resolution_due_at?: string
  sla_state?: string
  resolved_at?: string
  satisfaction_sent_at?: string
  satisfaction_reminder_sent_at?: string
  auto_close_at?: string
  satisfaction_response?: string
  final_closure_notice_sent_at?: string
}
type Attachment = { id: string; original_name: string }
export type Message = {
  id: string
  author_type: string
  author_name?: string
  message: string
  message_html?: string
  signature_html?: string
  visibility: string
  created_at: string
  email_status?: string
  email_error?: string
  email_recipient?: string
  attachments?: Attachment[]
}
export type TicketEvent = {
  id: string
  event_type: string
  actor_type: string
  actor_name?: string
  previous_value?: string
  new_value?: string
  metadata?: { reason?: string; satisfaction_response?: string }
  created_at: string
}
export type Sender = {
  name: string
  signatureHtml: string
  canUpdate: boolean
  canAssign: boolean
  canNotes: boolean
}
const categories = [
  "SOFTWARE",
  "LOGIN_ACCOUNT",
  "POS",
  "INVENTORY",
  "PRODUCTS",
  "REPORTS",
  "ONLINE_STORE",
  "CONFIGURATION",
  "TRAINING",
  "BILLING",
  "LICENSING",
  "SECURITY",
  "PRIVACY_DATA",
  "HARDWARE_GUIDANCE",
  "FEATURE_REQUEST",
  "PARTNER_COMPLAINT",
  "CREATOR_NETWORK",
  "PARTNER_NETWORK",
  "OTHER"
]
const inputClass = "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
const buttonClass =
  "inline-flex items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-50"
const primaryButtonClass = cn(
  buttonClass,
  "border-blue-600 bg-blue-600 text-white hover:border-blue-700 hover:bg-blue-700 hover:text-white"
)
const richClass =
  "text-sm leading-relaxed break-words [&_p]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-blue-600 [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:pl-3 [&_img]:max-w-full [&_pre]:overflow-x-auto [&_table]:max-w-full"
function fmt(value?: string) {
  return value
    ? new Date(value).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })
    : "Not scheduled"
}
function stage(status: string) {
  return status === "CLOSED"
    ? 4
    : status === "RESOLVED"
      ? 3
      : ["IN_PROGRESS", "WAITING_CUSTOMER", "WAITING_PARTNER", "ESCALATED"].includes(status)
        ? 2
        : status === "ASSIGNED"
          ? 1
          : 0
}
function statusText(status: string) {
  return status === "RESOLVED" ? "Awaiting customer confirmation" : ticketStatusLabel(status)
}
function stageHelp(ticket: Ticket) {
  if (ticket.status === "RESOLVED")
    return ticket.satisfaction_sent_at
      ? "The requester has been asked to confirm the fix. A follow-up is sent after three days; closure follows after five days of silence and a final email."
      : "The issue is marked resolved. Confirmation email is pending; automatic closure will wait until it is successfully sent."
  return (
    (
      {
        NEW: "New request received. Assign a teammate to take ownership.",
        ASSIGNED: "A support teammate has been assigned. Start work when investigation begins.",
        IN_PROGRESS: "The support team is actively working on this request.",
        WAITING_CUSTOMER: "Progress is waiting for a reply or information from the requester.",
        WAITING_PARTNER: "Progress is waiting for action from the assigned partner.",
        ESCALATED: "This request needs attention from the senior support team.",
        CLOSED:
          ticket.satisfaction_response === "satisfied"
            ? "The requester confirmed the issue is resolved."
            : "Closed after the confirmation period and final closure email.",
        CANCELLED: "This request has been cancelled."
      } as Record<string, string>
    )[ticket.status] || ""
  )
}

export type TicketThread = { ticket: Ticket; messages: Message[]; events: TicketEvent[] }
export type TicketDraft = { reply: string; internal: boolean; files: Attachment[] }
export type SupportAssignees = {
  users?: { id: string; name: string }[]
  partners?: { id: string; display_name: string; business_name: string }[]
  partnerUsers?: { id: string; full_name: string }[]
}

export default function SupportTicketDetail({
  ticketId,
  initial,
  sender,
  fetchThread,
  fetchAssignees,
  onUpdated,
  onBusyChange,
  drafts
}: {
  ticketId: string
  initial?: TicketThread
  sender: Sender | null
  fetchThread: (id: string, force?: boolean) => Promise<TicketThread>
  fetchAssignees: (partnerId: string) => Promise<SupportAssignees>
  onUpdated: (ticket: Ticket) => void
  onBusyChange: (busy: boolean) => void
  drafts: Map<string, TicketDraft>
}) {
  const [ticket, setTicket] = useState<Ticket | null>(initial?.ticket || null)
  const [messages, setMessages] = useState<Message[]>(initial?.messages || [])
  const [events, setEvents] = useState<TicketEvent[]>(initial?.events || [])
  const [loading, setLoading] = useState(!initial)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState("")
  const [reply, setReply] = useState(drafts.get(ticketId)?.reply || "")
  const [internal, setInternal] = useState(drafts.get(ticketId)?.internal || false)
  const [files, setFiles] = useState<Attachment[]>(drafts.get(ticketId)?.files || [])
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const readVersion = useRef(0)
  const [editRequester, setEditRequester] = useState(false)
  const [owner, setOwner] = useState<SupportRequester | null>(null)
  const [requesterName, setRequesterName] = useState("")
  const [requesterEmail, setRequesterEmail] = useState("")
  const [onBehalf, setOnBehalf] = useState("")
  const [users, setUsers] = useState<{ id: string; name: string }[]>([])
  const [partners, setPartners] = useState<{ id: string; display_name: string; business_name: string }[]>([])
  const [partnerUsers, setPartnerUsers] = useState<{ id: string; full_name: string }[]>([])
  const [adminId, setAdminId] = useState("")
  const [partnerId, setPartnerId] = useState("")
  const [partnerUserId, setPartnerUserId] = useState("")
  const [priority, setPriority] = useState("")
  const [category, setCategory] = useState("")
  const [escalation, setEscalation] = useState("")

  useEffect(() => {
    drafts.set(ticketId, { reply, internal, files })
  }, [drafts, ticketId, reply, internal, files])
  useEffect(() => {
    onBusyChange(saving || uploading)
    return () => onBusyChange(false)
  }, [saving, uploading, onBusyChange])

  const load = useCallback(
    async (signal?: AbortSignal, force = true) => {
      const version = ++readVersion.current
      try {
        const thread = await fetchThread(ticketId, force)
        if (signal?.aborted || version !== readVersion.current) return
        setTicket(thread.ticket)
        setMessages(thread.messages)
        setEvents(thread.events)
        onUpdated(thread.ticket)
      } catch (error) {
        if (!signal?.aborted && version === readVersion.current)
          setNotice(error instanceof Error ? error.message : "Could not load ticket")
      } finally {
        if (!signal?.aborted && version === readVersion.current) setLoading(false)
      }
    },
    [ticketId, fetchThread, onUpdated]
  )
  useEffect(() => {
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setNotice("")
      void load(controller.signal, false)
    }, 0)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [load])
  useEffect(() => {
    if (!sender?.canAssign) return
    const controller = new AbortController()
    fetchAssignees(partnerId)
      .then((data) => {
        if (controller.signal.aborted) return
        if (partnerId) setPartnerUsers(data.partnerUsers || [])
        else {
          setUsers(data.users || [])
          setPartners(data.partners || [])
        }
      })
      .catch((error) => {
        if (!controller.signal.aborted) setNotice(error.message || "Could not load assignees")
      })
    return () => controller.abort()
  }, [sender?.canAssign, partnerId, fetchAssignees])

  async function action(name: string, data: Record<string, unknown>) {
    setSaving(true)
    setNotice("")
    try {
      const response = await fetch("/api/admin/support/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: name, data: { id: ticketId, ...data } })
      })
      const result = await response.json()
      if (!response.ok || !result.success) throw new Error(result.error || "Could not update ticket")
      setEditRequester(false)
      await load()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not update ticket")
    } finally {
      setSaving(false)
    }
  }
  async function sendReply() {
    const text = htmlToText(reply)
    if (!text && !files.length) return
    setSaving(true)
    setNotice("")
    try {
      const response = await fetch("/api/admin/support/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          data: {
            ticketId,
            message: text || "Please see the attached file.",
            messageHtml: reply,
            visibility: internal ? "INTERNAL" : "PUBLIC",
            attachmentIds: files.map((file) => file.id)
          }
        })
      })
      const result = await response.json()
      if (!response.ok || !result.success) throw new Error(result.error || "Could not post reply")
      setReply("")
      setFiles([])
      if (!internal && result.data.email_status !== "accepted")
        setNotice(
          result.data.email_error || "Reply saved, but the email was not sent. You can retry it below."
        )
      await load()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not post reply")
    } finally {
      setSaving(false)
    }
  }
  async function upload(selected: FileList | null) {
    if (!selected) return
    setUploading(true)
    setNotice("")
    try {
      if (files.length + selected.length > 3) throw new Error("Attach up to three files per reply")
      for (const file of Array.from(selected)) {
        if (file.size > 3 * 1024 * 1024) throw new Error("Each attachment must be 3 MB or less")
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(String(reader.result).split(",")[1])
          reader.onerror = () => reject(new Error("Could not read attachment"))
          reader.readAsDataURL(file)
        })
        const response = await fetch("/api/admin/support/attachments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ticketId,
            fileName: file.name,
            mimeType: file.type,
            fileSize: file.size,
            fileBase64: base64,
            isInternal: internal
          })
        })
        const result = await response.json()
        if (!response.ok || !result.success) throw new Error(result.error || "Upload failed")
        setFiles((current) => [...current, result.attachment])
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Upload failed")
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ""
    }
  }
  async function attachment(id: string) {
    const response = await fetch(`/api/admin/support/attachments?attachmentId=${id}`)
    const data = await response.json()
    if (data.success) window.open(data.signedUrl, "_blank", "noopener,noreferrer")
    else setNotice(data.error || "Could not open attachment")
  }
  async function retry(id: string) {
    setSaving(true)
    try {
      const response = await fetch("/api/admin/support/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "retry_email", data: { ticketId, messageId: id } })
      })
      const data = await response.json()
      if (!data.success || !data.data.sent) throw new Error(data.error || data.data?.error || "Email failed")
      setNotice("")
      await load()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Email failed")
    } finally {
      setSaving(false)
    }
  }
  const timeline = useMemo(
    () =>
      [
        ...messages.map((message) => ({
          kind: "message" as const,
          id: message.id,
          at: message.created_at,
          message
        })),
        ...events.map((event) => ({ kind: "event" as const, id: event.id, at: event.created_at, event }))
      ].sort((a, b) => Date.parse(b.at) - Date.parse(a.at)),
    [messages, events]
  )

  if (loading)
    return (
      <div
        role="status"
        className="space-y-5 rounded-xl border border-border bg-card p-6"
        aria-label="Loading selected ticket"
      >
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading selected ticket…
        </div>
        <div className="h-8 w-2/3 animate-pulse rounded bg-muted" />
        <div className="h-24 animate-pulse rounded bg-muted" />
        <div className="h-64 animate-pulse rounded bg-muted" />
      </div>
    )
  if (!ticket)
    return (
      <div className="p-6">
        <p className="mt-4">{notice || "Ticket not found"}</p>
        <button className={buttonClass} onClick={() => void load()}>
          Retry loading ticket
        </button>
      </div>
    )
  const recipient = ticket.requester_email || ticket.requester_profile?.email || ""
  const currentStage = stage(ticket.status)
  const resolved = ticket.status === "RESOLVED"
  const closed = ["CLOSED", "CANCELLED"].includes(ticket.status)

  return (
    <div className="min-w-0 space-y-5">
      <header className="rounded-xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="mb-1 flex items-center gap-2 text-xs font-semibold text-blue-600">
              <LifeBuoy className="h-4 w-4" />
              {ticket.ticket_number}
            </p>
            <h1 className="text-xl font-semibold">{ticket.subject}</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${closed ? "bg-slate-100 text-slate-600" : resolved ? "bg-emerald-50 text-emerald-700" : "bg-blue-50 text-blue-700"}`}
            >
              {statusText(ticket.status)}
            </span>
            <span className="rounded-full bg-muted px-3 py-1 text-xs">
              {enumLabel(ticket.priority)} priority
            </span>
            <span className="rounded-full bg-muted px-3 py-1 text-xs">
              {supportCategoryLabel(ticket.category)}
            </span>
          </div>
        </div>
        <ol aria-label="Ticket stages" className="mt-5 grid grid-cols-5 gap-1.5">
          {["Received", "Assigned", "In progress", "Confirm resolution", "Closed"].map((label, index) => (
            <li
              key={label}
              aria-current={index === currentStage ? "step" : undefined}
              className={`rounded-lg border border-border px-2 py-2.5 text-center text-[10px] font-medium sm:text-xs ${index === currentStage ? "border-blue-600 bg-blue-600 text-white" : index < currentStage ? "border-emerald-100 bg-emerald-50 text-emerald-800" : "border-border border-border text-muted-foreground"}`}
            >
              <span className="mb-1 flex justify-center">
                {index < currentStage ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-border text-[10px]">
                    {index + 1}
                  </span>
                )}
              </span>
              {label}
            </li>
          ))}
        </ol>
        <p className="mt-3 text-sm text-muted-foreground">{stageHelp(ticket)}</p>
        {sender?.canUpdate && (
          <div className="mt-4 flex flex-wrap gap-2">
            {!closed && !resolved && (
              <>
                <button
                  className={buttonClass}
                  disabled={saving || ticket.status === "IN_PROGRESS"}
                  onClick={() => void action("change_status", { status: "IN_PROGRESS" })}
                >
                  Start / resume work
                </button>
                <button
                  className={buttonClass}
                  disabled={saving || ticket.status === "WAITING_CUSTOMER"}
                  onClick={() => void action("change_status", { status: "WAITING_CUSTOMER" })}
                >
                  Awaiting requester
                </button>
                <button
                  className={buttonClass}
                  disabled={saving || ticket.status === "WAITING_PARTNER"}
                  onClick={() => void action("change_status", { status: "WAITING_PARTNER" })}
                >
                  Awaiting partner
                </button>
                <button
                  className={primaryButtonClass}
                  disabled={saving || !recipient}
                  onClick={() => void action("change_status", { status: "RESOLVED" })}
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Resolve & ask for confirmation
                </button>
              </>
            )}
            {(resolved || closed) && (
              <button
                className={buttonClass}
                disabled={saving}
                onClick={() => void action("change_status", { status: "IN_PROGRESS" })}
              >
                Reopen ticket
              </button>
            )}
          </div>
        )}
      </header>
      {notice && (
        <div
          role="alert"
          className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
        >
          {notice}
        </div>
      )}
      <div className="grid min-w-0 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_270px]">
        <main className="min-w-0 space-y-5">
          {sender?.canUpdate && !closed && (
            <section className="rounded-xl border border-border bg-card p-4">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setInternal(false)
                    setFiles([])
                  }}
                  className={cn(buttonClass, !internal && "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 hover:text-blue-800")}
                >
                  <Mail className="h-3.5 w-3.5" />
                  Reply to requester
                </button>
                {sender.canNotes && (
                  <button
                    type="button"
                    onClick={() => {
                      setInternal(true)
                      setFiles([])
                    }}
                    className={cn(buttonClass, internal && "border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 hover:text-amber-900")}
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    Internal note
                  </button>
                )}
              </div>
              <p className="mb-2 break-all text-xs text-muted-foreground">
                {internal
                  ? "Visible to the support team only."
                  : `To: ${ticket.requester_name || ticket.requester_profile?.name} · ${recipient || "Add a requester email before sending"}`}
              </p>
              <EmailRichEditor value={reply} onChange={setReply} allowImages={false} minHeight={180} />
              {!internal && (
                <details className="mt-3 rounded-lg bg-muted/40 p-3">
                  <summary className="cursor-pointer text-xs font-medium">
                    {sender.name}’s email signature · attached automatically
                  </summary>
                  <div
                    className={`${richClass} mt-2`}
                    dangerouslySetInnerHTML={{ __html: sender.signatureHtml }}
                  />
                </details>
              )}
              {files.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {files.map((file) => (
                    <span
                      className="inline-flex items-center gap-1 rounded border border-border px-2 py-1 text-xs"
                      key={file.id}
                    >
                      <Paperclip className="h-3 w-3" />
                      {file.original_name}
                      <button
                        aria-label={`Remove ${file.original_name}`}
                        onClick={() => setFiles((current) => current.filter((item) => item.id !== file.id))}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="mt-3 flex flex-wrap justify-between gap-2">
                <button
                  type="button"
                  disabled={uploading || files.length >= 3}
                  className={buttonClass}
                  onClick={() => fileRef.current?.click()}
                >
                  {uploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Paperclip className="h-4 w-4" />
                  )}
                  Attach files
                </button>
                <button
                  disabled={
                    saving || uploading || (!htmlToText(reply) && !files.length) || (!internal && !recipient)
                  }
                  onClick={() => void sendReply()}
                  className={primaryButtonClass}
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {internal ? "Save internal note" : "Send reply & email"}
                </button>
              </div>
              <input
                ref={fileRef}
                type="file"
                multiple
                accept=".pdf,.txt,.png,.jpg,.jpeg,.webp,.gif"
                className="hidden"
                onChange={(e) => void upload(e.target.files)}
              />
            </section>
          )}
          <section className="rounded-xl border border-border bg-card p-4">
            <div className="mb-4 flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold">Conversation & activity</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Newest first · Open each entry independently
                </p>
              </div>
              <button aria-label="Refresh conversation" onClick={() => void load()} className={buttonClass}>
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="space-y-2">
              {timeline.map((entry) => {
                const m = entry.kind === "message" ? entry.message : null
                const e = entry.kind === "event" ? entry.event : null
                const title = m
                  ? m.author_name || enumLabel(m.author_type)
                  : e?.event_type === "CREATED"
                    ? "Ticket created"
                    : enumLabel(e?.event_type || "Update")
                const preview = m
                  ? m.message
                  : e?.event_type === "CREATED"
                    ? ticket.description
                    : [
                        e?.previous_value ? ticketEventValueLabel(e.previous_value) : "",
                        e?.new_value ? ticketEventValueLabel(e.new_value) : ""
                      ]
                        .filter(Boolean)
                        .join(" → ")
                return (
                  <details
                    key={entry.id}
                    className={`group rounded-lg border border-border ${m?.visibility === "INTERNAL" ? "border-amber-200 bg-amber-50/40" : "bg-background"}`}
                  >
                    <summary className="flex cursor-pointer list-none items-start gap-2.5 p-3 [&::-webkit-details-marker]:hidden">
                      <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold">{title}</span>
                          {m?.visibility === "INTERNAL" && (
                            <span className="text-[10px] text-amber-700">Internal note</span>
                          )}
                          {m?.email_status && m.email_status !== "not_required" && (
                            <span
                              className={`rounded-full px-2 py-0.5 text-[10px] ${m.email_status === "accepted" ? "bg-emerald-50 text-emerald-700" : m.email_status === "pending" ? "bg-slate-100" : "bg-red-50 text-red-700"}`}
                            >
                              {m.email_status === "accepted"
                                ? "Email sent"
                                : m.email_status === "pending"
                                  ? "Email pending"
                                  : m.email_status === "no_recipient"
                                    ? "No email recipient"
                                    : "Email failed"}
                            </span>
                          )}
                        </span>
                        <span className="mt-1 block truncate text-xs text-muted-foreground">
                          {preview || "View update"}
                        </span>
                      </span>
                      <time className="shrink-0 text-right text-[10px] text-muted-foreground">
                        {fmt(entry.at)}
                      </time>
                    </summary>
                    <div className="border-t border-border p-4 pl-9">
                      {m ? (
                        <>
                          {m.message_html ? (
                            <div className={richClass} dangerouslySetInnerHTML={{ __html: m.message_html }} />
                          ) : (
                            <p className="whitespace-pre-wrap text-sm">{m.message}</p>
                          )}
                          {m.signature_html && m.author_type !== "SYSTEM" && (
                            <div
                              className={`${richClass} mt-4 border-t border-border pt-3`}
                              dangerouslySetInnerHTML={{ __html: m.signature_html }}
                            />
                          )}
                          {m.attachments?.map((file) => (
                            <button
                              key={file.id}
                              onClick={() => void attachment(file.id)}
                              className={`${buttonClass} mr-2 mt-3`}
                            >
                              <Paperclip className="h-3 w-3" />
                              {file.original_name}
                              <ArrowUpRight className="h-3 w-3" />
                            </button>
                          ))}
                          {m.email_recipient && (
                            <p className="mt-3 text-xs text-muted-foreground">Email to {m.email_recipient}</p>
                          )}
                          {["failed", "no_recipient"].includes(m.email_status || "") && (
                            <div className="mt-3 text-xs text-red-700">
                              <p>{m.email_error}</p>
                              {sender?.canUpdate && (
                                <button
                                  onClick={() => void retry(m.id)}
                                  disabled={saving || !recipient}
                                  className={`${buttonClass} mt-2`}
                                >
                                  Retry email
                                </button>
                              )}
                            </div>
                          )}
                        </>
                      ) : (
                        <>
                          <p className="whitespace-pre-wrap text-sm">{preview || title}</p>
                          {e?.metadata?.reason && <p className="mt-2 text-sm">{e.metadata.reason}</p>}
                          {e?.metadata?.satisfaction_response && (
                            <p className="mt-2 text-sm">
                              Requester feedback:{" "}
                              {e.metadata.satisfaction_response === "satisfied"
                                ? "Satisfied — issue resolved"
                                : "Still needs help"}
                            </p>
                          )}
                          <p className="mt-3 text-xs text-muted-foreground">
                            {e?.actor_name || enumLabel(e?.actor_type || "System")}
                          </p>
                        </>
                      )}
                    </div>
                  </details>
                )
              })}
            </div>
          </section>
        </main>
        <aside className="min-w-0 space-y-4">
          <section className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <UserRound className="h-4 w-4" />
              Who this ticket is for
            </h2>
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
              {ticket.requester_profile?.type || "Requester"}
            </p>
            <Link
              className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-blue-700"
              href={ticket.requester_profile?.href || "/admin/support"}
            >
              {ticket.requester_profile?.name || "Select a profile"}
              <ArrowUpRight className="h-3 w-3" />
            </Link>
            <p className="mt-2 text-sm">{ticket.requester_name}</p>
            <p className="break-all text-xs text-muted-foreground">{recipient || "Email not recorded"}</p>
            {ticket.requester_on_behalf_of && (
              <p className="mt-2 text-xs text-muted-foreground">
                On behalf of: {ticket.requester_on_behalf_of}
              </p>
            )}
            {sender?.canUpdate && (
              <button
                className={`${buttonClass} mt-3 w-full`}
                onClick={() => {
                  setEditRequester(!editRequester)
                  setOwner(ticket.requester_profile || null)
                  setRequesterName(ticket.requester_name || "")
                  setRequesterEmail(recipient)
                  setOnBehalf(ticket.requester_on_behalf_of || "")
                }}
              >
                Edit requester / profile link
              </button>
            )}
            {editRequester && (
              <div className="mt-4 space-y-2 border-t border-border pt-3">
                <SupportRequesterPicker
                  value={owner}
                  onChange={(value) => {
                    setOwner(value)
                    if (value) {
                      setRequesterName(value.contactName || value.name)
                      setRequesterEmail(value.email)
                    }
                  }}
                />
                <label className="block text-xs">
                  Contact name
                  <input
                    className={`${inputClass} mt-1`}
                    value={requesterName}
                    onChange={(e) => setRequesterName(e.target.value)}
                  />
                </label>
                <label className="block text-xs">
                  Email for updates
                  <input
                    type="email"
                    className={`${inputClass} mt-1`}
                    value={requesterEmail}
                    onChange={(e) => setRequesterEmail(e.target.value)}
                  />
                </label>
                <label className="block text-xs">
                  On behalf of (optional)
                  <input
                    className={`${inputClass} mt-1`}
                    value={onBehalf}
                    onChange={(e) => setOnBehalf(e.target.value)}
                  />
                </label>
                <button
                  disabled={saving || !owner || !requesterName.trim()}
                  className={`${primaryButtonClass} w-full`}
                  onClick={() =>
                    void action("link_requester", {
                      requesterType: owner?.type,
                      requesterId: owner?.id,
                      requesterName,
                      requesterEmail,
                      onBehalfOf: onBehalf
                    })
                  }
                >
                  Save requester
                </button>
              </div>
            )}
          </section>
          <section className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold">Resolution confirmation</h2>
            <dl className="space-y-3 text-xs">
              {[
                ["Confirmation email", ticket.satisfaction_sent_at],
                ["3-day follow-up", ticket.satisfaction_reminder_sent_at],
                ["Closure due", ticket.auto_close_at],
                ["Final closure note", ticket.final_closure_notice_sent_at]
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="mt-0.5 font-medium">{fmt(value)}</dd>
                </div>
              ))}
            </dl>
            {ticket.satisfaction_response && (
              <p className="mt-3 rounded-lg bg-muted p-2 text-xs">
                {ticket.satisfaction_response === "satisfied"
                  ? "Customer confirmed resolution"
                  : "Customer still needs help"}
              </p>
            )}
          </section>
          <section className="rounded-xl border border-border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold">Assignment</h2>
            <p className="text-sm">{ticket.admin?.name || "No teammate assigned"}</p>
            {ticket.partner?.display_name && (
              <p className="mt-1 text-xs text-muted-foreground">Partner: {ticket.partner.display_name}</p>
            )}
            {sender?.canAssign && (
              <div className="mt-3 space-y-2">
                <select
                  aria-label="Assign support teammate"
                  className={inputClass}
                  value={adminId}
                  onChange={(e) => setAdminId(e.target.value)}
                >
                  <option value="">Choose teammate</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                    </option>
                  ))}
                </select>
                <button
                  className={`${buttonClass} w-full`}
                  disabled={!adminId || saving}
                  onClick={() => void action("assign_admin", { adminUserId: adminId })}
                >
                  Assign teammate
                </button>
                <details className="pt-2">
                  <summary className="cursor-pointer text-xs text-muted-foreground">
                    Partner assignment
                  </summary>
                  <div className="mt-2 space-y-2">
                    <select
                      aria-label="Assign partner"
                      className={inputClass}
                      value={partnerId}
                      onChange={(e) => {
                        setPartnerId(e.target.value)
                        setPartnerUserId("")
                      }}
                    >
                      <option value="">Select partner</option>
                      {partners.map((partner) => (
                        <option key={partner.id} value={partner.id}>
                          {partner.display_name || partner.business_name}
                        </option>
                      ))}
                    </select>
                    {partnerId && (
                      <select
                        aria-label="Partner teammate"
                        className={inputClass}
                        value={partnerUserId}
                        onChange={(e) => setPartnerUserId(e.target.value)}
                      >
                        <option value="">Select partner teammate</option>
                        {partnerUsers.map((user) => (
                          <option key={user.id} value={user.id}>
                            {user.full_name}
                          </option>
                        ))}
                      </select>
                    )}
                    <button
                      className={`${buttonClass} w-full`}
                      disabled={!partnerId || !partnerUserId || saving}
                      onClick={() => void action("assign_partner", { partnerId, partnerUserId })}
                    >
                      Assign partner
                    </button>
                    {ticket.partner && (
                      <button
                        className={`${buttonClass} w-full`}
                        disabled={saving}
                        onClick={() => void action("remove_partner", {})}
                      >
                        Return to MartPoint team
                      </button>
                    )}
                  </div>
                </details>
              </div>
            )}
          </section>
          <details className="rounded-xl border border-border bg-card p-4">
            <summary className="cursor-pointer text-sm font-semibold">Ticket details & controls</summary>
            <div className="mt-3 space-y-3 text-xs">
              <p>Created: {fmt(ticket.created_at)}</p>
              <p>Last activity: {fmt(ticket.updated_at)}</p>
              <p>SLA: {ticket.sla_state ? enumLabel(ticket.sla_state) : "Not set"}</p>
              <p>First response due: {fmt(ticket.first_response_due_at)}</p>
              <p>Resolution due: {fmt(ticket.resolution_due_at)}</p>
              {sender?.canUpdate && (
                <>
                  <label className="block">
                    Priority
                    <select
                      value={priority}
                      onChange={(e) => setPriority(e.target.value)}
                      className={`${inputClass} mt-1`}
                    >
                      <option value="">{enumLabel(ticket.priority)}</option>
                      {["LOW", "NORMAL", "HIGH", "URGENT"].map((value) => (
                        <option key={value} value={value}>
                          {enumLabel(value)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    className={`${buttonClass} w-full`}
                    disabled={!priority || saving}
                    onClick={() => void action("change_priority", { priority })}
                  >
                    Save priority
                  </button>
                  <label className="block">
                    Category
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className={`${inputClass} mt-1`}
                    >
                      <option value="">{supportCategoryLabel(ticket.category)}</option>
                      {categories.map((value) => (
                        <option key={value} value={value}>
                          {supportCategoryLabel(value)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    className={`${buttonClass} w-full`}
                    disabled={!category || saving}
                    onClick={() => void action("update", { category })}
                  >
                    Save category
                  </button>
                  <label className="block">
                    Escalation reason
                    <textarea
                      className={`${inputClass} mt-1`}
                      value={escalation}
                      onChange={(e) => setEscalation(e.target.value)}
                      rows={2}
                    />
                  </label>
                  <button
                    disabled={saving || !escalation.trim()}
                    className={`${buttonClass} w-full`}
                    onClick={() => void action("escalate", { reason: escalation })}
                  >
                    Escalate to senior team
                  </button>
                </>
              )}
            </div>
          </details>
        </aside>
      </div>
    </div>
  )
}
