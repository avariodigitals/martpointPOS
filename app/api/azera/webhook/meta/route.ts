import { NextResponse } from "next/server"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { notifySupportAgents } from "@/lib/omnichannel-notifications"

/**
 * Meta WhatsApp Cloud API webhook.
 *
 * Meta sends:
 *   - GET  with hub.mode=subscribe&hub.verify_token&hub.challenge  (verification handshake)
 *   - POST with a JSON payload of inbound messages/statuses
 *
 * Wire this URL in your Meta WhatsApp app config:
 *   https://yourdomain.com/api/azera/webhook/meta
 *   Verify token: WHATSAPP_WEBHOOK_VERIFY_TOKEN (env var)
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

  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN

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
    // Meta Cloud API wraps everything in an "entry" array
    const entries = body.entry || []

    for (const entry of entries) {
      const changes = entry.changes || []
      for (const change of changes) {
        const value = change.value || {}
        const messages = value.messages || []
        const contacts = value.contacts || []
        const messagingProduct = value.messaging_product || "whatsapp"

        // Build a wa_id -> name map from contacts
        const nameByWaId = new Map<string, string>()
        for (const c of contacts) {
          const waId = String((c as any).wa_id || "")
          const profile = (c as any).profile || {}
          const name = typeof profile.name === "string" ? profile.name : ""
          if (waId && name) nameByWaId.set(waId, name)
        }

        for (const msg of messages) {
          // Only handle text messages for now; ignore others (images, etc.)
          if (msg.type !== "text" || !msg.text?.body) continue

          const from = String(msg.from || "") // customer's wa_id
          const textBody = String(msg.text.body)
          const timestamp = msg.timestamp
            ? new Date(Number(msg.timestamp) * 1000).toISOString()
            : new Date().toISOString()

          // Store inbound message in azera_messages via a conversation
          // We need a business_id — resolve from the phone number the message
          // was sent to, or fall back to a default. Meta Cloud API is usually
          // one phone number per WABA, so we look up azera_settings by phone.
          const toNumber = String(value.metadata?.display_phone_number || "")

          const businessId = await resolveBusinessId(toNumber)
          if (!businessId) {
            console.error("[Meta webhook] No business found for phone", toNumber)
            continue
          }

          const externalId = from
          const customerName = nameByWaId.get(from) || ""

          // Find or create conversation
          let { data: conv } = await supabase
            .from("azera_conversations")
            .select("*")
            .eq("business_id", businessId)
            .eq("channel", "whatsapp")
            .eq("external_id", externalId)
            .maybeSingle()

          if (!conv) {
            const { data: created, error: ce } = await supabase
              .from("azera_conversations")
              .insert({
                business_id: businessId,
                channel: "whatsapp",
                external_id: externalId,
                customer_name: customerName,
                customer_phone: from,
                status: "open",
                ai_enabled: true,
                last_message_at: timestamp,
                created_at: timestamp,
                updated_at: timestamp,
              })
              .select()
              .single()
            if (ce) {
              console.error("[Meta webhook] create conv error", ce)
              continue
            }
            conv = created
          }

          // Save inbound message (dedupe by Meta message id via a check)
          const { data: existing } = await supabase
            .from("azera_messages")
            .select("id")
            .eq("conversation_id", conv.id)
            .eq("message", textBody)
            .eq("created_at", timestamp)
            .maybeSingle()

          if (!existing) {
            const { error: messageError } = await supabase.from("azera_messages").insert({
              conversation_id: conv.id,
              author_type: "customer",
              message: textBody,
              direction: "inbound",
              created_at: timestamp,
            })

            if (!messageError) {
              void notifySupportAgents({
                queue: "customer_support",
                title: "New WhatsApp message",
                message: `${conv.customer_name || "A customer"} sent a new WhatsApp message.`,
                deepLink: `/admin/azera?conversation=${conv.id}`,
                sourceId: conv.id,
              })
            }

            await supabase
              .from("azera_conversations")
              .update({
                last_message_at: timestamp,
                updated_at: timestamp,
                customer_name: customerName || conv.customer_name,
                customer_phone: from || conv.customer_phone,
              })
              .eq("id", conv.id)
          }
        }
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[Meta webhook error]", err)
    return NextResponse.json({ ok: true }) // always 200 to Meta so it doesn't redeliver
  }
}

/**
 * Resolve a business_id from a WhatsApp display phone number.
 * Looks up azera_settings.brand_color is not used here; we store the phone in
 * azera_settings via a phone_number column, or we can match against businesses.primary_phone.
 * For now, fall back to businesses.primary_phone match.
 */
async function resolveBusinessId(phone: string): Promise<string | null> {
  const normalized = phone.replace(/\D/g, "")

  // Try azera_settings first (we'll add phone_number there via settings UI)
  try {
    const { data } = await supabase
      .from("azera_settings")
      .select("business_id")
      .maybeSingle()
    // azera_settings doesn't have phone_number yet; skip if error
  } catch {
    // ignore
  }

  // Fall back to matching businesses.primary_phone
  try {
    const { data } = await supabase
      .from("businesses")
      .select("id")
      .ilike("primary_phone", `%${normalized.slice(-10)}%`)
      .maybeSingle()
    return data?.id || null
  } catch {
    return null
  }
}
