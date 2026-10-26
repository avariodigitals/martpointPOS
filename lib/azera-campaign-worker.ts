import { africaBrowserConfig } from "@/lib/africa-browser-voice"
import { getAfricaVoiceConfig, isVoiceBusinessOpen } from "@/lib/africastalking"
import { personalizeCampaignScript, placeAfricaCampaignCall } from "@/lib/azera-campaigns"
import { supabase } from "@/lib/supabase"

/** Dispatch one recipient. The SQL RPC serializes workers and reserves only one call at a time. */
export async function dispatchAzeraCampaignCall() {
  const { data: rows, error: claimError } = await supabase.rpc("azera_claim_campaign_recipient")
  if (claimError) throw new Error("Campaign worker could not claim a contact; check migration 140.")
  const recipient = Array.isArray(rows) ? rows[0] : rows
  if (!recipient) return { dispatched: false }

  const { data: campaign, error: campaignError } = await supabase.from("azera_call_campaigns")
    .select("id,business_id,status,purpose,goal,script_template,max_calls")
    .eq("id", recipient.campaign_id).maybeSingle()
  if (campaignError || !campaign || campaign.status !== "running") {
    await supabase.from("azera_call_campaign_recipients").update({ status: "failed", provider_error: "Campaign is no longer active", completed_at: new Date().toISOString() }).eq("id", recipient.id)
    return { dispatched: false }
  }

  const voice = await getAfricaVoiceConfig(campaign.business_id)
  if (!isVoiceBusinessOpen(voice.timezone, voice.weeklySchedule, voice.closedDates)) {
    await supabase.from("azera_call_campaign_recipients").update({ status: "queued", attempt_count: 0, updated_at: new Date().toISOString() }).eq("id", recipient.id)
    return { dispatched: false, outsideCallWindow: true }
  }

  const config = await africaBrowserConfig(campaign.business_id)
  if (!config.apiKey || !config.username || config.username === "sandbox" || !config.phone) {
    await supabase.from("azera_call_campaign_recipients").update({ status: "failed", provider_error: "Live Africa’s Talking credentials or caller number are not configured", completed_at: new Date().toISOString() }).eq("id", recipient.id)
    return { dispatched: false, configurationError: true }
  }

  const clientRequestId = String(recipient.id)
  const now = new Date().toISOString()
  const personalizedScript = personalizeCampaignScript(campaign.script_template || "", recipient)
  const { data: call, error: insertError } = await supabase.from("azera_calls").insert({
    business_id: campaign.business_id,
    campaign_recipient_id: recipient.id,
    call_type: "sip",
    direction: "outbound",
    status: "ringing",
    customer_name: recipient.contact_name,
    customer_phone: recipient.phone,
    sip_provider: "africas_talking_campaign",
    sip_from_number: config.phone,
    sip_to_number: recipient.phone,
    webrtc_room: `azera-campaign:${clientRequestId}`,
    started_at: now,
    created_at: now,
    updated_at: now,
  }).select("id").single()
  if (insertError || !call) {
    await supabase.from("azera_call_campaign_recipients").update({ status: "failed", provider_error: "Call history could not be created", completed_at: now }).eq("id", recipient.id)
    return { dispatched: false, databaseError: true }
  }

  await supabase.from("azera_call_campaign_recipients").update({ personalized_script: personalizedScript, call_id: call.id, updated_at: now }).eq("id", recipient.id)
  await supabase.from("azera_call_events").insert({ call_id: call.id, event_type: "call_initiated", actor_type: "system", metadata: { provider: "africas_talking_campaign", campaign_id: campaign.id, campaign_recipient_id: recipient.id } })

  try {
    const result = await placeAfricaCampaignCall({ phone: recipient.phone, from: config.phone, username: config.username, apiKey: config.apiKey, clientRequestId })
    if (result.sessionId) {
      await supabase.from("azera_calls").update({ sip_call_sid: result.sessionId, updated_at: new Date().toISOString() }).eq("id", call.id).eq("status", "ringing")
    }
    return { dispatched: true, campaignId: campaign.id, callId: call.id }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Call provider rejected the request"
    const endedAt = new Date().toISOString()
    await supabase.from("azera_calls").update({ status: "failed", final_outcome: "provider_rejected", ended_at: endedAt, updated_at: endedAt }).eq("id", call.id)
    await supabase.from("azera_call_campaign_recipients").update({ status: "failed", provider_error: message, completed_at: endedAt, updated_at: endedAt }).eq("id", recipient.id)
    return { dispatched: false, providerError: true }
  }
}

export async function finishAzeraCampaignIfDone(campaignId: string) {
  const [{ count: remaining, error: remainingError }, { data: campaign, error: campaignError }] = await Promise.all([
    supabase.from("azera_call_campaign_recipients").select("id", { count: "exact", head: true }).eq("campaign_id", campaignId).in("status", ["queued", "dialing"]),
    supabase.from("azera_call_campaigns").select("status").eq("id", campaignId).maybeSingle(),
  ])
  if (remainingError || campaignError || !campaign || campaign.status !== "running" || remaining !== 0) return
  await supabase.from("azera_call_campaigns").update({ status: "completed", completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", campaignId).eq("status", "running")
}

export function campaignCallId(value: string) {
  const match = value.match(/^azera-campaign:([0-9a-f-]{36})$/i)
  return match?.[1] || null
}
