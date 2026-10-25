import { NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { importAfricaCallRecording } from "@/lib/africa-call-recording";
import { getAfricaVoiceConfig } from "@/lib/africastalking";
import {
  callbackSecretIsValid,
  finishAfricaWebhookEvent,
  normalizePhone,
  normalizeVoiceDestination,
  pick,
  readAfricaRequest,
  resolveAfricaBusinessId,
  storeAfricaWebhookEvent,
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
    "phoneNumber",
    "dialedNumber",
    "calledNumber",
    "destinationNumber",
    "destination",
    "to",
  );
  return raw.includes("@") || raw.toLowerCase().startsWith("sip:")
    ? normalizeVoiceDestination(raw)
    : normalizePhone(raw);
}

export async function POST(request: Request) {
  if (!callbackSecretIsValid(request))
    return NextResponse.json(
      { ok: false, error: "Forbidden" },
      { status: 403 },
    );

  const { rawBody, payload } = await readAfricaRequest(request);
  const caller = normalizePhone(
    pick(payload, "callerNumber", "caller", "from"),
  );
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
  const businessId = await resolveAfricaBusinessId(destination);
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

    const providerState = pick(
      payload,
      "callSessionState",
      "status",
      "call_status",
      "event",
    );
    const mapped = mapState(providerState);
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
        "id, business_id, status, answered_at, last_provider_event_at, recording_choice, recording_consent_at",
      )
      .eq("business_id", businessId)
      .eq("sip_call_sid", sessionId)
      .maybeSingle();
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
          "id, business_id, status, answered_at, last_provider_event_at, recording_choice, recording_consent_at",
        )
        .single();
      if (error || !created)
        throw new Error(error?.message || "Could not create callback call");
      call = created;
    }

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

    const stale = Boolean(
      providerEventAt &&
      call.last_provider_event_at &&
      providerEventAt <= call.last_provider_event_at,
    );
    const terminalToRinging =
      !mapped.terminal &&
      ["ended", "missed", "failed", "busy"].includes(call.status);
    if (!stale && !terminalToRinging) {
      const { data: pendingAttempts } = await supabase
        .from("azera_call_attempts")
        .select("id, status")
        .eq("call_id", call.id)
        .in("status", ["dialing", "ringing"]);
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
          ["dialing", "ringing"].includes(item.status),
      );
      const hasAnswered =
        Boolean(answeredAttempts?.length) || mapped.status === "active";
      const nextStatus =
        mapped.status === "active"
          ? "active"
          : mapped.status === "ended"
            ? "ended"
            : mapped.terminal && !stillPending && !hasAnswered
              ? mapped.status
              : call.status;
      const updates: Record<string, unknown> = {
        status: nextStatus,
        updated_at: now,
      };
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
          hasAnswered && mapped.status !== "ended" ? "answered" : mapped.status;
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
