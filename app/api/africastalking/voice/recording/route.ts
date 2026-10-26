import { NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { importAfricaCallRecording } from "@/lib/africa-call-recording";
import { notifyAllAdmins } from "@/lib/admin-notifications";
import {
  callbackSecretIsValid,
  finishAfricaWebhookEvent,
  getAfricaVoiceConfig,
  normalizePhone,
  pick,
  readAfricaRequest,
  resolveAfricaBusinessId,
  storeAfricaWebhookEvent,
} from "@/lib/africastalking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_RECORDING_BYTES = 25 * 1024 * 1024;

function safeExtension(contentType: string, url: string): string {
  if (contentType.includes("wav")) return "wav";
  if (contentType.includes("mpeg") || contentType.includes("mp3")) return "mp3";
  return url.toLowerCase().includes(".wav") ? "wav" : "mp3";
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
  const recordingUrl = pick(payload, "recordingUrl", "recording_url", "url");
  const recordingReference = pick(
    payload,
    "recordingId",
    "recording_id",
    "reference",
  );
  let businessId = await resolveAfricaBusinessId(destination);
  const webhookEventId = await storeAfricaWebhookEvent({
    product: "voice",
    endpoint: "voice/recording",
    request,
    rawBody,
    payload,
    businessId,
  });

  try {
    if (!isSupabaseConfigured() || !sessionId) {
      await finishAfricaWebhookEvent(
        webhookEventId,
        sessionId ? "processed" : "failed",
        sessionId ? undefined : "Missing Africa's Talking sessionId",
      );
      return NextResponse.json({ ok: true });
    }

    const { data: call } = await supabase
      .from("azera_calls")
      .select(
        "id, business_id, selected_department, customer_phone, recording_choice, recording_consent_at",
      )
      .eq("sip_call_sid", sessionId)
      .maybeSingle();
    if (!call) throw new Error("Parent call not found for recording callback");
    businessId = String(call.business_id);

    const config = await getAfricaVoiceConfig(businessId);
    const kind = new URL(request.url).searchParams.get("kind");
    if (
      kind === "call" ||
      (kind !== "voicemail" && call.recording_choice === "accepted")
    ) {
      await importAfricaCallRecording(
        call,
        recordingUrl,
        recordingReference || sessionId,
        config.recordingRetentionDays,
      );
      await finishAfricaWebhookEvent(webhookEventId, "processed");
      return NextResponse.json({ ok: true });
    }
    const duration =
      Number(
        pick(payload, "durationInSeconds", "duration", "duration_seconds"),
      ) || null;
    const retentionExpiresAt = new Date(
      Date.now() + config.voicemailRetentionDays * 24 * 60 * 60 * 1000,
    ).toISOString();
    const reference = recordingReference || sessionId;
    const { data: existingVoicemail } = await supabase
      .from("azera_voicemails")
      .select("id")
      .eq("call_id", call.id)
      .eq("recording_reference", reference)
      .maybeSingle();
    if (existingVoicemail) {
      await finishAfricaWebhookEvent(webhookEventId, "processed");
      return NextResponse.json({ ok: true });
    }
    let recordingPath: string | null = null;
    let storedRecordingUrl: string | null = recordingUrl || null;

    // Copy provider audio into a private bucket when the provider gives us a
    // downloadable HTTPS URL. If the provider URL is temporary or unavailable,
    // retain the reference rather than exposing a public URL.
    if (recordingUrl && /^https:\/\//i.test(recordingUrl)) {
      const url = new URL(recordingUrl);
      const allowed = (
        process.env.AFRICASTALKING_RECORDING_HOSTS || "africastalking.com"
      )
        .split(",")
        .map((host) => host.trim().toLowerCase())
        .filter(Boolean);
      if (
        !allowed.some(
          (host) => url.hostname === host || url.hostname.endsWith(`.${host}`),
        )
      )
        throw new Error(
          "Configure the provider recording host before importing this audio",
        );
      const response = await fetch(recordingUrl, {
        redirect: "error",
        signal: AbortSignal.timeout(10000),
      });
      const contentType = response.headers.get("content-type") || "";
      const contentLength = Number(response.headers.get("content-length") || 0);
      if (
        response.ok &&
        (contentType.includes("audio") ||
          /\.(wav|mp3)(?:\?|$)/i.test(recordingUrl)) &&
        contentLength <= MAX_RECORDING_BYTES
      ) {
        const reader = response.body?.getReader();
        const chunks: Uint8Array[] = [];
        let total = 0;
        if (!reader) throw new Error("Recording audio was empty");
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          total += value.byteLength;
          if (total > MAX_RECORDING_BYTES) {
            await reader.cancel();
            throw new Error("Recording exceeds import limit");
          }
          chunks.push(value);
        }
        const bytes = Buffer.concat(chunks);
        if (bytes.byteLength <= MAX_RECORDING_BYTES) {
          const extension = safeExtension(contentType, recordingUrl);
          recordingPath = `${businessId}/${call.id}/${crypto.randomUUID()}.${extension}`;
          const { error: uploadError } = await supabase.storage
            .from("azera-voicemails")
            .upload(recordingPath, bytes, {
              contentType:
                contentType || `audio/${extension === "wav" ? "wav" : "mpeg"}`,
              upsert: false,
            });
          if (!uploadError) storedRecordingUrl = null;
        }
      }
    }

    const { error } = await supabase.from("azera_voicemails").insert({
      call_id: call.id,
      business_id: businessId,
      department_key: call.selected_department || null,
      caller_phone: caller || call.customer_phone || null,
      recording_url: storedRecordingUrl,
      recording_reference: reference,
      recording_path: recordingPath,
      duration_seconds: duration,
      retention_expires_at: retentionExpiresAt,
    });
    if (error) throw new Error(error.message);

    await supabase
      .from("azera_calls")
      .update({
        final_outcome: "voicemail",
        updated_at: new Date().toISOString(),
      })
      .eq("id", call.id);
    await supabase.from("azera_call_events").insert({
      call_id: call.id,
      event_type: "sip_webhook",
      actor_type: "sip_provider",
      metadata: {
        provider: "africas_talking",
        kind: "voicemail",
        callback_event_id: webhookEventId,
        recording_reference: reference,
      },
      created_at: new Date().toISOString(),
    });
    await notifyAllAdmins({
      type: "azera_voicemail",
      title: "New Azera voicemail",
      message: `${call.selected_department || "General enquiries"} · ${caller || call.customer_phone || "Unknown caller"}`,
      deep_link: "/admin/azera/voicemails",
      source_type: "azera_voicemail",
      source_id: call.id,
      roles: ["Admin", "Sales", "Customer Care", "Tech"],
      actor_admin_user_id: null,
    });

    await finishAfricaWebhookEvent(webhookEventId, "processed");
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Africa's Talking voice recording error]", error);
    await finishAfricaWebhookEvent(
      webhookEventId,
      "failed",
      error instanceof Error
        ? error.message
        : "Voice recording processing failed",
    );
    return NextResponse.json(
      {
        ok: false,
        error: "Could not import recording. Please retry the callback.",
      },
      { status: 503 },
    );
  }
}
