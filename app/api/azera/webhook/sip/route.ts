import { NextResponse } from "next/server"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"

function ok<T>(data: T) {
  return NextResponse.json({ success: true, data })
}
function err(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status })
}

/**
 * SIP trunk webhook — receives call status updates from telecom providers
 * (Africa's Talking, Twilio, Plivo, etc.) for real phone number calls.
 *
 * Each provider sends webhooks in their own format. This endpoint normalizes
 * them and updates azera_calls / azera_call_events.
 *
 * Configure your provider's webhook URL to:
 *   https://yourdomain.com/api/azera/webhook/sip
 *
 * Provider-specific signature verification can be added per-provider.
 */

function mapProviderEvent(rawStatus: string): string {
  const s = String(rawStatus).toLowerCase()
  if (s === "ringing" || s === "queued" || s === "initiated") return "ringing"
  if (s === "answered" || s === "completed" || s === "active") return "active"
  if (s === "ended" || s === "finished" || s === "hangup") return "ended"
  if (s === "missed" || s === "no_answer" || s === "timeout") return "missed"
  if (s === "failed" || s === "error" || s === "rejected") return "failed"
  if (s === "busy") return "busy"
  return "failed"
}

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: true })
  }

  try {
    const body = await request.json()

    // Detect provider by header or body shape
    const provider = detectProvider(request.headers, body)

    // Normalize common fields
    const callSid =
      body.call_sid ||
      body.call_id ||
      body.CallSid ||
      body.callReference ||
      body.id

    const status = mapProviderEvent(
      body.status || body.call_status || body.Status || body.event || "failed"
    )

    const fromNumber = body.from || body.From || body.caller || body.from_number
    const toNumber = body.to || body.To || body.called || body.to_number

    const duration = body.duration || body.Duration || body.duration_seconds || 0
    const answeredAt = body.answered_at || body.AnsweredAt || null
    const endedAt = body.ended_at || body.EndedAt || null

    if (!callSid) {
      return err("Missing call reference", 400)
    }

    // Find the call by sip_call_sid
    const { data: call, error: callError } = await supabase
      .from("azera_calls")
      .select("*")
      .eq("sip_call_sid", callSid)
      .single()

    if (callError || !call) {
      // Try matching by phone numbers + recent timestamp
      const { data: recentCalls } = await supabase
        .from("azera_calls")
        .select("*")
        .eq("call_type", "sip")
        .eq("sip_to_number", toNumber || "")
        .order("created_at", { ascending: false })
        .limit(5)

      if (!recentCalls || recentCalls.length === 0) {
        return err("Call not found", 404)
      }

      // Use most recent matching call
      const targetCall = recentCalls[0]

      const now = new Date().toISOString()

      const { data: updated, error: upError } = await supabase
        .from("azera_calls")
        .update({
          status,
          updated_at: now,
          ...(status === "active" && { answered_at: answeredAt || now }),
          ...(status === "ended" && { ended_at: endedAt || now, duration_seconds: duration }),
        })
        .eq("id", targetCall.id)
        .select()
        .single()

      if (upError) return err("Failed to update call", 500)

      await supabase.from("azera_call_events").insert({
        call_id: targetCall.id,
        event_type: status,
        actor_type: "sip_provider",
        metadata: { provider, raw: body },
        created_at: now,
      })

      return ok(updated)
    }

    const now = new Date().toISOString()

    const { data: updated, error: upError } = await supabase
      .from("azera_calls")
      .update({
        status,
        updated_at: now,
        sip_cost_cents: body.cost_cents ?? body.cost ?? call.sip_cost_cents,
        ...(status === "active" && { answered_at: answeredAt || now }),
        ...(status === "ended" && { ended_at: endedAt || now, duration_seconds: duration }),
      })
      .eq("id", call.id)
      .select()
      .single()

    if (upError) return err("Failed to update call", 500)

    await supabase.from("azera_call_events").insert({
      call_id: call.id,
      event_type: status,
      actor_type: "sip_provider",
      metadata: { provider, raw: body },
      created_at: now,
    })

    return ok(updated)
  } catch (e) {
    console.error("[SIP webhook error]", e)
    return NextResponse.json({ ok: true }) // Always 200 to provider
  }
}

function detectProvider(headers: Headers, body: any): string {
  // Africa's Talking
  if (body?.provider === "africas_talking" || headers.get("x-at-signature")) {
    return "africas_talking"
  }
  // Twilio
  if (body?.CallSid || headers.get("x-twilio-signature")) {
    return "twilio"
  }
  // Plivo
  if (headers.get("x-plivo-signature")) return "plivo"
  return "generic"
}
