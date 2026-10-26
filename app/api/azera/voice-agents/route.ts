import { NextResponse } from "next/server";
import { getSession, hasPermission } from "@/lib/admin-auth";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { africaBrowserConfig } from "@/lib/africa-browser-voice";
import { resolveAfricaBusinessId } from "@/lib/africastalking";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const allowedRoles = ["Admin", "Sales", "Customer Care", "Tech"];
const allowedQueues = ["sales", "support", "onboarding", "customer_support"];
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

async function requireManager() {
  const session = await getSession();
  return session && hasPermission(session.role, "settings") ? session : null;
}

async function businessId() {
  const config = await africaBrowserConfig();
  return resolveAfricaBusinessId(config.phone);
}

export async function GET() {
  const session = await requireManager();
  if (!session) return reply({ error: "Forbidden" }, 403);
  if (!isSupabaseConfigured()) return reply({ businessId: null, agents: [] });
  const id = await businessId();
  if (!id) return reply({ error: "No business is configured for Azera." }, 400);
  const [users, assignments] = await Promise.all([
    supabase.from("users").select("id,name,username,email,role,status").in("role", allowedRoles).eq("status", "ACTIVE").order("name"),
    supabase.from("azera_voice_agent_assignments").select("user_id,queues,enabled,updated_at").eq("business_id", id),
  ]);
  if (assignments.error) return reply({ error: "Apply migration 141 before managing voice agents." }, 503);
  const assignmentMap = new Map((assignments.data || []).map(row => [row.user_id, row]));
  return reply({ businessId: id, agents: (users.data || []).map(user => ({
    ...user,
    queues: assignmentMap.get(user.id)?.queues || [],
    enabled: assignmentMap.get(user.id)?.enabled === true,
    updated_at: assignmentMap.get(user.id)?.updated_at || null,
  })) });
}

export async function POST(request: Request) {
  const session = await requireManager();
  if (!session) return reply({ error: "Forbidden" }, 403);
  if (request.headers.get("origin") && request.headers.get("origin") !== new URL(request.url).origin) return reply({ error: "Forbidden" }, 403);
  if (!isSupabaseConfigured()) return reply({ error: "Supabase not configured" }, 503);
  try {
    const body = await request.json();
    const userId = String(body.user_id || "");
    const id = await businessId();
    if (!id || !/^[0-9a-f-]{36}$/i.test(userId)) return reply({ error: "A valid team member is required." }, 400);
    const { data: user } = await supabase.from("users").select("id,role,status").eq("id", userId).maybeSingle();
    if (!user || user.status !== "ACTIVE" || !allowedRoles.includes(user.role)) return reply({ error: "That team member cannot answer voice calls." }, 400);
    const selected = Array.isArray(body.queues) ? [...new Set(body.queues.filter((queue: unknown) => typeof queue === "string" && allowedQueues.includes(queue)))] : [];
    const enabled = body.enabled !== false && selected.length > 0;
    const { error } = await supabase.from("azera_voice_agent_assignments").upsert({
      business_id: id,
      user_id: userId,
      queues: selected,
      enabled,
      updated_at: new Date().toISOString(),
    }, { onConflict: "business_id,user_id" });
    if (error) return reply({ error: error.message }, 500);
    // An assignment change takes effect on the next registration. Stop a
    // currently advertised browser immediately if its queues were removed.
    if (!enabled) await supabase.from("azera_africa_browser_agents").update({ ready: false, last_seen_at: new Date(0).toISOString() }).eq("business_id", id).eq("user_id", userId);
    return reply({ ok: true, enabled, queues: selected });
  } catch {
    return reply({ error: "Invalid voice assignment." }, 400);
  }
}
