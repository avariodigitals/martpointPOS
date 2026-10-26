import { NextResponse } from "next/server"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { campaignCallId, finishAzeraCampaignIfDone } from "@/lib/azera-campaign-worker"
import { callbackSecretIsValid, pick, readAfricaRequest, voiceXml, xmlEscape } from "@/lib/africastalking"
import { notifyAllAdmins } from "@/lib/admin-notifications"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function endCall(message: string) {
  return voiceXml([`<Say>${xmlEscape(message)}</Say>`])
}

function askForResponse(request: Request, script: string, attempt: number) {
  const callback = new URL(request.url)
  callback.pathname = "/api/africastalking/voice/campaign"
  callback.searchParams.set("stage", "response")
  callback.searchParams.set("attempt", String(attempt))
  callback.searchParams.delete("timeout")
  const timeout = new URL(callback)
  timeout.searchParams.set("timeout", "1")
  const prompt = `${script} To arrange a follow-up with our team, press 1. To request a call back, press 2. To stop automated calls from MartPoint, press 3.`
  return voiceXml([`<GetDigits numDigits="1" timeout="8" callbackUrl="${xmlEscape(callback.toString())}"><Say>${xmlEscape(prompt)}</Say></GetDigits><Redirect>${xmlEscape(timeout.toString())}</Redirect>`])
}

export async function POST(request: Request): Promise<Response> {
  if (!callbackSecretIsValid(request)) return new NextResponse("Forbidden", { status: 403 })
  if (!isSupabaseConfigured()) return new NextResponse("Retry", { status: 503 })
  const { payload } = await readAfricaRequest(request)
  const url = new URL(request.url)
  const sessionId = pick(payload, "sessionId", "callSessionId", "call_sid", "call_id", "id")
  const requestId = campaignCallId(pick(payload, "clientRequestId", "client_request_id"))
  let recipientId = requestId
  if (!recipientId && sessionId) {
    const { data: matchedCall } = await supabase.from("azera_calls").select("campaign_recipient_id")
      .eq("sip_provider", "africas_talking_campaign").eq("sip_call_sid", sessionId).maybeSingle()
    recipientId = matchedCall?.campaign_recipient_id || null
  }
  const { data: recipient, error: recipientError } = recipientId
    ? await supabase.from("azera_call_campaign_recipients").select("id,campaign_id,call_id,status,response_digit,phone,contact_name,business_name,personalized_script").eq("id", recipientId).maybeSingle()
    : { data: null, error: null }
  if (recipientError || !recipient?.call_id) return endCall("Sorry, this follow-up call could not be confirmed. Please contact MartPoint directly.")
  const { data: call, error: callError } = await supabase.from("azera_calls").select("id,business_id,status,sip_provider").eq("id", recipient.call_id).maybeSingle()
  if (callError || !call || call.sip_provider !== "africas_talking_campaign") return endCall("This follow-up call has ended. Thank you.")

  const now = new Date().toISOString()
  const digits = pick(payload, "dtmfDigits", "digits", "userInput", "input").replace(/[^1-3]/g, "").slice(0, 1)
  if (url.searchParams.get("timeout") === "1") {
    if (!recipient.response_digit) {
      await supabase.from("azera_call_campaign_recipients").update({ status: "no_response", response_label: "No keypad response", notes: "The call connected, but no keypad response was received.", completed_at: now, updated_at: now }).eq("id", recipient.id).in("status", ["dialing", "answered"])
    }
    await finishAzeraCampaignIfDone(recipient.campaign_id)
    return endCall("Thank you for your time. Goodbye.")
  }

  if (digits) {
    if (recipient.response_digit) return endCall("We have already recorded your response. Thank you. Goodbye.")
    const outcome = digits === "1" ? "answered" : digits === "2" ? "callback_requested" : "not_interested"
    const label = digits === "1" ? "Interested; team follow-up requested" : digits === "2" ? "Requested a call back" : "Opted out of future automated calls"
    const note = `Automated campaign call: ${label}. Response recorded ${now}.`
    const { data: saved, error } = await supabase.from("azera_call_campaign_recipients").update({ status: outcome, response_digit: digits, response_label: label, notes: note, answered_at: now, completed_at: now, updated_at: now }).eq("id", recipient.id).is("response_digit", null).select("id").maybeSingle()
    if (error) return new NextResponse("Retry", { status: 503 })
    if (!saved) return endCall("We have already recorded your response. Thank you. Goodbye.")
    if (digits === "3") {
      const { error: suppressionError } = await supabase.from("azera_call_suppressions").upsert({ phone: recipient.phone, reason: "recipient_request", source_campaign_id: recipient.campaign_id }, { onConflict: "phone" })
      if (suppressionError) return new NextResponse("Retry", { status: 503 })
    }
    await supabase.from("azera_calls").update({ follow_up_status: digits === "2" ? "assigned" : digits === "1" ? "contacted" : "resolved", follow_up_notes: note, follow_up_at: digits === "1" || digits === "2" ? now : null, updated_at: now }).eq("id", call.id)
    await supabase.from("azera_call_events").insert({ call_id: call.id, event_type: "sip_webhook", actor_type: "customer", metadata: { provider: "africas_talking_campaign", response_digit: digits, response_label: label } })
    if (digits === "1" || digits === "2") {
      await notifyAllAdmins({
        type: "AZERA_CAMPAIGN_RESPONSE",
        title: digits === "2" ? "Call-back requested" : "Campaign lead requested follow-up",
        message: `${recipient.contact_name || "A contact"} at ${recipient.business_name || "a business"} responded to an Azera voice campaign: ${label}. Open Call Campaigns to review the note and contact details.`,
        deep_link: "/admin/azera/campaigns",
        source_type: "azera_call_campaign_recipient",
        source_id: recipient.id,
        actor_admin_user_id: null,
        roles: ["Admin", "Sales", "Customer Care"],
      })
    }
    await finishAzeraCampaignIfDone(recipient.campaign_id)
    return endCall(digits === "3" ? "Your number has been removed from automated MartPoint calls. Goodbye." : digits === "2" ? "Thank you. Our team will call you back. Goodbye." : "Thank you. Our team will follow up with you. Goodbye.")
  }

  if (recipient.response_digit) return endCall("Thank you for your time. Goodbye.")
  const attempt = Number(url.searchParams.get("attempt") || "0")
  if (attempt > 1) return endCall("We did not receive a response. Thank you for your time. Goodbye.")
  const script = String(recipient.personalized_script || "Hello, this is Azera, MartPoint's automated assistant, following up on your enquiry.")
  return askForResponse(request, script, attempt + 1)
}
