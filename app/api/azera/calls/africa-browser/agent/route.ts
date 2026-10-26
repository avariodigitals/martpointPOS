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
  const { data: call } = await supabase.from("azera_calls")
    .select("id,status,customer_phone,selected_department,answered_at")
    .eq("agent_user_id", session.userId).eq("sip_provider", "africas_talking")
    .eq("direction", "inbound").in("status", ["ringing", "active"])
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  return reply({ phone, call });
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
      const selected = Array.isArray(body.queues) ? [...new Set(body.queues.filter((q: unknown) => typeof q === "string" && queues.includes(q)))] : [];
      if (!selected.length) return reply({ error: "Choose at least one department." }, 400);
      const config = await africaBrowserConfig();
      const businessId = await resolveAfricaBusinessId(config.phone);
      if (!businessId || !africaBrowserReady(config)) return reply({ error: "Configure the live Africa’s Talking application and virtual number first." }, 503);
      const { data: clientName, error } = await supabase.rpc("azera_register_africa_browser", {
        p_user: session.userId, p_business: businessId, p_lease: body.lease, p_queues: selected,
      });
      if (error) return reply({ error: "Could not register your phone. Apply migration 137 and try again." }, 503);
      if (!clientName) return reply({ error: "Your phone is open in another tab, or you have an unfinished call. Close that phone or finish the call first." }, 409);
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
