import { NextResponse } from "next/server";
import { getSession, hasPermission } from "@/lib/admin-auth";
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
  if (!session || !hasPermission(session.role, "azera"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!isSupabaseConfigured())
    return NextResponse.json(
      { error: "The contact-centre database is unavailable." },
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
      label: "Contact-centre database",
      status: schemaReady ? "configured" : "needs_setup",
      detail: schemaReady
        ? "Delivery tracking and connection fields are available."
        : "Apply migration 134 before enabling the new delivery, reports and privacy controls.",
    });
    const business =
      (rows || []).find((row) => row.africas_talking_phone_number) || rows?.[0];
    const voice = await africaBrowserConfig(business?.business_id);
    checks.push({
      id: "browser-phone",
      label: "Africa’s Talking browser dialler",
      status: africaBrowserReady(voice) ? "configured" : "needs_setup",
      detail: africaBrowserReady(voice)
        ? "Live credentials and a virtual number are present. Provider WebRTC activation, balance and a real call still need verification."
        : "Set the live Africa’s Talking username, API key and virtual voice number. No LiveKit subscription is required.",
      href: "/admin/azera/settings",
    });
    const turn = Boolean(
      process.env.AZERA_TURN_URLS &&
      (process.env.AZERA_TURN_SECRET ||
        (process.env.AZERA_TURN_USERNAME && process.env.AZERA_TURN_CREDENTIAL)),
    );
    checks.push({
      id: "website-audio",
      label: "Website-to-agent audio",
      status: process.env.AZERA_BROWSER_MEDIA === "cloudflare" ? cloudflareSfuEnabled() ? "configured" : "needs_setup" : turn ? "configured" : "needs_setup",
      detail: process.env.AZERA_BROWSER_MEDIA === "cloudflare"
        ? `Cloudflare SFU: ${cloudflareSfuConfigured() ? "credentials present" : "App ID/Secret missing"}; TURN: ${cloudflareTurnConfigured() ? "credentials present" : "key/token missing"}. Apply migration 136 and verify the cleanup cron. Credentials do not prove live audio works; test iOS, Android and separate networks. No VPS or RealtimeKit is used.`
        : turn
        ? "TURN relay credentials are present; verify iOS, Android and separate networks with two consenting test participants."
        : "STUN-only calling cannot reliably cross every network. Configure AZERA_TURN_URLS and TURN credentials or a shared TURN secret.",
    });
    checks.push({
      id: "incoming",
      label: "Incoming telephone routing",
      status:
        process.env.AFRICASTALKING_CALLBACK_SECRET &&
        business?.africas_talking_phone_number
          ? "configured"
          : "needs_setup",
      detail:
        "Use the existing Africa’s Talking callback, events and voicemail endpoints. Verify number activation, callback secret, department destinations, busy and closed-hours branches.",
      href: "/admin/azera/settings",
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
        "Cloud API needs a business phone-number ID, messaging token and app secret. 360dialog needs the existing API key, webhook secret and business-number mapping.",
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
          "Set the account ID, supported messaging token, webhook verification token and app secret. Provider approval and the reply window still apply.",
        href: "/admin/azera/settings",
      });
    checks.push({
      id: "recordings",
      label: "Recording privacy & playback",
      status: schemaReady ? "configured" : "needs_setup",
      detail:
        "Migration 134 makes recordings private. Consent-confirmed uploads and short-lived playback links are supported. Automatic telephone recording is not enabled by uploading a file.",
      href: "/admin/azera/reports",
    });
    checks.push({
      id: "advanced",
      label: "Self-hosted agent handover & supervisor audio",
      status: selfHostedMediaAllowed(settings.livekit)
        ? "configured"
        : "blocked",
      detail:
        "The workspace supports direct agent handover, listen-only, separate private coaching and joining a call, for calls on the approved self-hosted media server. A compatible Africa’s Talking SIP trunk and a capable host are required. Paid LiveKit Cloud is blocked. Shared cPanel hosting has not been verified as suitable. Private consultation/warm transfer is not implemented.",
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
        "Website AI voice uses direct OpenAI Realtime: apply migration 135, verify scheduled shutdown, set AZERA_REALTIME_ENABLED=true and enable it for the business in Azera Settings. AI usage charges apply; no LiveKit server is needed. Human requests end AI audio then ring the team. This is not a telephone AI agent or a warm transfer. Verify model access, live audio and handoff before enabling.",
      href: "/admin/azera/settings",
    });
    return NextResponse.json(
      { checkedAt: new Date().toISOString(), liveVerified: false, checks },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      {
        error: "Readiness checks could not finish. No live calls were placed.",
      },
      { status: 503 },
    );
  }
}
