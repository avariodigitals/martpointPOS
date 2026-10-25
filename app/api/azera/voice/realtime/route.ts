import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import {
  tokenFromRequest,
  verifyConversationToken,
} from "@/lib/azera-public-auth";
import { isConversationIdentityMatch } from "@/lib/azera-identity";
import { getCallAccess } from "@/lib/azera-call-access";
import {
  createRealtimeCall,
  hangupRealtimeCall,
  realtimeProvider,
  voiceInstructions,
  realtimeVoiceEnabled,
} from "@/lib/azera-realtime";

const headers = { "Cache-Control": "no-store" };
const error = (message: string, status = 503) =>
  NextResponse.json({ error: message }, { status, headers });
async function authorisedConversation(request: Request) {
  const claims = verifyConversationToken(tokenFromRequest(request));
  if (!claims || !isSupabaseConfigured()) return null;
  const { data } = await supabase
    .from("azera_conversations")
    .select("id,business_id,external_id,channel,status")
    .eq("id", claims.conversationId)
    .eq("channel", "website")
    .maybeSingle();
  return data &&
    data.status !== "closed" &&
    isConversationIdentityMatch(claims, data)
    ? data
    : null;
}
export async function GET(request: Request) {
  const conversation = await authorisedConversation(request);
  if (!conversation) return error("Conversation authorization required", 401);
  try {
    if (!realtimeVoiceEnabled())
      return NextResponse.json({ enabled: false }, { headers });
    await realtimeProvider();
    const { data: settings, error: lookupError } = await supabase
      .from("azera_settings")
      .select("voice_realtime_enabled")
      .eq("business_id", conversation.business_id)
      .maybeSingle();
    return NextResponse.json(
      { enabled: !lookupError && settings?.voice_realtime_enabled === true },
      { headers },
    );
  } catch {
    return NextResponse.json({ enabled: false }, { headers });
  }
}
export async function POST(request: Request) {
  const conversation = await authorisedConversation(request);
  if (!conversation) return error("Conversation authorization required", 401);
  let id: string | null = null;
  let providerId: string | null = null;
  try {
    if (!realtimeVoiceEnabled())
      return error(
        "AI voice is not enabled yet. Please message us here or call the team instead.",
        409,
      );
    const raw = await request.text();
    if (raw.length > 70_000)
      return error("Voice connection request is too large", 413);
    const { sdp } = JSON.parse(raw);
    if (
      typeof sdp !== "string" ||
      !sdp.startsWith("v=0") ||
      sdp.length > 65_536
    )
      return error("Invalid voice connection request", 400);
    await realtimeProvider();
    const { data: settings, error: settingsError } = await supabase
      .from("azera_settings")
      .select("voice_realtime_enabled,ai_prompt")
      .eq("business_id", conversation.business_id)
      .maybeSingle();
    if (settingsError || !settings?.voice_realtime_enabled)
      return error(
        "AI voice is unavailable. Please message us here or call the team instead.",
        409,
      );
    const { data: articles, error: knowledgeError } = await supabase
      .from("azera_knowledge")
      .select("title,content")
      .eq("business_id", conversation.business_id)
      .eq("status", "published")
      .in("audience", ["all", "prospect"])
      .limit(30);
    if (knowledgeError)
      return error(
        "Voice assistance is temporarily unavailable. Please message us here instead.",
      );
    const reserved = await supabase.rpc("azera_prepare_ai_call", {
      p_conversation_id: conversation.id,
    });
    if (reserved.error || !reserved.data)
      return error(
        "Voice assistance is busy or its call limit has been reached. Please message us here instead.",
        409,
      );
    id = reserved.data;
    const result = await createRealtimeCall(
      sdp,
      voiceInstructions(settings.ai_prompt || "", articles || []),
      createHash("sha256").update(conversation.id).digest("hex"),
    );
    providerId = result.providerId;
    const { data: saved, error: saveError } = await supabase
      .from("azera_calls")
      .update({
        sip_call_sid: providerId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("status", "ringing")
      .select("id")
      .maybeSingle();
    if (saveError || !saved) throw new Error("Call was cancelled");
    return NextResponse.json(
      { id, answer: result.answer, maxSeconds: 600 },
      { headers },
    );
  } catch {
    if (providerId) await hangupRealtimeCall(providerId).catch(() => {});
    if (id)
      await supabase
        .from("azera_calls")
        .update({ status: "failed", ended_at: new Date().toISOString() })
        .eq("id", id)
        .eq("status", "ringing");
    return error(
      "Voice assistance could not connect. Please message us here instead.",
    );
  }
}
export async function PATCH(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return error("Call required", 400);
  const access = await getCallAccess(request, id);
  if (
    !access ||
    access.actor.type !== "customer" ||
    access.call.sip_provider !== "openai_realtime"
  )
    return error("Call authorization required", 403);
  if (
    !access.call.sip_call_sid ||
    Date.parse(access.call.created_at) < Date.now() - 600_000
  )
    return error("This call has expired", 409);
  const { error: updateError } = await supabase
    .from("azera_calls")
    .update({
      status: "active",
      answered_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", "ringing");
  if (updateError) return error("Could not update call history");
  return NextResponse.json({ connected: true }, { headers });
}
export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return error("Call required", 400);
  const access = await getCallAccess(request, id);
  if (!access || access.call.sip_provider !== "openai_realtime")
    return error("Call authorization required", 403);
  try {
    if (access.call.sip_call_sid)
      await hangupRealtimeCall(access.call.sip_call_sid);
    const { error: updateError } = await supabase
      .from("azera_calls")
      .update({
        status: "ended",
        ended_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        duration_seconds: access.call.answered_at
          ? Math.max(
              0,
              Math.floor(
                (Date.now() - Date.parse(access.call.answered_at)) / 1000,
              ),
            )
          : 0,
      })
      .eq("id", id)
      .in("status", ["ringing", "active"]);
    if (updateError) throw new Error("History update failed");
    return NextResponse.json({ ended: true }, { headers });
  } catch {
    return error(
      "Your microphone can be closed, but call shutdown could not be confirmed. Please retry End call.",
    );
  }
}
