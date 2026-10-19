import { NextResponse } from "next/server"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { notifySupportAgents } from "@/lib/omnichannel-notifications"

/**
 * Facebook Messenger webhook.
 *
 * Meta sends:
 *   - GET  with hub.mode=subscribe&hub.verify_token&hub.challenge  (verification handshake)
 *   - POST with a JSON payload of inbound messages
 *
 * Wire this URL in your Meta App → Webhooks:
 *   https://yourdomain.com/api/azera/webhook/messenger
 *   Verify token: MESSENGER_VERIFY_TOKEN (env var)
 *   Subscribe to: messages, messaging_postbacks
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

  const verifyToken = process.env.MESSENGER_VERIFY_TOKEN

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
    // Messenger wraps everything in an "entry" array
    const entries = body.entry || []

    for (const entry of entries) {
      const messaging = entry.messaging || []
      for (const msg of messaging) {
        // Skip non-message events (read receipts, etc.)
        if (!msg.message) continue

        const senderId = msg.sender?.id // Facebook user ID (PSID)
        const recipientId = msg.recipient?.id // Your page ID
        const text = msg.message?.text
        const timestamp = msg.timestamp
          ? new Date(Number(msg.timestamp)).toISOString()
          : new Date().toISOString()

        if (!senderId || !text) continue

        // Resolve business_id from recipient page ID
        // We match azera_settings.messenger_page_id against recipientId
        const { data: settings } = await supabase
          .from("azera_settings")
          .select("business_id, messenger_page_id")
          .eq("messenger_page_id", recipientId)
          .maybeSingle()

        const businessId = settings?.business_id
        if (!businessId) {
          console.error("[Messenger webhook] No business for page", recipientId)
          continue
        }

        const externalId = `messenger:${senderId}`

        // Find or create conversation
        let { data: conv } = await supabase
          .from("azera_conversations")
          .select("*")
          .eq("business_id", businessId)
          .eq("channel", "messenger")
          .eq("external_id", externalId)
          .maybeSingle()

        if (!conv) {
          const { data: created, error: ce } = await supabase
            .from("azera_conversations")
            .insert({
              business_id: businessId,
              channel: "messenger",
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
            console.error("[Messenger webhook] create conv error", ce)
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
          const { error: messageError } = await supabase.from("azera_messages").insert({
            conversation_id: conv.id,
            author_type: "customer",
            message: text,
            direction: "inbound",
            created_at: timestamp,
          })

          if (!messageError) {
            void notifySupportAgents({
              queue: "customer_support",
              title: "New Messenger message",
              message: `${conv.customer_name || "A customer"} sent a new Messenger message.`,
              deepLink: `/admin/azera?conversation=${conv.id}`,
              sourceId: conv.id,
            })
          }

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
    console.error("[Messenger webhook error]", err)
    return NextResponse.json({ ok: true }) // always 200 to Meta
  }
}
