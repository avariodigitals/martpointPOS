import { LiveKitAPI } from "livekit-server-sdk";
import type { LiveKitSettings } from "@/lib/integrations";
import { supabase } from "@/lib/supabase";
import { selfHostedMediaAllowed } from "@/lib/azera-media";

export function outboundReady(settings: LiveKitSettings) {
  const host = settings.sipHostname?.toLowerCase().split(":")[0];
  const approvedTrunk =
    host === "africastalking.com" ||
    host?.endsWith(".africastalking.com") ||
    (process.env.AZERA_AT_SIP_HOSTS || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
      .includes(host);
  return (
    selfHostedMediaAllowed(settings) &&
    process.env.AZERA_AT_SIP_TRUNK_VERIFIED === "true" &&
    approvedTrunk &&
    [
      settings.serverUrl,
      settings.publicUrl,
      settings.apiKey,
      settings.apiSecret,
      settings.sipHostname,
      settings.sipUsername,
      settings.sipPassword,
      settings.sipNumber,
    ].every((value) => Boolean(value?.trim()))
  );
}

export { normalizeDialNumber as normalizeOutboundPhone } from "@/lib/browser-phone-target";

export function voiceApi(settings: LiveKitSettings) {
  if (!selfHostedMediaAllowed(settings))
    throw new Error(
      "Only the approved self-hosted media server is allowed. LiveKit Cloud is disabled.",
    );
  return new LiveKitAPI({
    host: settings.serverUrl,
    apiKey: settings.apiKey,
    secret: settings.apiSecret,
    failover: false,
    requestTimeout: 20,
  });
}

export interface OutboundCallRecord {
  id: string;
  status: string;
  answered_at: string | null;
}

export async function deleteVoiceRoom(api: LiveKitAPI, room: string) {
  try {
    await api.room.deleteRoom(room);
  } catch (error) {
    if (!(
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "not_found"
    ))
      throw error;
  }
}

export async function finishOutbound(
  call: OutboundCallRecord,
  status: "active" | "ended" | "failed" | "missed",
  actorId: string,
) {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("azera_calls")
    .update({
      status,
      updated_at: now,
      ...(status === "active"
        ? { answered_at: now }
        : {
            ended_at: now,
            duration_seconds: call.answered_at
              ? Math.max(
                  0,
                  Math.floor(
                    (Date.now() - Date.parse(call.answered_at)) / 1000,
                  ),
                )
              : 0,
          }),
    })
    .eq("id", call.id)
    .eq("status", call.status)
    .select("status")
    .maybeSingle();
  if (error) throw new Error("Could not update call history");
  if (data)
    await supabase
      .from("azera_call_events")
      .insert({
        call_id: call.id,
        event_type: status === "active" ? "answered" : status,
        actor_type: "agent",
        actor_id: actorId,
        metadata: { status, provider: "livekit" },
        created_at: now,
      });
  return data?.status || call.status;
}
