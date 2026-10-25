import { AccessToken, LiveKitAPI } from "livekit-server-sdk";
import { getSettings } from "@/lib/settings";
import type { LiveKitSettings } from "@/lib/integrations";
import { supabase } from "@/lib/supabase";

/** Explicitly opt in to an owned host. Never silently select paid Cloud. */
export function selfHostedMediaAllowed(settings: LiveKitSettings) {
  if (process.env.AZERA_MEDIA_MODE !== "self_hosted") return false;
  const allowed = (process.env.AZERA_MEDIA_HOSTS || "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
  try {
    return (
      [settings.serverUrl, settings.publicUrl].every((value) => {
        const url = new URL(value);
        const local = ["localhost", "127.0.0.1", "[::1]"].includes(
          url.hostname,
        );
        return (
          !url.username &&
          !url.password &&
          !/\.(livekit\.cloud|livekit\.io)$/i.test(url.hostname) &&
          !["livekit.cloud", "livekit.io"].includes(url.hostname) &&
          allowed.includes(url.hostname.toLowerCase()) &&
          (["https:", "wss:"].includes(url.protocol) ||
            (local && ["http:", "ws:"].includes(url.protocol)))
        );
      }) && Boolean(settings.apiKey && settings.apiSecret)
    );
  } catch {
    return false;
  }
}
export async function mediaConfig() {
  const { livekit } = await getSettings();
  if (!selfHostedMediaAllowed(livekit))
    throw new Error(
      "Configure the approved self-hosted media server. Paid LiveKit Cloud is disabled for this workflow.",
    );
  return livekit;
}
export function mediaApi(settings: LiveKitSettings) {
  return new LiveKitAPI({
    host: settings.serverUrl,
    apiKey: settings.apiKey,
    secret: settings.apiSecret,
    failover: false,
    requestTimeout: 15,
  });
}
export async function mediaToken(
  settings: LiveKitSettings,
  room: string,
  identity: string,
  name: string,
  publish: boolean,
) {
  const token = new AccessToken(settings.apiKey, settings.apiSecret, {
    identity,
    name,
    ttl: 120,
  });
  token.addGrant({
    roomJoin: true,
    room,
    canPublish: publish,
    canSubscribe: true,
    canPublishData: false,
    canUpdateOwnMetadata: false,
  });
  return token.toJwt();
}
export async function mediaAudit(
  callId: string,
  actorId: string | null,
  action: string,
  metadata: Record<string, unknown> = {},
) {
  const { error } = await supabase
    .from("azera_call_events")
    .insert({
      call_id: callId,
      actor_type: actorId ? "agent" : "system",
      actor_id: actorId,
      event_type: "sip_webhook",
      metadata: { ...metadata, action, provider: "self_hosted_media" },
    });
  if (error) throw new Error("Could not record the call-control audit");
}
export const whisperRoom = (callId: string, agentId: string) =>
  `azera-private-${callId}-${agentId}`;
