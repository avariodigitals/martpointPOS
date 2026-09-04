import { createHmac } from "crypto"
import { supabase, isSupabaseConfigured } from "./supabase"
import { log } from "./logger"

export type GatewayEvent = {
  gateway: "paystack" | "flutterwave"
  reference: string
  amountKobo: number
  status: "success" | "failed"
  metadata?: Record<string, unknown>
}

export function isPaystackConfigured() {
  return Boolean(process.env.PAYSTACK_SECRET_KEY)
}

export function isFlutterwaveConfigured() {
  return Boolean(process.env.FLUTTERWAVE_SECRET_KEY)
}

export function verifyPaystackSignature(body: string, signature: string): boolean {
  const secret = process.env.PAYSTACK_SECRET_KEY
  if (!secret) return false
  const expected = createHmac("sha512", secret).update(body).digest("hex")
  return expected === signature
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
  if (!isPaystackConfigured()) return { success: false, message: "Paystack not configured" }

  if (!verifyPaystackSignature(body, signature)) {
    log("error", "Paystack webhook signature mismatch", { module: "payments", operation: "paystack_webhook" })
    return { success: false, message: "Invalid signature" }
  }

  let event: any
  try {
    event = JSON.parse(body)
  } catch {
    return { success: false, message: "Invalid JSON" }
  }

  const reference = event?.data?.reference
  const status = event?.event === "charge.success" ? "success" : "failed"

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

  let event: any
  try {
    event = JSON.parse(body)
  } catch {
    return { success: false, message: "Invalid JSON" }
  }

  const reference = event?.txRef
  const status = event?.status === "successful" ? "success" : "failed"

  if (!reference) return { success: false, message: "Missing txRef" }

  if (await wasWebhookProcessed(reference, "flutterwave")) {
    return { success: true, message: "Already processed" }
  }

  await recordWebhookEvent(reference, "flutterwave", event)

  log("info", "Flutterwave webhook accepted", { module: "payments", operation: "flutterwave_webhook", entityId: reference })

  return { success: true, message: `Flutterwave event ${status} recorded for reference ${reference}` }
}
