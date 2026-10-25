import { NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { callIceServers, getCallAccess } from "@/lib/azera-call-access";

const err = (error: string, status: number) =>
  NextResponse.json({ success: false, error }, { status });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isSupabaseConfigured())
    return err("Calling is temporarily unavailable.", 503);
  try {
    const { id } = await params;
    const access = await getCallAccess(request, id);
    if (!access)
      return err("Please refresh the page before starting another call.", 401);
    const { call, actor } = access;
    if (["openai_realtime", "livekit", "cloudflare_sfu"].includes(call.sip_provider))
      return err("This call uses a different secure audio connection.", 409);
    if (
      call.call_type !== "webrtc" ||
      !["ringing", "active"].includes(call.status)
    )
      return err("This call has ended.", 409);
    if (
      actor.type === "agent" &&
      call.agent_user_id &&
      call.agent_user_id !== actor.id
    )
      return err("Another team member is handling this call.", 409);
    if (
      actor.type === "agent" &&
      call.direction === "inbound" &&
      !call.agent_user_id
    )
      return err("Please answer this call before connecting audio.", 409);
    const body = await request.json();
    const { sdp_type, sdp, candidate } = body;
    if (!["offer", "answer", "ice"].includes(sdp_type))
      return err("Invalid connection message.", 400);
    const isCaller =
      (call.direction === "inbound") === (actor.type === "customer");
    if (
      (sdp_type === "offer" && !isCaller) ||
      (sdp_type === "answer" && isCaller)
    )
      return err("Invalid call participant.", 403);
    if (
      sdp_type !== "ice" &&
      (typeof sdp !== "string" || !sdp || sdp.length > 65536)
    )
      return err("Invalid connection details.", 400);
    if (
      sdp_type === "ice" &&
      (typeof candidate !== "string" || !candidate || candidate.length > 4096)
    )
      return err("Invalid connection details.", 400);
    const sdp_mid = body.sdp_mid ?? body.candidate_sdp_mid ?? null;
    const sdp_mline_index =
      body.sdp_mline_index ?? body.candidate_sdp_mline_index ?? null;
    if (
      sdp_mid !== null &&
      (typeof sdp_mid !== "string" || sdp_mid.length > 256)
    )
      return err("Invalid connection details.", 400);
    if (
      sdp_mline_index !== null &&
      (!Number.isInteger(sdp_mline_index) || sdp_mline_index < 0)
    )
      return err("Invalid connection details.", 400);
    const { error } = await supabase.from("azera_call_events").insert({
      call_id: id,
      event_type:
        sdp_type === "offer"
          ? "webrtc_offer"
          : sdp_type === "answer"
            ? "webrtc_answer"
            : "webrtc_ice_candidate",
      actor_type: actor.type,
      actor_id: actor.id,
      metadata: { sdp_type, sdp, candidate, sdp_mid, sdp_mline_index },
    });
    if (error) return err("The call could not connect. Please try again.", 500);
    return NextResponse.json({ success: true });
  } catch {
    return err("The call could not connect. Please try again.", 500);
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isSupabaseConfigured())
    return err("Calling is temporarily unavailable.", 503);
  try {
    const { id } = await params;
    const access = await getCallAccess(request, id);
    if (!access)
      return err("Please refresh the page before starting another call.", 401);
    const { call, actor } = access;
    if (["openai_realtime", "livekit", "cloudflare_sfu"].includes(call.sip_provider))
      return err("This call uses a different secure audio connection.", 409);
    if (
      actor.type === "agent" &&
      call.agent_user_id &&
      call.agent_user_id !== actor.id
    )
      return err("Another team member is handling this call.", 409);
    const { data, error } = await supabase
      .from("azera_call_events")
      .select("id,event_type,actor_type,metadata,created_at")
      .eq("call_id", id)
      .in("event_type", [
        "webrtc_offer",
        "webrtc_answer",
        "webrtc_ice_candidate",
      ])
      .neq("actor_type", actor.type)
      .order("created_at", { ascending: true })
      .limit(500);
    if (error)
      return err("Call connection details are temporarily unavailable.", 500);
    return NextResponse.json(
      {
        success: true,
        data: data || [],
        call: { status: call.status },
        ice_servers: callIceServers(),
      },
      {
        headers: { "Cache-Control": "no-store" },
      },
    );
  } catch {
    return err("Call connection details are temporarily unavailable.", 500);
  }
}
