import { NextResponse } from "next/server"
import { createHmac, timingSafeEqual } from "crypto"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { getSettings } from "@/lib/settings"
import { processLead } from "@/lib/process-lead"

function verifySignature(raw: string, signature: string | null, secret: string): boolean {
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

  if (webhookSecret && !verifySignature(raw, signature, webhookSecret)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: true })
  }

  try {
    const payload = JSON.parse(raw)
    const messages = payload.messages || []
    const contacts: Record<string, unknown>[] = Array.isArray(payload.contacts) ? payload.contacts : []
    const metadata = payload.metadata || {}
    const toNumber = metadata.display_phone_number || phoneNumber || ""

    // wa_id -> sender display name (360dialog contacts array)
    const nameByWaId = new Map<string, string>()
    for (const c of contacts) {
      const waId = String((c as Record<string, unknown>).wa_id || "")
      const profile = (c as Record<string, unknown>).profile as Record<string, unknown> | undefined
      const name = typeof profile?.name === "string" ? profile.name : ""
      if (waId && name) nameByWaId.set(waId, name)
    }

    const leadAttempted = new Set<string>()

    for (const msg of messages) {
      if (msg.type !== "text" || !msg.text?.body) continue

      const phone = String(msg.from || msg.wa_id || "")
      const body = String(msg.text.body)
      const ts = msg.timestamp ? new Date(Number(msg.timestamp) * 1000).toISOString() : new Date().toISOString()

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
      if (phone && !leadAttempted.has(phone) && matchesLeadKeyword(body, leadKeywords || "")) {
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

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[WhatsApp webhook error]", err)
    return NextResponse.json({ ok: true })
  }
}
