import { NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { importAfricaCallRecording } from "@/lib/africa-call-recording";
import { getAfricaVoiceConfig } from "@/lib/africastalking";
import { browserCallerIdentity, preparedAfricaOutbound } from "@/lib/africa-browser-routing";
import { campaignCallId, finishAzeraCampaignIfDone } from "@/lib/azera-campaign-worker";
import { normalizeOutboundPhone } from "@/lib/azera-outbound";
import {
  callbackSecretIsValid,
  finishAfricaWebhookEvent,
  normalizePhone,
  normalizeVoiceDestination,
  pick,
  readAfricaRequest,
  resolveAfricaBusinessId,
  storeAfricaWebhookEvent,
  voiceXml,
  xmlEscape,
} from "@/lib/africastalking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MappedState = {
  status: "ringing" | "active" | "ended" | "missed" | "failed" | "busy";
  eventType: "ringing" | "answered" | "ended" | "missed" | "failed" | "busy";
  attemptStatus:
    "ringing" | "answered" | "no_answer" | "failed" | "busy" | "rejected";
  terminal: boolean;
};

function mapState(value: string): MappedState {
  const state = value.toLowerCase().replace(/[-\s]/g, "_");
  if (["bridged", "answered", "active", "connected"].includes(state))
    return {
      status: "active",
      eventType: "answered",
      attemptStatus: "answered",
      terminal: false,
    };
  if (["completed", "ended", "finished", "hangup", "hang_up"].includes(state))
    return {
      status: "ended",
      eventType: "ended",
      attemptStatus: "answered",
      terminal: true,
    };
  if (
    [
      "notanswered",
      "no_answer",
      "missed",
      "timeout",
      "expired",
      "noanswer",
    ].includes(state)
  )
    return {
      status: "missed",
      eventType: "missed",
      attemptStatus: "no_answer",
      terminal: true,
    };
  if (["busy"].includes(state))
    return {
      status: "busy",
      eventType: "busy",
      attemptStatus: "busy",
      terminal: true,
    };
  if (["rejected", "declined"].includes(state))
    return {
      status: "failed",
      eventType: "failed",
      attemptStatus: "rejected",
      terminal: true,
    };
  if (["failed", "error", "aborted"].includes(state))
    return {
      status: "failed",
      eventType: "failed",
      attemptStatus: "failed",
      terminal: true,
    };
  return {
    status: "ringing",
    eventType: "ringing",
    attemptStatus: "ringing",
    terminal: false,
  };
}

function isoOrNull(value: string): string | null {
  if (!value || value.toLowerCase() === "none") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function numericValue(value: string): number | null {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const parsed = Number(raw.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function providerDestination(payload: Record<string, unknown>): string {
  const raw = pick(
    payload,
    "clientDialedNumber",
    "phoneNumber",
    "dialedNumber",
    "calledNumber",
    "destinationNumber",
    "destination",
    "to",
  );
  return normalizeVoiceDestination(raw);
}

export async function POST(request: Request): Promise<Response> {
  if (!callbackSecretIsValid(request))
    return NextResponse.json(
      { ok: false, error: "Forbidden" },
      { status: 403 },
    );

  const actionRequest = request.clone();
  const { rawBody, payload } = await readAfricaRequest(request);
  const rawCaller = pick(payload, "callerNumber", "caller", "from");
  const caller = browserCallerIdentity(rawCaller) ? "" : normalizePhone(rawCaller);
  const destination = normalizePhone(
    pick(payload, "destinationNumber", "destination", "to"),
  );
  const sessionId = pick(
    payload,
    "sessionId",
    "callSessionId",
    "call_sid",
    "call_id",
    "id",
  );
  const campaignRequestId = campaignCallId(pick(payload, "clientRequestId", "client_request_id"));
  // Outbound campaign webhooks usually identify the dialed customer as
  // destinationNumber, not the MartPoint virtual number. Resolve the tenant
  // through the campaign recipient before falling back to number mapping.
  const { data: campaignEventCall } = campaignRequestId && isSupabaseConfigured()
    ? await supabase.from("azera_calls")
      .select("id,business_id,status,answered_at,last_provider_event_at,recording_choice,recording_consent_at,agent_user_id,campaign_recipient_id")
      .eq("campaign_recipient_id", campaignRequestId).maybeSingle()
    : { data: null };
  // Some AT number configurations deliver GetDigits results to Events.
  // For a still-ringing native incoming call this is a voice action needing
  // XML, not just a status notification to acknowledge with JSON.
  const digits = pick(payload, "dtmfDigits", "digits", "userInput", "input");
  const actionState = pick(payload, "callSessionState", "status").toLowerCase();
  // A browser agent can request a blind transfer by creating a short-lived
  // control row and sending one reserved DTMF control digit. Africa's Talking
  // then asks the Events URL for the next XML action. This keeps target
  // identities server-side; the browser never receives a SIP password.
  if (digits && sessionId && isSupabaseConfigured() &&
      !["0", "false"].includes(String(payload.isActive).toLowerCase()) &&
      ["active", "answered", "connected", "bridged"].includes(actionState)) {
    const { data: activeCall } = await supabase.from("azera_calls")
      .select("id,business_id,status,agent_user_id,sip_call_sid")
      .eq("sip_call_sid", sessionId).eq("sip_provider", "africas_talking")
      .eq("direction", "inbound").eq("status", "active").maybeSingle();
    if (activeCall) {
      const { data: control } = await supabase.from("azera_call_control_requests")
        .select("id,mode,target_destination,target_queue,target_user_id")
        .eq("call_id", activeCall.id).eq("status", "pending")
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (control && (String(digits).includes("*") || String(digits).includes("#"))) {
        await supabase.from("azera_call_control_requests").update({ status: "executing", consumed_at: new Date().toISOString() }).eq("id", control.id).eq("status", "pending");
        await supabase.from("azera_call_events").insert({ call_id: activeCall.id, event_type: control.mode === "transfer" ? "transfer_started" : "conference_requested", actor_type: "system", metadata: { control_request_id: control.id, target_destination: control.target_destination, provider: "africas_talking" } });
        if (control.mode === "transfer") {
          const { data: targetUser } = control.target_user_id
            ? await supabase.from("users").select("name").eq("id", control.target_user_id).maybeSingle()
            : { data: null };
          const reassignment: Record<string, unknown> = { agent_user_id: control.target_user_id, agent_name: targetUser?.name || null, updated_at: new Date().toISOString() };
          if (control.target_queue) reassignment.selected_department = control.target_queue;
          await supabase.from("azera_calls").update(reassignment).eq("id", activeCall.id).eq("status", "active");
          return voiceXml([`<Dial phoneNumbers="${xmlEscape(control.target_destination)}" sequential="true"/>`]);
        }
        // AT exposes Conference as an Events/Voice XML action. The exact
        // conference-room/participant semantics must be enabled and verified
        // on the tenant's AT account before we expose it as a production join.
        // Do not silently drop the live call if that account capability is not
        // present; leave a provider-visible prompt and record the request.
        await supabase.from("azera_call_control_requests").update({ status: "failed", error_message: "Conference requires tenant-level Africa's Talking conference configuration and live verification." }).eq("id", control.id);
        return voiceXml(["<Say>Conference joining is not enabled for this number. Please use transfer or stay on the call.</Say>"]);
      }
    }
  }
  if (digits && sessionId && !browserCallerIdentity(rawCaller) && isSupabaseConfigured() &&
      !["0", "false"].includes(String(payload.isActive).toLowerCase()) &&
      ["", "ringing", "active", "answered", "connected", "bridged"].includes(actionState)) {
    const { data: pending, error } = await supabase.from("azera_calls").select("id")
      .eq("sip_call_sid", sessionId).eq("sip_provider", "africas_talking")
      .eq("direction", "inbound").eq("status", "ringing").limit(1).maybeSingle();
    if (error) return NextResponse.json({ ok: false }, { status: 503 });
    if (pending) {
      const { POST: handleVoiceAction } = await import("@/app/api/africastalking/voice/callback/route");
      return handleVoiceAction(actionRequest);
    }
  }
  let prepared = null;
  if (browserCallerIdentity(rawCaller)) {
    try {
      prepared = await preparedAfricaOutbound(rawCaller, normalizeOutboundPhone(pick(payload, "clientDialedNumber")) || "", sessionId);
      // Never fabricate an inbound call for an unrecognised browser identity.
      if (!prepared) return NextResponse.json({ ok: true, ignored: true });
    } catch { return NextResponse.json({ ok: false }, { status: 503 }); }
  }
  const businessId = prepared?.business_id || campaignEventCall?.business_id || await resolveAfricaBusinessId(destination);
  const webhookEventId = await storeAfricaWebhookEvent({
    product: "voice",
    endpoint: "voice/events",
    request,
    rawBody,
    payload,
    businessId,
  });

  try {
    if (!sessionId || !businessId || !isSupabaseConfigured()) {
      await finishAfricaWebhookEvent(
        webhookEventId,
        sessionId ? "processed" : "failed",
        sessionId ? undefined : "Missing Africa's Talking sessionId",
      );
      return NextResponse.json({ ok: true });
    }

    const inactive = ["0", "false"].includes(String(payload.isActive).toLowerCase());
    const providerState = pick(
      payload,
      "callSessionState",
      "status",
      "call_status",
      "event",
    );
    let mapped = mapState(providerState);
    // Keep an explicit Busy/Failed/NoAnswer outcome, but a final notification
    // without a terminal state must never leave the parent call ringing.
    if (inactive && !mapped.terminal) mapped = mapState("completed");
    const now = new Date().toISOString();
    const providerEventAt = isoOrNull(
      pick(payload, "eventTime", "timestamp", "callStopTime", "callStartTime"),
    );
    const duration = numericValue(
      pick(payload, "durationInSeconds", "duration", "duration_seconds"),
    );
    const cost = numericValue(
      pick(payload, "cost", "costAmount", "amount", "price"),
    );
    const currency =
      pick(payload, "currency", "currencyCode", "costCurrency") || null;
    const dialedDestination = providerDestination(payload);
    const startedAt = isoOrNull(pick(payload, "callStartTime", "started_at"));
    const endedAt = isoOrNull(pick(payload, "callStopTime", "ended_at"));

    let { data: call } = await supabase
      .from("azera_calls")
      .select(
        "id, business_id, status, answered_at, last_provider_event_at, recording_choice, recording_consent_at, agent_user_id, campaign_recipient_id",
      )
      .eq("business_id", businessId)
      .eq("sip_call_sid", sessionId)
      .maybeSingle();
    if (!call && campaignEventCall) call = campaignEventCall;
    if (!call && campaignRequestId) {
      const { data: recipient } = await supabase.from("azera_call_campaign_recipients")
        .select("call_id").eq("id", campaignRequestId).maybeSingle();
      if (recipient?.call_id) {
        const { data: campaignCall } = await supabase.from("azera_calls")
          .select("id,business_id,status,answered_at,last_provider_event_at,recording_choice,recording_consent_at,agent_user_id,campaign_recipient_id")
          .eq("id", recipient.call_id).maybeSingle();
        call = campaignCall;
      }
    }
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
          answered_at:
            mapped.status === "active" ? providerEventAt || now : null,
          ended_at: mapped.terminal ? endedAt || now : null,
          duration_seconds: duration || 0,
          provider_cost_amount: cost,
          provider_cost_currency: currency,
          last_provider_event_at: providerEventAt,
          final_outcome: mapped.terminal ? mapped.status : null,
          created_at: now,
          updated_at: now,
        })
        .select(
          "id, business_id, status, answered_at, last_provider_event_at, recording_choice, recording_consent_at, agent_user_id, campaign_recipient_id",
        )
        .single();
      if (error || !created)
        throw new Error(error?.message || "Could not create callback call");
      call = created;
    }

    const stale = Boolean(
      providerEventAt &&
      call.last_provider_event_at &&
      providerEventAt <= call.last_provider_event_at,
    );
    const terminalToRinging =
      !mapped.terminal &&
      (["ended", "missed", "failed", "busy"].includes(call.status) || (call.status === "active" && mapped.status === "ringing"));
    if (!stale && !terminalToRinging) {
      const { data: pendingAttempts } = await supabase
        .from("azera_call_attempts")
        .select("id, status")
        .eq("call_id", call.id)
        .in("status", ["queued", "dialing", "ringing"]);
      const { data: answeredAttempts } = await supabase
        .from("azera_call_attempts")
        .select("id")
        .eq("call_id", call.id)
        .eq("status", "answered")
        .limit(1);
      const attemptQuery = supabase
        .from("azera_call_attempts")
        .select("id, status")
        .eq("call_id", call.id)
        .order("attempt_number", { ascending: true })
        .limit(1);
      const { data: attempt } = dialedDestination
        ? await attemptQuery.eq("destination", dialedDestination).maybeSingle()
        : await attemptQuery.in("status", ["dialing", "ringing"]).maybeSingle();

      if (attempt) {
        const attemptUpdates: Record<string, unknown> = {
          provider_state: providerState || null,
          error_message:
            pick(payload, "errorMessage", "error", "reason") || null,
          duration_seconds: duration,
        };
        if (mapped.status === "active") {
          attemptUpdates.status = "answered";
          attemptUpdates.answered_at = providerEventAt || now;
        } else if (
          mapped.terminal &&
          call.status !== "active" &&
          !answeredAttempts?.length
        ) {
          attemptUpdates.status = mapped.attemptStatus;
        }
        if (mapped.terminal) attemptUpdates.ended_at = endedAt || now;
        await supabase
          .from("azera_call_attempts")
          .update(attemptUpdates)
          .eq("id", attempt.id);
      }

      const stillPending = (pendingAttempts || []).some(
        (item) =>
          item.id !== attempt?.id &&
          ["queued", "dialing", "ringing"].includes(item.status),
      );
      const hasAnswered =
        Boolean(answeredAttempts?.length) || mapped.status === "active";
      const nextStatus =
        mapped.status === "active"
          ? "active"
          : mapped.status === "ended"
            ? hasAnswered || call.answered_at ? "ended" : "missed"
            : mapped.terminal && !stillPending && !hasAnswered
              ? mapped.status
              : call.status;
      const updates: Record<string, unknown> = {
        status: nextStatus,
        updated_at: now,
      };
      // If the reserved browser was not answered and a configured fallback
      // connects instead, don't attribute that telephone conversation to it.
      if (mapped.status === "active" && call.agent_user_id && attempt && dialedDestination &&
          !/^[a-zA-Z0-9_-]+\.mp_agent_[a-zA-Z0-9_-]+$/.test(dialedDestination)) {
        updates.agent_user_id = null;
        updates.agent_name = null;
      }
      if (startedAt) updates.started_at = startedAt;
      if (mapped.status === "active" && !call.answered_at)
        updates.answered_at = providerEventAt || now;
      if (
        mapped.status === "ended" ||
        (mapped.terminal && !stillPending && !hasAnswered)
      ) {
        updates.ended_at = endedAt || now;
        updates.duration_seconds = duration || 0;
        updates.final_outcome =
          hasAnswered && mapped.status !== "ended" ? "answered" : nextStatus;
      }
      if (cost !== null) {
        updates.provider_cost_amount = cost;
        updates.sip_cost_cents = Math.round(cost * 100);
      }
      if (currency) updates.provider_cost_currency = currency;
      if (providerEventAt) updates.last_provider_event_at = providerEventAt;
      const { error } = await supabase
        .from("azera_calls")
        .update(updates)
        .eq("id", call.id);
      if (error) throw new Error(error.message);

      // Completed is the aggregate end of the sequential Dial action: any
      // destinations still queued were never needed and must not hold history
      // open forever. Per-destination busy/no-answer events keep those rows
      // queued while the provider advances to the next fallback.
      if (mapped.status === "ended") {
        await supabase.from("azera_call_attempts").update({ status: hasAnswered ? "failed" : "no_answer", ended_at: endedAt || now, provider_state: providerState || null })
          .eq("call_id", call.id).eq("status", "queued");
      }
    }

    if (!stale && call.campaign_recipient_id) {
      const { data: recipient } = await supabase.from("azera_call_campaign_recipients")
        .select("id,campaign_id,status,response_digit").eq("id", call.campaign_recipient_id).maybeSingle();
      if (recipient && mapped.status === "active" && !recipient.response_digit && recipient.status === "dialing") {
        await supabase.from("azera_call_campaign_recipients").update({ status: "answered", answered_at: providerEventAt || now, updated_at: now }).eq("id", recipient.id).eq("status", "dialing");
      }
      if (recipient && mapped.terminal) {
        if (!recipient.response_digit && ["dialing", "answered"].includes(recipient.status)) {
          const noAnswer = mapped.status === "missed" || mapped.status === "busy";
          await supabase.from("azera_call_campaign_recipients").update({
            status: noAnswer ? "no_response" : "no_response",
            response_label: noAnswer ? "No answer" : "Call ended without a keypad response",
            notes: noAnswer ? "The contact did not answer the automated campaign call." : "The call connected but ended before a keypad response was received.",
            completed_at: endedAt || now,
            updated_at: now,
          }).eq("id", recipient.id).in("status", ["dialing", "answered"]).is("response_digit", null);
        }
        await finishAzeraCampaignIfDone(recipient.campaign_id);
      }
    }

    await supabase.from("azera_call_events").insert({
      call_id: call.id,
      event_type: mapped.eventType,
      actor_type: "sip_provider",
      metadata: {
        provider: "africas_talking",
        provider_state: providerState,
        dialed_destination: dialedDestination || null,
        cost,
        currency,
        stale,
        callback_event_id: webhookEventId,
      },
      created_at: now,
    });
    // Persist carrier state first. A failed/private-host recording download
    // must not leave a finished call ringing or keep an agent falsely busy.
    // Still return a retryable error so the recording is not silently lost.
    const recordingUrl = pick(payload, "recordingUrl", "recording_url");
    if (recordingUrl && call.recording_choice === "accepted") {
      const config = await getAfricaVoiceConfig(businessId);
      await importAfricaCallRecording(
        call,
        recordingUrl,
        pick(payload, "recordingId", "recording_id") || sessionId,
        config.recordingRetentionDays,
      );
    }
    await finishAfricaWebhookEvent(webhookEventId, "processed");
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Africa's Talking voice events error]", error);
    await finishAfricaWebhookEvent(
      webhookEventId,
      "failed",
      error instanceof Error ? error.message : "Voice event processing failed",
    );
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
