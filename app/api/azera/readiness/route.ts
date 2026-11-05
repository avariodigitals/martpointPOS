import { NextResponse } from "next/server";
import { getSession, hasPermissionForUser } from "@/lib/admin-auth";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { getSettings } from "@/lib/settings";
import { selfHostedMediaAllowed } from "@/lib/azera-media";
import { realtimeProvider, realtimeVoiceEnabled } from "@/lib/azera-realtime";
import { cloudflareSfuEnabled, cloudflareSfuConfigured, cloudflareTurnConfigured } from "@/lib/cloudflare-rtc";
import {
  africaBrowserConfig,
  africaBrowserReady,
} from "@/lib/africa-browser-voice";
type Check = {
  id: string;
  label: string;
  status: "configured" | "needs_setup" | "blocked";
  detail: string;
  href?: string;
};
export async function GET() {
  const session = await getSession();
  if (!session || !await hasPermissionForUser(session.userId, session.role, "azera"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!isSupabaseConfigured())
    return NextResponse.json(
      { error: "Contact-centre checks are temporarily unavailable. Please try again." },
      { status: 503 },
    );
  try {
    const settings = await getSettings();
    const { data: rows, error } = await supabase
      .from("azera_settings")
      .select(
        "business_id,africas_talking_phone_number,voice_menu_enabled,voice_departments,voice_voicemail_enabled,messenger_page_id,messenger_page_access_token,instagram_account_id,instagram_access_token,whatsapp_phone_number_id,whatsapp_access_token,whatsapp_phone_number",
      );
    const schema = await supabase
      .from("azera_messages")
      .select("delivery_status,client_message_id,provider_message_id")
      .limit(0);
    const checks: Check[] = [];
    const schemaReady = !error && !schema.error;
    checks.push({
      id: "database",
      label: "Contact-centre setup",
      status: schemaReady ? "configured" : "needs_setup",
      detail: schemaReady
        ? "Contact-centre setup is ready."
        : "Some contact-centre features are unavailable. Ask an administrator for help.",
    });
    const business =
      (rows || []).find((row) => row.africas_talking_phone_number) || rows?.[0];
    const voice = await africaBrowserConfig(business?.business_id);
    checks.push({
      id: "browser-phone",
      label: "Staff phone service",
      status: africaBrowserReady(voice) ? "configured" : "needs_setup",
      detail: africaBrowserReady(voice)
        ? "Phone setup is present. Place a test call to confirm it works."
        : "Phone calling needs administrator setup.",
      href: "/admin/azera/settings",
    });
    const turn = Boolean(
      process.env.AZERA_TURN_URLS &&
      (process.env.AZERA_TURN_SECRET ||
        (process.env.AZERA_TURN_USERNAME && process.env.AZERA_TURN_CREDENTIAL)),
    );
    checks.push({
      id: "website-audio",
      label: "Website calling",
      status: process.env.AZERA_BROWSER_MEDIA === "cloudflare" ? cloudflareSfuEnabled() ? "configured" : "needs_setup" : turn ? "configured" : "needs_setup",
      detail: process.env.AZERA_BROWSER_MEDIA === "cloudflare"
        ? cloudflareSfuConfigured() && cloudflareTurnConfigured()
          ? "Website calling is set up. Place a test call to confirm sound on the devices your team uses."
          : "Website calling needs administrator setup."
        : turn
        ? "Website calling is set up. Place a test call to confirm sound on the devices your team uses."
        : "Website calls may not connect on every network. Ask an administrator to review call setup.",
    });
    const businessId = business?.business_id;
    const [incomingCallResult, assignmentResult, browserAgentResult, ringSchema] = businessId
      ? await Promise.all([
          supabase.from("azera_calls")
            .select("created_at,status,final_outcome")
            .eq("business_id", businessId).eq("direction", "inbound")
            .order("created_at", { ascending: false }).limit(1).maybeSingle(),
          supabase.from("azera_voice_agent_assignments")
            .select("user_id,queues,enabled").eq("business_id", businessId).eq("enabled", true),
          supabase.from("azera_africa_browser_agents")
            .select("user_id,ready,last_seen_at").eq("business_id", businessId)
            .eq("ready", true).gt("last_seen_at", new Date(Date.now() - 60_000).toISOString()),
          supabase.from("azera_africa_browser_call_rings").select("call_id").limit(0),
        ])
      : [null, null, null, null] as const;
    const latestInboundCall = incomingCallResult?.data;
    const callAt = latestInboundCall?.created_at
      ? new Date(latestInboundCall.created_at).toLocaleString()
      : null;
    const callStatus = latestInboundCall
      ? ({ ringing: "ringing", active: "connected", ended: "ended", missed: "missed", failed: "failed", busy: "busy" } as Record<string, string>)[latestInboundCall.status] || "received"
      : "";
    const assignments = assignmentResult?.data || [];
    const assignedUsers = new Set(assignments.flatMap((assignment) =>
      Array.isArray(assignment.queues) && assignment.queues.length ? [assignment.user_id] : [],
    ));
    const onlineUsers = new Set((browserAgentResult?.data || []).map((row) => row.user_id));
    const onlineAssignedAgents = [...assignedUsers].filter((userId) => onlineUsers.has(userId)).length;
    checks.push({
      id: "incoming",
      label: "Incoming calls",
      status:
        process.env.AFRICASTALKING_CALLBACK_SECRET &&
        business?.africas_talking_phone_number &&
        !incomingCallResult?.error && latestInboundCall
          ? "configured"
          : "needs_setup",
      detail: incomingCallResult?.error
        ? "Could not check incoming-call activity. Please try again later."
        : latestInboundCall
          ? `Last incoming call: ${callAt} (${callStatus}). Place a test call to confirm team phones ring.`
          : "No incoming call has reached the system yet. Check your phone service’s incoming-call settings, then place a test call.",
      href: "/admin/azera/settings",
    });
    checks.push({
      id: "browser-agents",
      label: "Team phones online",
      status: !businessId || assignmentResult?.error || browserAgentResult?.error ? "needs_setup" : onlineAssignedAgents > 0 ? "configured" : "needs_setup",
      detail: !businessId
        ? "Phone calling is not set up for this business. Ask an administrator for help."
        : assignmentResult?.error || browserAgentResult?.error
        ? "Could not check team phone availability. Please try again later."
        : assignedUsers.size
          ? `${onlineAssignedAgents} of ${assignedUsers.size} assigned team member(s) have their phone on. Keep the softphone open to receive calls.`
          : "No team members are assigned to a call queue yet.",
      href: "/admin/azera/voice-agents",
    });
    checks.push({
      id: "browser-ring-groups",
      label: "Team phones",
      status: !ringSchema || ringSchema.error ? "needs_setup" : "configured",
      detail: !businessId
        ? "Phone calling is not set up for this business. Ask an administrator for help."
        : ringSchema?.error
        ? "Group calling is unavailable. Ask an administrator for help."
        : "Available team phones can ring together. Place a test call to confirm.",
      href: "/admin/azera/calls",
    });
    const secret = Boolean(process.env.META_APP_SECRET);
    const any = (
      predicate: (row: NonNullable<typeof rows>[number]) => boolean,
    ) => (rows || []).some(predicate);
    checks.push({
      id: "whatsapp",
      label: "WhatsApp replies & receipts",
      status: any((row) =>
        Boolean(
          (row.whatsapp_phone_number_id &&
            (row.whatsapp_access_token || process.env.WHATSAPP_ACCESS_TOKEN) &&
            (secret || process.env.WHATSAPP_APP_SECRET)) ||
          (row.whatsapp_phone_number &&
            settings.whatsapp.apiKey &&
            settings.whatsapp.webhookSecret),
        ),
      )
        ? "configured"
        : "needs_setup",
      detail:
        "Connect your messaging account in Azera Settings.",
      href: "/admin/azera/settings",
    });
    for (const channel of ["messenger", "instagram"] as const)
      checks.push({
        id: channel,
        label:
          channel === "messenger"
            ? "Messenger replies & receipts"
            : "Instagram replies",
        status: any((row) =>
          Boolean(
            (channel === "messenger"
              ? row.messenger_page_id &&
                (row.messenger_page_access_token ||
                  process.env.MESSENGER_PAGE_ACCESS_TOKEN)
              : row.instagram_account_id &&
                (row.instagram_access_token ||
                  process.env.INSTAGRAM_ACCESS_TOKEN)) &&
            (secret || process.env[`${channel.toUpperCase()}_APP_SECRET`]),
          ),
        )
          ? "configured"
          : "needs_setup",
        detail:
          "Connect this messaging account in Azera Settings.",
        href: "/admin/azera/settings",
      });
    checks.push({
      id: "recordings",
      label: "Recording privacy & playback",
      status: schemaReady ? "configured" : "needs_setup",
      detail:
        "Record a call only after the caller has agreed.",
      href: "/admin/azera/reports",
    });
    checks.push({
      id: "advanced",
      label: "Self-hosted agent handover & supervisor audio",
      status: selfHostedMediaAllowed(settings.livekit)
        ? "configured"
        : "blocked",
      detail:
        selfHostedMediaAllowed(settings.livekit)
          ? "Supervisor call tools are available. Test them with your team before use."
          : "Supervisor call tools are not available for this workspace.",
      href: "/admin/azera/calls",
    });
    const aiConfigured = await realtimeProvider()
      .then(() => true)
      .catch(() => false);
    checks.push({
      id: "ai-voice",
      label: "Continuous AI voice agent",
      status:
        aiConfigured && realtimeVoiceEnabled() ? "configured" : "needs_setup",
      detail:
        aiConfigured && realtimeVoiceEnabled()
          ? "Website voice assistance is set up. Test a conversation and team handoff before use."
          : "Website voice assistance needs administrator setup.",
      href: "/admin/azera/settings",
    });
    return NextResponse.json(
      { checkedAt: new Date().toISOString(), liveVerified: false, checks },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[Azera contact-centre readiness check failed]", error);
    return NextResponse.json(
      {
        error: "Contact-centre checks could not finish. Please try again.",
      },
      { status: 503 },
    );
  }
}
