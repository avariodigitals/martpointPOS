import { createHash } from "crypto"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { getSettings } from "@/lib/settings"

export type AfricaProduct = "voice" | "ussd" | "sms" | "airtime"

export type AfricaPayload = Record<string, unknown>

export type AfricaVoiceDepartment = {
  key: string
  label: string
  numbers: string[]
}

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
  const rawNumbers = Array.isArray(item.numbers)
    ? item.numbers
    : String(item.numbers || "").split(",")
  const numbers = rawNumbers.map(normalizeVoiceDestination).filter(Boolean).filter((number, numberIndex, all) => all.indexOf(number) === numberIndex)
  if (!label || !key || !numbers.length) return null
  return { key, label, numbers }
}

export function normalizeVoiceDepartments(value: unknown): AfricaVoiceDepartment[] {
  if (!Array.isArray(value)) return []
  return value.map(normalizeDepartment).filter((department): department is AfricaVoiceDepartment => Boolean(department))
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
  const configured = process.env.AFRICASTALKING_BUSINESS_ID || process.env.AZERA_PUBLIC_BUSINESS_ID
  if (configured) return configured
  if (!isSupabaseConfigured()) return null

  const destination = normalizePhone(destinationNumber)
  const { data } = await supabase
    .from("azera_settings")
    .select("business_id, africas_talking_phone_number")
  const match = (data || []).find((row) => normalizePhone(row.africas_talking_phone_number) === destination)
  return (match?.business_id as string | undefined) || null
}

export async function getAfricaVoiceConfig(businessId: string | null) {
  const settings = await getSettings()
  const sip = (settings.sip || {}) as Record<string, unknown>
  let row: Record<string, unknown> = {}

  if (businessId && isSupabaseConfigured()) {
    const { data } = await supabase
      .from("azera_settings")
      .select("africas_talking_phone_number, africas_talking_forward_numbers, ai_voice_enabled, voice_greeting, voice_no_answer_greeting, voice_menu_enabled, voice_departments")
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
    noAnswerGreeting: String(row.voice_no_answer_greeting || "We are unable to answer right now. Please try again later."),
    menuEnabled: row.voice_menu_enabled === true,
    departments: normalizeVoiceDepartments(row.voice_departments),
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
  const { data, error } = await supabase
    .from("africastalking_webhook_events")
    .insert({
      business_id: input.businessId || null,
      product: input.product,
      endpoint: input.endpoint,
      event_type: eventType(input.product, input.payload),
      provider_reference: providerReference(input.product, input.payload) || null,
      content_type: input.request.headers.get("content-type"),
      request_headers: requestHeaders(input.request),
      raw_body: input.rawBody,
      payload: input.payload,
      processing_status: "received",
    })
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

