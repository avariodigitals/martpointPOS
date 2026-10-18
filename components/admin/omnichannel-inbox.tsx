"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Inbox, Loader2, MessageCircle, RefreshCw, Search, Send, Share2 } from "lucide-react"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

type Channel = "messenger" | "instagram"

interface Conversation {
  id: string
  external_id: string
  customer_name: string | null
  status: string
  last_message_at: string
  last_message: { message: string; created_at: string; direction: string } | null
}

interface Message {
  id: string
  author_type: string
  message: string
  direction: "inbound" | "outbound"
  created_at: string
}

const channelMeta: Record<Channel, { label: string; description: string; accent: string; soft: string; icon: typeof MessageCircle }> = {
  messenger: {
    label: "Messenger",
    description: "Facebook Messenger conversations in one focused workspace.",
    accent: "text-[#1877F2]",
    soft: "bg-[#1877F2]/10",
    icon: MessageCircle,
  },
  instagram: {
    label: "Instagram DM",
    description: "Respond to Instagram conversations without leaving Control Centre.",
    accent: "text-[#C13584]",
    soft: "bg-[#C13584]/10",
    icon: Share2,
  },
}

function initials(name: string | null, fallback: string): string {
  const value = (name || fallback).trim()
  const parts = value.split(/\s+/).filter(Boolean)
  return (parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : value.slice(0, 2)).toUpperCase()
}

function formatTime(value: string | null | undefined): string {
  if (!value) return ""
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

export function OmnichannelInbox({ channel }: { channel: Channel }) {
  const meta = channelMeta[channel]
  const ChannelIcon = meta.icon
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selected, setSelected] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [query, setQuery] = useState("")
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState("")
  const optimisticId = useRef(0)

  const loadConversations = useCallback(async () => {
    setError("")
    try {
      const res = await fetch(`/api/azera/conversations?channel=${channel}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Could not load conversations")
      const next = (json.conversations || []) as Conversation[]
      setConversations(next)
      setSelected((current) => {
        const nextSelected = next.find((item) => item.id === current?.id) || next[0] || null
        if (nextSelected && !current) void loadMessages(nextSelected.id)
        return nextSelected
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load conversations")
    } finally {
      setLoading(false)
    }
  }, [channel])

  const loadMessages = useCallback(async (conversationId: string) => {
    setLoadingMessages(true)
    try {
      const res = await fetch(`/api/azera/conversations/${encodeURIComponent(conversationId)}/messages?limit=100`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Could not load messages")
      setMessages((json.messages || []) as Message[])
    } catch (err) {
      setMessages([])
      setError(err instanceof Error ? err.message : "Could not load messages")
    } finally {
      setLoadingMessages(false)
    }
  }, [])

  useEffect(() => {
    // The request owns its loading/error state; this effect only starts the initial fetch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadConversations()
  }, [loadConversations])

  function selectConversation(conversation: Conversation) {
    setSelected(conversation)
    setMessages([])
    void loadMessages(conversation.id)
  }

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return conversations
    return conversations.filter((conversation) =>
      [conversation.customer_name, conversation.external_id, conversation.last_message?.message]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(term)),
    )
  }, [conversations, query])

  async function sendReply() {
    if (!input.trim() || !selected?.id || sending) return
    const text = input.trim()
    setInput("")
    setSending(true)
    setError("")
    const optimistic: Message = {
      id: `optimistic-${optimisticId.current++}`,
      author_type: "agent",
      message: text,
      direction: "outbound",
      created_at: new Date().toISOString(),
    }
    setMessages((current) => [...current, optimistic])
    try {
      const res = await fetch(`/api/azera/conversations/${encodeURIComponent(selected.id)}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, author_type: "agent", direction: "outbound" }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || "Could not send reply")
      await loadMessages(selected.id)
      await loadConversations()
    } catch (err) {
      setMessages((current) => current.filter((message) => message.id !== optimistic.id))
      setError(err instanceof Error ? err.message : "Could not send reply")
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            <span className={cn("flex h-8 w-8 items-center justify-center rounded-xl", meta.soft, meta.accent)}><ChannelIcon className="h-4 w-4" /></span>
            Omnichannel
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">{meta.label} inbox</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{meta.description}</p>
        </div>
        <button onClick={() => void loadConversations()} className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-border bg-white px-3 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50">
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </header>

      {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <Card className="overflow-hidden border-slate-200 bg-white shadow-[0_14px_40px_rgba(15,23,42,0.06)]">
        <div className="grid min-h-[620px] lg:grid-cols-[minmax(270px,0.8fr)_minmax(0,1.6fr)]">
          <aside className="border-b border-slate-200 bg-slate-50/80 lg:border-b-0 lg:border-r">
            <div className="border-b border-slate-200 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div><p className="text-sm font-semibold text-slate-900">Conversations</p><p className="text-xs text-muted-foreground">{conversations.length} total</p></div>
                <span className={cn("rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-wider", meta.soft, meta.accent)}>{channel}</span>
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search conversations" className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10" />
              </div>
            </div>
            <div className="max-h-[500px] overflow-y-auto p-2 lg:max-h-[550px]">
              {loading ? <div className="flex items-center justify-center py-16 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div> : filtered.length === 0 ? (
                <div className="px-6 py-16 text-center"><Inbox className="mx-auto mb-3 h-8 w-8 text-slate-300" /><p className="text-sm font-medium text-slate-700">No conversations yet</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">New {meta.label.toLowerCase()} messages will appear here.</p></div>
              ) : filtered.map((conversation) => {
                const active = selected?.id === conversation.id
                return <button key={conversation.id} onClick={() => selectConversation(conversation)} className={cn("flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition", active ? "bg-white shadow-sm ring-1 ring-slate-200" : "hover:bg-white/80")}>
                  <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold", active ? meta.soft + " " + meta.accent : "bg-slate-200 text-slate-600")}>{initials(conversation.customer_name, conversation.external_id)}</span>
                  <span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-2"><span className="truncate text-sm font-medium text-slate-800">{conversation.customer_name || conversation.external_id}</span><span className="shrink-0 text-[10px] text-slate-400">{formatTime(conversation.last_message_at)}</span></span><span className="mt-1 block truncate text-xs text-muted-foreground">{conversation.last_message?.message || "No messages yet"}</span></span>
                </button>
              })}
            </div>
          </aside>

          <section className="flex min-h-[620px] flex-col bg-white">
            {!selected ? <div className="flex flex-1 flex-col items-center justify-center px-8 text-center"><div className={cn("mb-4 flex h-14 w-14 items-center justify-center rounded-2xl", meta.soft, meta.accent)}><ChannelIcon className="h-7 w-7" /></div><h2 className="text-base font-semibold text-slate-900">Choose a conversation</h2><p className="mt-1 max-w-xs text-sm leading-relaxed text-muted-foreground">Select a thread from the left to view messages and reply.</p></div> : <>
              <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4"><div className="flex min-w-0 items-center gap-3"><span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold", meta.soft, meta.accent)}>{initials(selected.customer_name, selected.external_id)}</span><div className="min-w-0"><h2 className="truncate text-sm font-semibold text-slate-900">{selected.customer_name || selected.external_id}</h2><p className="truncate text-xs text-muted-foreground">{selected.customer_name ? selected.external_id : "Customer conversation"}</p></div></div><span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-700">{selected.status}</span></div>
              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-slate-50/60 p-5">{loadingMessages ? <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div> : messages.length === 0 ? <div className="py-16 text-center text-sm text-muted-foreground">No messages in this conversation.</div> : messages.map((message) => <div key={message.id} className={cn("max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm", message.direction === "outbound" ? "ml-auto rounded-br-md bg-[#0A0F1C] text-white" : "rounded-bl-md border border-slate-200 bg-white text-slate-700")}><div className="mb-1 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider opacity-60"><span>{message.author_type === "agent" ? "You" : message.author_type === "ai" ? "Azera" : "Customer"}</span><span>{formatTime(message.created_at)}</span></div>{message.message}</div>)}</div>
              <div className="border-t border-slate-200 bg-white p-4"><div className="flex items-end gap-2"><textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void sendReply() } }} rows={2} placeholder={`Reply to ${selected.customer_name || "customer"}…`} className="min-h-11 flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-500/10" /><button onClick={() => void sendReply()} disabled={!input.trim() || sending} className={cn("flex h-11 shrink-0 items-center gap-2 rounded-xl px-4 text-sm font-semibold text-white shadow-sm transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40", meta.accent.includes("C13584") ? "bg-[#C13584]" : "bg-[#1877F2]")}><Send className="h-4 w-4" />{sending ? "Sending" : "Send"}</button></div><p className="mt-2 text-[11px] text-muted-foreground">Press Enter to send · Shift + Enter for a new line</p></div>
            </>}
          </section>
        </div>
      </Card>
    </div>
  )
}
