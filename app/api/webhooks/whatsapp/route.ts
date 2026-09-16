import { NextResponse } from "next/server"
import { createHmac, timingSafeEqual } from "crypto"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { getSettings } from "@/lib/settings"

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

export async function POST(request: Request) {
  const settings = await getSettings()
  const { webhookSecret, phoneNumber } = settings.whatsapp

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
    const metadata = payload.metadata || {}
    const toNumber = metadata.display_phone_number || phoneNumber || ""

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
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[WhatsApp webhook error]", err)
    return NextResponse.json({ ok: true })
  }
}
