import { NextResponse } from "next/server"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import {
  callbackSecretIsValid,
  finishAfricaWebhookEvent,
  getAfricaVoiceConfig,
  isVoiceBusinessOpen,
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

function say(text: string): string {
  return `<Say>${xmlEscape(text)}</Say>`
}

function sayOrPlay(text: string, audioUrl: string): string {
  return audioUrl ? `<Play url="${xmlEscape(audioUrl)}"/>` : say(text)
}

function digitsAction(request: Request, prompt: string, audioUrl = ""): string {
  // Keep the secret query parameter on the callback used for the next digit.
  return `<GetDigits numDigits="1" timeout="8" finishOnKey="#" callbackUrl="${xmlEscape(request.url)}">${sayOrPlay(prompt, audioUrl)}</GetDigits>`
}

function callbackUrl(request: Request, path: string): string {
  const url = new URL(request.url)
  url.pathname = path
  return url.toString()
}

function dialAction(
  destinations: string[],
  callerId: string,
  waitingAudioUrl: string,
): string {
  const attributes = [
    `phoneNumbers="${xmlEscape(destinations.join(","))}"`,
    `sequential="true"`,
    callerId ? `callerId="${xmlEscape(callerId)}"` : "",
    waitingAudioUrl ? `ringbackTone="${xmlEscape(waitingAudioUrl)}"` : "",
  ].filter(Boolean).join(" ")
  // Africa's Talking supports maxDuration on Dial, but it is the connected-call
  // limit, not a ringing timeout. Do not send a made-up timeout attribute.
  return `<Dial ${attributes}/>`
}

function voicemailOrHangup(
  request: Request,
  config: Awaited<ReturnType<typeof getAfricaVoiceConfig>>,
  message: string,
  audioUrl = "",
): string[] {
  if (!config.voicemailEnabled) return [say(message), "<Hangup/>"]
  return [
    sayOrPlay(message, audioUrl),
    `<Record maxLength="${config.voicemailMaxSeconds}" playBeep="true" callbackUrl="${xmlEscape(callbackUrl(request, "/api/africastalking/voice/recording"))}"/>`,
    say("Thank you. Your message has been recorded and our team will follow up."),
    "<Hangup/>",
  ]
}

async function recordAttempts(
  callId: string,
  businessId: string,
  departmentKey: string | null,
  destinations: string[],
  now: string,
) {
  if (!destinations.length) return
  await supabase.from("azera_call_attempts").insert(
    destinations.map((destination, index) => ({
      call_id: callId,
      business_id: businessId,
      department_key: departmentKey,
      destination,
      attempt_number: index + 1,
      status: "dialing",
      started_at: now,
      created_at: now,
    })),
  )
}

function menuPrompt(
  greeting: string,
  departments: Awaited<ReturnType<typeof getAfricaVoiceConfig>>["departments"],
): string {
  if (/press\s+1\b/i.test(greeting)) return greeting
  return `${greeting} ${departments.map((department) => `Press ${department.digit} for ${department.label}.`).join(" ")} To hear these options again, press 9.`
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
      return voiceXml([say("Sorry, this call cannot be connected right now. Please try again later."), "<Hangup/>"])
    }

    const now = new Date().toISOString()
    const startedAt = isoOrNull(pick(payload, "callStartTime", "started_at")) || now
    const { data: existing } = await supabase
      .from("azera_calls")
      .select("id, menu_attempts")
      .eq("business_id", businessId)
      .eq("sip_call_sid", sessionId)
      .maybeSingle()

    let callId = existing?.id as string | undefined
    let menuAttempts = Number(existing?.menu_attempts || 0)
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
        .select("id, menu_attempts")
        .single()
      if (error || !created) throw new Error(error?.message || "Could not create inbound call")
      callId = created.id as string
      menuAttempts = Number(created.menu_attempts || 0)
      await supabase.from("azera_call_events").insert({
        call_id: callId,
        event_type: "ringing",
        actor_type: "sip_provider",
        metadata: { provider: "africas_talking", callback_event_id: webhookEventId },
        created_at: now,
      })
    }

    const config = await getAfricaVoiceConfig(businessId)
    const departments = config.departments.slice(0, 8)
    const open = isVoiceBusinessOpen(config.timezone, config.weeklySchedule, config.closedDates)

    if (!open) {
      if (config.afterHoursDestination) {
        await recordAttempts(callId, businessId, "after-hours", [config.afterHoursDestination], now)
        await supabase.from("azera_calls").update({ selected_department: "after-hours", updated_at: now }).eq("id", callId)
        await finishAfricaWebhookEvent(webhookEventId, "processed")
        return voiceXml([
          sayOrPlay(config.afterHoursGreeting, config.afterHoursAudioUrl),
          dialAction([config.afterHoursDestination], config.phoneNumber || destination, config.waitingAudioUrl),
        ])
      }
      await finishAfricaWebhookEvent(webhookEventId, "processed")
      return voiceXml(voicemailOrHangup(request, config, config.afterHoursGreeting, config.afterHoursAudioUrl))
    }

    const hasConfiguredRoute = config.forwardNumbers.length > 0 || (config.menuEnabled && departments.some((department) => department.numbers.length))
    if (!hasConfiguredRoute) {
      await supabase.from("azera_calls").update({ status: "missed", final_outcome: "no_route", ended_at: now, updated_at: now }).eq("id", callId)
      await supabase.from("azera_call_events").insert({
        call_id: callId,
        event_type: "missed",
        actor_type: "system",
        metadata: { reason: "No Africa's Talking forwarding number configured", callback_event_id: webhookEventId },
        created_at: now,
      })
      await finishAfricaWebhookEvent(webhookEventId, "processed")
      return voiceXml(voicemailOrHangup(request, config, config.noAnswerGreeting, config.noAnswerAudioUrl))
    }

    if (config.menuEnabled && departments.length) {
      const prompt = menuPrompt(config.greeting, departments)
      const digit = Number(dtmfDigits)

      if (digit === 9 || !dtmfDigits || !departments.some((department) => department.digit === digit)) {
        const nextAttempts = menuAttempts + 1
        await supabase.from("azera_calls").update({ menu_attempts: nextAttempts, updated_at: now }).eq("id", callId)
        const canRetry = digit === 9 ? nextAttempts <= 3 : nextAttempts <= config.menuRetryLimit
        if (canRetry) {
          await finishAfricaWebhookEvent(webhookEventId, "processed")
          const retryPrompt = digit === 9 ? prompt : `${dtmfDigits ? "That is not a valid selection. " : "We did not receive a selection. "}${prompt}`
          return voiceXml([digitsAction(request, retryPrompt, digit === 9 ? "" : config.greetingAudioUrl), say("We did not receive a valid selection."), "<Hangup/>"])
        }

        if (config.forwardNumbers.length) {
          await recordAttempts(callId, businessId, null, config.forwardNumbers, now)
          await supabase.from("azera_calls").update({ selected_department: "default", updated_at: now }).eq("id", callId)
          await finishAfricaWebhookEvent(webhookEventId, "processed")
          return voiceXml([
            say(config.connectingGreeting),
            dialAction(config.forwardNumbers, config.phoneNumber || destination, config.waitingAudioUrl),
          ])
        }
        await finishAfricaWebhookEvent(webhookEventId, "processed")
        return voiceXml(voicemailOrHangup(request, config, config.noAnswerGreeting, config.noAnswerAudioUrl))
      }

      const department = departments.find((item) => item.digit === digit)
      if (department) {
        await recordAttempts(callId, businessId, department.key, department.numbers, now)
        await supabase.from("azera_calls").update({ selected_department: department.key, updated_at: now }).eq("id", callId)
        await supabase.from("azera_call_events").insert({
          call_id: callId,
          event_type: "sip_webhook",
          actor_type: "system",
          metadata: { provider: "africas_talking", department: department.key, digit, label: department.label, callback_event_id: webhookEventId },
          created_at: now,
        })
        await finishAfricaWebhookEvent(webhookEventId, "processed")
        return voiceXml([
          sayOrPlay(config.connectingGreeting, config.connectingAudioUrl),
          dialAction(department.numbers, config.phoneNumber || destination, config.waitingAudioUrl),
        ])
      }
    }

    await recordAttempts(callId, businessId, null, config.forwardNumbers, now)
    await finishAfricaWebhookEvent(webhookEventId, "processed")
    const callerId = config.phoneNumber || destination
    return voiceXml([
      sayOrPlay(config.greeting, config.greetingAudioUrl),
      sayOrPlay(config.connectingGreeting, config.connectingAudioUrl),
      dialAction(config.forwardNumbers, callerId, config.waitingAudioUrl),
    ])
  } catch (error) {
    console.error("[Africa's Talking voice callback error]", error)
    await finishAfricaWebhookEvent(webhookEventId, "failed", error instanceof Error ? error.message : "Voice callback failed")
    return voiceXml([say("Sorry, we are unable to connect your call right now."), "<Hangup/>"])
  }
}
