import { NextResponse } from "next/server";
import { getSession, hasPermission } from "@/lib/admin-auth";
import { supabase } from "@/lib/supabase";
import { africaBrowserConfig } from "@/lib/africa-browser-voice";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const queues = ["sales", "support", "onboarding", "customer_support"];
const reply = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !hasPermission(session.role, "azera")) return reply({ error: "Forbidden" }, 403);
  try {
    const { id } = await params;
    const body = await request.json();
    const mode = body.mode === "conference" ? "conference" : body.mode === "transfer" ? "transfer" : "";
    const queue = String(body.queue || "");
    if (!mode || !queues.includes(queue)) return reply({ error: "Choose a valid destination queue." }, 400);
    const { data: call } = await supabase.from("azera_calls").select("id,business_id,status,agent_user_id,sip_call_sid").eq("id", id).eq("agent_user_id", session.userId).eq("status", "active").maybeSingle();
    if (!call) return reply({ error: "This active call is no longer assigned to you." }, 409);
    if (!call.sip_call_sid) return reply({ error: "The provider call session is not ready for transfer." }, 409);
    const { data: assignments, error: assignmentError } = await supabase.from("azera_voice_agent_assignments").select("user_id").eq("business_id", call.business_id).eq("enabled", true).contains("queues", [queue]);
    if (assignmentError) return reply({ error: "Apply migration 141 before using call controls." }, 503);
    const targetIds = (assignments || []).map(row => row.user_id).filter(id => id !== session.userId);
    if (!targetIds.length) return reply({ error: `No other ${queue.replace("_", " ")} agent is assigned.` }, 409);
    const { data: targets } = await supabase.from("azera_africa_browser_agents").select("user_id,client_name,last_seen_at").eq("business_id", call.business_id).eq("ready", true).gt("last_seen_at", new Date(Date.now() - 60_000).toISOString()).in("user_id", targetIds).order("last_seen_at", { ascending: true }).limit(1);
    const target = targets?.[0];
    if (!target) return reply({ error: `No available ${queue.replace("_", " ")} agent is online.` }, 409);
    const config = await africaBrowserConfig(call.business_id);
    const destination = `${config.username}.${target.client_name}`;
    if (!/^[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+$/.test(destination)) return reply({ error: "The provider destination is not configured correctly." }, 503);
    await supabase.from("azera_call_control_requests").update({ status: "cancelled", error_message: "Superseded by a newer request" }).eq("call_id", id).eq("status", "pending");
    const { data: control, error } = await supabase.from("azera_call_control_requests").insert({ call_id: id, business_id: call.business_id, requested_by: session.userId, target_user_id: target.user_id, target_destination: destination, target_queue: queue, mode }).select("id,mode,status,target_destination,target_queue").single();
    if (error || !control) return reply({ error: "Could not create the call-control request." }, 503);
    await supabase.from("azera_call_events").insert({ call_id: id, event_type: "transfer_requested", actor_type: "agent", actor_id: session.userId, metadata: { mode, queue, target_user_id: target.user_id, control_request_id: control.id } });
    return reply({ ok: true, requestId: control.id, mode, controlDigit: mode === "transfer" ? "*" : "#", message: mode === "transfer" ? "Transfer requested. Press the transfer control once to connect the selected queue." : "Conference requested. Press the conference control once; availability depends on the configured Africa’s Talking Events URL." });
  } catch {
    return reply({ error: "Could not prepare the call control." }, 400);
  }
}
