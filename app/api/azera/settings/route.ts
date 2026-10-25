import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { getSession, hasPermission } from "@/lib/admin-auth";
import type { SessionPayload, UserRole } from "@/lib/admin-auth";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { getAiProviderStatus } from "@/lib/ai-chat";
import { normalizeVoiceDestination } from "@/lib/africastalking";

async function requireSession(): Promise<SessionPayload | null> {
  const session = await getSession();
  if (!session || !hasPermission(session.role as UserRole, "settings")) {
    return null;
  }
  return session;
}

async function resolveBusinessId(
  value: string | null | undefined,
): Promise<string | null> {
  if (
    value &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  )
    return value;
  // The old admin form sent business_id=1. Resolve that legacy value to the
  // first configured tenant instead of sending an integer into a UUID column.
  const { data } = await supabase
    .from("businesses")
    .select("id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data?.id as string | undefined) || null;
}

export async function GET(request: Request) {
  const session = await requireSession();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const businessId = await resolveBusinessId(searchParams.get("business_id"));

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ settings: null });
  }

  if (!businessId)
    return NextResponse.json(
      { error: "No business is configured for Azera settings" },
      { status: 400 },
    );

  try {
    const { data, error } = await supabase
      .from("azera_settings")
      .select("*")
      .eq("business_id", businessId)
      .maybeSingle();

    if (error) {
      console.error("[Azera settings get error]", error);
      return NextResponse.json(
        { error: "Failed to load settings" },
        { status: 500 },
      );
    }

    const { data: globalRow } = await supabase
      .from("settings")
      .select("data")
      .eq("id", 1)
      .maybeSingle();
    const globalSip =
      ((globalRow?.data as Record<string, unknown> | null)?.sip as
        Record<string, unknown> | undefined) || {};
    const aiProvider = await getAiProviderStatus();
    return NextResponse.json({
      settings: data
        ? {
            ...data,
            ...aiProvider,
            sip_provider: globalSip.provider || null,
            sip_from_number: globalSip.from_number || null,
            africas_talking_api_key: globalSip.api_key || null,
            africas_talking_username: globalSip.username || null,
            twilio_account_sid: globalSip.account_sid || null,
            twilio_auth_token: globalSip.auth_token || null,
            twilio_from: globalSip.from_number || null,
          }
        : null,
      ai_provider: aiProvider,
    });
  } catch (err) {
    console.error("[Azera settings get error]", err);
    return NextResponse.json(
      { error: "Failed to load settings" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  const session = await requireSession();
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase not configured" },
      { status: 500 },
    );
  }

  try {
    const body = await request.json();
    const {
      business_id: requestedBusinessId,
      widget_enabled,
      widget_title,
      widget_greeting,
      brand_color,
      position,
      ai_enabled,
      ai_prompt,
      ai_voice_enabled,
      ai_voice_provider,
      ai_voice,
      voice_record_calls,
      voice_recording_notice,
      voice_recording_retention_days,
      voice_realtime_enabled,
      africas_talking_phone_number,
      africas_talking_forward_numbers,
      voice_greeting,
      voice_connecting_greeting,
      voice_no_answer_greeting,
      voice_busy_greeting,
      voice_after_hours_greeting,
      voice_after_hours_destination,
      voice_timezone,
      voice_weekly_schedule,
      voice_closed_dates,
      voice_menu_retry_limit,
      voice_menu_enabled,
      voice_departments,
      voice_voicemail_enabled,
      voice_voicemail_max_seconds,
      voice_voicemail_retention_days,
      voice_greeting_audio_url,
      voice_connecting_audio_url,
      voice_no_answer_audio_url,
      voice_after_hours_audio_url,
      voice_waiting_audio_url,
      messenger_page_id,
      instagram_account_id,
      google_place_id,
      google_review_enabled,
      google_review_message,
      sip_provider,
      sip_from_number,
      africas_talking_api_key,
      africas_talking_username,
      twilio_account_sid,
      twilio_auth_token,
      twilio_from,
    } = body;

    const business_id = await resolveBusinessId(requestedBusinessId);
    if (!business_id)
      return NextResponse.json(
        { error: "No business is configured for Azera settings" },
        { status: 400 },
      );

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (widget_enabled !== undefined) updates.widget_enabled = widget_enabled;
    if (widget_title !== undefined) updates.widget_title = widget_title;
    if (widget_greeting !== undefined)
      updates.widget_greeting = widget_greeting;
    if (brand_color !== undefined) updates.brand_color = brand_color;
    if (position !== undefined) updates.position = position;
    if (ai_enabled !== undefined) updates.ai_enabled = ai_enabled;
    if (ai_prompt !== undefined) updates.ai_prompt = ai_prompt;
    if (ai_voice_enabled !== undefined)
      updates.ai_voice_enabled = ai_voice_enabled;
    if (ai_voice_provider !== undefined)
      updates.ai_voice_provider = ai_voice_provider;
    if (ai_voice !== undefined) updates.ai_voice = ai_voice;
    if (voice_record_calls !== undefined) {
      if (typeof voice_record_calls !== "boolean")
        throw new Error("Recording setting must be true or false");
      updates.voice_record_calls = voice_record_calls;
    }
    if (voice_recording_notice !== undefined) {
      const notice = String(voice_recording_notice).trim();
      if (!notice || notice.length > 1000)
        throw new Error("Use a recording notice between 1 and 1000 characters");
      updates.voice_recording_notice = notice;
    }
    if (voice_recording_retention_days !== undefined) {
      const days = Number(voice_recording_retention_days);
      if (!Number.isInteger(days) || days < 1 || days > 365)
        throw new Error("Recording retention must be between 1 and 365 days");
      updates.voice_recording_retention_days = days;
    }
    if (voice_realtime_enabled !== undefined) {
      if (typeof voice_realtime_enabled !== "boolean")
        throw new Error("Realtime setting must be true or false");
      updates.voice_realtime_enabled = voice_realtime_enabled;
    }
    if (africas_talking_phone_number !== undefined)
      updates.africas_talking_phone_number = africas_talking_phone_number;
    if (africas_talking_forward_numbers !== undefined) {
      updates.africas_talking_forward_numbers = Array.isArray(
        africas_talking_forward_numbers,
      )
        ? africas_talking_forward_numbers
            .map((value) => normalizeVoiceDestination(value))
            .filter(Boolean)
        : String(africas_talking_forward_numbers)
            .split(",")
            .map((value) => normalizeVoiceDestination(value))
            .filter(Boolean);
    }
    if (voice_greeting !== undefined)
      updates.voice_greeting = String(voice_greeting).trim();
    if (voice_connecting_greeting !== undefined)
      updates.voice_connecting_greeting = String(
        voice_connecting_greeting,
      ).trim();
    if (voice_no_answer_greeting !== undefined)
      updates.voice_no_answer_greeting = String(
        voice_no_answer_greeting,
      ).trim();
    if (voice_busy_greeting !== undefined)
      updates.voice_busy_greeting = String(voice_busy_greeting).trim();
    if (voice_after_hours_greeting !== undefined)
      updates.voice_after_hours_greeting = String(
        voice_after_hours_greeting,
      ).trim();
    if (voice_after_hours_destination !== undefined)
      updates.voice_after_hours_destination =
        String(voice_after_hours_destination || "").trim() || null;
    if (voice_timezone !== undefined)
      updates.voice_timezone =
        String(voice_timezone || "Africa/Lagos").trim() || "Africa/Lagos";
    if (
      voice_weekly_schedule !== undefined &&
      voice_weekly_schedule &&
      typeof voice_weekly_schedule === "object"
    )
      updates.voice_weekly_schedule = voice_weekly_schedule;
    if (voice_closed_dates !== undefined)
      updates.voice_closed_dates = Array.isArray(voice_closed_dates)
        ? voice_closed_dates
        : [];
    if (voice_menu_retry_limit !== undefined)
      updates.voice_menu_retry_limit = Math.min(
        3,
        Math.max(0, Number(voice_menu_retry_limit) || 1),
      );
    if (voice_menu_enabled !== undefined)
      updates.voice_menu_enabled = Boolean(voice_menu_enabled);
    if (voice_departments !== undefined) {
      if (!Array.isArray(voice_departments))
        throw new Error("voice_departments must be an array");
      const usedDigits = new Set<number>();
      updates.voice_departments = voice_departments.map((department) => {
        const item = department as Record<string, unknown>;
        const digit = Number(item.digit);
        const label = String(item.label || "").trim();
        const primary = normalizeVoiceDestination(item.primary || "");
        const fallback = (Array.isArray(item.fallback) ? item.fallback : [])
          .map((value) => normalizeVoiceDestination(value))
          .filter((value) => value && value !== primary);
        if (
          !Number.isInteger(digit) ||
          digit < 1 ||
          digit > 8 ||
          usedDigits.has(digit)
        )
          throw new Error(
            "Department digits must be unique numbers from 1 to 8. Digit 9 is reserved to repeat the menu.",
          );
        if (!label || !primary)
          throw new Error(
            "Each department needs a name and primary destination",
          );
        usedDigits.add(digit);
        return {
          digit,
          key: String(
            item.key || label.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
          ).replace(/^-|-$/g, ""),
          label,
          primary,
          fallback,
          numbers: [primary, ...fallback],
          enabled: item.enabled !== false,
        };
      });
    }
    if (voice_voicemail_enabled !== undefined)
      updates.voice_voicemail_enabled = Boolean(voice_voicemail_enabled);
    if (voice_voicemail_max_seconds !== undefined)
      updates.voice_voicemail_max_seconds = Math.min(
        300,
        Math.max(15, Number(voice_voicemail_max_seconds) || 60),
      );
    if (voice_voicemail_retention_days !== undefined)
      updates.voice_voicemail_retention_days = Math.min(
        3650,
        Math.max(1, Number(voice_voicemail_retention_days) || 90),
      );
    for (const [key, value] of Object.entries({
      voice_greeting_audio_url,
      voice_connecting_audio_url,
      voice_no_answer_audio_url,
      voice_after_hours_audio_url,
      voice_waiting_audio_url,
    })) {
      if (value !== undefined) {
        const audioUrl = String(value || "").trim();
        if (audioUrl && !/^https:\/\//i.test(audioUrl))
          throw new Error("Audio URLs must use HTTPS");
        updates[key] = audioUrl || null;
      }
    }
    if (messenger_page_id !== undefined)
      updates.messenger_page_id = messenger_page_id;
    if (instagram_account_id !== undefined)
      updates.instagram_account_id = instagram_account_id;
    for (const key of [
      "messenger_page_access_token",
      "instagram_access_token",
      "whatsapp_phone_number_id",
      "whatsapp_access_token",
      "whatsapp_phone_number",
    ]) {
      if (body[key] !== undefined) {
        if (
          (typeof body[key] !== "string" && body[key] !== null) ||
          (typeof body[key] === "string" && body[key].length > 4000)
        )
          return NextResponse.json(
            { error: "Invalid social connection setting" },
            { status: 400 },
          );
        updates[key] = body[key]?.trim() || null;
      }
    }
    if (google_place_id !== undefined)
      updates.google_place_id = google_place_id;
    if (google_review_enabled !== undefined)
      updates.google_review_enabled = google_review_enabled;
    if (google_review_message !== undefined)
      updates.google_review_message = google_review_message;

    const { data: existing } = await supabase
      .from("azera_settings")
      .select("business_id")
      .eq("business_id", business_id)
      .maybeSingle();

    let result;
    if (existing) {
      const { data, error } = await supabase
        .from("azera_settings")
        .update(updates)
        .eq("business_id", business_id)
        .select()
        .single();
      if (error) throw error;
      result = data;
    } else {
      const { data, error } = await supabase
        .from("azera_settings")
        .insert({ business_id, ...updates })
        .select()
        .single();
      if (error) throw error;
      result = data;
    }

    if (
      sip_provider !== undefined ||
      sip_from_number !== undefined ||
      africas_talking_api_key !== undefined ||
      africas_talking_username !== undefined ||
      twilio_account_sid !== undefined ||
      twilio_auth_token !== undefined ||
      twilio_from !== undefined
    ) {
      const { data: globalRow } = await supabase
        .from("settings")
        .select("data")
        .eq("id", 1)
        .maybeSingle();
      const global = (globalRow?.data as Record<string, unknown> | null) || {};
      const currentSip =
        (global.sip as Record<string, unknown> | undefined) || {};
      const nextSip = {
        ...currentSip,
        provider: sip_provider ?? currentSip.provider ?? "",
        from_number:
          sip_from_number ?? twilio_from ?? currentSip.from_number ?? "",
        api_key: africas_talking_api_key ?? currentSip.api_key ?? "",
        username: africas_talking_username ?? currentSip.username ?? "",
        account_sid: twilio_account_sid ?? currentSip.account_sid ?? "",
        auth_token: twilio_auth_token ?? currentSip.auth_token ?? "",
      };
      await supabase
        .from("settings")
        .upsert({ id: 1, data: { ...global, sip: nextSip } });
      revalidateTag("settings", { expire: 0 });
    }

    return NextResponse.json({ success: true, settings: result });
  } catch (err) {
    console.error("[Azera settings patch error]", err);
    const errorMessage =
      err instanceof Error
        ? err.message
        : err && typeof err === "object" && "message" in err
          ? String(
              (err as { message?: unknown }).message ||
                "Failed to save settings",
            )
          : "Failed to save settings";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
