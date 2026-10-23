import { NextResponse } from "next/server"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import {
  callbackSecretIsValid,
  finishAfricaWebhookEvent,
  getAfricaVoiceConfig,
  normalizePhone,
  pick,
  readAfricaRequest,
  resolveAfricaBusinessId,
  storeAfricaWebhookEvent,
  voiceXml,
  xmlEscape,
} from "@/lib/africastalking"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function isoOrNull(value: string): string | null {
  if (!value || value.toLowerCase() === "none") return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export async function POST(request: Request) {
  if (!callbackSecretIsValid(request)) return new NextResponse("Forbidden", { status: 403 })

  const { rawBody, payload } = await readAfricaRequest(request)
  const caller = normalizePhone(pick(payload, "callerNumber", "caller", "from"))
  const destination = normalizePhone(pick(payload, "destinationNumber", "destination", "to"))
  const sessionId = pick(payload, "sessionId", "callSessionId", "call_sid", "call_id", "id")
  const dtmfDigits = pick(payload, "dtmfDigits", "digits", "userInput", "input").replace(/[^0-9*#]/g, "").slice(0, 1)
  const businessId = await resolveAfricaBusinessId(destination)
  const webhookEventId = await storeAfricaWebhookEvent({
    product: "voice",
    endpoint: "voice/callback",
    request,
    rawBody,
    payload,
    businessId,
  })

  try {
    if (!sessionId || !businessId || !isSupabaseConfigured()) {
      await finishAfricaWebhookEvent(webhookEventId, sessionId ? "processed" : "failed", sessionId ? undefined : "Missing Africa's Talking sessionId")
      return voiceXml([
        `<Say>Sorry, this call cannot be connected right now. Please try again later.</Say>`,
        `<Hangup/>`,
      ])
    }

    const now = new Date().toISOString()
    const startedAt = isoOrNull(pick(payload, "callStartTime", "started_at")) || now
    const { data: existing } = await supabase
      .from("azera_calls")
      .select("id")
      .eq("business_id", businessId)
      .eq("sip_call_sid", sessionId)
      .maybeSingle()

    let callId = existing?.id as string | undefined
    if (!callId) {
      const { data: created, error } = await supabase
        .from("azera_calls")
        .insert({
          business_id: businessId,
          call_type: "sip",
          direction: "inbound",
          status: "ringing",
          customer_phone: caller || null,
          sip_provider: "africas_talking",
          sip_call_sid: sessionId,
          sip_from_number: destination || null,
          sip_to_number: caller || null,
          started_at: startedAt,
          created_at: now,
          updated_at: now,
        })
        .select("id")
        .single()
      if (error || !created) throw new Error(error?.message || "Could not create inbound call")
      callId = created.id as string
      await supabase.from("azera_call_events").insert({
        call_id: callId,
        event_type: "ringing",
        actor_type: "sip_provider",
        metadata: { provider: "africas_talking", callback_event_id: webhookEventId },
        created_at: now,
      })
    }

    const config = await getAfricaVoiceConfig(businessId)
    const menuDepartments = config.departments.slice(0, 9)
    const hasConfiguredRoute = config.forwardNumbers.length > 0 || (config.menuEnabled && menuDepartments.some((department) => department.numbers.length))
    if (!hasConfiguredRoute) {
      await supabase.from("azera_calls").update({ status: "missed", ended_at: now, updated_at: now }).eq("id", callId)
      await supabase.from("azera_call_events").insert({
        call_id: callId,
        event_type: "missed",
        actor_type: "system",
        metadata: { reason: "No Africa's Talking forwarding number configured", callback_event_id: webhookEventId },
        created_at: now,
      })
      await finishAfricaWebhookEvent(webhookEventId, "processed")
      return voiceXml([
        `<Say>${xmlEscape(config.noAnswerGreeting)}</Say>`,
        `<Hangup/>`,
      ])
    }

    if (config.menuEnabled && menuDepartments.length) {
      const menuPrompt = `${config.greeting} ${menuDepartments.map((department, index) => `Press ${index + 1} for ${department.label}.`).join(" ")}`
      if (!dtmfDigits) {
        await finishAfricaWebhookEvent(webhookEventId, "processed")
        return voiceXml([
          `<GetDigits numDigits="1" timeout="8" finishOnKey="#"><Say>${xmlEscape(menuPrompt)}</Say></GetDigits>`,
          `<Say>We did not receive a selection. ${xmlEscape(config.noAnswerGreeting)}</Say>`,
          `<Hangup/>`,
        ])
      }

      const department = menuDepartments[Number(dtmfDigits) - 1]
      if (!department) {
        await finishAfricaWebhookEvent(webhookEventId, "processed")
        return voiceXml([
          `<GetDigits numDigits="1" timeout="8" finishOnKey="#"><Say>That is not a valid selection. ${xmlEscape(menuPrompt)}</Say></GetDigits>`,
          `<Say>${xmlEscape(config.noAnswerGreeting)}</Say>`,
          `<Hangup/>`,
        ])
      }

      await supabase.from("azera_call_events").insert({
        call_id: callId,
        event_type: "sip_webhook",
        actor_type: "system",
        metadata: { provider: "africas_talking", department: department.key, label: department.label, callback_event_id: webhookEventId },
        created_at: now,
      })
      await finishAfricaWebhookEvent(webhookEventId, "processed")
      return voiceXml([
        `<Say>Connecting you to ${xmlEscape(department.label)}.</Say>`,
        `<Dial phoneNumbers="${xmlEscape(department.numbers.join(","))}" sequential="true" callerId="${xmlEscape(config.phoneNumber || destination)}"/>`,
      ])
    }

    await finishAfricaWebhookEvent(webhookEventId, "processed")
    const phoneNumbers = config.forwardNumbers.join(",")
    const callerId = config.phoneNumber || destination
    return voiceXml([
      `<Say>${xmlEscape(config.greeting)}</Say>`,
      `<Dial phoneNumbers="${xmlEscape(phoneNumbers)}" sequential="true"${callerId ? ` callerId="${xmlEscape(callerId)}"` : ""}/>`,
    ])
  } catch (error) {
    console.error("[Africa's Talking voice callback error]", error)
    await finishAfricaWebhookEvent(webhookEventId, "failed", error instanceof Error ? error.message : "Voice callback failed")
    return voiceXml([
      `<Say>Sorry, we are unable to connect your call right now.</Say>`,
      `<Hangup/>`,
    ])
  }
}

