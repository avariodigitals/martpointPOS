import { NextResponse } from "next/server"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { notifySupportAgents } from "@/lib/omnichannel-notifications"
import { recordCommunicationSmsOptOut } from "@/lib/communication-sms"
import {
  callbackSecretIsValid,
  finishAfricaWebhookEvent,
  normalizePhone,
  pick,
  readAfricaRequest,
  resolveAfricaBusinessId,
  storeAfricaWebhookEvent,
  textResponse,
} from "@/lib/africastalking"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  if (!callbackSecretIsValid(request)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 })

  const { rawBody, payload } = await readAfricaRequest(request)
  const from = normalizePhone(pick(payload, "from", "sender", "phoneNumber"))
  const to = normalizePhone(pick(payload, "to", "recipient", "shortCode"))
  const businessId = await resolveAfricaBusinessId(to)
  const eventId = await storeAfricaWebhookEvent({ product: "sms", endpoint: "sms", request, rawBody, payload, businessId })

  try {
    const text = pick(payload, "text", "message", "body")
    if (from && /^(STOP|UNSUBSCRIBE|CANCEL|END|QUIT)$/i.test(text.trim())) {
      try { await recordCommunicationSmsOptOut(from, text) }
      catch {
        await finishAfricaWebhookEvent(eventId, "failed", "Could not retain SMS opt-out")
        return NextResponse.json({ error: "Could not retain opt-out" }, { status: 503 })
      }
    }
    if (!businessId || !from || !text || !isSupabaseConfigured()) {
      await finishAfricaWebhookEvent(eventId, "processed")
      return textResponse("")
    }

    const now = new Date().toISOString()
    const externalId = `sms:${from}`
    let { data: conversation } = await supabase
      .from("azera_conversations")
      .select("id, customer_name")
      .eq("business_id", businessId)
      .eq("channel", "sms")
      .eq("external_id", externalId)
      .maybeSingle()

    if (!conversation) {
      const { data: created, error } = await supabase
        .from("azera_conversations")
        .insert({
          business_id: businessId,
          channel: "sms",
          external_id: externalId,
          customer_name: from,
          customer_phone: from,
          status: "open",
          ai_enabled: true,
          last_message_at: now,
          created_at: now,
          updated_at: now,
        })
        .select("id, customer_name")
        .single()
      if (error || !created) throw new Error(error?.message || "Could not create SMS conversation")
      conversation = created
    }

    const messageId = pick(payload, "id", "messageId", "message_id")
    let duplicate = false
    if (messageId) {
      const { data: previous } = await supabase
        .from("africastalking_webhook_events")
        .select("id")
        .eq("product", "sms")
        .eq("provider_reference", messageId)
        .neq("id", eventId || "00000000-0000-0000-0000-000000000000")
        .limit(1)
      duplicate = Boolean(previous?.length)
    }

    if (!duplicate) {
      const { error } = await supabase.from("azera_messages").insert({
        conversation_id: conversation.id,
        author_type: "customer",
        message: text,
        direction: "inbound",
        created_at: now,
      })
      if (error) throw new Error(error.message)
      await supabase.from("azera_conversations").update({ last_message_at: now, updated_at: now }).eq("id", conversation.id)
      void notifySupportAgents({
        queue: "customer_support",
        title: "New SMS message",
        message: `${conversation.customer_name || from} sent a new SMS message.`,
        deepLink: `/admin/azera?conversation=${conversation.id}`,
        sourceId: conversation.id,
      })
    }

    await finishAfricaWebhookEvent(eventId, "processed")
    return textResponse("")
  } catch (error) {
    console.error("[Africa's Talking SMS webhook error]", error)
    await finishAfricaWebhookEvent(eventId, "failed", error instanceof Error ? error.message : "SMS webhook failed")
    return textResponse("")
  }
}

