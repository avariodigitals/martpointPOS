import { z } from "zod"
import { readSettings } from "./settings"
import { africaBrowserConfig } from "./africa-browser-voice"
import { normalizeCommunicationPhone } from "./communications-policy"
import { supabase } from "./supabase"
import { getSettings } from "./settings"

export const smsConfigurationSchema = z.object({
  provider: z.enum(["africastalking", "bulksmsnigeria"]), sender: z.string().trim().min(1).max(11).regex(/^[A-Za-z0-9 +]+$/),
  apiKey: z.string().trim().max(500).optional(), username: z.string().trim().max(100).default(""),
  sandbox: z.boolean().default(false),
})
export async function getCommunicationSmsConfig() {
  const settings = await readSettings()
  const raw = (settings?.communications || {}) as Record<string, unknown>
  const sms = (raw.sms || {}) as Record<string, unknown>
  const provider = sms.provider === "africastalking" ? "africastalking" : "bulksmsnigeria"
  const africa = provider === "africastalking" ? await africaBrowserConfig() : null
  return {
    provider, sender: String(sms.sender || process.env.COMMUNICATION_SMS_SENDER || ""),
    apiKey: String(sms.apiKey || (provider === "africastalking" ? africa?.apiKey : process.env.BULKSMSNIGERIA_API_TOKEN) || ""),
    username: String(sms.username || africa?.username || ""), sandbox: sms.sandbox === true,
  }
}
export type SmsDelivery = { status: "accepted" | "failed" | "unknown"; provider: string; providerId?: string; error?: string }

export async function recordCommunicationSmsOptOut(from: string, text: string) {
  if (!/^(STOP|UNSUBSCRIBE|CANCEL|END|QUIT)$/i.test(text.trim())) return false
  const phone = normalizeCommunicationPhone(from)
  if (!phone) return false
  const result = await supabase.from("communication_suppressions").upsert({ channel: "sms", address: phone, reason: "Inbound STOP / opt-out" })
  if (result.error) throw new Error("Could not retain SMS opt-out")
  return true
}

export async function recordCommunicationWhatsAppOptOut(from: string, text: string) {
  if (!/^(STOP|UNSUBSCRIBE|CANCEL|END|QUIT)$/i.test(text.trim())) return false
  const phone = normalizeCommunicationPhone(from)
  if (!phone) return false
  const result = await supabase.from("communication_suppressions").upsert({ channel: "whatsapp", address: phone, reason: "Inbound WhatsApp STOP / opt-out" })
  if (result.error) throw new Error("Could not retain WhatsApp opt-out")
  return true
}

export async function sendCommunicationWhatsApp(to: string, body: string): Promise<SmsDelivery> {
  const phone = normalizeCommunicationPhone(to)
  if (!phone || !body.trim() || body.length > 2000) return { status: "failed", provider: "360dialog", error: "A valid phone and message up to 2,000 characters are required" }
  try {
    const settings = await getSettings()
    const config = settings.whatsapp
    if (!config.apiKey || !config.baseUrl) return { status: "failed", provider: "360dialog", error: "Configure the WhatsApp provider before sending" }
    const response = await fetch(`${config.baseUrl.replace(/\/$/, "")}/messages`, {
      method: "POST", signal: AbortSignal.timeout(12000),
      headers: { "Content-Type": "application/json", "D360-API-KEY": config.apiKey },
      body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to: phone.replace(/^\+/, ""), type: "text", text: { body } }),
    })
    const data = await response.json().catch(() => null)
    if (!data) return { status: "unknown", provider: "360dialog", error: "WhatsApp provider response is uncertain. Check provider history before retrying." }
    if (!response.ok || !data.messages?.[0]?.id) return { status: response.status >= 500 ? "unknown" : "failed", provider: "360dialog", error: "WhatsApp provider rejected the message. Check its configuration and account." }
    await supabase.from("whatsapp_messages").insert({ wa_message_id: data.messages[0].id, wa_id: phone.replace(/^\+/, ""), to_number: phone, body, direction: "outbound", status: "sent" })
    return { status: "accepted", provider: "360dialog", providerId: String(data.messages[0].id) }
  } catch {
    return { status: "unknown", provider: "360dialog", error: "WhatsApp provider outcome is uncertain. Check provider history before retrying." }
  }
}

/** One recipient per tracked message. No wallet or application credit checks. */
export async function sendCommunicationSms(to: string, body: string): Promise<SmsDelivery> {
  const cfg = await getCommunicationSmsConfig()
  const phone = normalizeCommunicationPhone(to)
  if (!phone || !body.trim() || body.length > 480) return { status: "failed", provider: cfg.provider, error: "A valid phone and a message up to 480 characters are required" }
  if (!cfg.apiKey || !cfg.sender || (cfg.provider === "africastalking" && !cfg.username)) return { status: "failed", provider: cfg.provider, error: "Configure the SMS provider and approved sender ID in Communications settings" }
  try {
    const africa = cfg.provider === "africastalking"
    const url = africa
      ? `https://api.${cfg.sandbox ? "sandbox." : ""}africastalking.com/version1/messaging`
      : `https://www.bulksmsnigeria.com/api/${cfg.sandbox ? "sandbox/" : ""}v2/sms`
    const response = await fetch(url, {
      method: "POST", signal: AbortSignal.timeout(12000),
      headers: africa ? { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded", apiKey: cfg.apiKey }
        : { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${cfg.apiKey}` },
      body: africa ? new URLSearchParams({ username: cfg.username, to: phone, from: cfg.sender, message: body }).toString()
        : JSON.stringify({ from: cfg.sender, to: phone.replace(/^\+/, ""), body }),
    })
    const data = await response.json().catch(() => null)
    if (!data) return { status: "unknown", provider: cfg.provider, error: "Provider response could not be confirmed. Check provider history before retrying." }
    if (africa) {
      const recipient = data.SMSMessageData?.Recipients?.[0]
      if (response.ok && Number(recipient?.statusCode) === 101) return { status: "accepted", provider: cfg.provider, providerId: String(recipient.messageId || "") }
      return { status: response.status >= 500 ? "unknown" : "failed", provider: cfg.provider, error: String(recipient?.status || "SMS provider did not accept this message") }
    }
    if (response.ok && String(data.status || data.data?.status).toLowerCase() === "success") return { status: "accepted", provider: cfg.provider, providerId: String(data.data?.message_id || data.message_id || data.data?.id || "") }
    return { status: response.status >= 500 ? "unknown" : "failed", provider: cfg.provider, error: "SMS provider rejected this message. Check your sender ID and provider dashboard." }
  } catch {
    return { status: "unknown", provider: cfg.provider, error: "SMS provider outcome is uncertain. Check provider history before retrying." }
  }
}
