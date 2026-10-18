"use client"

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Bot, CheckCircle2, FilePlus2, Inbox, Loader2, Mail, MessageCircle, Phone, RefreshCw, Search, Send, Share2, Ticket, UserRound, Users, X } from "lucide-react"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type Channel = "all" | "website" | "whatsapp" | "messenger" | "instagram"
type Status = "all" | "open" | "assigned" | "closed"

interface Conversation {
  id: string
  business_id: string
  channel: string
  external_id: string
  customer_name: string | null
  customer_phone: string | null
  status: string
  assigned_admin_user_id: string | null
  ticket_id: string | null
  ai_enabled: boolean
  last_message_at: string
  last_message: { message: string; author_type: string; created_at: string } | null
  unread_count: number
}

interface Message {
  id: string
  author_type: "customer" | "agent" | "ai" | "system"
  author_id?: string | null
  message: string
  direction: "inbound" | "outbound"
  created_at: string
}

const channels: Array<{ value: Channel; label: string; color: string }> = [
  { value: "all", label: "All conversations", color: "bg-slate-900" },
  { value: "website", label: "Retail app / website", color: "bg-blue-600" },
  { value: "whatsapp", label: "WhatsApp", color: "bg-emerald-600" },
  { value: "messenger", label: "Messenger", color: "bg-[#1877F2]" },
  { value: "instagram", label: "Instagram", color: "bg-[#C13584]" },
]

const channelIcon: Record<string, typeof MessageCircle> = { website: MessageCircle, whatsapp: MessageCircle, messenger: MessageCircle, instagram: Share2 }

function initials(name: string | null, fallback: string) {
  const value = (name || fallback).trim()
  const parts = value.split(/\s+/).filter(Boolean)
  return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : value.slice(0, 2)).toUpperCase()
}

function time(value: string | null | undefined) {
  if (!value) return ""
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

function channelLabel(value: string) {
  return channels.find((item) => item.value === value)?.label || value
}

function OmnichannelInboxContent({ channel = "all" }: { channel?: Channel }) {
  const searchParams = useSearchParams()
  const requestedConversation = searchParams.get("conversation")
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selected, setSelected] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [channelFilter, setChannelFilter] = useState<Channel>(channel)
  const [status, setStatus] = useState<Status>("all")
  const [query, setQuery] = useState("")
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState("")
  const [showTicket, setShowTicket] = useState(false)
  const [ticketSubject, setTicketSubject] = useState("")
  const [ticketPriority, setTicketPriority] = useState("NORMAL")
  const [ticketCategory, setTicketCategory] = useState("OTHER")
  const [ticketSaving, setTicketSaving] = useState(false)
  const optimisticId = useRef(0)

  const loadMessages = useCallback(async (id: string) => {
    setLoadingMessages(true)
    try {
      const response = await fetch(`/api/azera/conversations/${encodeURIComponent(id)}/messages?limit=100`)
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || "Could not load messages")
      setMessages(json.messages || [])
    } catch (err) {
      setMessages([])
      setError(err instanceof Error ? err.message : "Could not load messages")
    } finally {
      setLoadingMessages(false)
    }
  }, [])

  const loadConversations = useCallback(async () => {
    setError("")
    try {
      const params = new URLSearchParams()
      if (channelFilter !== "all") params.set("channel", channelFilter)
      if (status !== "all") params.set("status", status)
      const response = await fetch(`/api/azera/conversations?${params}`)
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || "Could not load conversations")
      const next = (json.conversations || []) as Conversation[]
      setConversations(next)
      setSelected((current) => {
        const nextSelected = next.find((item) => item.id === requestedConversation) || next.find((item) => item.id === current?.id) || next[0] || null
        if (nextSelected && !current) void loadMessages(nextSelected.id)
        return nextSelected
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load conversations")
    } finally {
      setLoading(false)
    }
  }, [channelFilter, loadMessages, requestedConversation, status])

  useEffect(() => {
    // The request owns its loading/error state; this effect only starts the fetch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadConversations()
  }, [loadConversations])

  useEffect(() => {
    const interval = window.setInterval(() => void loadConversations(), 15000)
    return () => window.clearInterval(interval)
  }, [loadConversations])

  function selectConversation(conversation: Conversation) {
    setSelected(conversation)
    setMessages([])
    void loadMessages(conversation.id)
  }

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return conversations
    return conversations.filter((item) => [item.customer_name, item.external_id, item.last_message?.message].filter(Boolean).some((value) => value!.toLowerCase().includes(term)))
  }, [conversations, query])

  const stats = useMemo(() => ({
    open: conversations.filter((item) => item.status === "open").length,
    mine: conversations.filter((item) => item.assigned_admin_user_id).length,
    unread: conversations.reduce((sum, item) => sum + (item.unread_count || 0), 0),
  }), [conversations])

  async function updateConversation(updates: Record<string, unknown>) {
    if (!selected) return
    const response = await fetch(`/api/azera/conversations/${encodeURIComponent(selected.id)}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(updates) })
    const json = await response.json()
    if (!response.ok) throw new Error(json.error || "Could not update conversation")
    setSelected(json.conversation)
    await loadConversations()
  }

  async function sendReply() {
    if (!input.trim() || !selected || sending || selected.status === "closed") return
    const text = input.trim()
    setInput("")
    setSending(true)
    const optimistic: Message = { id: `optimistic-${optimisticId.current++}`, author_type: "agent", message: text, direction: "outbound", created_at: new Date().toISOString() }
    setMessages((current) => [...current, optimistic])
    try {
      const response = await fetch(`/api/azera/conversations/${encodeURIComponent(selected.id)}/messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: text, author_type: "agent", direction: "outbound" }) })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || "Could not send reply")
      await loadMessages(selected.id)
      await loadConversations()
    } catch (err) {
      setMessages((current) => current.filter((item) => item.id !== optimistic.id))
      setError(err instanceof Error ? err.message : "Could not send reply")
    } finally {
      setSending(false)
    }
  }

  async function createTicket() {
    if (!selected || ticketSaving) return
    setTicketSaving(true)
    try {
      const response = await fetch(`/api/admin/azera/conversations/${encodeURIComponent(selected.id)}/ticket`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subject: ticketSubject, category: ticketCategory, priority: ticketPriority }) })
      const json = await response.json()
      if (!response.ok) throw new Error(json.error || "Could not create ticket")
      setSelected((current) => current ? { ...current, ticket_id: json.ticket.id } : current)
      setShowTicket(false)
      setTicketSubject("")
      await loadConversations()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create ticket")
    } finally {
      setTicketSaving(false)
    }
  }

  const Icon = selected ? channelIcon[selected.channel] || MessageCircle : Inbox

  return <div className="space-y-6">
    <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div><div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground"><span className="flex h-8 w-8 items-center justify-center rounded-xl bg-retail-soft text-retail"><Inbox className="h-4 w-4" /></span> Support workspace</div><h1 className="text-2xl font-bold tracking-tight text-slate-950">Omnichannel inbox</h1><p className="mt-1 max-w-2xl text-sm text-muted-foreground">One queue for retail app chat, Azera, WhatsApp, Messenger, and Instagram. Every thread can become a ticket.</p></div><button onClick={() => void loadConversations()} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border bg-white px-3 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"><RefreshCw className="h-4 w-4" /> Refresh</button></header>

    <div className="grid grid-cols-3 gap-3 md:grid-cols-6"><div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"><p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Open</p><p className="mt-1 text-2xl font-bold text-slate-900">{stats.open}</p></div><div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"><p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Assigned</p><p className="mt-1 text-2xl font-bold text-indigo-600">{stats.mine}</p></div><div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"><p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Unread</p><p className="mt-1 text-2xl font-bold text-red-600">{stats.unread}</p></div><div className="hidden rounded-xl border border-slate-200 bg-white p-3 shadow-sm md:block"><p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">AI enabled</p><p className="mt-1 text-2xl font-bold text-violet-600">{conversations.filter((item) => item.ai_enabled).length}</p></div><div className="hidden rounded-xl border border-slate-200 bg-white p-3 shadow-sm md:block"><p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Tickets</p><p className="mt-1 text-2xl font-bold text-emerald-600">{conversations.filter((item) => item.ticket_id).length}</p></div><div className="hidden rounded-xl border border-slate-200 bg-white p-3 shadow-sm md:block"><p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Channels</p><p className="mt-1 text-2xl font-bold text-slate-900">{new Set(conversations.map((item) => item.channel)).size}</p></div></div>

    {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
    <Card className="overflow-hidden border-slate-200 bg-white shadow-[0_14px_40px_rgba(15,23,42,0.06)]"><div className="border-b border-slate-200 bg-slate-50/80 p-3"><div className="flex flex-wrap gap-2">{channels.map((item) => <button key={item.value} onClick={() => setChannelFilter(item.value)} className={cn("rounded-full px-3 py-1.5 text-xs font-semibold transition", channelFilter === item.value ? `${item.color} text-white shadow-sm` : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100")}>{item.label}</button>)}<span className="mx-1 hidden h-6 w-px bg-slate-200 sm:block" /><select value={status} onChange={(event) => setStatus(event.target.value as Status)} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 outline-none"><option value="all">All statuses</option><option value="open">Open</option><option value="assigned">Assigned</option><option value="closed">Closed</option></select></div></div><div className="grid min-h-[650px] lg:grid-cols-[minmax(270px,0.8fr)_minmax(0,1.6fr)_minmax(230px,0.65fr)]">
      <aside className="border-b border-slate-200 bg-slate-50/80 lg:border-b-0 lg:border-r"><div className="border-b border-slate-200 p-4"><div className="mb-3 flex items-center justify-between"><div><p className="text-sm font-semibold text-slate-900">Conversation queue</p><p className="text-xs text-muted-foreground">{filtered.length} visible</p></div><Users className="h-4 w-4 text-slate-400" /></div><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search customer or message" className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10" /></div></div><div className="max-h-[540px] overflow-y-auto p-2">{loading ? <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div> : filtered.length === 0 ? <div className="px-5 py-16 text-center"><Inbox className="mx-auto mb-3 h-8 w-8 text-slate-300" /><p className="text-sm font-medium text-slate-700">No conversations</p><p className="mt-1 text-xs text-muted-foreground">New customer messages will appear here.</p></div> : filtered.map((conversation) => { const active = selected?.id === conversation.id; const ChannelIcon = channelIcon[conversation.channel] || MessageCircle; return <button key={conversation.id} onClick={() => selectConversation(conversation)} className={cn("flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition", active ? "bg-white shadow-sm ring-1 ring-slate-200" : "hover:bg-white/80")}><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs font-semibold text-slate-600">{initials(conversation.customer_name, conversation.external_id)}</span><span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-2"><span className="truncate text-sm font-medium text-slate-800">{conversation.customer_name || conversation.external_id}</span><span className="shrink-0 text-[10px] text-slate-400">{time(conversation.last_message_at)}</span></span><span className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground"><ChannelIcon className="h-3 w-3" /> {channelLabel(conversation.channel)} {conversation.unread_count > 0 && <span className="rounded-full bg-red-500 px-1.5 text-[10px] text-white">{conversation.unread_count}</span>}</span><span className="mt-1 block truncate text-xs text-muted-foreground">{conversation.last_message?.message || "No messages yet"}</span></span></button> })}</div></aside>

      <section className="flex min-h-[650px] flex-col bg-white">{!selected ? <div className="flex flex-1 flex-col items-center justify-center px-8 text-center"><Inbox className="mb-4 h-12 w-12 text-slate-300" /><h2 className="text-base font-semibold text-slate-900">Choose a conversation</h2><p className="mt-1 max-w-xs text-sm text-muted-foreground">Select a customer from the queue to reply, call, or create a support ticket.</p></div> : <><div className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><div className="flex min-w-0 items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-retail-soft text-xs font-semibold text-retail">{initials(selected.customer_name, selected.external_id)}</span><div className="min-w-0"><h2 className="truncate text-sm font-semibold text-slate-900">{selected.customer_name || selected.external_id}</h2><p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Icon className="h-3 w-3" /> {channelLabel(selected.channel)} · {selected.status}</p></div></div><div className="flex items-center gap-1.5"><button onClick={() => void updateConversation({ assigned_admin_user_id: "me", status: "assigned" })} className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50" title="Assign to me"><UserRound className="h-4 w-4" /></button><button onClick={() => void updateConversation({ ai_enabled: !selected.ai_enabled })} className={cn("rounded-lg border p-2", selected.ai_enabled ? "border-violet-200 bg-violet-50 text-violet-700" : "border-slate-200 text-slate-400")} title={selected.ai_enabled ? "Azera is active" : "Azera is paused"}><Bot className="h-4 w-4" /></button><button onClick={() => void updateConversation({ status: selected.status === "closed" ? "open" : "closed" })} className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50" title={selected.status === "closed" ? "Reopen" : "Close"}>{selected.status === "closed" ? <RefreshCw className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}</button></div></div><div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-slate-50/60 p-5">{loadingMessages ? <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div> : messages.length === 0 ? <div className="py-16 text-center text-sm text-muted-foreground">No messages in this conversation.</div> : messages.map((message) => <div key={message.id} className={cn("max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm", message.author_type === "ai" ? "border border-violet-200 bg-violet-50 text-violet-950" : message.direction === "outbound" ? "ml-auto rounded-br-md bg-[#0A0F1C] text-white" : "rounded-bl-md border border-slate-200 bg-white text-slate-700")}><div className="mb-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider opacity-60">{message.author_type === "ai" ? <Bot className="h-3 w-3" /> : message.author_type === "agent" ? <UserRound className="h-3 w-3" /> : null}<span>{message.author_type === "agent" ? "Agent" : message.author_type === "ai" ? "Azera" : message.author_type === "system" ? "System" : "Customer"}</span><span>{time(message.created_at)}</span></div>{message.message}</div>)}</div><div className="border-t border-slate-200 bg-white p-4"><div className="flex items-end gap-2"><textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendReply() } }} rows={2} disabled={selected.status === "closed"} placeholder={selected.status === "closed" ? "Conversation closed" : `Reply to ${selected.customer_name || "customer"}…`} className="min-h-11 flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-500/10" /><button onClick={() => void sendReply()} disabled={!input.trim() || sending || selected.status === "closed"} className="flex h-11 shrink-0 items-center gap-2 rounded-xl bg-[#0A0F1C] px-4 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-40"><Send className="h-4 w-4" />{sending ? "Sending" : "Send"}</button></div><p className="mt-2 text-[11px] text-muted-foreground">Enter to send · Shift + Enter for a new line</p></div></>}</section>

      <aside className="border-t border-slate-200 bg-white p-4 lg:border-l lg:border-t-0">{selected ? <div className="space-y-5"><div><p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Customer</p><div className="mt-3 flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-full bg-retail-soft font-semibold text-retail">{initials(selected.customer_name, selected.external_id)}</span><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-900">{selected.customer_name || "Anonymous customer"}</p><p className="truncate text-xs text-muted-foreground">{selected.customer_phone || selected.external_id}</p></div></div></div><div className="space-y-2"><p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Actions</p><div className="grid grid-cols-2 gap-2"><a href={selected.customer_phone ? `tel:${selected.customer_phone}` : undefined} className={cn("flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-medium", selected.customer_phone ? "border-slate-200 text-slate-700 hover:bg-slate-50" : "pointer-events-none border-slate-100 text-slate-300")}><Phone className="h-3.5 w-3.5" /> Call</a><a href={selected.customer_phone ? `https://wa.me/${selected.customer_phone.replace(/\D/g, "")}` : undefined} target="_blank" rel="noreferrer" className={cn("flex items-center justify-center gap-1.5 rounded-lg border px-2 py-2 text-xs font-medium", selected.customer_phone ? "border-emerald-200 text-emerald-700 hover:bg-emerald-50" : "pointer-events-none border-slate-100 text-slate-300")}><MessageCircle className="h-3.5 w-3.5" /> WhatsApp</a><a href={selected.customer_phone ? `mailto:?subject=${encodeURIComponent(`MartPoint support — ${selected.customer_name || "your conversation"}`)}` : undefined} className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-2 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"><Mail className="h-3.5 w-3.5" /> Email</a><button onClick={() => setShowTicket(true)} disabled={Boolean(selected.ticket_id)} className="flex items-center justify-center gap-1.5 rounded-lg border border-retail/20 bg-retail-soft px-2 py-2 text-xs font-semibold text-retail disabled:opacity-50"><FilePlus2 className="h-3.5 w-3.5" />{selected.ticket_id ? "Ticket linked" : "Create ticket"}</button></div></div><div className="space-y-2 border-t border-slate-100 pt-4"><p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Conversation</p><div className="flex items-center justify-between text-xs"><span className="text-muted-foreground">AI assistant</span><span className={cn("rounded-full px-2 py-1 font-medium", selected.ai_enabled ? "bg-violet-50 text-violet-700" : "bg-slate-100 text-slate-500")}>{selected.ai_enabled ? "Active" : "Paused"}</span></div><div className="flex items-center justify-between text-xs"><span className="text-muted-foreground">Ticket</span>{selected.ticket_id ? <a href={`/admin/support?id=${selected.ticket_id}`} className="font-semibold text-retail hover:underline">Open ticket</a> : <span className="text-slate-400">None</span>}</div><div className="flex items-center justify-between text-xs"><span className="text-muted-foreground">Last activity</span><span className="text-slate-700">{time(selected.last_message_at)}</span></div></div></div> : <div className="flex h-full items-center justify-center text-center text-xs text-muted-foreground">Customer details and actions appear here.</div>}</aside>
    </div></Card>

    {showTicket && selected && <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/40 p-4"><div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"><div className="mb-4 flex items-start justify-between"><div><h2 className="text-base font-semibold text-slate-900">Create support ticket</h2><p className="mt-1 text-xs text-muted-foreground">Link this conversation to the support workflow.</p></div><button onClick={() => setShowTicket(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button></div><div className="space-y-3"><label className="block text-xs font-medium text-slate-700">Subject<input value={ticketSubject} onChange={(event) => setTicketSubject(event.target.value)} placeholder={`Follow up with ${selected.customer_name || "customer"}`} className="mt-1 h-10 w-full rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-retail focus:ring-4 focus:ring-retail/10" /></label><div className="grid grid-cols-2 gap-3"><label className="block text-xs font-medium text-slate-700">Priority<select value={ticketPriority} onChange={(event) => setTicketPriority(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"><option>NORMAL</option><option>HIGH</option><option>URGENT</option><option>LOW</option></select></label><label className="block text-xs font-medium text-slate-700">Category<select value={ticketCategory} onChange={(event) => setTicketCategory(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"><option>OTHER</option><option>SOFTWARE</option><option>POS</option><option>INVENTORY</option><option>LOGIN_ACCOUNT</option><option>BILLING</option></select></label></div><button onClick={() => void createTicket()} disabled={ticketSaving} className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#0A0F1C] text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50">{ticketSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Ticket className="h-4 w-4" />} Create ticket</button></div></div></div>}
  </div>
}

export function OmnichannelInbox(props: { channel?: Channel }) {
  return <Suspense fallback={<div className="flex min-h-[420px] items-center justify-center text-sm text-muted-foreground">Loading support workspace…</div>}><OmnichannelInboxContent {...props} /></Suspense>
}
