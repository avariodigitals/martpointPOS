import { supabase } from "@/lib/supabase";
import { africaBrowserConfig } from "@/lib/africa-browser-voice";

export function africaDepartmentQueue(key: string) {
  if (/sales|demo/i.test(key)) return "sales";
  if (/onboard|billing/i.test(key)) return "onboarding";
  if (/tech|support/i.test(key)) return "support";
  return "customer_support";
}

/** The provider documents username.clientName as the Dial destination. */
export async function africaBrowserDestination(callId: string, businessId: string, department: string) {
  try {
    const config = await africaBrowserConfig(businessId);
    if (!/^[a-zA-Z0-9_-]+$/.test(config.username)) return null;
    const { data, error } = await supabase.rpc("azera_route_africa_browser", {
      p_call: callId, p_queue: africaDepartmentQueue(department),
    });
    // Old databases keep their existing phone/SIP fallback until migration 137.
    if (error || typeof data !== "string" || !/^[a-zA-Z0-9_-]+$/.test(data)) return null;
    return `${config.username}.${data}`;
  } catch {
    // Missing/unavailable registration storage must preserve existing routing.
    return null;
  }
}

export function browserCallerIdentity(caller: string) {
  return /^[a-zA-Z0-9_-]+\.mp_[a-zA-Z0-9_-]+$/.test(caller);
}

/** Bind provider callbacks only to a server-prepared outgoing call. Never let
 * a callback's arbitrary clientDialedNumber turn the endpoint into a dial proxy. */
export async function preparedAfricaOutbound(caller: string, dialled: string, sessionId: string) {
  if (!browserCallerIdentity(caller) || !/^[a-zA-Z0-9_-]{1,200}$/.test(sessionId)) return null;
  const clientName = caller.slice(caller.indexOf(".") + 1);
  const { data: call, error } = await supabase.from("azera_calls")
    .select("id,business_id,sip_to_number,sip_from_number,sip_call_sid,status,created_at")
    .eq("webrtc_room", clientName).eq("sip_provider", "africas_talking_browser")
    .eq("direction", "outbound").maybeSingle();
  if (error || !call || (call.sip_call_sid && call.sip_call_sid !== sessionId)) return null;
  const config = await africaBrowserConfig(call.business_id);
  if (caller !== `${config.username}.${clientName}` ||
      (dialled !== call.sip_to_number && !(dialled === "" && call.sip_call_sid === sessionId))) return null;
  if (!call.sip_call_sid && (call.status !== "ringing" || Date.parse(call.created_at) < Date.now()-120_000)) return null;
  const { data, error: saveError } = await supabase.from("azera_calls")
    .update({ sip_call_sid: sessionId, updated_at: new Date().toISOString() })
    .eq("id", call.id).eq("status", call.status)
    .or(`sip_call_sid.is.null,sip_call_sid.eq.${sessionId}`)
    .select("id").maybeSingle();
  if (saveError || !data) throw new Error("Could not bind the provider call session");
  return call;
}
