"use client"

import { useEffect, useState, useRef, useCallback } from "react"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  Loader2,
  MessageCircle,
  Send,
  X,
  User,
  Bot,
  Clock,
  CheckCheck,
  MoveDiagonal,
  Ticket,
  Phone,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  PhoneOff,
} from "lucide-react"
import { useWebRTCCall, AzeraCallUI } from "@/components/shared/azera-webrtc-call"

interface Conversation {
  id: string
  business_id: string
  channel: "website" | "whatsapp"
  external_id: string
  customer_name: string | null
  customer_phone: string | null
  status: "open" | "assigned" | "closed"
  assigned_admin_user_id: string | null
  ticket_id: string | null
  ai_enabled: boolean
  last_message_at: string
  created_at: string
  last_message: {
    id: string
    message: string
    author_type: string
    created_at: string
  } | null
  unread_count: number
}

interface Message {
  id: string
  conversation_id: string
  author_type: "customer" | "agent" | "ai" | "system"
  author_id: string | null
  message: string
  direction: "inbound" | "outbound"
  created_at: string
}

const CHANNEL_LABEL: Record<string, string> = {
  website: "Website",
  whatsapp: "WhatsApp",
}

const CHANNEL_ICON: Record<string, React.ReactNode> = {
  website: <User className="w-4 h-4" />,
  whatsapp: <MessageCircle className="w-4 h-4" />,
}

const STATUS_COLOR: Record<string, string> = {
  open: "bg-blue-50 text-blue-700",
  assigned: "bg-indigo-50 text-indigo-700",
  closed: "bg-gray-100 text-gray-500",
}

export default function AzeraConsolePage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [selected, setSelected] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [statusFilter, setStatusFilter] = useState("all")
  const scrollRef = useRef<HTMLDivElement>(null)

  // Call state
  const [activeCall, setActiveCall] = useState<{ id: string; type: "webrtc" | "sip" } | null>(null)
  const [callError, setCallError] = useState<string | null>(null)
  const [isRecording, setIsRecording] = useState(false)

  // WebRTC hook for active call
  const webrtc = activeCall?.type === "webrtc"
    ? useWebRTCCall({
        callId: activeCall.id,
        isAgent: true,
        onCallEnded: () => {
          setActiveCall(null)
          setIsRecording(false)
        },
        onStartRecording: async () => {
          setIsRecording(true)
          try {
            await fetch("/api/azera/call-recordings", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                call_id: activeCall.id,
                business_id: selected?.business_id || "",
                recording_url: "",
                recording_type: "manual",
              }),
            })
          } catch {
            // ignore
          }
        },
        onStopRecording: () => setIsRecording(false),
      })
    : { state: "idle" as const, error: null, startCall: () => {}, answerCall: () => {}, endCall: () => {}, toggleMute: () => {}, onStartRecording: () => {}, onStopRecording: () => {}, isMuted: false }

  useEffect(() => {
    loadConversations()
    const interval = setInterval(loadConversations, 8000)
    return () => clearInterval(interval)
  }, [])

  async function loadConversations() {
    try {
      const params = new URLSearchParams()
      if (statusFilter !== "all") params.set("status", statusFilter)
      const res = await fetch(`/api/azera/conversations?${params.toString()}`)
      const json = await res.json()
      if (json.conversations) {
        setConversations(json.conversations)
        if (!selected && json.conversations.length > 0) {
          setSelected(json.conversations[0])
        }
      }
    } catch (err) {
      console.error("[Azera console] load error", err)
    } finally {
      setLoading(false)
    }
  }

  async function loadMessages(convId: string) {
    try {
      const res = await fetch(
        `/api/azera/conversations/${encodeURIComponent(convId)}/messages?limit=100`
      )
      const json = await res.json()
      if (json.messages) {
        setMessages(json.messages)
      }
    } catch (err) {
      console.error("[Azera console] load messages error", err)
      setMessages([])
    }
  }

  function selectConversation(conv: Conversation) {
    setSelected(conv)
    setMessages([])
    loadMessages(conv.id)
  }

  async function sendReply() {
    if (!input.trim() || !selected?.id) return
    const text = input.trim()
    setInput("")
    setSending(true)

    // Optimistic add
    const optimistic: Message = {
      id: "opt_" + Date.now(),
      conversation_id: selected.id,
      author_type: "agent",
      author_id: null,
      message: text,
      direction: "outbound",
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimistic])
    scrollToBottom()

    try {
      const res = await fetch(
        `/api/azera/conversations/${encodeURIComponent(selected.id)}/messages`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text, author_type: "agent", direction: "outbound" }),
        }
      )
      const json = await res.json()
      if (json.success && json.message) {
        setMessages((prev) =>
          prev.map((m) => (m.id === optimistic.id ? { ...m, id: json.message.id } : m))
        )
      }
    } catch {
      // ignore
    } finally {
      setSending(false)
      scrollToBottom()
    }
  }

  async function updateStatus(newStatus: Conversation["status"]) {
    if (!selected?.id) return
    try {
      await fetch(`/api/azera/conversations/${encodeURIComponent(selected.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      setSelected((prev) => (prev ? { ...prev, status: newStatus } : null))
      loadConversations()
    } catch {
      // ignore
    }
  }

  async function assignToMe() {
    if (!selected?.id) return
    try {
      await fetch(`/api/azera/conversations/${encodeURIComponent(selected.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "assigned",
          assigned_admin_user_id: "me", // server resolves from session
        }),
      })
      setSelected((prev) => (prev ? { ...prev, status: "assigned" } : null))
      loadConversations()
    } catch {
      // ignore
    }
  }

  async function startWebRTCCall() {
    if (!selected?.id) return
    setCallError(null)
    try {
      const res = await fetch("/api/azera/calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business_id: selected.business_id,
          conversation_id: selected.id,
          call_type: "webrtc",
          direction: "outbound",
          customer_name: selected.customer_name || selected.external_id,
          customer_phone: selected.customer_phone || undefined,
          customer_external_id: selected.external_id,
          webrtc_room: `azera-${selected.id}`,
        }),
      })
      const json = await res.json()
      if (json.success && json.data) {
        setActiveCall({ id: json.data.id, type: "webrtc" })
      } else {
        setCallError(json.error || "Failed to start WebRTC call")
      }
    } catch (e) {
      setCallError(String(e))
    }
  }

  async function startSIPCall() {
    if (!selected?.id || !selected.customer_phone) {
      setCallError("No phone number for this customer")
      return
    }
    setCallError(null)
    try {
      const res = await fetch("/api/azera/calls/sip-outbound", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business_id: selected.business_id,
          conversation_id: selected.id,
          customer_phone: selected.customer_phone,
          customer_name: selected.customer_name || selected.external_id,
        }),
      })
      const json = await res.json()
      if (json.success && json.data) {
        setActiveCall({ id: json.data.id, type: "sip" })
      } else {
        setCallError(json.error || "Failed to start SIP call")
      }
    } catch (e) {
      setCallError(String(e))
    }
  }

  async function endActiveCall() {
    if (!activeCall) return
    try {
      await fetch(`/api/azera/calls/${encodeURIComponent(activeCall.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "ended" }),
      })
    } catch {
      // ignore
    }
    setActiveCall(null)
    setCallError(null)
  }

  function scrollToBottom() {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const openCount = conversations.filter((c) => c.status === "open").length
  const assignedCount = conversations.filter((c) => c.status === "assigned").length

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-retail" />
            Azera Live Chat
          </h2>
          <p className="text-muted-foreground">
            Customer conversations from website chat and WhatsApp. Reply, assign,
            and convert to support tickets.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadConversations}>
            <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase text-muted-foreground">Open</p>
            <p className="text-2xl font-bold text-blue-600">{openCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase text-muted-foreground">Assigned</p>
            <p className="text-2xl font-bold text-indigo-600">{assignedCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase text-muted-foreground">Total</p>
            <p className="text-2xl font-bold">{conversations.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs uppercase text-muted-foreground">Unread</p>
            <p className="text-2xl font-bold text-red-600">
              {conversations.reduce((s, c) => s + c.unread_count, 0)}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Conversation list */}
        <div className="lg:col-span-4 space-y-2">
          <div className="flex items-center gap-2 mb-3">
            <label className="text-xs font-medium text-muted-foreground">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs rounded-md border border-input bg-background px-2 py-1"
            >
              <option value="all">All</option>
              <option value="open">Open</option>
              <option value="assigned">Assigned</option>
              <option value="closed">Closed</option>
            </select>
          </div>
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground text-sm">
              No conversations
            </div>
          ) : (
            <div className="space-y-1">
              {conversations.map((c) => {
                const isActive = selected?.id === c.id
                return (
                  <button
                    key={c.id}
                    onClick={() => selectConversation(c)}
                    className={cn(
                      "w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left",
                      isActive
                        ? "bg-retail/10 border-retail/50"
                        : "bg-background border-border hover:bg-muted",
                      c.unread_count > 0 && "font-semibold"
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        {CHANNEL_ICON[c.channel]}
                        <span className="text-xs font-medium truncate">
                          {c.customer_name || c.external_id}
                        </span>
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded ${STATUS_COLOR[c.status] || "bg-gray-100"}`}
                        >
                          {c.status}
                        </span>
                      </div>
                      {c.last_message && (
                        <div className="text-xs text-muted-foreground truncate">
                          {c.last_message.message}
                        </div>
                      )}
                    </div>
                    {c.unread_count > 0 && (
                      <span className="text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded-full">
                        {c.unread_count}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Conversation detail */}
        <div className="lg:col-span-8 flex flex-col h-[70vh]">
          {!selected ? (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
              <Ticket className="w-12 h-12 opacity-20 mb-3" />
              <p>Select a conversation to reply.</p>
            </div>
          ) : (
            <div className="flex flex-col h-full">
              <Card className="flex-1 flex flex-col">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        {CHANNEL_ICON[selected.channel]}
                        <span className="text-xs font-medium text-muted-foreground uppercase">
                          {CHANNEL_LABEL[selected.channel]}
                        </span>
                      </div>
                      <div className="flex items-baseline gap-1">
                        <h3 className="font-semibold text-sm">
                          {selected.customer_name || selected.external_id}
                        </h3>
                        {selected.customer_phone && (
                          <span className="text-xs text-muted-foreground">
                            · {selected.customer_phone}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => assignToMe()}
                        disabled={selected.status !== "open"}
                      >
                        <User className="w-3.5 h-3.5 mr-1" /> Assign to me
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          updateStatus(
                            selected.status === "closed" ? "open" : "closed"
                          )
                        }
                      >
                        {selected.status === "closed" ? "Reopen" : "Close"}
                      </Button>
                      {selected.channel === "website" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={startWebRTCCall}
                          disabled={activeCall !== null || selected.status === "closed"}
                        >
                          <Phone className="w-3.5 h-3.5 mr-1" /> Internet Call
                        </Button>
                      )}
                      {(selected.channel === "whatsapp" || selected.customer_phone) && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={startSIPCall}
                          disabled={activeCall !== null || !selected.customer_phone || selected.status === "closed"}
                        >
                          <Phone className="w-3.5 h-3.5 mr-1" /> Phone Call
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="flex-1 overflow-y-auto p-0">
                  <div ref={scrollRef} className="p-4 space-y-3">
                    {messages.length === 0 && (
                      <div className="text-center py-10 text-muted-foreground text-sm">
                        No messages yet
                      </div>
                    )}
                    {messages.map((m) => (
                      <div
                        key={m.id}
                        className={cn(
                          "max-w-[85%] rounded-lg p-3 text-sm break-words",
                          m.direction === "outbound"
                            ? "ml-auto bg-retail text-white rounded-tr-none"
                            : "mr-auto bg-muted text-foreground rounded-tl-none"
                        )}
                      >
                        <div className="flex items-center gap-1.5 mb-1">
                          <span
                            className="text-[10px] font-medium uppercase tracking-wider"
                          >
                            {m.author_type === "ai"
                              ? "Azera"
                              : m.author_type === "agent"
                              ? "Agent"
                              : "Customer"}
                          </span>
                          <span className="text-[10px] opacity-50">
                            {new Date(m.created_at).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        {m.message}
                      </div>
                    ))}
                  </div>
                </CardContent>

                <div className="border-t border-border p-3 bg-white/50 flex gap-2">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Type a reply…"
                    rows={1}
                    className="flex-1 resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-retail/50"
                    disabled={!selected || selected.status === "closed"}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault()
                        sendReply()
                      }
                    }}
                  />
                  <button
                    onClick={sendReply}
                    disabled={sending || !input.trim() || !selected || selected.status === "closed"}
                    className="rounded-lg px-4 py-2 text-sm font-medium transition-opacity disabled:opacity-50 bg-retail text-white disabled:bg-retail/40"
                  >
                    {sending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Send className="w-4 h-4" />}
                    {sending ? "Sending…" : "Send"}
                  </button>
                  {selected.status === "closed" && (
                    <span className="text-xs text-red-500">Conversation closed</span>
                  )}
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* Call UI overlay */}
      {activeCall && (
        <div className="fixed z-[60] top-24 left-1/2 -translate-x-1/2 w-full max-w-md">
          {activeCall.type === "webrtc" && (
            <AzeraCallUI
              state={webrtc.state}
              isAgent={true}
              customerName={selected?.customer_name || "Customer"}
              onAccept={webrtc.answerCall}
              onReject={endActiveCall}
              onEnd={endActiveCall}
              onToggleMute={webrtc.toggleMute}
              isMuted={webrtc.isMuted}
              onStartRecording={webrtc.onStartRecording}
              onStopRecording={webrtc.onStopRecording}
              isRecording={isRecording}
            />
          )}
          {activeCall.type === "sip" && callUI(
            selected?.customer_name || "Customer",
            endActiveCall,
            callError
          )}
        </div>
      )}
    </div>
  )
}

function callUI(customerName: string, onEnd: () => void, error: string | null) {
  return (
    <div className="bg-white rounded-2xl shadow-2xl border border-border p-4 flex flex-col items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-300">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center animate-pulse">
          <Phone className="w-5 h-5" />
        </div>
        <div>
          <div className="font-semibold text-sm">Calling {customerName}…</div>
          <div className="text-xs text-muted-foreground">Phone call (SIP)</div>
        </div>
      </div>
      <div className="flex gap-3">
        <button
          onClick={onEnd}
          className="px-6 py-2 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition-colors"
        >
          <PhoneOff className="w-4 h-4 mr-1" /> Hang up
        </button>
      </div>
      {error && <div className="text-xs text-red-500">{error}</div>}
    </div>
  )
}
