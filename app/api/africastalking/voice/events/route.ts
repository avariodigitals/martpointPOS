import { NextResponse } from "next/server"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import {
  callbackSecretIsValid,
  finishAfricaWebhookEvent,
  normalizePhone,
  pick,
  readAfricaRequest,
  resolveAfricaBusinessId,
  storeAfricaWebhookEvent,
} from "@/lib/africastalking"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function mapState(value: string): { status: "ringing" | "active" | "ended" | "missed" | "failed" | "busy"; eventType: "ringing" | "answered" | "ended" | "missed" | "failed" | "busy" } {
  const state = value.toLowerCase()
  if (["bridged", "answered", "active"].includes(state)) return { status: "active", eventType: "answered" }
  if (["completed", "ended", "finished", "hangup"].includes(state)) return { status: "ended", eventType: "ended" }
  if (["notanswered", "no_answer", "missed", "timeout", "expired"].includes(state)) return { status: "missed", eventType: "missed" }
  if (["busy"].includes(state)) return { status: "busy", eventType: "busy" }
  if (["failed", "error", "rejected", "aborted"].includes(state)) return { status: "failed", eventType: "failed" }
  return { status: "ringing", eventType: "ringing" }
}

function isoOrNull(value: string): string | null {
  if (!value || value.toLowerCase() === "none") return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export async function POST(request: Request) {
  if (!callbackSecretIsValid(request)) return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 })

  const { rawBody, payload } = await readAfricaRequest(request)
  const caller = normalizePhone(pick(payload, "callerNumber", "caller", "from"))
  const destination = normalizePhone(pick(payload, "destinationNumber", "destination", "to"))
  const sessionId = pick(payload, "sessionId", "callSessionId", "call_sid", "call_id", "id")
  const businessId = await resolveAfricaBusinessId(destination)
  const webhookEventId = await storeAfricaWebhookEvent({
    product: "voice",
    endpoint: "voice/events",
    request,
    rawBody,
    payload,
    businessId,
  })

  try {
    if (!sessionId || !businessId || !isSupabaseConfigured()) {
      await finishAfricaWebhookEvent(webhookEventId, sessionId ? "processed" : "failed", sessionId ? undefined : "Missing Africa's Talking sessionId")
      return NextResponse.json({ ok: true })
    }

    const mapped = mapState(pick(payload, "callSessionState", "status", "call_status", "event"))
    const now = new Date().toISOString()
    const duration = Number(pick(payload, "durationInSeconds", "duration", "duration_seconds")) || 0
    const startedAt = isoOrNull(pick(payload, "callStartTime", "started_at"))
    const endedAt = isoOrNull(pick(payload, "callStopTime", "ended_at"))

    let { data: call } = await supabase
      .from("azera_calls")
      .select("id, status")
      .eq("business_id", businessId)
      .eq("sip_call_sid", sessionId)
      .maybeSingle()

    if (!call) {
      const { data: created, error } = await supabase
        .from("azera_calls")
        .insert({
          business_id: businessId,
          call_type: "sip",
          direction: "inbound",
          status: mapped.status,
          customer_phone: caller || null,
          sip_provider: "africas_talking",
          sip_call_sid: sessionId,
          sip_from_number: destination || null,
          sip_to_number: caller || null,
          started_at: startedAt || now,
          answered_at: mapped.status === "active" ? now : null,
          ended_at: ["ended", "missed", "failed", "busy"].includes(mapped.status) ? endedAt || now : null,
          duration_seconds: duration,
          created_at: now,
          updated_at: now,
        })
        .select("id, status")
        .single()
      if (error || !created) throw new Error(error?.message || "Could not create callback call")
      call = created
    } else {
      const updates: Record<string, unknown> = { status: mapped.status, updated_at: now }
      if (startedAt) updates.started_at = startedAt
      if (mapped.status === "active") updates.answered_at = now
      if (["ended", "missed", "failed", "busy"].includes(mapped.status)) {
        updates.ended_at = endedAt || now
        updates.duration_seconds = duration
      }
      const { error } = await supabase.from("azera_calls").update(updates).eq("id", call.id)
      if (error) throw new Error(error.message)
    }

    await supabase.from("azera_call_events").insert({
      call_id: call.id,
      event_type: mapped.eventType,
      actor_type: "sip_provider",
      metadata: {
        provider: "africas_talking",
        provider_state: pick(payload, "callSessionState", "status", "call_status", "event"),
        callback_event_id: webhookEventId,
      },
      created_at: now,
    })
    await finishAfricaWebhookEvent(webhookEventId, "processed")
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[Africa's Talking voice events error]", error)
    await finishAfricaWebhookEvent(webhookEventId, "failed", error instanceof Error ? error.message : "Voice event processing failed")
    return NextResponse.json({ ok: true })
  }
}

