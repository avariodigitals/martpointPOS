import { NextResponse } from "next/server";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { notifyAllAdmins } from "@/lib/admin-notifications";
import { contactCentreUrl } from "@/lib/contact-centre-links";
import { hangupRealtimeCall } from "@/lib/azera-realtime";
import { cloudflareSfuConfigured } from "@/lib/cloudflare-rtc";
import { sweepCloudflareCalls } from "@/lib/azera-cloudflare-cleanup";
import { dispatchAzeraCampaignCall } from "@/lib/azera-campaign-worker";
export const maxDuration = 60;
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isSupabaseConfigured())
    return NextResponse.json(
      { error: "Database unavailable" },
      { status: 503 },
    );
  const now = new Date().toISOString();
  if (cloudflareSfuConfigured()) {
    try { await sweepCloudflareCalls(); }
    catch { return NextResponse.json({ error: "Cloudflare audio shutdown is unconfirmed; verify migration 136 and retry cleanup." }, { status: 503 }); }
  }
  // Browser timers are not a billing boundary. Independently close provider
  // sessions that outlive ten minutes, including closed tabs and lost replies.
  const { data: expiredAi, error: aiError } = await supabase
    .from("azera_calls")
    .select("id,sip_call_sid,answered_at")
    .eq("sip_provider", "openai_realtime")
    .in("status", ["ringing", "active"])
    .lt("created_at", new Date(Date.now() - 600_000).toISOString())
    .limit(3);
  if (aiError)
    return NextResponse.json(
      { error: "Could not check expired AI calls" },
      { status: 503 },
    );
  for (const call of expiredAi || []) {
    try {
      if (call.sip_call_sid) await hangupRealtimeCall(call.sip_call_sid);
      const { error } = await supabase
        .from("azera_calls")
        .update({
          status: "ended",
          final_outcome: "voice_time_limit",
          ended_at: now,
          updated_at: now,
          duration_seconds: call.answered_at
            ? Math.max(
                0,
                Math.floor((Date.now() - Date.parse(call.answered_at)) / 1000),
              )
            : 0,
        })
        .eq("id", call.id)
        .in("status", ["ringing", "active"]);
      if (error) throw new Error("History update failed");
    } catch {
      return NextResponse.json(
        {
          error:
            "Could not confirm provider shutdown for an expired AI call; retry required",
        },
        { status: 503 },
      );
    }
  }
  // Unknown is deliberately NOT retried automatically: the provider might
  // have accepted a message before a server/network interruption.
  const { error: pendingError } = await supabase
    .from("azera_messages")
    .update({
      delivery_status: "unknown",
      delivery_error:
        "The provider did not confirm this attempt. Check its inbox before retrying.",
      delivery_updated_at: now,
    })
    .eq("delivery_status", "pending")
    .lt("delivery_updated_at", new Date(Date.now() - 5 * 60_000).toISOString());
  const { error: callsError } = await supabase
    .from("azera_calls")
    .update({ status: "missed", ended_at: now, updated_at: now })
    .eq("status", "ringing")
    .lt("created_at", new Date(Date.now() - 120_000).toISOString())
    .in("sip_provider", ["africas_talking_browser"]);
  const { data: stale, error: staleError } = await supabase
    .from("azera_calls")
    .select("id,updated_at,answered_at")
    .eq("sip_provider", "africas_talking_browser")
    .eq("status", "active")
    .lt("updated_at", new Date(Date.now() - 180_000).toISOString())
    .limit(100);
  for (const call of stale || []) {
    // Compare the heartbeat timestamp so a newly refreshed call is never closed
    // by an older sweep snapshot. This reconciles history, not provider billing.
    const { error: closeError } = await supabase
      .from("azera_calls")
      .update({
        status: "failed",
        final_outcome: "agent_disconnected",
        ended_at: call.updated_at,
        updated_at: now,
        duration_seconds: call.answered_at
          ? Math.max(
              0,
              Math.floor(
                (Date.parse(call.updated_at) - Date.parse(call.answered_at)) /
                  1000,
              ),
            )
          : 0,
      })
      .eq("id", call.id)
      .eq("status", "active")
      .eq("updated_at", call.updated_at);
    if (closeError)
      return NextResponse.json(
        { error: "Could not reconcile disconnected call history" },
        { status: 503 },
      );
  }
  const { data: due, error } = await supabase
    .from("azera_calls")
    .select("id,customer_name,follow_up_at")
    .lte("follow_up_at", now)
    .neq("follow_up_status", "resolved")
    .order("follow_up_at", { ascending: true })
    .limit(100);
  if (error || pendingError || callsError || staleError)
    return NextResponse.json(
      { error: "Could not sweep contact-centre work. Verify migration 134." },
      { status: 503 },
    );
  let reminded = 0;
  for (const call of due || []) {
    const claim = await supabase
      .from("azera_follow_up_alerts")
      .insert({ call_id: call.id, due_at: call.follow_up_at });
    if (claim.error?.code === "23505") continue;
    if (claim.error)
      return NextResponse.json(
        { error: "Could not claim follow-up reminder" },
        { status: 503 },
      );
    await notifyAllAdmins({
      type: "OMNICHANNEL_FOLLOWUP",
      title: "Call follow-up due",
      message: `Follow up with ${call.customer_name || "this contact"}.`,
      deep_link: `/admin/azera/reports?call=${call.id}`,
      source_type: "azera_call",
      source_id: call.id,
      roles: ["Admin", "Customer Care", "Tech", "Sales"],
      actor_admin_user_id: null,
      email: {
        route: "support_ticket",
        subject: "Call follow-up due",
        text: `A scheduled call follow-up is due.\n\n${contactCentreUrl(`/admin/azera/reports?call=${call.id}`)}`,
      },
    });
    reminded++;
  }
  let campaign = { dispatched: false };
  try {
    campaign = await dispatchAzeraCampaignCall();
  } catch {
    return NextResponse.json({ error: "Could not dispatch outbound campaign call. Check migration 140 and Africa’s Talking Voice setup." }, { status: 503 });
  }
  return NextResponse.json({ success: true, reminded, campaign });
}
