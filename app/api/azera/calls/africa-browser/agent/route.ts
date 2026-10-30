import { NextResponse } from "next/server";
import { getSession, hasPermission } from "@/lib/admin-auth";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { africaBrowserConfig, africaBrowserReady, africaCapability } from "@/lib/africa-browser-voice";
import { resolveAfricaBusinessId } from "@/lib/africastalking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
const queues = ["sales", "support", "onboarding", "customer_support"];
async function agent() {
  const session = await getSession();
  if (!session || !hasPermission(session.role, "azera") || !isSupabaseConfigured()) return null;
  const { data } = await supabase.from("users").select("id,role,status").eq("id", session.userId).maybeSingle();
  return data?.status === "ACTIVE" && ["Admin", "Sales", "Customer Care", "Tech"].includes(data.role) ? session : null;
}

export async function GET() {
  const session = await agent();
  if (!session) return reply({ error: "Forbidden" }, 403);
  const { data: phone, error } = await supabase.from("azera_africa_browser_agents")
    .select("ready,last_seen_at,queues").eq("user_id", session.userId).maybeSingle();
  if (error) return reply({ error: "Apply migration 137 before enabling incoming browser calls." }, 503);
  const config = await africaBrowserConfig();
  const businessId = await resolveAfricaBusinessId(config.phone);
  const { data: assignment, error: assignmentError } = await supabase
    .from("azera_voice_agent_assignments")
    .select("business_id,queues,enabled")
    .eq("business_id", businessId || "00000000-0000-0000-0000-000000000000")
    .eq("user_id", session.userId)
    .eq("enabled", true)
    .maybeSingle();
  if (assignmentError) return reply({ error: "Apply migration 141 before enabling voice assignments." }, 503);
  let { data: call } = await supabase.from("azera_calls")
    .select("id,status,customer_phone,selected_department,answered_at")
    .eq("agent_user_id", session.userId).eq("sip_provider", "africas_talking")
    .eq("direction", "inbound").in("status", ["ringing", "active"])
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!call) {
    const { data: offered } = await supabase.from("azera_africa_browser_call_rings")
      .select("call_id").eq("user_id", session.userId).eq("state", "ringing")
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (offered?.call_id) {
      const { data: offeredCall } = await supabase.from("azera_calls")
        .select("id,status,customer_phone,selected_department,answered_at")
        .eq("id", offered.call_id).eq("sip_provider", "africas_talking")
        .eq("direction", "inbound").in("status", ["ringing", "active"]).maybeSingle();
      if (offeredCall?.status === "ringing") call = offeredCall;
    }
  }
  let caller: { kind: "lead" | "business"; name: string; businessName?: string } | null = null;
  if (call?.customer_phone) {
    const [leadResult, businessResult] = await Promise.all([
      supabase.from("leads").select("full_name,business_name").eq("phone", call.customer_phone).order("submitted_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("businesses").select("business_name,primary_contact_name").eq("primary_phone", call.customer_phone).limit(1).maybeSingle(),
    ]);
    if (businessResult.data) caller = { kind: "business", name: businessResult.data.primary_contact_name, businessName: businessResult.data.business_name };
    else if (leadResult.data) caller = { kind: "lead", name: leadResult.data.full_name, businessName: leadResult.data.business_name };
  }
  return reply({ phone, call, caller, allowedQueues: assignment?.queues || [], assignedBusinessId: assignment?.business_id || null });
}

export async function POST(request: Request) {
  const session = await agent();
  if (!session) return reply({ error: "Forbidden" }, 403);
  if (request.headers.get("origin") && request.headers.get("origin") !== new URL(request.url).origin)
    return reply({ error: "Forbidden" }, 403);
  try {
    const body = await request.json();
    if (typeof body.lease !== "string" || !/^[0-9a-f-]{36}$/i.test(body.lease)) return reply({ error: "Invalid phone session" }, 400);
    if (body.action === "register") {
      const config = await africaBrowserConfig();
      const businessId = await resolveAfricaBusinessId(config.phone);
      if (!businessId || !africaBrowserReady(config)) return reply({ error: "Configure the live Africa’s Talking application and virtual number first." }, 503);
      const { data: assignment, error: assignmentError } = await supabase
        .from("azera_voice_agent_assignments")
        .select("queues,enabled")
        .eq("business_id", businessId)
        .eq("user_id", session.userId)
        .eq("enabled", true)
        .maybeSingle();
      if (assignmentError) return reply({ error: "Apply migration 141 before enabling voice assignments." }, 503);
      const selected = Array.isArray(assignment?.queues)
        ? [...new Set(assignment.queues.filter((q: unknown) => typeof q === "string" && queues.includes(q)))]
        : [];
      if (!selected.length) return reply({ error: "You are not assigned to a voice queue. Ask an administrator to assign Sales, Support, Onboarding, or General enquiries." }, 403);

      // Give the agent an actionable reason before the atomic RPC below. The
      // RPC remains authoritative so concurrent registrations are still safe.
      const [{ data: activeCall, error: activeCallError }, { data: existingPhone, error: existingPhoneError }] = await Promise.all([
        supabase.from("azera_calls").select("id,status,customer_phone,created_at")
          .eq("agent_user_id", session.userId).in("status", ["ringing", "active"])
          .order("created_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("azera_africa_browser_agents").select("lease_id,last_seen_at")
          .eq("user_id", session.userId).maybeSingle(),
      ]);
      if (activeCallError || existingPhoneError) return reply({ error: "Could not check your current phone session. Refresh and try again." }, 503);
      if (activeCall) return reply({
        error: "You have a call still marked as active or ringing. End it first, or check Azera Call Reports if the call already disconnected.",
        reason: "unfinished_call",
        callId: activeCall.id,
      }, 409);
      if (existingPhone?.lease_id && existingPhone.lease_id !== body.lease && existingPhone.last_seen_at
        && new Date(existingPhone.last_seen_at).getTime() > Date.now() - 60_000) {
        return reply({
          error: "Your browser phone is connected in another tab. In that tab choose Receive calls → Go offline. Minimising the panel does not disconnect it.",
          reason: "other_tab",
        }, 409);
      }
      const { data: clientName, error } = await supabase.rpc("azera_register_africa_browser", {
        p_user: session.userId, p_business: businessId, p_lease: body.lease, p_queues: selected,
      });
      if (error) return reply({ error: "Could not register your phone. Apply migration 137 and try again." }, 503);
      if (!clientName) return reply({
        error: "Another phone session or call became active while you were connecting. Switch to that phone and go offline, or finish the call, then retry.",
        reason: "phone_conflict",
      }, 409);
      try {
        const token = await africaCapability(config, clientName, true);
        return reply({ token, clientName, expiresIn: 3600 });
      } catch (error) {
        await supabase.from("azera_africa_browser_agents").update({ ready: false, last_seen_at: new Date(0).toISOString() }).eq("user_id", session.userId).eq("lease_id", body.lease);
        return reply({ error: error instanceof Error ? error.message : "Provider registration failed." }, 502);
      }
    }
    if (!["ready", "heartbeat", "stop"].includes(body.action)) return reply({ error: "Invalid phone action" }, 400);
    const { data, error } = await supabase.from("azera_africa_browser_agents")
      .update({ ready: body.action !== "stop", last_seen_at: new Date(body.action === "stop" ? 0 : Date.now()).toISOString() })
      .eq("user_id", session.userId).eq("lease_id", body.lease)
      .select("user_id").maybeSingle();
    if (error) return reply({ error: "Could not update your phone availability." }, 503);
    if (!data) return reply({ error: "This phone session has expired. Reconnect your phone." }, 409);
    return reply({ ok: true });
  } catch { return reply({ error: "Could not update browser phone." }, 400); }
}
