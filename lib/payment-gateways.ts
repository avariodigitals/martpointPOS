import { createHmac, timingSafeEqual } from "crypto"
import { supabase, isSupabaseConfigured } from "./supabase"
import { log } from "./logger"
import { getPaystackSecret, getPaystackWebhookSecrets } from "./paystack-settings"

export type GatewayEvent = {
  gateway: "paystack" | "flutterwave"
  reference: string
  amountKobo: number
  status: "success" | "failed"
  metadata?: Record<string, unknown>
}

/** Server-side transaction lookup used before a Central credit invoice is confirmed. */
export async function verifyPaystackTransaction(reference: string, secretOverride?: string): Promise<{ status: boolean; reference: string; paymentStatus: string; amountKobo: number; requestedAmountKobo: number; currency: string }> {
  const secret = secretOverride || await getPaystackSecret()
  const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, { headers: { Authorization: `Bearer ${secret}` }, cache: "no-store" })
  if (!response.ok) throw new Error(`Paystack verification unavailable (${response.status})`)
  const result = await response.json() as { status?: boolean; data?: { status?: string; reference?: string; amount?: number; requested_amount?: number; currency?: string } }
  const amountKobo = Number(result.data?.amount)
  const requestedAmountKobo = Number(result.data?.requested_amount)
  // Paystack may pass transaction fees to the cardholder. `amount` then
  // includes that surcharge, while `requested_amount` remains the amount
  // MartPoint invoiced and should be matched against the invoice/payment row.
  return { status: result.status === true, reference: String(result.data?.reference || ""), paymentStatus: String(result.data?.status || ""), amountKobo,
    requestedAmountKobo: Number.isSafeInteger(requestedAmountKobo) ? requestedAmountKobo : amountKobo, currency: String(result.data?.currency || "") }
}

export function isFlutterwaveConfigured() {
  return Boolean(process.env.FLUTTERWAVE_SECRET_KEY)
}

export function verifyPaystackSignature(body: string, signature: string, secretOverride?: string): boolean {
  const secret = secretOverride
  if (!secret || !/^[a-f\d]{128}$/i.test(signature)) return false
  const expected = createHmac("sha512", secret).update(body).digest("hex")
  return timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(signature, "hex"))
}

export function verifyFlutterwaveSignature(body: string, signature: string): boolean {
  const secret = process.env.FLUTTERWAVE_SECRET_KEY
  if (!secret) return false
  const expected = createHmac("sha256", secret).update(body).digest("hex")
  return expected === signature
}

export async function wasWebhookProcessed(reference: string, gateway: string): Promise<boolean> {
  if (!isSupabaseConfigured()) return false
  const { data } = await supabase
    .from("payment_webhook_events")
    .select("id")
    .eq("reference", reference)
    .eq("gateway", gateway)
    .maybeSingle()
  return !!data
}

export async function recordWebhookEvent(reference: string, gateway: string, payload: Record<string, unknown>): Promise<void> {
  if (!isSupabaseConfigured()) return
  await supabase.from("payment_webhook_events").insert({
    reference,
    gateway,
    payload,
    created_at: new Date().toISOString(),
  })
}

export async function processPaystackWebhook(body: string, signature: string): Promise<{ success: boolean; message: string }> {
  let webhookSecrets: string[]
  try { webhookSecrets = await getPaystackWebhookSecrets() }
  catch { return { success: false, message: "Paystack not configured" } }
  if (!webhookSecrets.length) return { success: false, message: "Paystack not configured" }

  if (!webhookSecrets.some((secret) => verifyPaystackSignature(body, signature, secret))) {
    log("error", "Paystack webhook signature mismatch", { module: "payments", operation: "paystack_webhook" })
    return { success: false, message: "Invalid signature" }
  }

  let event: Record<string, unknown> & { event?: string; data?: { reference?: string } }
  try {
    const parsed: unknown = JSON.parse(body)
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return { success: false, message: "Invalid event" }
    event = parsed as Record<string, unknown> & { event?: string; data?: { reference?: string } }
  } catch {
    return { success: false, message: "Invalid JSON" }
  }

  const reference = event.data?.reference
  const status = event.event === "charge.success" ? "success" : "failed"

  if (!reference) return { success: false, message: "Missing reference" }

  if (await wasWebhookProcessed(reference, "paystack")) {
    return { success: true, message: "Already processed" }
  }

  await recordWebhookEvent(reference, "paystack", event)

  log("info", "Paystack webhook accepted", { module: "payments", operation: "paystack_webhook", entityId: reference })

  // Manual confirmation remains the authoritative step; webhooks are stored for reconciliation.
  return { success: true, message: `Paystack event ${status} recorded for reference ${reference}` }
}

export async function processFlutterwaveWebhook(body: string, signature: string): Promise<{ success: boolean; message: string }> {
  if (!isFlutterwaveConfigured()) return { success: false, message: "Flutterwave not configured" }

  if (!verifyFlutterwaveSignature(body, signature)) {
    log("error", "Flutterwave webhook signature mismatch", { module: "payments", operation: "flutterwave_webhook" })
    return { success: false, message: "Invalid signature" }
  }

  let event: Record<string, unknown> & { txRef?: string; status?: string }
  try {
    const parsed: unknown = JSON.parse(body)
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return { success: false, message: "Invalid event" }
    event = parsed as Record<string, unknown> & { txRef?: string; status?: string }
  } catch {
    return { success: false, message: "Invalid JSON" }
  }

  const reference = event.txRef
  const status = event.status === "successful" ? "success" : "failed"

  if (!reference) return { success: false, message: "Missing txRef" }

  if (await wasWebhookProcessed(reference, "flutterwave")) {
    return { success: true, message: "Already processed" }
  }

  await recordWebhookEvent(reference, "flutterwave", event)

  log("info", "Flutterwave webhook accepted", { module: "payments", operation: "flutterwave_webhook", entityId: reference })

  return { success: true, message: `Flutterwave event ${status} recorded for reference ${reference}` }
}
