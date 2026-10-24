"use client"

import { useEffect, useRef, useState, type CSSProperties } from "react"
import { createPortal } from "react-dom"
import Image from "next/image"
import dynamic from "next/dynamic"
import { Send, MessageCircle, X, Phone, Minus } from "lucide-react"
import styles from "./azera-chat-widget.module.css"

const AzeraCallController = dynamic(
  () => import("@/components/shared/azera-call-controller").then((module) => module.AzeraCallController),
  { ssr: false },
)

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

interface StreamPayload {
  conversation_token?: string
  conversation?: Conversation
  customer_message?: { id: string }
  ai_message?: { id: string; message: string; created_at: string }
  text?: string
  message?: string
}

function MartPointBubbleIcon({ className = "h-7 w-7", dotColor = "#2563EB" }: { className?: string; dotColor?: string }) {
  return (
    <svg
      viewBox="0 0 64 64"
      className={className}
      aria-hidden="true"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M20 6h24c9 0 15 6 15 15v18c0 9-6 15-15 15H27L17 61V53C10 51 5 46 5 39V21C5 12 11 6 20 6Z" fill="currentColor" />
      <g fill={dotColor}><circle cx="20" cy="28" r="4"/><circle cx="32" cy="28" r="4"/><circle cx="44" cy="28" r="4"/></g>
    </svg>
  )
}

// Scroll only the contact form, never the page behind the fixed chat panel.
function revealProfileField(field: HTMLInputElement) {
  requestAnimationFrame(() => {
    const form = field.closest("form")
    if (!form || document.activeElement !== field) return
    const bounds = form.getBoundingClientRect()
    const inputBounds = field.getBoundingClientRect()
    if (inputBounds.bottom > bounds.bottom - 16) form.scrollTop += inputBounds.bottom - bounds.bottom + 16
    else if (inputBounds.top < bounds.top + 16) form.scrollTop -= bounds.top - inputBounds.top + 16
  })
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
  const tokenStorageKey = `azera_chat_token:${source}:${businessId || "public"}`
  const [open, setOpen] = useState(false)
  const [showEndConfirmation, setShowEndConfirmation] = useState(false)
  const [showRating, setShowRating] = useState(false)
  const [ratingSubmitting, setRatingSubmitting] = useState(false)
  const [ratingSubmitted, setRatingSubmitted] = useState(false)
  const [ratingError, setRatingError] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [expandedMessages, setExpandedMessages] = useState<Record<string, boolean>>({})
  const [showProfileForm, setShowProfileForm] = useState(false)
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const [receivingReply, setReceivingReply] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [chatTimerStartedAt, setChatTimerStartedAt] = useState<number | null>(null)
  const [chatElapsedSeconds, setChatElapsedSeconds] = useState(0)
  const [conversationToken, setConversationToken] = useState<string | null>(() =>
    typeof window !== "undefined"
      ? localStorage.getItem(tokenStorageKey) || (source === "public_site" ? localStorage.getItem("azera_chat_token") : null)
      : null
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
  const [viewportMetrics, setViewportMetrics] = useState({ height: 0, width: 0, top: 0, left: 0 })
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const previousMessageIds = useRef<Set<string>>(new Set())
  const conversationTokenRef = useRef<string | null>(conversationToken)

  // iOS Safari keeps the layout viewport at the full device height while the
  // keyboard reduces the visual viewport. Track both values so the panel and
  // its form stay above the keyboard instead of being covered by it.
  useEffect(() => {
    if (typeof window === "undefined") return
    const visualViewport = window.visualViewport
    const updateViewportMetrics = () => {
      const height = visualViewport?.height || window.innerHeight
      setViewportMetrics({
        height,
        width: visualViewport?.width || window.innerWidth,
        top: visualViewport?.offsetTop || 0,
        left: visualViewport?.offsetLeft || 0,
      })
      if (document.activeElement instanceof HTMLInputElement) revealProfileField(document.activeElement)
    }

    updateViewportMetrics()
    visualViewport?.addEventListener("resize", updateViewportMetrics)
    visualViewport?.addEventListener("scroll", updateViewportMetrics)
    window.addEventListener("resize", updateViewportMetrics)
    return () => {
      visualViewport?.removeEventListener("resize", updateViewportMetrics)
      visualViewport?.removeEventListener("scroll", updateViewportMetrics)
      window.removeEventListener("resize", updateViewportMetrics)
    }
  }, [])

  function rememberConversationToken(token: string) {
    conversationTokenRef.current = token
    setConversationToken(token)
    localStorage.setItem(tokenStorageKey, token)
  }

  /**
   * A public visitor token is intentionally scoped to this site/business.
   * If an old deployment used a different signing secret, the old token must
   * not block the visitor from starting a fresh public conversation.
   */
  function resetPublicConversation(clearMessages = true): string | null {
    if (source !== "public_site" || typeof window === "undefined") return null
    const nextExternalId = `web_${crypto.randomUUID()}`
    localStorage.setItem("azera_session_id", nextExternalId)
    localStorage.removeItem(tokenStorageKey)
    localStorage.removeItem("azera_chat_token")
    conversationTokenRef.current = null
    setConversationToken(null)
    setConversation(null)
    if (clearMessages) setMessages([])
    return nextExternalId
  }

  // Call state
  const [activeCall, setActiveCall] = useState<{ id: string; type: "webrtc"; stream: MediaStream } | null>(null)
  const [startingCall, setStartingCall] = useState(false)
  const callStartingRef = useRef(false)
  const callRequestVersion = useRef(0)
  const callStreamRef = useRef<MediaStream | null>(null)
  useEffect(() => () => {
    callRequestVersion.current++
    callStreamRef.current?.getTracks().forEach((track) => track.stop())
  }, [])
  const [callError, setCallError] = useState<string | null>(null)

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
  // Visitors should be able to ask a question immediately. Contact details
  // are offered in the conversation instead of blocking the first message.
  const needsVisitorProfile = source === "public_site" && !visitorProfile && showProfileForm

  useEffect(() => {
    if (!open || chatTimerStartedAt === null) return
    const startedAt = chatTimerStartedAt
    const updateElapsed = () => setChatElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)))
    const interval = window.setInterval(updateElapsed, 1000)
    return () => window.clearInterval(interval)
  }, [open, chatTimerStartedAt])

  useEffect(() => {
    if (open && !needsVisitorProfile && window.matchMedia("(min-width: 640px) and (pointer: fine)").matches) {
      inputRef.current?.focus({ preventScroll: true })
    }
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
    setShowProfileForm(false)
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
        resetPublicConversation()
        if (source !== "public_site") {
          conversationTokenRef.current = null
          setConversationToken(null)
          localStorage.removeItem(tokenStorageKey)
        }
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
    setReceivingReply(false)
    const requestController = new AbortController()
    const requestTimeout = window.setTimeout(() => requestController.abort(), 20000)

    // Optimistically add customer message
    const tempId = "temp_" + Date.now()
    setMessages((prev) => [
      ...prev,
      { id: tempId, author_type: "customer", message: text, direction: "inbound", created_at: new Date().toISOString() },
    ])
    scrollToBottom()

    const postChatMessage = async (messageExternalId: string, token: string | null) => fetch("/api/azera/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "X-Azera-Chat-Token": token } : {}),
        },
        signal: requestController.signal,
        body: JSON.stringify({
          business_id: businessId,
          external_id: messageExternalId,
          customer_name: visitorProfile?.name || customerName || undefined,
          customer_email: visitorProfile?.email || undefined,
          customer_phone: visitorProfile?.phone || undefined,
          source,
          stream: true,
          message: text,
        }),
      })

    let sentExternalId = externalId
    let streamedAssistantId: string | null = null

    const readStreamingReply = async (response: Response) => {
      if (!response.body) throw new Error("The chat stream was unavailable. Please try again.")
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""
      let completed = false

      const consumeBlock = (block: string) => {
        let event = "message"
        const dataLines: string[] = []
        for (const line of block.split("\n")) {
          if (line.startsWith("event:")) event = line.slice(6).trim()
          if (line.startsWith("data:")) dataLines.push(line.slice(5).trim())
        }
        if (!dataLines.length) return
        const payload = JSON.parse(dataLines.join("\n")) as StreamPayload

        if (event === "meta") {
          if (payload.conversation_token) rememberConversationToken(payload.conversation_token)
          if (payload.conversation) setConversation(payload.conversation)
          const customerMessage = payload.customer_message
          if (customerMessage) {
            setMessages((previous) => previous.map((item) => item.id === tempId
              ? { ...item, id: customerMessage.id }
              : item))
          }
        }

        if (event === "delta" && payload.text) {
          setReceivingReply(true)
          const createdAt = new Date().toISOString()
          if (!streamedAssistantId) {
            streamedAssistantId = `stream_${Date.now()}`
            setMessages((previous) => [...previous, {
              id: streamedAssistantId as string,
              author_type: "ai",
              message: String(payload.text),
              direction: "outbound",
              created_at: createdAt,
            }])
          } else {
            setMessages((previous) => previous.map((item) => item.id === streamedAssistantId
              ? { ...item, message: `${item.message}${String(payload.text)}` }
              : item))
          }
          window.requestAnimationFrame(scrollToBottom)
        }

        if (event === "done") {
          completed = true
          if (payload.conversation_token) rememberConversationToken(payload.conversation_token)
          if (payload.conversation) setConversation(payload.conversation)
          const customerMessage = payload.customer_message
          if (customerMessage) {
            setMessages((previous) => previous.map((item) => item.id === tempId
              ? { ...item, id: customerMessage.id }
              : item))
          }
          const aiMessage = payload.ai_message
          if (aiMessage) {
            setMessages((previous) => {
              const assistantMessage = {
                id: aiMessage.id,
                author_type: "ai" as const,
                message: aiMessage.message,
                direction: "outbound" as const,
                created_at: aiMessage.created_at,
              }
              return streamedAssistantId
                ? previous.map((item) => item.id === streamedAssistantId ? assistantMessage : item)
                : [...previous, assistantMessage]
            })
          }
        }

        if (event === "error") throw new Error(payload.message || "The assistant could not finish the reply.")
      }

      while (true) {
        const { value, done } = await reader.read()
        buffer += decoder.decode(value || new Uint8Array(), { stream: !done })
        const blocks = buffer.split("\n\n")
        buffer = blocks.pop() || ""
        blocks.forEach(consumeBlock)
        if (done) break
      }
      if (buffer.trim()) consumeBlock(buffer)
      if (!completed) throw new Error("The assistant connection ended before the reply was complete.")
    }

    try {
      let messageExternalId = externalId
      let res = await postChatMessage(messageExternalId, conversationTokenRef.current)
      // A deployment secret change or a stale browser token must not strand a
      // public visitor on an existing thread they can no longer authorize.
      // Start a new visitor thread and retry once; the old thread remains
      // protected and available to admins.
      if (res.status === 401 && source === "public_site") {
        const nextExternalId = resetPublicConversation(false)
        if (nextExternalId) {
          messageExternalId = nextExternalId
          res = await postChatMessage(messageExternalId, null)
        }
      }
      sentExternalId = messageExternalId
      const contentType = res.headers.get("content-type") || ""
      if (contentType.includes("text/event-stream")) {
        await readStreamingReply(res)
        return
      }
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
      const timedOut = error instanceof DOMException && error.name === "AbortError"
      if (!timedOut) {
        setMessages((prev) => prev.filter((message) => message.id !== tempId))
      }
      setSendError(timedOut
        ? "We may have received your message, but the reply is taking longer than expected. Please keep the chat open and try again shortly."
        : error instanceof Error ? error.message : "We could not send your message. Please try again.")
      return
    } finally {
      setLoading(false)
      setReceivingReply(false)
      window.clearTimeout(requestTimeout)
      scrollToBottom()
    }

    // The chat API has finished generating or routing the reply, so refresh once
    // to pick up system handoff messages without adding a fixed polling delay.
    await loadMessages(businessId, sentExternalId, conversationTokenRef.current)
    scrollToBottom()
  }

  const panelStyle = {
    "--azera-viewport-height": viewportMetrics.height ? `${viewportMetrics.height}px` : "100dvh",
    "--azera-viewport-width": viewportMetrics.width ? `${viewportMetrics.width}px` : "100vw",
    "--azera-viewport-top": `${viewportMetrics.top}px`,
    "--azera-viewport-left": `${viewportMetrics.left}px`,
  } as CSSProperties

  async function requestCall() {
    if (!businessId || !conversation?.id || activeCall || callStartingRef.current) return
    callStartingRef.current = true
    setStartingCall(true)
    setCallError(null)
    const version = callRequestVersion.current
    const token = conversationTokenRef.current
    let stream: MediaStream | null = null
    try {
      const { requestCallMicrophone } = await import("@/lib/azera-webrtc")
      // Do not ring staff or create call history until the visitor actually
      // has a working microphone and has granted permission.
      stream = await requestCallMicrophone()
      if (version !== callRequestVersion.current) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      callStreamRef.current = stream
      const res = await fetch("/api/azera/calls", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "X-Azera-Chat-Token": token } : {}),
        },
        body: JSON.stringify({
          business_id: conversation.business_id || businessId,
          conversation_id: conversation.id,
          call_type: "webrtc",
          direction: "inbound",
          source,
          conversation_token: token,
          customer_name: customerName || undefined,
          customer_external_id: externalId,
          webrtc_room: `azera-web-${conversation.id}`,
        }),
      })
      const json = await res.json()
      if (version !== callRequestVersion.current) {
        stream.getTracks().forEach((track) => track.stop())
        if (json.success && json.data?.id) void fetch(`/api/azera/calls/${encodeURIComponent(json.data.id)}`, {
          method: "PATCH", keepalive: true,
          headers: { "Content-Type": "application/json", ...(token ? { "X-Azera-Chat-Token": token } : {}) },
          body: JSON.stringify({ status: "ended" }),
        }).catch(() => {})
        return
      }
      if (json.success && json.data) {
        setActiveCall({ id: json.data.id, type: "webrtc", stream })
      } else {
        stream.getTracks().forEach((track) => track.stop())
        callStreamRef.current = null
        setCallError(res.status === 401 || res.status === 403
          ? "We couldn't securely connect the call. Please refresh the page and try again."
          : json.error || "We couldn't start the call right now. Please try again shortly.")
      }
    } catch (error) {
      stream?.getTracks().forEach((track) => track.stop())
      callStreamRef.current = null
      if (version === callRequestVersion.current) setCallError(error instanceof Error ? error.message : "We couldn't start the call right now. Please try again shortly.")
    } finally {
      callStartingRef.current = false
      if (version === callRequestVersion.current) setStartingCall(false)
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

  // Attach to the document so transformed site sections cannot move or clip
  // this fixed panel. Wait for viewport measurement to keep SSR deterministic.
  if (!viewportMetrics.width) return null

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[70]">
      {/* Chat button */}
      {!open && (
        <button
          onClick={toggleChat}
          style={{
            color: brandColor,
          }}
          className={cn(
            "pointer-events-auto group fixed bottom-[max(16px,env(safe-area-inset-bottom))] flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-[0_8px_24px_rgba(15,23,42,0.18)] ring-1 ring-slate-200 transition-transform hover:-translate-y-1 active:scale-95 sm:bottom-6 sm:h-16 sm:w-16",
            position === "bottom-right" ? "right-4 sm:right-6" : "left-4 sm:left-6",
          )}
          aria-label="Open Azera chat"
          aria-expanded={false}
        >
          <Image src="/azera/chat-icon.svg" width={52} height={52} alt="" unoptimized className="h-12 w-12 sm:h-[3.25rem] sm:w-[3.25rem]" />
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div
          style={panelStyle}
          className={styles.panel}
          data-position={position}
          role="dialog"
          aria-label={title}
        >
          {/* Header */}
          <header style={{ backgroundColor: brandColor, color: brandTextColor }} className="flex items-center gap-3 px-4 py-3">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-white/20 ring-1 ring-white/25">
              <MartPointBubbleIcon className="h-5 w-5" dotColor={brandColor} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="truncate text-sm font-bold tracking-tight">{title}</div>
              <div className="mt-0.5 flex items-center gap-1.5 text-xs opacity-90">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
                Online support
                <span className="ml-2 rounded-md bg-black/10 px-1.5 py-0.5 font-mono text-[11px] tabular-nums" aria-label={`Chat open for ${formattedChatTimer}`}>
                  {formattedChatTimer}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => setOpen(false)} aria-label="Minimize chat" title="Minimize chat" className="rounded-lg p-2 opacity-75 transition hover:bg-white/15 hover:opacity-100">
                <Minus className="h-4 w-4" />
              </button>
              <button onClick={closeOrRateChat} aria-label="Close chat" title="Close chat" className="rounded-lg p-2 opacity-75 transition hover:bg-white/15 hover:opacity-100">
              <X className="h-4 w-4" />
              </button>
            </div>
          </header>

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
            <form onSubmit={saveVisitorProfile} className={cn(styles.scrollArea, "min-h-0 flex-1 overflow-y-auto bg-slate-50")}>
              <div
                className="relative overflow-hidden px-5 py-4 text-center sm:py-6"
                style={{
                  background: `linear-gradient(145deg, ${brandColor} 0%, ${brandColor} 62%, #0f172a 145%)`,
                  color: brandTextColor,
                }}
              >
                <div className="pointer-events-none absolute -right-12 -top-16 h-40 w-40 rounded-full border-[18px] border-white/10" />
                <div className="pointer-events-none absolute -bottom-20 -left-12 h-44 w-44 rounded-full border-[24px] border-white/10" />
                <div className="relative mx-auto hidden h-12 w-12 items-center justify-center rounded-xl bg-white/20 ring-1 ring-white/30 sm:flex">
                  <MartPointBubbleIcon className="h-9 w-9" dotColor={brandColor} />
                </div>
                <p className="relative text-base font-semibold sm:mt-3 sm:text-lg">Welcome to MartPoint Support</p>
                <p className="relative mx-auto mt-2 max-w-[18rem] text-sm leading-relaxed opacity-80">
                  Our sales team is ready to help with setup, pricing, and everyday questions.
                </p>
              </div>

              <div className="px-5 py-5 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
                <p className="text-base font-bold text-slate-900">Let’s get you connected</p>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">Add your details so our team can reply with the right context.</p>
                <div className="mt-4 space-y-2.5">
                  <label className="block">
                    <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-600 sm:text-xs">Your name</span>
                    <input value={profileDraft.name} onChange={(event) => setProfileDraft((current) => ({ ...current, name: event.target.value }))} onFocus={(event) => revealProfileField(event.currentTarget)} placeholder="Enter your name" autoComplete="name" className="h-12 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-base text-slate-900 outline-none placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 sm:h-11 sm:text-sm" />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-600 sm:text-xs">Email address <span className="font-normal normal-case tracking-normal text-slate-400">(or use phone below)</span></span>
                    <input value={profileDraft.email || ""} onChange={(event) => setProfileDraft((current) => ({ ...current, email: event.target.value }))} onFocus={(event) => revealProfileField(event.currentTarget)} placeholder="Enter your email address" type="email" autoComplete="email" className="h-12 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-base text-slate-900 outline-none placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 sm:h-11 sm:text-sm" />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-600 sm:text-xs">Phone <span className="font-normal normal-case tracking-normal text-slate-400">(optional)</span></span>
                    <input value={profileDraft.phone || ""} onChange={(event) => setProfileDraft((current) => ({ ...current, phone: event.target.value }))} onFocus={(event) => revealProfileField(event.currentTarget)} placeholder="Add a phone number" type="tel" autoComplete="tel" className="h-12 w-full rounded-xl border border-slate-300 bg-white px-3.5 text-base text-slate-900 outline-none placeholder:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/15 sm:h-11 sm:text-sm" />
                  </label>
                  <button type="submit" style={{ backgroundColor: brandColor, color: brandTextColor }} className="mt-1 h-12 w-full rounded-xl px-3 text-base font-bold shadow-[0_8px_18px_rgba(15,23,42,0.14)] transition hover:-translate-y-0.5 hover:brightness-95 sm:h-11 sm:text-sm">Start chatting</button>
                </div>
                <p className="mt-3 text-center text-xs text-slate-500">Private and secure. We’ll only use this to help with your conversation.</p>
              </div>
            </form>
          )}

          {/* Messages */}
          <div ref={scrollRef} aria-live="polite" className={cn(styles.scrollArea, "min-h-0 flex-1 space-y-3 overflow-y-auto scroll-py-2 bg-slate-50 p-4 sm:p-5", (needsVisitorProfile || showRating || showEndConfirmation) && "hidden")}>
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
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  {["Request a demo", "How does MartPoint work?", "I need support"].map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => {
                        setInput(prompt)
                        inputRef.current?.focus()
                      }}
                      className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-blue-300 hover:text-blue-700"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {!needsVisitorProfile && source === "public_site" && !visitorProfile && messages.length > 0 && !showProfileForm && (
              <div className="mx-auto max-w-[94%] rounded-2xl border border-blue-100 bg-blue-50/80 px-3.5 py-3 text-center text-xs leading-5 text-blue-900">
                <p className="font-semibold">Want our team to follow up?</p>
                <p className="mt-0.5 text-blue-800/80">Add your contact details so we can continue the conversation with context.</p>
                <button
                  type="button"
                  onClick={() => setShowProfileForm(true)}
                  className="mt-2 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-blue-700 shadow-sm ring-1 ring-blue-200 transition hover:bg-blue-100"
                >
                  Add contact details
                </button>
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
            {!needsVisitorProfile && loading && !receivingReply && (
              <div role="status" aria-label="Waiting for reply" className="mr-auto flex w-fit items-center gap-1.5 rounded-2xl rounded-bl-md border border-slate-200 bg-white px-4 py-3.5 shadow-sm">
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-slate-400 motion-safe:animate-bounce" />
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-slate-400 motion-safe:animate-bounce [animation-delay:150ms]" />
                <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-slate-400 motion-safe:animate-bounce [animation-delay:300ms]" />
              </div>
            )}
            {sendError && !needsVisitorProfile && (
              <div className="mr-auto max-w-[90%] rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm leading-relaxed text-red-800">
                {sendError}
              </div>
            )}
          </div>

          {/* Input */}
          <form onSubmit={sendMessage} className={cn(styles.composer, "flex gap-2 border-t border-slate-200 bg-white p-3", (needsVisitorProfile || showRating || showEndConfirmation) && "hidden")}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={needsVisitorProfile}
              placeholder="Type a message…"
              rows={1}
              className="min-h-10 min-w-0 flex-1 resize-none rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-base text-slate-900 placeholder:text-slate-500 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/10 sm:text-sm"
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
              disabled={loading || !conversation?.id || startingCall || Boolean(activeCall)}
              style={{ backgroundColor: brandColor, color: brandTextColor }}
              className="h-10 w-10 shrink-0 rounded-xl p-2.5 transition-opacity hover:brightness-90 disabled:opacity-50"
              aria-label={startingCall ? "Starting call" : activeCall ? "Call in progress" : "Call our support team"}
            >
              <Phone className="h-4 w-4" />
            </button>
          </form>
          {callError && <p className="border-t border-red-100 bg-red-50 px-3 py-2 text-sm text-red-800">{callError}</p>}
          <footer className="border-t border-slate-100 bg-white px-3 py-2 text-center text-[11px] text-slate-400">
            Secured by <a href="https://www.avariodigitals.com" target="_blank" rel="noreferrer" className="font-medium text-slate-500 underline decoration-slate-300 underline-offset-2 hover:text-blue-600">Avario</a>
          </footer>
        </div>
      )}

      {/* Call UI */}
      {activeCall && (
        <AzeraCallController
          callId={activeCall.id}
          customerName={customerName || visitorProfile?.name || "You"}
          authToken={conversationToken}
          localStream={activeCall.stream}
          onEnded={() => {
            callStreamRef.current?.getTracks().forEach((track) => track.stop())
            callStreamRef.current = null
            setActiveCall(null)
          }}
        />
      )}
    </div>,
    document.body,
  )
}

function cn(...classes: (string | undefined | null | boolean)[]): string {
  return classes.filter(Boolean).join(" ")
}
