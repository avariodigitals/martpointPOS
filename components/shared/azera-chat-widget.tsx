"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { Send, MessageCircle, X, Loader2, User, Bot, Phone, PhoneOff } from "lucide-react"
import { useWebRTCCall, AzeraCallUI } from "@/components/shared/azera-webrtc-call"

interface AzeraChatWidgetProps {
  /** The business's public ID (from businesses table) */
  businessId?: string
  /** A random session id for this website visitor (auto-generated if omitted) */
  externalId?: string
  /** Customer name if known */
  customerName?: string
  /** Override widget title */
  title?: string
  /** Override widget greeting */
  greeting?: string
  /** Brand color for the button/header */
  brandColor?: string
  /** Position: bottom-right | bottom-left */
  position?: "bottom-right" | "bottom-left"
}

interface ChatMessage {
  id: string
  author_type: "customer" | "agent" | "ai" | "system"
  message: string
  direction: "inbound" | "outbound"
  created_at: string
}

interface Conversation {
  id: string
  channel: string
  status: string
  ai_enabled: boolean
  last_message_at: string
}

/**
 * Azera Chat Widget — embeddable live chat for a MartPoint business website.
 *
 * Usage:
 *   <AzeraChatWidget businessId="..." externalId="..." />
 *
 * The widget:
 *   1. Opens a chat panel on the site
 *   2. Sends messages to /api/azera/chat
 *   3. Displays AI replies (and agent replies when they come in)
 */
export function AzeraChatWidget({
  businessId,
  externalId: externalIdProp,
  customerName,
  title = "Chat with us",
  greeting = "Hello! How can we help you today?",
  brandColor = "#0057FF",
  position = "bottom-right",
}: AzeraChatWidgetProps) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [connected, setConnected] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Call state
  const [activeCall, setActiveCall] = useState<{ id: string; type: "webrtc" } | null>(null)
  const [callError, setCallError] = useState<string | null>(null)

  // WebRTC hook for customer side
  const webrtc = activeCall?.type === "webrtc"
    ? useWebRTCCall({
        callId: activeCall.id,
        isAgent: false,
        onCallEnded: () => setActiveCall(null),
      })
    : { state: "idle" as const, error: null, startCall: () => {}, answerCall: () => {}, endCall: () => {}, toggleMute: () => {}, isMuted: false }

  const externalId =
    externalIdProp ||
    (typeof window !== "undefined"
      ? localStorage.getItem("azera_session_id") ||
        (() => {
          const id = "web_" + crypto.randomUUID()
          localStorage.setItem("azera_session_id", id)
          return id
        })()
      : "")

  useEffect(() => {
    if (!businessId || !externalId) return
    fetchConversation(businessId, externalId)
  }, [businessId, externalId])

  async function fetchConversation(bizId: string, extId: string) {
    try {
      const res = await fetch(
        `/api/azera/conversations?business_id=${encodeURIComponent(bizId)}&channel=website&external_id=${encodeURIComponent(extId)}`
      )
      const json = await res.json()
      if (json.conversations && json.conversations.length > 0) {
        setConversation(json.conversations[0])
        loadMessages(json.conversations[0].id)
      }
    } catch {
      // ignore — conversation will be created on first message
    }
  }

  async function loadMessages(convId: string) {
    try {
      const res = await fetch(`/api/azera/conversations/${encodeURIComponent(convId)}/messages?limit=100`)
      const json = await res.json()
      if (json.messages) {
        setMessages(
          json.messages.map((m: any) => ({
            id: m.id,
            author_type: m.author_type,
            message: m.message,
            direction: m.direction,
            created_at: m.created_at,
          }))
        )
      }
    } catch {
      setMessages([])
    }
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim() || !businessId) return
    const text = input.trim()
    setInput("")
    setLoading(true)

    // Optimistically add customer message
    const tempId = "temp_" + Date.now()
    setMessages((prev) => [
      ...prev,
      { id: tempId, author_type: "customer", message: text, direction: "inbound", created_at: new Date().toISOString() },
    ])
    scrollToBottom()

    try {
      const res = await fetch("/api/azera/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business_id: businessId,
          external_id: externalId,
          customer_name: customerName || undefined,
          message: text,
        }),
      })
      const json = await res.json()
      if (json.success) {
        if (json.data.conversation) setConversation(json.data.conversation)
        // Replace optimistic message with real one if ids align, else append
        if (json.data.customer_message) {
          setMessages((prev) =>
            prev.map((m) => (m.id === tempId ? { ...m, id: json.data.customer_message.id } : m))
          )
        }
        if (json.data.ai_message) {
          setMessages((prev) => [
            ...prev,
            {
              id: json.data.ai_message.id,
              author_type: "ai",
              message: json.data.ai_message.message,
              direction: "outbound",
              created_at: json.data.ai_message.created_at,
            },
          ])
          setLoading(false)
          scrollToBottom()
          return
        }
      }
    } catch {
      // ignore
    } finally {
      setLoading(false)
      scrollToBottom()
    }

    // Poll for new messages (AI or agent) for a few seconds
    if (conversation?.id) {
      for (let i = 0; i < 6; i++) {
        await new Promise((r) => setTimeout(r, 2000))
        await loadMessages(conversation.id)
      }
    }
    setLoading(false)
    scrollToBottom()
  }

  async function requestCall() {
    if (!businessId || !conversation?.id) return
    setCallError(null)
    try {
      const res = await fetch("/api/azera/calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          business_id: businessId,
          conversation_id: conversation.id,
          call_type: "webrtc",
          direction: "inbound",
          customer_name: customerName || undefined,
          customer_external_id: externalId,
          webrtc_room: `azera-web-${conversation.id}`,
        }),
      })
      const json = await res.json()
      if (json.success && json.data) {
        setActiveCall({ id: json.data.id, type: "webrtc" })
      } else {
        setCallError(json.error || "Failed to request call")
      }
    } catch (e) {
      setCallError(String(e))
    }
  }

  function scrollToBottom() {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Auto-greeting on open
  useEffect(() => {
    if (open && !connected && greeting) {
      setConnected(true)
      setMessages((prev) =>
        prev.length === 0
          ? [
              {
                id: "welcome",
                author_type: "ai",
                message: greeting,
                direction: "outbound",
                created_at: new Date().toISOString(),
              },
            ]
          : prev
      )
    }
  }, [open, greeting, connected])

  const bubblePosition = position === "bottom-left" ? "left-1/2 -translate-x-1/2" : "right-0"

  return (
    <div className="fixed z-50">
      {/* Chat button */}
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "fixed w-12 h-12 rounded-full flex items-center justify-center shadow-lg text-white transition-transform duration-200 active:scale-95",
          `bottom-8 ${position === "bottom-right" ? "right-8" : "left-8"}`,
          `bg-${brandColor}`
        )}
        aria-label="Open chat"
      >
        <MessageCircle className="w-6 h-6" />
      </button>

      {/* Chat panel */}
      {open && (
        <div
          className={cn(
            "fixed z-50 w-full max-w-xs h-[90vh] flex flex-col border border-border bg-white rounded-2xl shadow-2xl",
            `bottom-20 ${position === "bottom-right" ? "right-8" : "left-8"}`,
            `border-t-4 ${brandColor ? `border-${brandColor}` : ""}`
          )}
        >
          {/* Header */}
          <div className={`bg-${brandColor} text-white rounded-t-xl p-4 flex items-center gap-3`}>
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
              <Bot className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm">{title}</div>
              <div className="text-xs opacity-90">Azera · MartPoint</div>
            </div>
            <button onClick={() => setOpen(false)} className="text-white/70 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
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
                {m.author_type === "ai" && (
                  <span className="text-[10px] uppercase tracking-wider opacity-60 block mb-1">Azera</span>
                )}
                {m.message}
                <span className="text-[10px] block mt-1 opacity-50">
                  {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            ))}
            {loading && (
              <div className="ml-auto max-w-[85%] rounded-lg bg-retail text-white p-3 text-sm rounded-tr-none flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Typing…
              </div>
            )}
          </div>

          {/* Input */}
          <form onSubmit={sendMessage} className="p-3 border-t border-border bg-white flex gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message…"
              rows={1}
              className="flex-1 resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-retail/50"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) e.preventDefault()
              }}
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className={`rounded-lg p-2.5 text-white transition-opacity disabled:opacity-50 ${brandColor ? `bg-${brandColor}` : "bg-retail"}`}
              aria-label="Send"
            >
              <Send className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={requestCall}
              disabled={loading || !conversation?.id}
              className="rounded-lg p-2.5 text-white transition-opacity disabled:opacity-50 bg-blue-600 hover:bg-blue-700"
              aria-label="Request call"
            >
              <Phone className="w-5 h-5" />
            </button>
          </form>
        </div>
      )}

      {/* Call UI */}
      {activeCall && (
        <AzeraCallUI
          state={webrtc.state}
          isAgent={false}
          customerName={customerName || "You"}
          onAccept={webrtc.answerCall}
          onReject={() => setActiveCall(null)}
          onEnd={() => setActiveCall(null)}
          onToggleMute={webrtc.toggleMute}
          isMuted={webrtc.isMuted}
        />
      )}
    </div>
  )
}

function cn(...classes: (string | undefined | null | boolean)[]): string {
  return classes.filter(Boolean).join(" ")
}
