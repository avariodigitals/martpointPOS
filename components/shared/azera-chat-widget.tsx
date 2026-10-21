"use client"

import { useEffect, useRef, useState } from "react"
import { Send, MessageCircle, X, Loader2, Phone, Smile } from "lucide-react"
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
  business_id?: string
  channel: string
  status: string
  ai_enabled: boolean
  last_message_at: string
  created_at?: string
  waiting_for_agent?: boolean
  queue_position?: number | null
}

interface VisitorProfile {
  name: string
  email?: string
  phone?: string
}

function MartPointBubbleIcon({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      aria-hidden="true"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M8 14.5C8 9.8 12.2 7 18 7h18c7.2 0 12 3.8 12 9.5S43.2 26 36 26H23l-8.5 8.5V26.2C10.4 24.8 8 20.4 8 14.5Z"
        fill="currentColor"
      />
      <path
        d="M24 24h18c7.2 0 12 3.8 12 9.5S49.2 43 42 43H31l-7.5 8v-8.3C19.2 41.1 17 37 17 33.5c0-1.5.3-2.8.9-4"
        fill="currentColor"
        fillOpacity="0.72"
      />
    </svg>
  )
}

function getReadableTextColor(color: string): "#0f172a" | "#ffffff" {
  const normalized = color.trim().replace(/^#/, "")
  const hex = normalized.length === 3
    ? normalized.split("").map((digit) => digit + digit).join("")
    : normalized.slice(0, 6)

  if (!/^[0-9a-f]{6}$/i.test(hex)) return "#ffffff"

  const red = Number.parseInt(hex.slice(0, 2), 16)
  const green = Number.parseInt(hex.slice(2, 4), 16)
  const blue = Number.parseInt(hex.slice(4, 6), 16)
  const brightness = (red * 299 + green * 587 + blue * 114) / 1000

  return brightness > 160 ? "#0f172a" : "#ffffff"
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
  brandColor = "#2563EB",
  position = "bottom-right",
  source = "public_site",
}: AzeraChatWidgetProps) {
  const brandTextColor = getReadableTextColor(brandColor)
  const [open, setOpen] = useState(false)
  const [showEndConfirmation, setShowEndConfirmation] = useState(false)
  const [showRating, setShowRating] = useState(false)
  const [ratingSubmitting, setRatingSubmitting] = useState(false)
  const [ratingSubmitted, setRatingSubmitted] = useState(false)
  const [ratingError, setRatingError] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [expandedMessages, setExpandedMessages] = useState<Record<string, boolean>>({})
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [chatTimerStartedAt, setChatTimerStartedAt] = useState<number | null>(null)
  const [chatElapsedSeconds, setChatElapsedSeconds] = useState(0)
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

  useEffect(() => {
    if (!open || chatTimerStartedAt === null) return
    const startedAt = chatTimerStartedAt
    const updateElapsed = () => setChatElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)))
    const interval = window.setInterval(updateElapsed, 1000)
    return () => window.clearInterval(interval)
  }, [open, chatTimerStartedAt])

  useEffect(() => {
    if (open && !needsVisitorProfile) inputRef.current?.focus()
  }, [open, needsVisitorProfile])

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
    setConnected(true)
    setMessages((previous) => previous.length > 0 ? previous : [{
      id: "welcome-after-profile",
      author_type: "ai",
      message: `Thanks, ${profile.name}! You’re all set. What would you like to see in your demo? Tell me a little about your business or ask me a question, and I’ll guide you.`,
      direction: "outbound",
      created_at: new Date().toISOString(),
    }])
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

  useEffect(() => {
    if (!open || !conversation?.waiting_for_agent || !businessId || !externalId) return
    const refreshQueue = () => void loadMessages(businessId, externalId, conversationTokenRef.current)
    const interval = window.setInterval(refreshQueue, 15000)
    return () => window.clearInterval(interval)
    // loadMessages is intentionally local; the stable IDs and token ref keep polling scoped to this thread.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, conversation?.waiting_for_agent, businessId, externalId])

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

    // The chat API has finished generating or routing the reply, so refresh once
    // to pick up system handoff messages without adding a fixed polling delay.
    await loadMessages(businessId, externalId, conversationTokenRef.current)
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
    setChatTimerStartedAt(nextOpen ? Date.now() : null)
    setChatElapsedSeconds(0)
    if (nextOpen && (ratingSubmitted || conversation?.status === "closed")) {
      setShowRating(false)
      setRatingSubmitted(false)
      setShowEndConfirmation(false)
      setRatingError(null)
    }
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

  const formattedChatTimer = `${String(Math.floor(chatElapsedSeconds / 60)).padStart(2, "0")}:${String(chatElapsedSeconds % 60).padStart(2, "0")}`
  const hasHandoffMessage = messages.some((message) =>
    message.author_type === "system" && /sent this to a specialist|bringing a martpoint specialist|connecting you with a martpoint specialist|human support agent has been requested/i.test(message.message)
  )

  function closeOrRateChat() {
    if (showEndConfirmation) {
      setShowEndConfirmation(false)
      return
    }
    if (showRating) {
      if (ratingSubmitted) setOpen(false)
      else void finishChat()
      return
    }
    const hasCustomerMessages = messages.some((message) => message.author_type === "customer")
    if (conversation?.id && hasCustomerMessages) {
      setRatingError(null)
      setShowEndConfirmation(true)
      return
    }
    setOpen(false)
  }

  async function finishChat(rating?: number) {
    if (!conversation?.id || !businessId || !externalId || !conversationToken) {
      setOpen(false)
      return
    }

    setRatingSubmitting(true)
    setRatingError(null)
    try {
      const response = await fetch("/api/azera/merchant/end", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Azera-Chat-Token": conversationToken,
        },
        body: JSON.stringify({ business_id: conversation.business_id || businessId, external_id: externalId, ...(rating ? { rating } : {}) }),
      })
      const result = await response.json()
      if (!response.ok || !result.success) throw new Error(result.error || "Could not finish this chat")
      setConversation((current) => current ? { ...current, status: "closed" } : current)
      setMessages([])
      if (rating) setRatingSubmitted(true)
      else setOpen(false)
    } catch (error) {
      setRatingError(error instanceof Error ? error.message : "Could not save your rating")
    } finally {
      setRatingSubmitting(false)
    }
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-[70]">
      {/* Chat button */}
      {!open && (
        <button
          onClick={toggleChat}
          style={{
            color: brandColor,
          }}
          className={cn(
            "pointer-events-auto group fixed bottom-8 flex h-24 w-24 items-center justify-center rounded-full bg-transparent shadow-none transition-all duration-300 hover:-translate-y-1 hover:scale-105 active:scale-95 sm:bottom-9",
            position === "bottom-right" ? "right-8 sm:right-10" : "left-8 sm:left-10",
          )}
          aria-label="Open Azera chat"
          aria-expanded={false}
        >
          {/* Professional Pulse Effect */}
          <span className="absolute inset-4 rounded-full border-2 border-current opacity-50 animate-ping" aria-hidden="true" />

          <span className="relative flex h-24 w-24 items-center justify-center drop-shadow-[0_12px_20px_rgba(15,23,42,0.3)]">
            <span className="animate-[pulse_3s_ease-in-out_infinite]">
              <MartPointBubbleIcon className="h-20 w-20 transition-transform group-hover:rotate-6" />
            </span>
            <Smile className="absolute right-2 top-14 h-6 w-6 rounded-full bg-white/90 p-0.5 text-amber-500 shadow-sm" aria-hidden="true" />
          </span>
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div
          className={cn(
            "pointer-events-auto fixed z-50 flex h-[min(680px,calc(100dvh-9rem))] w-[min(420px,calc(100vw-1rem))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_65px_rgba(15,23,42,0.24)]",
            "bottom-28 sm:bottom-32",
            position === "bottom-right" ? "right-4 sm:right-8" : "left-4 sm:left-8",
          )}
          role="dialog"
          aria-label={title}
        >
          {/* Header */}
          <div style={{ backgroundColor: brandColor, color: brandTextColor }} className="flex items-center gap-3 px-4 py-3.5">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-white/20 ring-1 ring-white/25">
              <MartPointBubbleIcon className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="truncate text-sm font-bold tracking-tight">{title}</div>
              <div className="mt-0.5 flex items-center gap-1.5 text-xs opacity-90">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                Live Sales &amp; Support
                <span className="ml-2 rounded-md bg-black/10 px-1.5 py-0.5 font-mono text-[11px] tabular-nums" aria-label={`Chat open for ${formattedChatTimer}`}>
                  {formattedChatTimer}
                </span>
              </div>
            </div>
            <button onClick={closeOrRateChat} aria-label="Close chat" className="rounded-lg p-2 opacity-75 transition hover:bg-white/15 hover:opacity-100">
              <X className="h-4 w-4" />
            </button>
          </div>

          {showEndConfirmation && (
            <section className="flex min-h-0 flex-1 flex-col items-center justify-center bg-white px-6 py-8 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                <MessageCircle className="h-7 w-7" aria-hidden="true" />
              </span>
              <h2 className="mt-5 text-xl font-bold text-slate-900">Would you like to end this chat?</h2>
              <p className="mt-2 max-w-xs text-sm leading-relaxed text-slate-600">Your conversation will close, and you’ll have a chance to tell us whether we resolved your question.</p>
              <button onClick={() => setShowEndConfirmation(false)} className="mt-6 h-11 w-full max-w-xs rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800">Keep chatting</button>
              <button onClick={() => { setShowEndConfirmation(false); setShowRating(true) }} className="mt-2 h-11 w-full max-w-xs rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">End chat</button>
            </section>
          )}

          {showRating && (
            <section className="flex min-h-0 flex-1 flex-col items-center justify-center bg-slate-50 px-5 py-8 text-center">
              {ratingSubmitted ? (
                <>
                  <span className="text-5xl" aria-hidden="true">😊</span>
                  <h2 className="mt-4 text-xl font-bold text-slate-900">Thanks for your feedback!</h2>
                  <p className="mt-2 text-sm text-slate-600">Your rating helps our team improve.</p>
                  <button onClick={() => setOpen(false)} className="mt-6 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white">Done</button>
                </>
              ) : (
                <>
                  <h2 className="text-xl font-bold text-slate-900">Did you get the help you needed?</h2>
                  <p className="mt-2 text-sm text-slate-600">Your feedback helps us improve the support you receive.</p>
                  <div className="mt-6 flex items-center justify-center gap-2 sm:gap-3" role="group" aria-label="Rate your chat">
                    {[
                      { value: 1, face: "😞", label: "Not at all" },
                      { value: 2, face: "🙁", label: "A little" },
                      { value: 3, face: "😐", label: "Somewhat" },
                      { value: 4, face: "🙂", label: "Mostly" },
                      { value: 5, face: "😄", label: "Completely" },
                    ].map(({ value, face, label }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => void finishChat(value)}
                        disabled={ratingSubmitting}
                        aria-label={`${label}, ${value} out of 5`}
                        className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white text-2xl shadow-sm transition hover:-translate-y-1 hover:border-blue-300 hover:shadow-md disabled:opacity-50 sm:h-14 sm:w-14"
                      >
                        {face}
                      </button>
                    ))}
                  </div>
                  {ratingSubmitting && <p className="mt-4 text-sm text-slate-500">Saving your rating…</p>}
                  {ratingError && <p role="alert" className="mt-4 text-sm text-red-700">{ratingError}</p>}
                  <button type="button" onClick={() => void finishChat()} disabled={ratingSubmitting} className="mt-7 text-sm font-medium text-slate-500 underline underline-offset-4 disabled:opacity-50">Skip rating</button>
                </>
              )}
            </section>
          )}

          {needsVisitorProfile && !showRating && !showEndConfirmation && (
            <form onSubmit={saveVisitorProfile} className="min-h-0 flex-1 overflow-y-auto bg-slate-50 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <div
                className="relative overflow-hidden px-5 pb-7 pt-8 text-center"
                style={{
                  background: `linear-gradient(145deg, ${brandColor} 0%, ${brandColor} 62%, #0f172a 145%)`,
                  color: brandTextColor,
                }}
              >
                <div className="pointer-events-none absolute -right-12 -top-16 h-40 w-40 rounded-full border-[18px] border-white/10" />
                <div className="pointer-events-none absolute -bottom-20 -left-12 h-44 w-44 rounded-full border-[24px] border-white/10" />
                <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-[1.35rem] bg-white/20 shadow-lg ring-1 ring-white/30 backdrop-blur-sm">
                  <MartPointBubbleIcon className="h-9 w-9" />
                </div>
                <p className="relative mt-4 text-xl font-bold tracking-tight">Welcome to MartPoint Support</p>
                <p className="relative mx-auto mt-2 max-w-[18rem] text-sm leading-relaxed opacity-80">
                  Our sales team is ready to help with setup, pricing, and everyday questions.
                </p>
              </div>

              <div className="px-5 py-5">
                <p className="text-base font-bold text-slate-900">Let’s get you connected</p>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">Add your details so our team can reply with the right context.</p>
                <div className="mt-4 space-y-2.5">
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-600">Your name</span>
                    <input value={profileDraft.name} onChange={(event) => setProfileDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Enter your name" autoComplete="name" className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-900 outline-none placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15" />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-600">Email address <span className="font-normal normal-case tracking-normal text-slate-400">(or use phone below)</span></span>
                    <input value={profileDraft.email || ""} onChange={(event) => setProfileDraft((current) => ({ ...current, email: event.target.value }))} placeholder="Enter your email address" type="email" autoComplete="email" className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-900 outline-none placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15" />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-600">Phone <span className="font-normal normal-case tracking-normal text-slate-400">(optional)</span></span>
                    <input value={profileDraft.phone || ""} onChange={(event) => setProfileDraft((current) => ({ ...current, phone: event.target.value }))} placeholder="Add a phone number" type="tel" autoComplete="tel" className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-sm text-slate-900 outline-none placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15" />
                  </label>
                  <button type="submit" style={{ backgroundColor: brandColor, color: brandTextColor }} className="mt-1 h-11 w-full rounded-xl px-3 text-sm font-bold shadow-[0_8px_18px_rgba(15,23,42,0.14)] transition hover:-translate-y-0.5 hover:brightness-95">Start chatting</button>
                </div>
                <p className="mt-3 text-center text-xs text-slate-500">Private and secure. We’ll only use this to help with your conversation.</p>
              </div>
            </form>
          )}

          {/* Messages */}
          <div ref={scrollRef} className={cn("min-h-0 flex-1 space-y-3 overflow-y-auto scroll-py-2 bg-slate-100 p-4 sm:p-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", (needsVisitorProfile || showRating || showEndConfirmation) && "hidden")}>
            {!needsVisitorProfile && conversation?.status === "closed" && conversation.last_message_at && (
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <p className="text-sm font-bold text-slate-900">Welcome back</p>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">
                  You last chatted with us {new Date(conversation.last_message_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}. Your earlier chat is saved so Azera can help with context, but it isn’t shown here.
                </p>
              </div>
            )}
            {!needsVisitorProfile && messages.length === 0 && (
              <div className="flex h-full min-h-40 flex-col items-center justify-center px-6 text-center text-slate-500">
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm ring-1 ring-slate-200">
                  <MessageCircle className="h-5 w-5" />
                </div>
                <p className="text-base font-semibold text-slate-800">Start a conversation</p>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">Ask about MartPoint, setup, pricing, or support.</p>
              </div>
            )}
            {!needsVisitorProfile && messages.map((m) => {
              const isCustomer = m.author_type === "customer"
              const isExpanded = Boolean(expandedMessages[m.id])
              const canCollapse = m.message.length > 280
              return (
                <div
                  key={m.id}
                  className={cn(
                    "relative w-fit max-w-[94%] rounded-2xl px-3.5 py-2.5 text-sm leading-5 break-words shadow-sm",
                    isCustomer
                      ? "ml-auto rounded-br-md"
                      : "mr-auto rounded-bl-md border border-slate-200 bg-white text-slate-800",
                  )}
                  style={isCustomer ? { backgroundColor: brandColor, color: brandTextColor } : undefined}
                >
                  {m.author_type === "agent" && (
                    <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      MartPoint Support
                    </span>
                  )}
                  <p
                    className="whitespace-pre-wrap"
                    style={canCollapse && !isExpanded ? {
                      display: "-webkit-box",
                      WebkitBoxOrient: "vertical",
                      WebkitLineClamp: 5,
                      overflow: "hidden",
                    } : undefined}
                  >
                    {m.message}
                  </p>
                  {canCollapse && (
                    <button
                      type="button"
                      onClick={() => setExpandedMessages((current) => ({ ...current, [m.id]: !current[m.id] }))}
                      className="mt-1 text-xs font-semibold underline underline-offset-2"
                      style={{ color: isCustomer ? brandTextColor : brandColor }}
                    >
                      {isExpanded ? "Show less" : "Show more"}
                    </button>
                  )}
                  <div className="mt-1 flex items-center justify-between gap-3 text-[10px] leading-4 opacity-60">
                    <span>{new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    {isCustomer && <span>Delivered</span>}
                  </div>
                  <span
                    aria-hidden="true"
                    style={isCustomer ? { backgroundColor: brandColor } : undefined}
                    className={cn(
                      "absolute bottom-[-5px] h-3 w-3 rotate-45",
                      isCustomer
                        ? "right-2 rounded-br-[3px]"
                        : "left-2 rounded-bl-[3px] border-b border-l border-slate-200 bg-white",
                    )}
                  />
                </div>
              )
            })}
            {!needsVisitorProfile && conversation?.waiting_for_agent && hasHandoffMessage && !showRating && !showEndConfirmation && (
              <div className="mr-auto w-fit max-w-[94%] rounded-2xl rounded-bl-md border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm leading-5 text-amber-950" role="status" aria-live="polite">
                <span className="font-semibold">
                  {conversation.queue_position ? `You’re #${conversation.queue_position} in the queue` : "You’re in the queue"}
                </span>
                <span> — a specialist will join as soon as possible.</span>
              </div>
            )}
            {!needsVisitorProfile && loading && (
              <div className="mr-auto flex w-fit max-w-[94%] items-center gap-2 rounded-2xl rounded-bl-md border border-slate-200 bg-white px-3.5 py-2.5 text-sm leading-5 text-slate-700 shadow-sm">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Typing…
              </div>
            )}
            {sendError && !needsVisitorProfile && (
              <div className="mr-auto max-w-[90%] rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm leading-relaxed text-red-800">
                {sendError}
              </div>
            )}
          </div>

          {/* Input */}
          <form onSubmit={sendMessage} className={cn("flex gap-2 border-t border-slate-200 bg-white p-3", (needsVisitorProfile || showRating || showEndConfirmation) && "hidden")}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={needsVisitorProfile}
              placeholder="Type a message…"
              rows={1}
              className="min-h-10 flex-1 resize-none rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-500 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10"
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
              style={{ backgroundColor: brandColor, color: brandTextColor }}
              className="h-10 w-10 shrink-0 rounded-xl p-2.5 shadow-sm transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Send"
            >
              <Send className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={requestCall}
              disabled={loading || !conversation?.id}
              style={{ backgroundColor: brandColor, color: brandTextColor }}
              className="h-10 w-10 rounded-xl p-2.5 transition-opacity hover:brightness-90 disabled:opacity-50"
              aria-label="Request call"
            >
              <Phone className="h-4 w-4" />
            </button>
          </form>
          {callError && <p className="border-t border-red-100 bg-red-50 px-3 py-2 text-sm text-red-800">{callError}</p>}
          <div className="border-t border-slate-100 bg-white px-3 py-2 text-center text-xs text-slate-500">
            Powered by <a href="https://www.avariodigitals.com" target="_blank" rel="noreferrer" className="font-medium text-slate-500 underline decoration-slate-300 underline-offset-2 hover:text-blue-600">Avario</a>
          </div>
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
