import { NextResponse } from "next/server";
import { getSession, hasPermission } from "@/lib/admin-auth";
import type { SessionPayload, UserRole } from "@/lib/admin-auth";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { isConversationIdentityMatch } from "@/lib/azera-identity";
import { cloudflareSfuEnabled } from "@/lib/cloudflare-rtc";
import {
  tokenFromRequest,
  verifyConversationToken,
} from "@/lib/azera-public-auth";

async function requireSession(): Promise<SessionPayload | null> {
  const session = await getSession();
  if (!session || !hasPermission(session.role as UserRole, "azera")) {
    return null;
  }
  return session;
}

function ok<T>(data: T) {
  return NextResponse.json({ success: true, data });
}
function err(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function GET(request: Request) {
  const session = await requireSession();
  if (!session) return err("Forbidden", 403);

  if (!isSupabaseConfigured()) return ok([]);

  const { searchParams } = new URL(request.url);
  const businessId = searchParams.get("business_id");
  const status = searchParams.get("status"); // ringing|active|ended|missed|failed|busy
  const agentId = searchParams.get("agent_id");

  try {
    let query = supabase
      .from("azera_calls")
      .select(
        `
        *,
        azera_call_events (
          id, event_type, actor_type, metadata, created_at
        ),
        azera_call_attempts (
          id, department_key, destination, attempt_number, status, provider_state,
          error_message, started_at, answered_at, ended_at, duration_seconds, created_at
        ),
        azera_voicemails (
          id, department_key, caller_phone, recording_reference, recording_path,
          duration_seconds, status, assigned_user_id, notes, follow_up_at,
          retention_expires_at, created_at, updated_at
        )
      `,
      )
      .order("created_at", { ascending: false });

    if (businessId) query = query.eq("business_id", businessId);
    if (status) query = query.eq("status", status);
    // Do not offer abandoned browser calls from earlier visits to staff.
    if (status === "ringing")
      query = query.gte(
        "created_at",
        new Date(Date.now() - 90_000).toISOString(),
      );
    if (agentId) query = query.eq("agent_user_id", agentId);

    const { data, error } = await query.limit(200);

    if (error) return err(error.message, 500);

    if (status === "ringing") {
      const { data: presence } = await supabase
        .from("azera_agent_presence")
        .select("queues,last_seen_at,is_online")
        .eq("user_id", session.userId)
        .maybeSingle();
      if (
        !presence?.is_online ||
        Date.parse(presence.last_seen_at) < Date.now() - 90_000
      )
        return ok([]);
      const conversationIds = [
        ...new Set(
          (data || []).map((call) => call.conversation_id).filter(Boolean),
        ),
      ];
      const { data: conversations } = conversationIds.length
        ? await supabase
            .from("azera_conversations")
            .select("id,queue")
            .in("id", conversationIds)
        : { data: [] };
      const queues = new Map(
        (conversations || []).map((conversation) => [
          conversation.id,
          conversation.queue,
        ]),
      );
      return ok(
        (data || []).filter(
          (call) =>
            !["openai_realtime", "livekit"].includes(call.sip_provider) &&
            (!call.agent_user_id || call.agent_user_id === session.userId) &&
            presence.queues.includes(
              queues.get(call.conversation_id) || "customer_support",
            ),
        ),
      );
    }
    return ok(data || []);
  } catch (e) {
    console.error("[Azera calls list error]", e);
    return err(
      "We couldn't load call history right now. Please try again shortly.",
      500,
    );
  }
}

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) return err("Supabase not configured", 500);

  try {
    const body = await request.json();
    const {
      business_id,
      call_type = "webrtc",
      direction = "outbound",
      conversation_id,
      agent_user_id,
      agent_name,
      customer_name,
      customer_phone,
      customer_external_id,
      sip_provider,
      sip_from_number,
      sip_to_number,
      webrtc_room,
      source = "retail_app",
      conversation_token,
    } = body;

    if (!business_id) return err("business_id is required");

    const isPublicRequest = source === "public_site";
    let session: SessionPayload | null = null;
    if (isPublicRequest) {
      if (call_type !== "webrtc" || direction !== "inbound")
        return err("Invalid website call", 400);
      const claims = verifyConversationToken(
        tokenFromRequest(request, conversation_token),
      );
      if (
        !claims ||
        claims.conversationId !== conversation_id ||
        claims.businessId !== business_id ||
        claims.externalId !== customer_external_id
      ) {
        return err("Conversation authorization required", 401);
      }
      const { data: conversation, error: conversationError } = await supabase
        .from("azera_conversations")
        .select("id, business_id, external_id, queue")
        .eq("id", conversation_id)
        .eq("channel", "website")
        .maybeSingle();
      if (
        conversationError ||
        !conversation ||
        !isConversationIdentityMatch(claims, conversation)
      ) {
        return err("Conversation authorization required", 401);
      }
      const { data: agents, error: presenceError } = await supabase
        .from("azera_agent_presence")
        .select("user_id,users!inner(role,status)")
        .eq("is_online", true)
        .eq("users.status", "ACTIVE")
        .in("users.role", ["Admin", "Sales", "Customer Care", "Tech"])
        .contains("queues", [conversation.queue || "customer_support"])
        .gte("last_seen_at", new Date(Date.now() - 90_000).toISOString())
        .limit(100);
      if (presenceError)
        return err(
          "Calling is temporarily unavailable. Please message us here instead.",
          503,
        );
      if (!agents?.length)
        return err(
          "Our team is unavailable for a live call right now. Please leave a message here and we’ll help you.",
          409,
        );
      const { data: busy, error: busyError } = await supabase
        .from("azera_calls")
        .select("agent_user_id")
        .in(
          "agent_user_id",
          agents.map((agent) => agent.user_id),
        )
        .in("status", ["ringing", "active"]);
      if (busyError)
        return err(
          "Calling is temporarily unavailable. Please message us here instead.",
          503,
        );
      const occupied = new Set((busy || []).map((call) => call.agent_user_id));
      if (agents.every((agent) => occupied.has(agent.user_id)))
        return err(
          "Our team is currently on other calls. Please leave a message here and we’ll follow up.",
          409,
        );
    } else {
      session = await requireSession();
      if (!session) return err("Forbidden", 403);
    }

    const now = new Date().toISOString();

    if (isPublicRequest && process.env.AZERA_BROWSER_MEDIA === "cloudflare") {
      // Explicit Cloudflare selection must fail closed, not silently select a
      // different provider or a STUN-only call when credentials are missing.
      if (!cloudflareSfuEnabled()) return err("Website calling is being configured. Please continue in chat.", 503);
      const reserved = await supabase.rpc("azera_prepare_cloudflare_call", { p_conversation_id: conversation_id });
      if (reserved.error) return err("Website calling is unavailable. Verify the Cloudflare migration.", 503);
      if (!reserved.data) return err("A call is already open or the call limit has been reached. Please continue in chat.", 409);
      const result = await supabase.from("azera_calls").select("*").eq("id", reserved.data).single();
      if (result.error || !result.data) return err("Could not load the call. Please continue in chat.", 503);
      return ok(result.data);
    }

    const { data, error } = await supabase
      .from("azera_calls")
      .insert({
        business_id,
        conversation_id,
        call_type,
        direction,
        status: direction === "outbound" ? "ringing" : "ringing",
        agent_user_id: isPublicRequest
          ? null
          : agent_user_id || session?.userId || null,
        agent_name: isPublicRequest
          ? "Website visitor"
          : agent_name || session?.name || null,
        customer_name,
        customer_phone,
        customer_external_id,
        sip_provider: isPublicRequest ? null : sip_provider,
        sip_from_number: isPublicRequest ? null : sip_from_number,
        sip_to_number: isPublicRequest ? null : sip_to_number,
        webrtc_room: isPublicRequest
          ? `azera-web-${conversation_id}`
          : webrtc_room,
        started_at: now,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single();

    if (error || !data)
      return err(
        "We couldn't start the call right now. Please try again shortly.",
        500,
      );

    // Log call initiated event
    await supabase.from("azera_call_events").insert({
      call_id: data.id,
      event_type: "call_initiated",
      actor_type: isPublicRequest ? "customer" : "agent",
      actor_id: isPublicRequest ? null : session?.userId || null,
      metadata: { call_type, direction },
      created_at: now,
    });

    return ok(data);
  } catch (e) {
    console.error("[Azera call create error]", e);
    return err(
      "We couldn't start the call right now. Please try again shortly.",
      500,
    );
  }
}
