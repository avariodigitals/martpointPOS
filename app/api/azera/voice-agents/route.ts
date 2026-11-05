import { NextResponse } from "next/server";
import { getSession, hasPermissionForUser } from "@/lib/admin-auth";
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
  return session && await hasPermissionForUser(session.userId, session.role, "settings") ? session : null;
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
  if (!id) return reply({ error: "Phone calling is not ready for this business. Ask an administrator for help." }, 400);
  const [users, assignments, phones] = await Promise.all([
    supabase.from("users").select("id,name,username,email,role,status").in("role", allowedRoles).eq("status", "ACTIVE").order("name"),
    supabase.from("azera_voice_agent_assignments").select("user_id,queues,enabled,updated_at").eq("business_id", id),
    supabase.from("azera_africa_browser_agents").select("user_id,business_id,ready,last_seen_at,queues").eq("business_id", id),
  ]);
  if (assignments.error) {
    console.error("[Azera voice agent assignments could not be loaded]", assignments.error);
    return reply({ error: "Voice assignments are temporarily unavailable. Please try again or ask an administrator for help." }, 503);
  }
  const assignmentMap = new Map((assignments.data || []).map(row => [row.user_id, row]));
  if (phones.error) {
    console.error("[Azera browser phone availability could not be loaded]", phones.error);
    return reply({ error: "Phone availability is temporarily unavailable. Please try again or ask an administrator for help." }, 503);
  }
  const phoneMap = new Map((phones.data || []).map(row => [row.user_id, row]));
  const now = Date.now();
  return reply({ businessId: id, agents: (users.data || []).map(user => ({
    ...user,
    queues: assignmentMap.get(user.id)?.queues || [],
    enabled: assignmentMap.get(user.id)?.enabled === true,
    updated_at: assignmentMap.get(user.id)?.updated_at || null,
    browserPhoneReady: phoneMap.get(user.id)?.ready === true &&
      Date.parse(phoneMap.get(user.id)?.last_seen_at || "") > now - 60_000,
  })) });
}

export async function POST(request: Request) {
  const session = await requireManager();
  if (!session) return reply({ error: "Forbidden" }, 403);
  if (request.headers.get("origin") && request.headers.get("origin") !== new URL(request.url).origin) return reply({ error: "Forbidden" }, 403);
  if (!isSupabaseConfigured()) return reply({ error: "Voice assignments are temporarily unavailable. Please try again later." }, 503);
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
    if (error) {
      console.error("[Azera voice assignment save failed]", error);
      return reply({ error: "Could not save the voice assignment. Please try again." }, 500);
    }
    const { data: saved, error: verifyError } = await supabase.from("azera_voice_agent_assignments")
      .select("queues,enabled")
      .eq("business_id", id)
      .eq("user_id", userId)
      .maybeSingle();
    const savedQueues = Array.isArray(saved?.queues) ? saved.queues : [];
    const queuesMatch = selected.length === savedQueues.length && selected.every(queue => savedQueues.includes(queue));
    if (verifyError || !saved || saved.enabled !== enabled || !queuesMatch) {
      if (verifyError) console.error("[Azera voice assignment verification failed]", verifyError);
      return reply({ error: "The voice assignment could not be confirmed. Please refresh and try again." }, 503);
    }
    // An assignment change takes effect on the next registration. Stop a
    // currently advertised browser immediately if its queues were removed.
    if (!enabled) await supabase.from("azera_africa_browser_agents").update({ ready: false, last_seen_at: new Date(0).toISOString() }).eq("business_id", id).eq("user_id", userId);
    return reply({ ok: true, enabled: saved.enabled, queues: savedQueues, verified: true });
  } catch {
    return reply({ error: "Invalid voice assignment." }, 400);
  }
}
