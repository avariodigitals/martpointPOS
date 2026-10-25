import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getCallAccess } from "@/lib/azera-call-access";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { audioSdp, cloudflareIceServers, cloudflareSfuEnabled, sfuRequest } from "@/lib/cloudflare-rtc";
import { endCloudflareCall } from "@/lib/azera-cloudflare-cleanup";
export const maxDuration = 60;
const headers = { "Cache-Control": "no-store" };
const ok = (data: object) => NextResponse.json({ success: true, ...data }, { headers });
const err = (error: string, status = 503) => NextResponse.json({ success: false, error }, { status, headers });
type Context = { params: Promise<{ id: string }> };
async function accessFor(request: Request, context: Context) {
  if (!isSupabaseConfigured()) return null;
  return getCallAccess(request, (await context.params).id);
}
function allowed(access: NonNullable<Awaited<ReturnType<typeof accessFor>>>) {
  return access.actor.type === "customer" || access.call.agent_user_id === access.actor.id;
}
export async function GET(request: Request, context: Context) {
  const access = await accessFor(request, context);
  if (!access) return err("Call authorization required", 401);
  if (access.call.sip_provider !== "cloudflare_sfu") return ok({ transport: "peer" });
  // Staff can identify a ringing call's transport before claiming it, but
  // cannot discover or receive audio until they own the atomic call claim.
  if (!allowed(access)) return ok({ transport: "cloudflare", status: access.call.status, ready: false });
  const rows = await supabase.from("azera_cloudflare_participants").select("participant,published,connected").eq("call_id", access.call.id).is("closed_at", null);
  if (rows.error) return err("Audio setup is unavailable. Verify migration 136.");
  const heartbeat = await supabase.from("azera_cloudflare_participants").update({ last_seen_at: new Date().toISOString() }).eq("call_id", access.call.id).eq("participant", access.actor.type).is("closed_at", null);
  if (heartbeat.error) return err("Could not refresh the audio connection");
  return ok({ transport: "cloudflare", status: access.call.status, ready: rows.data?.some((row) => row.participant !== access.actor.type && row.published) || false });
}
export async function POST(request: Request, context: Context) {
  const access = await accessFor(request, context);
  if (!access) return err("Call authorization required", 401);
  const { call, actor } = access;
  if (call.sip_provider !== "cloudflare_sfu") return err("This call uses a different audio connection", 409);
  let claim: string | null = null;
  try {
    const raw = await request.text();
    if (raw.length > 70_000) return err("Audio request too large", 413);
    const body = JSON.parse(raw);
    if (body.action === "accept") {
      if (actor.type !== "agent") return err("Only a team member can answer", 403);
      const result = await supabase.rpc("azera_claim_browser_call", { p_call_id: call.id, p_agent_id: actor.id });
      if (result.error || !result.data) return err("This call or agent is busy, offline or in another queue", 409);
      return ok({ accepted: true });
    }
    if (!allowed(access)) {
      if (body.action !== "end" || body.outcome !== "busy" || actor.type !== "agent" || call.agent_user_id) return err("Another team member is handling this call", 403);
      const result = await supabase.rpc("azera_claim_browser_call", { p_call_id: call.id, p_agent_id: actor.id });
      if (result.error || !result.data) return err("This call cannot be declined by this agent", 409);
    }
    if (body.action === "end") {
      await endCloudflareCall(call.id, ["failed", "missed", "busy"].includes(body.outcome) ? body.outcome : "ended");
      return ok({ ended: true });
    }
    if (!["ringing", "active"].includes(call.status) || Date.parse(call.created_at) < Date.now() - 1800_000) return err("This call has ended or expired", 409);
    if (!cloudflareSfuEnabled()) return err("Cloudflare website audio is not enabled", 409);
    if (!["config", "publish", "published", "subscribe", "answer", "connected"].includes(body.action)) return err("Invalid audio action", 400);
    if (body.action === "publish" && (!audioSdp(body.sessionDescription, "offer") || typeof body.mid !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(body.mid))) return err("Invalid microphone connection", 400);
    if (body.action === "answer" && !audioSdp(body.sessionDescription, "answer")) return err("Invalid audio answer", 400);
    const inserted = await supabase.from("azera_cloudflare_participants").upsert({ call_id: call.id, participant: actor.type, actor_user_id: actor.type === "agent" ? actor.id : null }, { onConflict: "call_id,participant", ignoreDuplicates: true });
    if (inserted.error) return err("Could not reserve audio setup. Verify migration 136.");
    claim = randomUUID();
    const reserved = await supabase.from("azera_cloudflare_participants").update({ operation_claim: claim, operation_claimed_at: new Date().toISOString(), last_seen_at: new Date().toISOString() }).eq("call_id", call.id).eq("participant", actor.type).is("operation_claim", null).is("closed_at", null).select("*").maybeSingle();
    if (reserved.error || !reserved.data) return err("Audio setup is already in progress. End this call and reconnect.", 409);
    const own = reserved.data;
    // Recheck after obtaining the participant lock, so an End call operation
    // cannot race a new publication or subscription on a different instance.
    const fresh = await supabase.from("azera_calls").select("status,media_control_claim,agent_user_id").eq("id", call.id).maybeSingle();
    if (fresh.error || !fresh.data || !["ringing", "active"].includes(fresh.data.status) || fresh.data.media_control_claim || (actor.type === "agent" && fresh.data.agent_user_id !== actor.id)) return err("This call changed. Please reconnect.", 409);
    const save = async (fields: object) => {
      const result = await supabase.from("azera_cloudflare_participants").update(fields).eq("call_id", call.id).eq("participant", actor.type).eq("operation_claim", claim);
      if (result.error) throw new Error("Could not save audio setup");
    };
    if (body.action === "config") {
      const iceServers = own.ice_servers || await cloudflareIceServers();
      if (!own.ice_servers) await save({ ice_servers: iceServers });
      return ok({ iceServers, maxSeconds: Math.max(1, 1800 - Math.floor((Date.now() - Date.parse(call.created_at)) / 1000)) });
    }
    if (body.action === "publish") {
      if (own.publisher_session) return err("This microphone is already connected. End the call before reconnecting.", 409);
      const session = await sfuRequest(null, "new");
      if (!session.sessionId) throw new Error("No media session returned");
      await save({ publisher_session: session.sessionId });
      const result = await sfuRequest(session.sessionId, "publish", { sessionDescription: body.sessionDescription, tracks: [{ location: "local", mid: body.mid, trackName: "microphone" }] });
      if (!audioSdp(result.sessionDescription, "answer") || result.tracks?.length !== 1) throw new Error("Invalid audio publication response");
      return ok({ sessionDescription: result.sessionDescription });
    }
    if (body.action === "published") {
      if (!own.publisher_session) return err("The microphone connection is missing", 409);
      await save({ published: true });
      return ok({ published: true });
    }
    if (body.action === "subscribe") {
      if (!own.published || own.subscriber_session) return err("Audio is already connecting or the microphone is not ready", 409);
      const other = await supabase.from("azera_cloudflare_participants").select("publisher_session,published").eq("call_id", call.id).neq("participant", actor.type).is("closed_at", null).maybeSingle();
      if (other.error) throw new Error("Could not inspect the other participant");
      if (!other.data?.published || !other.data.publisher_session) return ok({ waiting: true });
      const session = await sfuRequest(null, "new");
      if (!session.sessionId) throw new Error("No media session returned");
      await save({ subscriber_session: session.sessionId });
      const result = await sfuRequest(session.sessionId, "subscribe", { tracks: [{ location: "remote", sessionId: other.data.publisher_session, trackName: "microphone" }] });
      if (!audioSdp(result.sessionDescription, "offer") || result.tracks?.length !== 1) throw new Error("Invalid audio reception response");
      return ok({ sessionDescription: result.sessionDescription });
    }
    if (body.action === "answer") {
      if (!own.subscriber_session || own.subscribed) return err("Audio negotiation is no longer available", 409);
      await sfuRequest(own.subscriber_session, "answer", { sessionDescription: body.sessionDescription });
      await save({ subscribed: true });
      return ok({ negotiated: true });
    }
    if (!own.published || !own.subscribed) return err("Audio negotiation is incomplete", 409);
    await save({ connected: true });
    if (actor.type === "agent") {
      const result = await supabase.from("azera_calls").update({ status: "active", answered_at: call.answered_at || new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", call.id).eq("agent_user_id", actor.id).in("status", ["ringing", "active"]);
      if (result.error) throw new Error("Could not confirm the call");
    }
    return ok({ connected: true });
  } catch {
    return err("Audio could not connect. End this call and try again, or continue in chat.");
  } finally {
    if (claim) await supabase.from("azera_cloudflare_participants").update({ operation_claim: null, operation_claimed_at: null }).eq("call_id", call.id).eq("participant", actor.type).eq("operation_claim", claim);
  }
}
