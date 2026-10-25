import { randomUUID } from "node:crypto";
import { supabase } from "@/lib/supabase";
import { closeSfuSession } from "@/lib/cloudflare-rtc";

/** End provider media BEFORE marking history ended; retry unresolved cleanup. */
export async function endCloudflareCall(id: string, outcome = "ended") {
  const claim = randomUUID();
  const reserved = await supabase.from("azera_calls").update({ media_control_claim: claim, media_control_claimed_at: new Date().toISOString() }).eq("id", id).eq("sip_provider", "cloudflare_sfu").is("media_control_claim", null).select("id,answered_at").maybeSingle();
  if (reserved.error || !reserved.data) throw new Error("Call cleanup is already in progress. Please retry.");
  try {
    const rows = await supabase.from("azera_cloudflare_participants").select("publisher_session,subscriber_session,operation_claim").eq("call_id", id).is("closed_at", null);
    if (rows.error || rows.data?.some((row) => row.operation_claim)) throw new Error("Audio setup is still finishing; retry ending this call.");
    const sessions = new Set((rows.data || []).flatMap((row) => [row.subscriber_session, row.publisher_session]).filter(Boolean) as string[]);
    await Promise.all([...sessions].map((session) => closeSfuSession(session)));
    const now = new Date().toISOString();
    const closed = await supabase.from("azera_cloudflare_participants").update({ closed_at: now, connected: false }).eq("call_id", id).is("closed_at", null);
    if (closed.error) throw new Error("Could not save provider cleanup");
    const saved = await supabase.from("azera_calls").update({ status: ["missed", "failed", "busy"].includes(outcome) ? outcome : "ended", final_outcome: outcome, ended_at: now, updated_at: now, duration_seconds: reserved.data.answered_at ? Math.max(0, Math.floor((Date.now() - Date.parse(reserved.data.answered_at)) / 1000)) : 0 }).eq("id", id).eq("media_control_claim", claim);
    if (saved.error) throw new Error("Could not save call closure");
  } finally {
    await supabase.from("azera_calls").update({ media_control_claim: null, media_control_claimed_at: null }).eq("id", id).eq("media_control_claim", claim);
  }
}

export async function sweepCloudflareCalls() {
  const cutoff = new Date(Date.now() - 120_000).toISOString();
  const abandoned = await supabase.from("azera_cloudflare_participants").update({ operation_claim: null, operation_claimed_at: null }).lt("operation_claimed_at", cutoff);
  const controls = await supabase.from("azera_calls").update({ media_control_claim: null, media_control_claimed_at: null }).eq("sip_provider", "cloudflare_sfu").lt("media_control_claimed_at", cutoff);
  if (abandoned.error || controls.error) throw new Error("Could not reconcile abandoned media operations");
  const calls = await supabase.from("azera_calls").select("id,status,created_at").eq("sip_provider", "cloudflare_sfu").in("status", ["ringing", "active"]).order("created_at").limit(10);
  if (calls.error) throw new Error("Could not inspect Cloudflare calls; verify migration 136");
  let cleaned = 0;
  for (const call of calls.data || []) {
    const participants = await supabase.from("azera_cloudflare_participants").select("last_seen_at").eq("call_id", call.id).is("closed_at", null);
    if (participants.error) throw new Error("Could not inspect Cloudflare participants");
    const age = Date.now() - Date.parse(call.created_at);
    const stale = participants.data?.some((row) => Date.parse(row.last_seen_at) < Date.now() - 120_000);
    if (age > 1800_000 || (call.status === "ringing" && age > 90_000) || stale) {
      await endCloudflareCall(call.id, call.status === "ringing" ? "missed" : "media_timeout");
      if (++cleaned >= 2) break;
    }
  }
}
