"use client"

import { use, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, LifeBuoy, ArrowLeft, Send, Check } from "lucide-react"

interface BusinessSummary {
  business_name?: string | null
  primary_contact_name?: string | null
  primary_email?: string | null
  primary_phone?: string | null
  city?: string | null
  state?: string | null
  country?: string | null
  status?: string | null
  entitlement?: {
    plan_code?: string | null
    max_users?: number | null
    max_branches?: number | null
    online_store_enabled?: boolean | null
    subscription_status?: string | null
  } | null
  subscription?: {
    plans?: { name?: string | null } | null
    status?: string | null
    current_period_end?: string | null
  } | null
}

interface AdminInfo {
  name?: string | null
}

interface PartnerInfo {
  display_name?: string | null
}

interface Ticket {
  id: string
  ticket_number: string
  business_id: string
  partner_id?: string | null
  subject: string
  description?: string | null
  category: string
  priority: string
  status: string
  business?: BusinessSummary
  business_summary?: { business?: BusinessSummary; entitlement?: BusinessSummary["entitlement"]; subscription?: BusinessSummary["subscription"] }
  admin?: AdminInfo
  partner?: PartnerInfo
  assigned_admin_user_id?: string | null
  assigned_partner_id?: string | null
  assigned_partner_user_id?: string | null
  first_response_due_at?: string | null
  resolution_due_at?: string | null
  sla_state: "ON_TRACK" | "DUE_SOON" | "BREACHED" | null
  created_at: string
  updated_at: string
}

interface Message {
  id: string
  ticket_id: string
  author_type: "ADMIN" | "PARTNER" | "CUSTOMER" | "SYSTEM"
  author_id?: string | null
  message: string
  visibility: "PUBLIC" | "INTERNAL"
  attachment_path?: string | null
  created_at: string
}

interface Event {
  id: string
  ticket_id: string
  event_type: string
  actor_type: "ADMIN" | "PARTNER" | "CUSTOMER" | "SYSTEM"
  previous_value?: string | null
  new_value?: string | null
  created_at: string
}

interface User {
  id: string
  name: string
}

interface Partner {
  id: string
  business_name?: string | null
  display_name?: string | null
}

const PRIORITIES = ["LOW", "NORMAL", "HIGH", "URGENT"]
const CATEGORIES = [
  "SOFTWARE", "LOGIN_ACCOUNT", "POS", "INVENTORY", "PRODUCTS", "REPORTS", "ONLINE_STORE",
  "CONFIGURATION", "TRAINING", "BILLING", "LICENSING", "SECURITY", "PRIVACY_DATA",
  "HARDWARE_GUIDANCE", "FEATURE_REQUEST", "PARTNER_COMPLAINT", "OTHER",
]

const STATUS_COLORS: Record<string, string> = {
  NEW: "bg-slate-100 text-slate-700",
  ASSIGNED: "bg-blue-50 text-blue-700",
  IN_PROGRESS: "bg-indigo-50 text-indigo-700",
  WAITING_CUSTOMER: "bg-amber-50 text-amber-700",
  WAITING_PARTNER: "bg-amber-50 text-amber-700",
  ESCALATED: "bg-red-50 text-red-700",
  RESOLVED: "bg-green-50 text-green-700",
  CLOSED: "bg-gray-100 text-gray-500",
  CANCELLED: "bg-gray-100 text-gray-500",
}

const PRIORITY_COLORS: Record<string, string> = {
  LOW: "bg-slate-100 text-slate-700",
  NORMAL: "bg-blue-50 text-blue-700",
  HIGH: "bg-amber-50 text-amber-700",
  URGENT: "bg-red-50 text-red-700",
}

const SLA_COLORS: Record<string, string> = {
  ON_TRACK: "text-green-600",
  DUE_SOON: "text-amber-600",
  BREACHED: "text-red-600",
}

function formatDate(iso: string | undefined | null) {
  if (!iso) return "—"
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

export default function AdminSupportDetailPage({
  params,
}: {
  params: Promise<{ ticketId: string }>
}) {
  const { ticketId } = use(params)
  const router = useRouter()

  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [partners, setPartners] = useState<Partner[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState("")

  const [reply, setReply] = useState("")
  const [isInternal, setIsInternal] = useState(false)
  const [adminUserId, setAdminUserId] = useState("")
  const [partnerId, setPartnerId] = useState("")
  const [partnerUserId, setPartnerUserId] = useState("")
  const [escalateReason, setEscalateReason] = useState("")
  const [newPriority, setNewPriority] = useState("")
  const [newCategory, setNewCategory] = useState("")

  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadAll()
  }, [ticketId])

  async function loadAll() {
    setLoading(true)
    setMessage("")
    try {
      const [ticketRes, msgRes, evRes, usersRes, partnersRes] = await Promise.all([
        fetch(`/api/admin/support/tickets?id=${ticketId}`),
        fetch(`/api/admin/support/messages?ticketId=${ticketId}`),
        fetch(`/api/admin/support/events?ticketId=${ticketId}`),
        fetch("/api/admin/users"),
        fetch("/api/admin/partners"),
      ])

      const [ticketJson, msgJson, evJson, usersJson, partnersJson] = await Promise.all([
        ticketRes.json(),
        msgRes.json(),
        evRes.json(),
        usersRes.json(),
        partnersRes.json(),
      ])

      if (ticketJson.success) setTicket(ticketJson.data as Ticket)
      else setMessage(ticketJson.error || "Failed to load ticket")

      if (msgJson.success) setMessages(msgJson.data as Message[])
      if (evJson.success) setEvents(evJson.data as Event[])
      if (usersJson.users) setUsers(usersJson.users as User[])
      if (partnersJson.partners) setPartners(partnersJson.partners as Partner[])
    } catch {
      setMessage("Failed to load ticket")
    } finally {
      setLoading(false)
    }
  }

  async function postAction(action: string, data: Record<string, unknown>) {
    setSaving(true)
    setMessage("")
    try {
      const res = await fetch("/api/admin/support/tickets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, data: { id: ticketId, ...data } }),
      })
      const json = await res.json()
      if (json.success) {
        await loadAll()
      } else {
        setMessage(json.error || "Action failed")
      }
    } catch {
      setMessage("Action failed")
    } finally {
      setSaving(false)
    }
  }

  async function postReply() {
    if (!reply.trim()) return
    setSaving(true)
    setMessage("")
    try {
      const res = await fetch("/api/admin/support/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          data: { ticketId, message: reply, visibility: isInternal ? "INTERNAL" : "PUBLIC" },
        }),
      })
      const json = await res.json()
      if (json.success) {
        setReply("")
        setIsInternal(false)
        await loadAll()
      } else {
        setMessage(json.error || "Failed to post reply")
      }
    } catch {
      setMessage("Failed to post reply")
    } finally {
      setSaving(false)
    }
  }

  const summary = useMemo(() => {
    if (!ticket) return null
    return ticket.business_summary?.business || ticket.business
  }, [ticket])

  const entitlement = ticket?.business_summary?.entitlement || null
  const subscription = ticket?.business_summary?.subscription || null

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!ticket) {
    return (
      <div className="space-y-4">
        <Link href="/admin/support" className="inline-flex items-center text-sm text-muted-foreground hover:underline">
          <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back
        </Link>
        <p className="text-muted-foreground">{message || "Ticket not found."}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <Link href="/admin/support" className="inline-flex items-center text-sm text-muted-foreground hover:underline">
            <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Back to tickets
          </Link>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2 mt-1">
            <LifeBuoy className="w-5 h-5" />
            {ticket.ticket_number}
          </h2>
          <p className="text-muted-foreground">{ticket.subject}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => router.push(`/admin/businesses/${ticket.business_id}`)}>
            Open Business
          </Button>
        </div>
      </div>

      {message && (
        <p className={`text-sm ${message.includes("failed") || message.includes("Failed") ? "text-red-500" : "text-green-600"}`}>{message}</p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <span className={`inline-flex text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium ${STATUS_COLORS[ticket.status]}`}>
                    {ticket.status}
                  </span>
                </div>
                <div>
                  <p className="text-muted-foreground">Priority</p>
                  <span className={`inline-flex text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium ${PRIORITY_COLORS[ticket.priority]}`}>
                    {ticket.priority}
                  </span>
                </div>
                <div>
                  <p className="text-muted-foreground">Category</p>
                  <p className="font-medium">{ticket.category}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">SLA state</p>
                  <span className={`text-sm font-medium ${SLA_COLORS[ticket.sla_state || ""] || "text-muted-foreground"}`}>
                    {ticket.sla_state || "—"}
                  </span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-4 whitespace-pre-wrap">{ticket.description || "No description"}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Conversation</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 mb-6">
                {messages.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No messages yet.</p>
                ) : (
                  messages.map((m) => (
                    <div key={m.id} className={`p-3 rounded-md border ${m.visibility === "INTERNAL" ? "border-amber-200 bg-amber-50/30" : "border-border bg-muted/20"}`}>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                        <span className="font-medium text-foreground">{m.author_type}</span>
                        {m.visibility === "INTERNAL" && <span className="text-amber-700 font-medium">Internal</span>}
                        <span>· {formatDate(m.created_at)}</span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{m.message}</p>
                      {m.attachment_path && <p className="text-xs text-muted-foreground mt-1">Attachment: {m.attachment_path}</p>}
                    </div>
                  ))
                )}
              </div>

              <div className="space-y-3">
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  rows={3}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="Write a reply..."
                />
                <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={isInternal}
                      onChange={(e) => setIsInternal(e.target.checked)}
                      className="w-4 h-4 rounded border-border"
                    />
                    Internal note
                  </label>
                  <Button size="sm" onClick={postReply} disabled={!reply.trim() || saving}>
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    <span className="ml-1">Post</span>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Ticket Events</CardTitle>
            </CardHeader>
            <CardContent>
              {events.length === 0 ? (
                <p className="text-sm text-muted-foreground">No events.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {events.map((e) => (
                    <li key={e.id} className="flex items-start gap-2 p-2 rounded-md bg-muted/20">
                      <span className="font-medium">{e.event_type}</span>
                      {e.previous_value !== undefined && e.new_value !== undefined && (
                        <span className="text-muted-foreground">
                          {e.previous_value} → {e.new_value}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground ml-auto">{formatDate(e.created_at)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Customer & Licence Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-muted-foreground">Business</p>
                <p className="font-medium">{summary?.business_name || "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Contact</p>
                <p>{summary?.primary_contact_name || "—"}</p>
                <p className="text-muted-foreground">{summary?.primary_email || "—"}</p>
                <p className="text-muted-foreground">{summary?.primary_phone || "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Location</p>
                <p>{[summary?.city, summary?.state, summary?.country].filter(Boolean).join(", ") || "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Business status</p>
                <p className="font-medium">{summary?.status || "—"}</p>
              </div>
              {entitlement && (
                <div className="p-2 rounded-md bg-muted/20">
                  <p className="font-medium">Entitlement</p>
                  <p className="text-muted-foreground">Users: {entitlement.max_users ?? "—"} · Branches: {entitlement.max_branches ?? "—"}</p>
                  <p className="text-muted-foreground">Online store: {entitlement.online_store_enabled ? "Enabled" : "Disabled"}</p>
                  <p className="text-muted-foreground">Status: {entitlement.subscription_status || "—"}</p>
                </div>
              )}
              {subscription && (
                <div className="p-2 rounded-md bg-muted/20">
                  <p className="font-medium">Subscription</p>
                  <p className="text-muted-foreground">Plan: {subscription.plans?.name || "—"}</p>
                  <p className="text-muted-foreground">Status: {subscription.status || "—"}</p>
                  <p className="text-muted-foreground">Period end: {subscription.current_period_end || "—"}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Assignment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <p className="text-muted-foreground">Admin</p>
                <p className="font-medium">{ticket.admin?.name || "Unassigned"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Partner</p>
                <p className="font-medium">{ticket.partner?.display_name || "Unassigned"}</p>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-medium">Assign to admin</label>
                <select value={adminUserId} onChange={(e) => setAdminUserId(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="">Select admin</option>
                  {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
                <Button size="sm" className="w-full" onClick={() => postAction("assign_admin", { adminUserId })} disabled={!adminUserId || saving}>
                  Assign Admin
                </Button>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-medium">Assign to partner</label>
                <select value={partnerId} onChange={(e) => setPartnerId(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="">Select partner</option>
                  {partners.map((p) => <option key={p.id} value={p.id}>{p.display_name || p.business_name}</option>)}
                </select>
                <input
                  type="text"
                  value={partnerUserId}
                  onChange={(e) => setPartnerUserId(e.target.value)}
                  placeholder="Partner user ID"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
                <Button size="sm" className="w-full" onClick={() => postAction("assign_partner", { partnerId, partnerUserId })} disabled={!partnerId || !partnerUserId || saving}>
                  Assign Partner
                </Button>
                <Button size="sm" variant="outline" className="w-full" onClick={() => postAction("remove_partner", {})} disabled={saving}>
                  Remove Partner
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border">
                <Button size="sm" variant="outline" onClick={() => postAction("change_status", { status: "IN_PROGRESS" })} disabled={saving}>
                  In Progress
                </Button>
                <Button size="sm" variant="outline" onClick={() => postAction("change_status", { status: "WAITING_CUSTOMER" })} disabled={saving}>
                  Wait Customer
                </Button>
                <Button size="sm" variant="outline" onClick={() => postAction("change_status", { status: "WAITING_PARTNER" })} disabled={saving}>
                  Wait Partner
                </Button>
                <Button size="sm" variant="outline" onClick={() => postAction("change_status", { status: "RESOLVED" })} disabled={saving}>
                  Resolve
                </Button>
                <Button size="sm" variant="outline" onClick={() => postAction("change_status", { status: "NEW" })} disabled={saving}>
                  Reopen
                </Button>
                <Button size="sm" variant="outline" onClick={() => postAction("change_status", { status: "CLOSED" })} disabled={saving}>
                  Close
                </Button>
              </div>

              <div className="space-y-2 pt-2 border-t border-border">
                <label className="block text-xs font-medium">Change priority</label>
                <select value={newPriority} onChange={(e) => setNewPriority(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="">Select priority</option>
                  {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
                <Button size="sm" className="w-full" onClick={() => postAction("change_priority", { priority: newPriority })} disabled={!newPriority || saving}>
                  Change Priority
                </Button>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-medium">Change category</label>
                <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                  <option value="">Select category</option>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <Button size="sm" className="w-full" onClick={() => postAction("update", { category: newCategory })} disabled={!newCategory || saving}>
                  Change Category
                </Button>
              </div>

              <div className="space-y-2 pt-2 border-t border-border">
                <input
                  type="text"
                  value={escalateReason}
                  onChange={(e) => setEscalateReason(e.target.value)}
                  placeholder="Escalation reason"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
                <Button size="sm" variant="retail" className="w-full" onClick={() => postAction("escalate", { reason: escalateReason })} disabled={saving}>
                  Escalate to MartPoint
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
