import { NextResponse } from "next/server"
import { createHmac, timingSafeEqual } from "crypto"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { getSettings } from "@/lib/settings"
import { processLead } from "@/lib/process-lead"
import {
  receiveSocialMessage,
  applyDeliveryReceipt,
  socialTimestamp,
  validSharedWebhookSecret,
} from "@/lib/azera-social-webhook"

function verifySignature(
  raw: string,
  signature: string | null,
  secret: string
): boolean {
  if (!secret || !signature) return false
  const computed = createHmac("sha256", secret).update(raw).digest("hex")
  if (computed.length !== signature.length) return false
  try {
    return timingSafeEqual(Buffer.from(computed), Buffer.from(signature))
  } catch {
    return false
  }
}

function matchesLeadKeyword(body: string, keywordsCsv: string): boolean {
  const keywords = keywordsCsv
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean)
  if (keywords.length === 0) return true // empty list = capture all new contacts
  return keywords.some((kw) => {
    const escaped = kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    return new RegExp(`\\b${escaped}\\b`, "i").test(body)
  })
}

export async function POST(request: Request) {
  const settings = await getSettings()
  const { webhookSecret, phoneNumber, leadKeywords } = settings.whatsapp

  const raw = await request.text()
  const signature = request.headers.get("x-360dialog-signature")

  if (!webhookSecret)
    return NextResponse.json(
      { error: "Configure the WhatsApp webhook secret first" },
      { status: 503 }
    )
  // 360dialog supports configured webhook headers. Keep the legacy relay HMAC
  // as an alternative; do not assume 360dialog manufactures that header.
  const suppliedSecret =
    request.headers.get("x-webhook-secret") ||
    request.headers.get("authorization")?.replace(/^Bearer /, "") ||
    null
  if (
    !verifySignature(raw, signature, webhookSecret) &&
    !validSharedWebhookSecret(suppliedSecret, webhookSecret)
  ) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: true })
  }

  try {
    const parsed = JSON.parse(raw)
    const envelopes = Array.isArray(parsed.entry)
      ? parsed.entry.flatMap(
          (entry: { changes?: { value?: Record<string, unknown> }[] }) =>
            (entry.changes || []).map((change) => change.value || {})
        )
      : [parsed]
    for (const payload of envelopes) {
      const messages = payload.messages || []
      const contacts: Record<string, unknown>[] = Array.isArray(
        payload.contacts
      )
        ? payload.contacts
        : []
      const metadata = payload.metadata || {}
      const toNumber = metadata.display_phone_number || phoneNumber || ""
      const { data: mapped, error: mappingError } = await supabase
        .from("azera_settings")
        .select("business_id,whatsapp_phone_number")
      if (mappingError)
        return NextResponse.json(
          { error: "Messaging configuration unavailable" },
          { status: 503 }
        )
      const businessId = (mapped || []).find(
        (row) =>
          String(row.whatsapp_phone_number || "").replace(/\D/g, "") ===
            String(toNumber).replace(/\D/g, "") && row.whatsapp_phone_number
      )?.business_id
      if (!businessId)
        return NextResponse.json(
          { error: "Map this WhatsApp number to a business in Azera Settings" },
          { status: 503 }
        )
      for (const receipt of payload.statuses || [])
        await applyDeliveryReceipt(
          businessId,
          receipt.id,
          receipt.status,
          socialTimestamp(receipt.timestamp, true)
        )

      // wa_id -> sender display name (360dialog contacts array)
      const nameByWaId = new Map<string, string>()
      for (const c of contacts) {
        const waId = String((c as Record<string, unknown>).wa_id || "")
        const profile = (c as Record<string, unknown>).profile as
          | Record<string, unknown>
          | undefined
        const name = typeof profile?.name === "string" ? profile.name : ""
        if (waId && name) nameByWaId.set(waId, name)
      }

      const leadAttempted = new Set<string>()

      for (const msg of messages) {
        if (msg.type !== "text" || !msg.text?.body) continue

        const phone = String(msg.from || msg.wa_id || "")
        const body = String(msg.text.body)
        const ts = msg.timestamp
          ? new Date(Number(msg.timestamp) * 1000).toISOString()
          : new Date().toISOString()
        if (msg.id && phone)
          await receiveSocialMessage({
            businessId,
            channel: "whatsapp",
            sender: phone,
            providerId: msg.id,
            text: body,
            name: nameByWaId.get(phone),
            timestamp: ts,
          })

        await supabase.from("whatsapp_messages").insert({
          wa_message_id: msg.id,
          wa_id: phone,
          from_number: phone,
          to_number: toNumber,
          body,
          direction: "inbound",
          status: "received",
          created_at: ts,
        })

        // First-ever inbound message containing an intent keyword becomes a lead.
        // external_id (whatsapp:<wa_id>) dedupes — repeat messages stay on the
        // whatsapp_messages thread only.
        if (
          phone &&
          !leadAttempted.has(phone) &&
          matchesLeadKeyword(body, leadKeywords || "")
        ) {
          leadAttempted.add(phone)
          try {
            await processLead({
              fullName: nameByWaId.get(phone) || "WhatsApp Lead",
              businessName: "Not provided",
              email: "",
              phone: phone.startsWith("+") ? phone : `+${phone}`,
              businessType: "other",
              productInterest: "not-sure",
              branches: "1",
              staffSize: "1-5",
              message: `WhatsApp inbound: ${body.slice(0, 500)}`,
              source: "whatsapp",
              externalId: `whatsapp:${phone}`,
            })
          } catch (err) {
            console.error("[WhatsApp webhook] lead capture failed:", err)
          }
        }
      }
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[WhatsApp webhook error]", err)
    return NextResponse.json(
      {
        error:
          "Could not process WhatsApp delivery. The provider should retry.",
      },
      { status: 503 }
    )
  }
}
