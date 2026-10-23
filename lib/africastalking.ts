import { createHash } from "crypto"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { getSettings } from "@/lib/settings"

export type AfricaProduct = "voice" | "ussd" | "sms" | "airtime"

export type AfricaPayload = Record<string, unknown>

export type AfricaVoiceDepartment = {
  digit: number
  key: string
  label: string
  primary: string
  fallback: string[]
  numbers: string[]
  enabled: boolean
}

export type AfricaVoiceSchedule = Record<string, { open: string; close: string } | null>

export function normalizePhone(value: unknown): string {
  const raw = String(value || "").trim()
  if (!raw) return ""
  const digits = raw.replace(/[^\d+]/g, "")
  if (digits.startsWith("+")) return digits
  if (digits.startsWith("234")) return `+${digits}`
  if (digits.startsWith("0")) return `+234${digits.slice(1)}`
  return `+234${digits}`
}

/** Keep Africa's Talking SIP destinations intact; only normalize real phone numbers. */
export function normalizeVoiceDestination(value: unknown): string {
  const raw = String(value || "").trim()
  if (!raw) return ""
  if (/^(?:sip:)?[^\s,@]+@[^\s,@]+$/i.test(raw) || /^[^\s,@]+\.sip\.[^\s,@]+$/i.test(raw)) {
    return raw.replace(/^sip:/i, "")
  }
  return normalizePhone(raw)
}

function normalizeAudioUrl(value: unknown): string {
  const url = String(value || "").trim()
  return /^https:\/\//i.test(url) ? url : ""
}

export function pick(payload: AfricaPayload, ...keys: string[]): string {
  for (const key of keys) {
    const value = payload[key]
    if (typeof value === "string" && value.trim()) return value.trim()
    if (typeof value === "number" && Number.isFinite(value)) return String(value)
  }
  return ""
}

export function parseAfricaPayload(raw: string, contentType: string | null): AfricaPayload {
  if (!raw.trim()) return {}

  if (contentType?.toLowerCase().includes("json")) {
    try {
      const value = JSON.parse(raw)
      return value && typeof value === "object" && !Array.isArray(value) ? value as AfricaPayload : { value }
    } catch {
      return { raw }
    }
  }

  const params = new URLSearchParams(raw)
  const payload: AfricaPayload = {}
  for (const [key, value] of params.entries()) {
    const existing = payload[key]
    if (existing === undefined) payload[key] = value
    else if (Array.isArray(existing)) existing.push(value)
    else payload[key] = [existing, value]
  }
  return Object.keys(payload).length ? payload : { raw }
}

export async function readAfricaRequest(request: Request): Promise<{
  rawBody: string
  payload: AfricaPayload
  contentType: string
}> {
  const contentType = request.headers.get("content-type") || ""
  const rawBody = await request.text()
  return { rawBody, payload: parseAfricaPayload(rawBody, contentType), contentType }
}

export function requestHeaders(request: Request): Record<string, string> {
  return Object.fromEntries(request.headers.entries())
}

export function providerReference(product: AfricaProduct, payload: AfricaPayload): string {
  if (product === "voice") return pick(payload, "sessionId", "callSessionId", "call_sid", "call_id", "id")
  if (product === "ussd") return pick(payload, "sessionId", "session_id")
  if (product === "sms") return pick(payload, "id", "messageId", "message_id")
  return pick(payload, "requestId", "request_id", "id", "transactionId", "transaction_id")
}

export function eventType(product: AfricaProduct, payload: AfricaPayload): string {
  if (product === "voice") return pick(payload, "callSessionState", "status", "call_status", "event") || "received"
  if (product === "ussd") return pick(payload, "newSession", "event") || "request"
  if (product === "sms") return pick(payload, "status", "event") || "received"
  return pick(payload, "status", "event", "transactionStatus") || "received"
}

export function callbackSecretIsValid(request: Request): boolean {
  const expected = process.env.AFRICASTALKING_CALLBACK_SECRET
  if (!expected) return true
  const provided = new URL(request.url).searchParams.get("secret")
  return provided === expected
}

export function xmlEscape(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

function normalizeDepartment(value: unknown, index: number): AfricaVoiceDepartment | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const item = value as Record<string, unknown>
  const label = String(item.label || item.name || `Department ${index + 1}`).trim()
  const key = String(item.key || label.toLowerCase().replace(/[^a-z0-9]+/g, "-")).trim()
  const legacyNumbers = Array.isArray(item.numbers) ? item.numbers : String(item.numbers || "").split(",")
  const primary = normalizeVoiceDestination(item.primary || item.destination || legacyNumbers[0])
  const rawFallback = Array.isArray(item.fallback)
    ? item.fallback
    : String(item.fallback || "").split(",")
  const fallback = [...rawFallback, ...legacyNumbers.slice(1)]
    .map(normalizeVoiceDestination)
    .filter(Boolean)
    .filter((number, numberIndex, all) => all.indexOf(number) === numberIndex && number !== primary)
  const numbers = [primary, ...fallback].filter(Boolean)
  const digit = Number(item.digit || index + 1)
  const enabled = item.enabled !== false
  if (!label || !key || !primary || !Number.isInteger(digit) || digit < 1 || digit > 8) return null
  return { digit, key, label, primary, fallback, numbers, enabled }
}

export function normalizeVoiceDepartments(value: unknown): AfricaVoiceDepartment[] {
  if (!Array.isArray(value)) return []
  const usedDigits = new Set<number>()
  return value
    .map(normalizeDepartment)
    .filter((department): department is AfricaVoiceDepartment => {
      if (!department || !department.enabled || usedDigits.has(department.digit)) return false
      usedDigits.add(department.digit)
      return true
    })
    .sort((a, b) => a.digit - b.digit)
}

const DEFAULT_VOICE_SCHEDULE: AfricaVoiceSchedule = {
  mon: { open: "09:00", close: "17:00" },
  tue: { open: "09:00", close: "17:00" },
  wed: { open: "09:00", close: "17:00" },
  thu: { open: "09:00", close: "17:00" },
  fri: { open: "09:00", close: "17:00" },
  sat: null,
  sun: null,
}

function scheduleMinutes(value: unknown): number | null {
  const match = String(value || "").match(/^(\d{2}):(\d{2})$/)
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return null
  return hours * 60 + minutes
}

export function isVoiceBusinessOpen(
  timezone: string,
  scheduleValue: unknown,
  closedDatesValue: unknown,
  now = new Date(),
): boolean {
  let dateParts: Intl.DateTimeFormatPart[]
  try {
    dateParts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone || "Africa/Lagos",
      weekday: "short",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(now)
  } catch {
    dateParts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Africa/Lagos",
      weekday: "short",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(now)
  }

  const parts = Object.fromEntries(dateParts.map((part) => [part.type, part.value]))
  const localDate = `${parts.year}-${parts.month}-${parts.day}`
  const closedDates = Array.isArray(closedDatesValue) ? closedDatesValue.map((value) => String(value)) : []
  if (closedDates.includes(localDate)) return false

  const dayKey = String(parts.weekday || "").slice(0, 3).toLowerCase()
  const schedule = (scheduleValue && typeof scheduleValue === "object" ? scheduleValue : DEFAULT_VOICE_SCHEDULE) as Record<string, unknown>
  const day = schedule[dayKey] as Record<string, unknown> | null | undefined
  if (!day) return false
  const open = scheduleMinutes(day.open)
  const close = scheduleMinutes(day.close)
  const hour = Number(parts.hour === "24" ? "00" : parts.hour)
  const minute = Number(parts.minute)
  if (open === null || close === null || !Number.isFinite(hour) || !Number.isFinite(minute)) return false
  const current = hour * 60 + minute
  return current >= open && current < close
}

export function voiceXml(actions: string[]): Response {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${actions.join("")}</Response>`, {
    status: 200,
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "no-store" },
  })
}

export function textResponse(body: string): Response {
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  })
}

export async function resolveAfricaBusinessId(destinationNumber?: string): Promise<string | null> {
  const destination = normalizePhone(destinationNumber)
  if (destination && isSupabaseConfigured()) {
    // Prefer the number's persisted business mapping. This keeps a stale or
    // shared deployment env ID from routing a callback to the wrong tenant.
    const { data } = await supabase
      .from("azera_settings")
      .select("business_id, africas_talking_phone_number")
    const match = (data || []).find((row) => normalizePhone(row.africas_talking_phone_number) === destination)
    if (match?.business_id) return match.business_id as string
  }

  return process.env.AFRICASTALKING_BUSINESS_ID || process.env.AZERA_PUBLIC_BUSINESS_ID || null
}

export async function getAfricaVoiceConfig(businessId: string | null) {
  const settings = await getSettings()
  const sip = (settings.sip || {}) as Record<string, unknown>
  let row: Record<string, unknown> = {}

  if (businessId && isSupabaseConfigured()) {
    const { data } = await supabase
      .from("azera_settings")
      .select("africas_talking_phone_number, africas_talking_forward_numbers, ai_voice_enabled, voice_greeting, voice_connecting_greeting, voice_no_answer_greeting, voice_after_hours_greeting, voice_after_hours_destination, voice_timezone, voice_weekly_schedule, voice_closed_dates, voice_menu_retry_limit, voice_menu_enabled, voice_departments, voice_voicemail_enabled, voice_voicemail_max_seconds, voice_voicemail_retention_days, voice_greeting_audio_url, voice_connecting_audio_url, voice_no_answer_audio_url, voice_after_hours_audio_url, voice_waiting_audio_url")
      .eq("business_id", businessId)
      .maybeSingle()
    row = (data as Record<string, unknown> | null) || {}
  }

  const configuredForward = Array.isArray(row.africas_talking_forward_numbers)
    ? row.africas_talking_forward_numbers
    : []
  const envForward = (process.env.AFRICASTALKING_FORWARD_NUMBERS || "")
    .split(",")
    .map((value) => normalizeVoiceDestination(value))
    .filter(Boolean)
  const forwardNumbers = [...configuredForward, ...envForward]
    .map((value) => normalizeVoiceDestination(value))
    .filter((value, index, all) => value && all.indexOf(value) === index)

  return {
    phoneNumber: normalizePhone(row.africas_talking_phone_number || sip.from_number || process.env.AFRICASTALKING_FROM),
    forwardNumbers,
    aiVoiceEnabled: row.ai_voice_enabled === true,
    greeting: String(row.voice_greeting || "Welcome to MartPoint. Please hold while we connect you."),
    connectingGreeting: String(row.voice_connecting_greeting || "Please hold while we connect you."),
    noAnswerGreeting: String(row.voice_no_answer_greeting || "We are unable to answer right now. Please try again later."),
    afterHoursGreeting: String(row.voice_after_hours_greeting || "Thank you for calling MartPoint. Our office is currently closed. Please try again during our opening hours."),
    afterHoursDestination: normalizeVoiceDestination(row.voice_after_hours_destination),
    timezone: String(row.voice_timezone || "Africa/Lagos"),
    weeklySchedule: (row.voice_weekly_schedule || DEFAULT_VOICE_SCHEDULE) as AfricaVoiceSchedule,
    closedDates: Array.isArray(row.voice_closed_dates) ? row.voice_closed_dates : [],
    menuRetryLimit: Math.min(3, Math.max(0, Number(row.voice_menu_retry_limit) || 1)),
    menuEnabled: row.voice_menu_enabled === true,
    departments: normalizeVoiceDepartments(row.voice_departments),
    voicemailEnabled: row.voice_voicemail_enabled === true,
    voicemailMaxSeconds: Math.min(300, Math.max(15, Number(row.voice_voicemail_max_seconds) || 60)),
    voicemailRetentionDays: Math.min(3650, Math.max(1, Number(row.voice_voicemail_retention_days) || 90)),
    greetingAudioUrl: normalizeAudioUrl(row.voice_greeting_audio_url),
    connectingAudioUrl: normalizeAudioUrl(row.voice_connecting_audio_url),
    noAnswerAudioUrl: normalizeAudioUrl(row.voice_no_answer_audio_url),
    afterHoursAudioUrl: normalizeAudioUrl(row.voice_after_hours_audio_url),
    waitingAudioUrl: normalizeAudioUrl(row.voice_waiting_audio_url),
  }
}

export async function storeAfricaWebhookEvent(input: {
  product: AfricaProduct
  endpoint: string
  request: Request
  rawBody: string
  payload: AfricaPayload
  businessId?: string | null
}) {
  if (!isSupabaseConfigured()) return null
  const reference = providerReference(input.product, input.payload)
  const type = eventType(input.product, input.payload)
  const dedupeKey = reference
    ? `${input.product}:${input.endpoint}:${reference}:${type}`
    : stablePayloadHash(input.product, input.endpoint, input.rawBody)
  const { data, error } = await supabase
    .from("africastalking_webhook_events")
    .upsert({
      business_id: input.businessId || null,
      product: input.product,
      endpoint: input.endpoint,
      event_type: type,
      provider_reference: reference || null,
      dedupe_key: dedupeKey,
      content_type: input.request.headers.get("content-type"),
      request_headers: requestHeaders(input.request),
      raw_body: input.rawBody,
      payload: input.payload,
      processing_status: "received",
    }, { onConflict: "dedupe_key" })
    .select("id")
    .single()

  if (error) {
    console.error("[Africa's Talking webhook store error]", error)
    return null
  }
  return data?.id as string | null
}

export async function finishAfricaWebhookEvent(id: string | null, status: "processed" | "failed", errorMessage?: string) {
  if (!id || !isSupabaseConfigured()) return
  await supabase
    .from("africastalking_webhook_events")
    .update({ processing_status: status, processing_error: errorMessage || null, processed_at: new Date().toISOString() })
    .eq("id", id)
}

export function stablePayloadHash(product: AfricaProduct, endpoint: string, rawBody: string): string {
  return createHash("sha256").update(`${product}:${endpoint}:${rawBody}`).digest("hex")
}

