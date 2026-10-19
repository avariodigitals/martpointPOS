"use client"

import { useEffect, useRef, useState } from "react"
import { Send, MessageCircle, X, Loader2, Phone } from "lucide-react"
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

interface VisitorProfile {
  name: string
  email?: string
  phone?: string
}

function MartPointBubbleIcon({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true" fill="none">
      <path d="M10 29.5C10 17.9 20.5 10 33.7 10c12.4 0 21.8 6.9 21.8 17.8 0 11.4-10.1 18.4-23 18.4-3 0-5.8-.4-8.2-1.1L14 53l3.4-10.3c-4.7-3.2-7.4-7.7-7.4-13.2Z" fill="currentColor" opacity=".98" />
      <path d="M21.5 45.4c2.2 1 5.6 1.7 9.2 1.7 8.6 0 15.7-2.8 20.2-7.7" stroke="white" strokeWidth="2.5" strokeLinecap="round" opacity=".55" />
      <path d="M43.5 7v8M39.5 11h8" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="49.5" cy="22" r="1.8" fill="currentColor" />
    </svg>
  )
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
  const [sendError, setSendError] = useState<string | null>(null)
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [conversationToken, setConversationToken] = useState<string | null>(() =>
    typeof window !== "undefined" ? localStorage.getItem("azera_chat_token") : null
  )
  const [visitorProfile, setVisitorProfile] = useState<VisitorProfile | null>(() => {
    if (typeof window === "undefined") return null
    try {
      const saved = localStorage.getItem("azera_visitor_profile")
      return saved ? JSON.parse(saved) as VisitorProfile : null
    } catch {
      return null
    }
  })
  const [profileDraft, setProfileDraft] = useState<VisitorProfile>({ name: customerName || "", email: "", phone: "" })
  const [connected, setConnected] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const previousMessageIds = useRef<Set<string>>(new Set())
  const conversationTokenRef = useRef<string | null>(conversationToken)

  function rememberConversationToken(token: string) {
    conversationTokenRef.current = token
    setConversationToken(token)
    localStorage.setItem("azera_chat_token", token)
  }

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
  const needsVisitorProfile = source === "public_site" && !visitorProfile

  function saveVisitorProfile(event: React.FormEvent) {
    event.preventDefault()
    const profile = {
      name: profileDraft.name.trim(),
      email: profileDraft.email?.trim() || "",
      phone: profileDraft.phone?.trim() || "",
    }
    if (!profile.name || (!profile.email && !profile.phone)) {
      setSendError("Please add your name and either an email address or phone number.")
      return
    }
    localStorage.setItem("azera_visitor_profile", JSON.stringify(profile))
    setVisitorProfile(profile)
    setSendError(null)
  }

  useEffect(() => {
    if (!businessId || !externalId || needsVisitorProfile) return
    void fetchConversation(businessId, externalId)
    // fetchConversation is intentionally kept local to this widget instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, externalId, needsVisitorProfile])

  async function fetchConversation(bizId: string, extId: string) {
    if (!conversationTokenRef.current) return
    try {
      await loadMessages(bizId, extId)
    } catch {
      // ignore — conversation will be created on first message
    }
  }

  async function loadMessages(bizId = businessId || "", extId = externalId, tokenOverride?: string | null) {
    const token = tokenOverride ?? conversationTokenRef.current
    if (!token) return
    try {
      const res = await fetch(`/api/azera/merchant/messages?business_id=${encodeURIComponent(bizId)}&external_id=${encodeURIComponent(extId)}`, {
        headers: { "X-Azera-Chat-Token": token },
      })
      const json = await res.json()
      if (res.status === 401 || res.status === 403) {
        conversationTokenRef.current = null
        setConversationToken(null)
        localStorage.removeItem("azera_chat_token")
        return
      }
      const data = json.data || json
      if (data.conversation_token) {
        rememberConversationToken(data.conversation_token)
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
    if (needsVisitorProfile) {
      setSendError("Please add your name and contact so our team can help you properly.")
      return
    }
    const text = input.trim()
    setInput("")
    setSendError(null)
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
          ...(conversationTokenRef.current ? { "X-Azera-Chat-Token": conversationTokenRef.current } : {}),
        },
        body: JSON.stringify({
          business_id: businessId,
          external_id: externalId,
          customer_name: visitorProfile?.name || customerName || undefined,
          customer_email: visitorProfile?.email || undefined,
          customer_phone: visitorProfile?.phone || undefined,
          source,
          message: text,
        }),
      })
      const json = await res.json()
      if (!res.ok || !json.success) {
        throw new Error(json.error || "We could not send your message. Please try again.")
      }
      if (json.success) {
        const issuedToken = json.data?.conversation_token
        if (issuedToken) {
          rememberConversationToken(issuedToken)
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
    } catch (error) {
      setMessages((prev) => prev.filter((message) => message.id !== tempId))
      setSendError(error instanceof Error ? error.message : "We could not send your message. Please try again.")
      return
    } finally {
      setLoading(false)
      scrollToBottom()
    }

    // Poll for new messages (AI or agent) for a few seconds
    for (let i = 0; i < 6; i++) {
      await new Promise((r) => setTimeout(r, 2000))
      await loadMessages(businessId, externalId, conversationTokenRef.current)
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

  useEffect(() => {
    const freshReply = messages.some((message) =>
      !previousMessageIds.current.has(message.id) &&
      (message.author_type === "agent" || message.author_type === "ai") &&
      message.id !== "welcome"
    )
    previousMessageIds.current = new Set(messages.map((message) => message.id))
    if (!freshReply || !open || typeof window === "undefined" || document.visibilityState !== "visible") return
    try {
      const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!AudioContextClass) return
      const context = new AudioContextClass()
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.type = "sine"
      oscillator.frequency.setValueAtTime(740, context.currentTime)
      oscillator.frequency.exponentialRampToValueAtTime(980, context.currentTime + 0.08)
      gain.gain.setValueAtTime(0.0001, context.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.07, context.currentTime + 0.015)
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.18)
      oscillator.connect(gain).connect(context.destination)
      oscillator.start()
      oscillator.stop(context.currentTime + 0.2)
      window.setTimeout(() => void context.close(), 350)
    } catch {
      // Notification audio is a progressive enhancement and may be blocked.
    }
  }, [messages, open])

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
    <div className="pointer-events-none fixed inset-0 z-[70]">
      {/* Chat button */}
      {!open && (
        <button
          onClick={toggleChat}
          style={{ backgroundColor: brandColor }}
          className={cn(
            "pointer-events-auto group fixed bottom-5 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-[0_14px_35px_rgba(15,23,42,0.24)] ring-4 ring-white/80 transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_18px_42px_rgba(15,23,42,0.3)] active:scale-95 sm:bottom-6",
            position === "bottom-right" ? "right-5 sm:right-6" : "left-5 sm:left-6",
          )}
          aria-label="Open MartPoint Assist"
          aria-expanded={false}
        >
          <span className="absolute inset-0 rounded-full bg-white/30 opacity-40 animate-ping" aria-hidden="true" />
          <span className="relative flex h-full w-full items-center justify-center">
            <MartPointBubbleIcon className="h-8 w-8 animate-[pulse_3s_ease-in-out_infinite]" />
          </span>
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div
          className={cn(
            "pointer-events-auto fixed z-50 flex h-[min(560px,calc(100vh-5rem))] w-[min(340px,calc(100vw-1rem))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_20px_55px_rgba(15,23,42,0.2)]",
            "bottom-20 sm:bottom-24",
            position === "bottom-right" ? "right-2 sm:right-5" : "left-2 sm:left-5",
          )}
          role="dialog"
          aria-label={title}
        >
          {/* Header */}
          <div style={{ backgroundColor: brandColor }} className="flex items-center gap-2.5 px-3.5 py-3 text-white">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-white/20 ring-1 ring-white/20">
              <MartPointBubbleIcon className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="truncate text-[13px] font-semibold">{title}</div>
              <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-white/80">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                Azera · MartPoint
              </div>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Close chat" className="rounded-lg p-1.5 text-white/75 transition hover:bg-white/15 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>

          {needsVisitorProfile && (
            <form onSubmit={saveVisitorProfile} className="border-b border-blue-100 bg-blue-50/70 p-4">
              <p className="text-sm font-semibold text-slate-800">Before we begin</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">Tell us who we’re speaking with so the right MartPoint team can follow up.</p>
              <div className="mt-3 space-y-2">
                <input value={profileDraft.name} onChange={(event) => setProfileDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Your name" autoComplete="name" className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10" />
                <input value={profileDraft.email || ""} onChange={(event) => setProfileDraft((current) => ({ ...current, email: event.target.value }))} placeholder="Email address (or use phone)" type="email" autoComplete="email" className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10" />
                <input value={profileDraft.phone || ""} onChange={(event) => setProfileDraft((current) => ({ ...current, phone: event.target.value }))} placeholder="Phone number (optional if email added)" type="tel" autoComplete="tel" className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-500/10" />
                <button type="submit" style={{ backgroundColor: brandColor }} className="h-9 w-full rounded-lg px-3 text-xs font-semibold text-white shadow-sm hover:brightness-95">Start chat</button>
              </div>
            </form>
          )}

          {/* Messages */}
          <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-slate-50/80 p-3.5">
            {needsVisitorProfile && (
              <div className="flex h-full min-h-40 flex-col items-center justify-center px-6 text-center text-slate-500">
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-blue-500 shadow-sm ring-1 ring-blue-100">
                  <MartPointBubbleIcon className="h-7 w-7" />
                </div>
                <p className="text-sm font-medium text-slate-700">We’re ready when you are</p>
                <p className="mt-1 text-xs leading-relaxed">Complete the short form above and Azera will connect you with the right MartPoint team.</p>
              </div>
            )}
            {!needsVisitorProfile && messages.length === 0 && (
              <div className="flex h-full min-h-40 flex-col items-center justify-center px-6 text-center text-slate-500">
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm ring-1 ring-slate-200">
                  <MessageCircle className="h-5 w-5" />
                </div>
                <p className="text-sm font-medium text-slate-700">Start a conversation</p>
                <p className="mt-1 text-xs leading-relaxed">Ask about MartPoint, setup, pricing, or support.</p>
              </div>
            )}
            {!needsVisitorProfile && messages.map((m) => (
              <div
                key={m.id}
                className={cn(
                  "relative mb-1 max-w-[88%] rounded-2xl px-3 py-2 text-[13px] leading-relaxed break-words shadow-sm",
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
                <span className="mt-1 block text-[9px] opacity-50">
                  {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
                <span
                  aria-hidden="true"
                  style={m.direction === "outbound" ? { backgroundColor: brandColor } : undefined}
                  className={cn(
                    "absolute bottom-[-5px] h-3 w-3 rotate-45",
                    m.direction === "outbound"
                      ? "right-2 rounded-br-[3px]"
                      : "left-2 rounded-bl-[3px] border-b border-l border-slate-200 bg-white",
                  )}
                />
              </div>
            ))}
            {!needsVisitorProfile && loading && (
              <div style={{ backgroundColor: brandColor }} className="ml-auto flex max-w-[88%] items-center gap-2 rounded-2xl rounded-br-md px-3 py-2 text-[13px] text-white shadow-sm">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Typing…
              </div>
            )}
            {sendError && !needsVisitorProfile && (
              <div className="mr-auto max-w-[88%] rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs leading-relaxed text-red-700">
                {sendError}
              </div>
            )}
          </div>

          {/* Input */}
          <form onSubmit={sendMessage} className={cn("flex gap-1.5 border-t border-slate-200 bg-white p-2.5", needsVisitorProfile && "hidden")}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={needsVisitorProfile}
              placeholder="Type a message…"
              rows={1}
              className="min-h-9 flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] text-slate-800 placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  if (!loading) void sendMessage()
                }
              }}
            />
            <button
              type="submit"
              disabled={!input.trim() || loading || needsVisitorProfile}
              style={{ backgroundColor: brandColor }}
              className="h-9 w-9 shrink-0 rounded-xl p-2 text-white shadow-sm transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Send"
            >
              <Send className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={requestCall}
              disabled={loading || !conversation?.id}
              className="h-9 w-9 rounded-xl bg-blue-600 p-2 text-white transition-opacity hover:bg-blue-700 disabled:opacity-50"
              aria-label="Request call"
            >
              <Phone className="h-4 w-4" />
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
