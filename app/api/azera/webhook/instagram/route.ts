import { NextResponse } from "next/server"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"

/**
 * Instagram DM webhook.
 *
 * Meta sends:
 *   - GET  with hub.mode=subscribe&hub.verify_token&hub.challenge  (verification handshake)
 *   - POST with a JSON payload of inbound Instagram messages
 *
 * Wire this URL in your Meta App → Webhooks:
 *   https://yourdomain.com/api/azera/webhook/instagram
 *   Verify token: INSTAGRAM_VERIFY_TOKEN (env var)
 *   Subscribe to: messaging, instagram_messages
 */

function ok<T>(data: T) {
  return NextResponse.json({ success: true, data })
}
function err(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status })
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get("hub.mode")
  const token = searchParams.get("hub.verify_token")
  const challenge = searchParams.get("hub.challenge")

  const verifyToken = process.env.INSTAGRAM_VERIFY_TOKEN

  if (mode === "subscribe" && token === verifyToken) {
    return new NextResponse(challenge || "", { status: 200 })
  }

  return err("Forbidden", 403)
}

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: true })
  }

  try {
    const body = await request.json()
    // Instagram DM webhook structure
    const entries = body.entry || []

    for (const entry of entries) {
      const messaging = entry.messaging || []
      for (const msg of messaging) {
        if (!msg.message) continue

        const senderId = msg.sender?.id // Instagram user ID (PSID)
        const recipientId = msg.recipient?.id // Your Instagram account ID
        const text = msg.message?.text
        const timestamp = msg.timestamp
          ? new Date(Number(msg.timestamp)).toISOString()
          : new Date().toISOString()

        if (!senderId || !text) continue

        // Resolve business_id from recipient Instagram account ID
        const { data: settings } = await supabase
          .from("azera_settings")
          .select("business_id, instagram_account_id")
          .eq("instagram_account_id", recipientId)
          .maybeSingle()

        const businessId = settings?.business_id
        if (!businessId) {
          console.error("[Instagram webhook] No business for account", recipientId)
          continue
        }

        const externalId = `instagram:${senderId}`

        // Find or create conversation
        let { data: conv } = await supabase
          .from("azera_conversations")
          .select("*")
          .eq("business_id", businessId)
          .eq("channel", "instagram")
          .eq("external_id", externalId)
          .maybeSingle()

        if (!conv) {
          const { data: created, error: ce } = await supabase
            .from("azera_conversations")
            .insert({
              business_id: businessId,
              channel: "instagram",
              external_id: externalId,
              customer_name: senderId,
              customer_phone: null,
              status: "open",
              ai_enabled: true,
              last_message_at: timestamp,
              created_at: timestamp,
              updated_at: timestamp,
            })
            .select()
            .single()
          if (ce) {
            console.error("[Instagram webhook] create conv error", ce)
            continue
          }
          conv = created
        }

        // Save inbound message (dedupe by timestamp)
        const { data: existing } = await supabase
          .from("azera_messages")
          .select("id")
          .eq("conversation_id", conv.id)
          .eq("message", text)
          .eq("created_at", timestamp)
          .maybeSingle()

        if (!existing) {
          await supabase.from("azera_messages").insert({
            conversation_id: conv.id,
            author_type: "customer",
            message: text,
            direction: "inbound",
            created_at: timestamp,
          })

          await supabase
            .from("azera_conversations")
            .update({
              last_message_at: timestamp,
              updated_at: timestamp,
            })
            .eq("id", conv.id)
        }
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[Instagram webhook error]", err)
    return NextResponse.json({ ok: true }) // always 200 to Meta
  }
}
