"use client"

import { useEffect, useRef, useState } from "react"
import { Send, MessageCircle, X, Loader2, Phone, Sparkles } from "lucide-react"
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
  /** Public website chats are treated as sales leads; retail_app is reserved for merchant support. */
  source?: "public_site" | "retail_app"
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
  source = "public_site",
}: AzeraChatWidgetProps) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [conversationToken, setConversationToken] = useState<string | null>(() =>
    typeof window !== "undefined" ? localStorage.getItem("azera_chat_token") : null
  )
  const [connected, setConnected] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Call state
  const [activeCall, setActiveCall] = useState<{ id: string; type: "webrtc" } | null>(null)
  const [callError, setCallError] = useState<string | null>(null)

  // WebRTC hook for customer side
  const webrtc = useWebRTCCall({
    callId: activeCall?.id || "",
    enabled: activeCall?.type === "webrtc",
    isAgent: false,
    onCallEnded: () => setActiveCall(null),
  })

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
    void fetchConversation(businessId, externalId)
    // fetchConversation is intentionally kept local to this widget instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, externalId])

  async function fetchConversation(bizId: string, extId: string) {
    try {
      await loadMessages(bizId, extId)
    } catch {
      // ignore — conversation will be created on first message
    }
  }

  async function loadMessages(bizId = businessId || "", extId = externalId) {
    try {
      const res = await fetch(`/api/azera/merchant/messages?business_id=${encodeURIComponent(bizId)}&external_id=${encodeURIComponent(extId)}`, {
        headers: conversationToken ? { "X-Azera-Chat-Token": conversationToken } : undefined,
      })
      const json = await res.json()
      const data = json.data || json
      if (data.conversation_token) {
        setConversationToken(data.conversation_token)
        localStorage.setItem("azera_chat_token", data.conversation_token)
      }
      if (data.messages) {
        setMessages(
          data.messages.map((m: ChatMessage) => ({
            id: m.id,
            author_type: m.author_type,
            message: m.message,
            direction: m.direction,
            created_at: m.created_at,
          }))
        )
      }
      if (data.conversation) setConversation(data.conversation)
    } catch {
      setMessages([])
    }
  }

  async function sendMessage(e?: React.FormEvent) {
    e?.preventDefault()
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
        headers: {
          "Content-Type": "application/json",
          ...(conversationToken ? { "X-Azera-Chat-Token": conversationToken } : {}),
        },
        body: JSON.stringify({
          business_id: businessId,
          external_id: externalId,
          customer_name: customerName || undefined,
          source,
          message: text,
        }),
      })
      const json = await res.json()
      if (json.success) {
        const issuedToken = json.data?.conversation_token
        if (issuedToken) {
          setConversationToken(issuedToken)
          localStorage.setItem("azera_chat_token", issuedToken)
        }
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
    for (let i = 0; i < 6; i++) {
      await new Promise((r) => setTimeout(r, 2000))
      await loadMessages()
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

  function toggleChat() {
    const nextOpen = !open
    setOpen(nextOpen)
    if (nextOpen && !connected && greeting) {
      setConnected(true)
      setMessages((prev) => prev.length === 0 ? [{
        id: "welcome",
        author_type: "ai",
        message: greeting,
        direction: "outbound",
        created_at: new Date().toISOString(),
      }] : prev)
    }
  }

  return (
    <div className="fixed z-50">
      {/* Chat button */}
      <button
        onClick={toggleChat}
        style={{ backgroundColor: brandColor }}
        className={cn(
          "group relative fixed bottom-5 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-[0_14px_35px_rgba(15,23,42,0.24)] ring-4 ring-white/80 transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_18px_42px_rgba(15,23,42,0.3)] active:scale-95 sm:bottom-6",
          position === "bottom-right" ? "right-5 sm:right-6" : "left-5 sm:left-6",
        )}
        aria-label="Open MartPoint Assist"
        aria-expanded={open}
      >
        {!open && <span className="absolute inset-0 rounded-full bg-white/30 opacity-40 animate-ping" aria-hidden="true" />}
        <span className="relative flex h-full w-full items-center justify-center">
          {open ? <X className="h-6 w-6" /> : <Sparkles className="h-7 w-7 animate-[pulse_3s_ease-in-out_infinite]" />}
        </span>
      </button>

      {/* Chat panel */}
      {open && (
        <div
          className={cn(
            "fixed z-50 flex max-h-[min(680px,calc(100vh-7rem))] w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.22)] sm:w-[380px]",
            "bottom-24 sm:bottom-28",
            position === "bottom-right" ? "right-4 sm:right-6" : "left-4 sm:left-6",
          )}
          role="dialog"
          aria-label={title}
        >
          {/* Header */}
          <div style={{ backgroundColor: brandColor }} className="flex items-center gap-3 px-4 py-3.5 text-white">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-white/20 ring-1 ring-white/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="truncate text-sm font-semibold">{title}</div>
              <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-white/80">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                Azera · MartPoint
              </div>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Close chat" className="rounded-lg p-1.5 text-white/75 transition hover:bg-white/15 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-slate-50/80 p-4">
            {messages.length === 0 && (
              <div className="flex h-full min-h-40 flex-col items-center justify-center px-6 text-center text-slate-500">
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm ring-1 ring-slate-200">
                  <MessageCircle className="h-5 w-5" />
                </div>
                <p className="text-sm font-medium text-slate-700">Start a conversation</p>
                <p className="mt-1 text-xs leading-relaxed">Ask about MartPoint, setup, pricing, or support.</p>
              </div>
            )}
            {messages.map((m) => (
              <div
                key={m.id}
                className={cn(
                  "max-w-[88%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed break-words shadow-sm",
                  m.direction === "outbound"
                    ? "ml-auto rounded-br-md text-white"
                    : "mr-auto rounded-bl-md border border-slate-200 bg-white text-slate-700"
                )}
                style={m.direction === "outbound" ? { backgroundColor: brandColor } : undefined}
              >
                {m.author_type === "ai" && (
                  <span className="text-[10px] uppercase tracking-wider opacity-60 block mb-1">Azera</span>
                )}
                {m.message}
                <span className="mt-1 block text-[10px] opacity-50">
                  {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            ))}
            {loading && (
              <div style={{ backgroundColor: brandColor }} className="ml-auto flex max-w-[88%] items-center gap-2 rounded-2xl rounded-br-md px-3.5 py-2.5 text-sm text-white shadow-sm">
                <Loader2 className="w-4 h-4 animate-spin" /> Typing…
              </div>
            )}
          </div>

          {/* Input */}
          <form onSubmit={sendMessage} className="flex gap-2 border-t border-slate-200 bg-white p-3">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type a message…"
              rows={1}
              className="min-h-10 flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  if (!loading) void sendMessage()
                }
              }}
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              style={{ backgroundColor: brandColor }}
              className="h-10 w-10 shrink-0 rounded-xl p-2.5 text-white shadow-sm transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40"
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
          {callError && <p className="border-t border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">{callError}</p>}
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
