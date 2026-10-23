import { NextResponse } from "next/server"
import { revalidateTag } from "next/cache"
import { getSession, hasPermission } from "@/lib/admin-auth"
import type { SessionPayload, UserRole } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { getAiProviderStatus } from "@/lib/ai-chat"

async function requireSession(): Promise<SessionPayload | null> {
  const session = await getSession()
  if (!session || !hasPermission(session.role as UserRole, "settings")) {
    return null
  }
  return session
}

async function resolveBusinessId(value: string | null | undefined): Promise<string | null> {
  if (value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) return value
  // The old admin form sent business_id=1. Resolve that legacy value to the
  // first configured tenant instead of sending an integer into a UUID column.
  const { data } = await supabase.from("businesses").select("id").order("created_at", { ascending: true }).limit(1).maybeSingle()
  return (data?.id as string | undefined) || null
}

export async function GET(request: Request) {
  const session = await requireSession()
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const businessId = await resolveBusinessId(searchParams.get("business_id"))

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ settings: null })
  }

  if (!businessId) return NextResponse.json({ error: "No business is configured for Azera settings" }, { status: 400 })

  try {
    const { data, error } = await supabase
      .from("azera_settings")
      .select("*")
      .eq("business_id", businessId)
      .maybeSingle()

    if (error) {
      console.error("[Azera settings get error]", error)
      return NextResponse.json({ error: "Failed to load settings" }, { status: 500 })
    }

    const { data: globalRow } = await supabase.from("settings").select("data").eq("id", 1).maybeSingle()
    const globalSip = ((globalRow?.data as Record<string, unknown> | null)?.sip as Record<string, unknown> | undefined) || {}
    const aiProvider = await getAiProviderStatus()
    return NextResponse.json({
      settings: data ? { ...data, ...aiProvider, sip_provider: globalSip.provider || null, sip_from_number: globalSip.from_number || null, africas_talking_api_key: globalSip.api_key || null, africas_talking_username: globalSip.username || null, twilio_account_sid: globalSip.account_sid || null, twilio_auth_token: globalSip.auth_token || null, twilio_from: globalSip.from_number || null } : null,
      ai_provider: aiProvider,
    })
  } catch (err) {
    console.error("[Azera settings get error]", err)
    return NextResponse.json({ error: "Failed to load settings" }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const session = await requireSession()
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 })
  }

  try {
    const body = await request.json()
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
      africas_talking_phone_number,
      africas_talking_forward_numbers,
      voice_greeting,
      voice_no_answer_greeting,
      voice_menu_enabled,
      voice_departments,
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
    } = body

    const business_id = await resolveBusinessId(requestedBusinessId)
    if (!business_id) return NextResponse.json({ error: "No business is configured for Azera settings" }, { status: 400 })

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (widget_enabled !== undefined) updates.widget_enabled = widget_enabled
    if (widget_title !== undefined) updates.widget_title = widget_title
    if (widget_greeting !== undefined) updates.widget_greeting = widget_greeting
    if (brand_color !== undefined) updates.brand_color = brand_color
    if (position !== undefined) updates.position = position
    if (ai_enabled !== undefined) updates.ai_enabled = ai_enabled
    if (ai_prompt !== undefined) updates.ai_prompt = ai_prompt
    if (ai_voice_enabled !== undefined) updates.ai_voice_enabled = ai_voice_enabled
    if (ai_voice_provider !== undefined) updates.ai_voice_provider = ai_voice_provider
    if (ai_voice !== undefined) updates.ai_voice = ai_voice
    if (africas_talking_phone_number !== undefined) updates.africas_talking_phone_number = africas_talking_phone_number
    if (africas_talking_forward_numbers !== undefined) {
      updates.africas_talking_forward_numbers = Array.isArray(africas_talking_forward_numbers)
        ? africas_talking_forward_numbers
        : String(africas_talking_forward_numbers)
            .split(",")
            .map((value) => value.trim())
            .filter(Boolean)
    }
    if (voice_greeting !== undefined) updates.voice_greeting = String(voice_greeting).trim()
    if (voice_no_answer_greeting !== undefined) updates.voice_no_answer_greeting = String(voice_no_answer_greeting).trim()
    if (voice_menu_enabled !== undefined) updates.voice_menu_enabled = Boolean(voice_menu_enabled)
    if (voice_departments !== undefined) {
      updates.voice_departments = Array.isArray(voice_departments) ? voice_departments : []
    }
    if (messenger_page_id !== undefined) updates.messenger_page_id = messenger_page_id
    if (instagram_account_id !== undefined) updates.instagram_account_id = instagram_account_id
    if (google_place_id !== undefined) updates.google_place_id = google_place_id
    if (google_review_enabled !== undefined) updates.google_review_enabled = google_review_enabled
    if (google_review_message !== undefined) updates.google_review_message = google_review_message

    const { data: existing } = await supabase
      .from("azera_settings")
      .select("business_id")
      .eq("business_id", business_id)
      .maybeSingle()

    let result
    if (existing) {
      const { data, error } = await supabase
        .from("azera_settings")
        .update(updates)
        .eq("business_id", business_id)
        .select()
        .single()
      if (error) throw error
      result = data
    } else {
      const { data, error } = await supabase
        .from("azera_settings")
        .insert({ business_id, ...updates })
        .select()
        .single()
      if (error) throw error
      result = data
    }

    if (sip_provider !== undefined || sip_from_number !== undefined || africas_talking_api_key !== undefined || africas_talking_username !== undefined || twilio_account_sid !== undefined || twilio_auth_token !== undefined || twilio_from !== undefined) {
      const { data: globalRow } = await supabase.from("settings").select("data").eq("id", 1).maybeSingle()
      const global = (globalRow?.data as Record<string, unknown> | null) || {}
      const currentSip = (global.sip as Record<string, unknown> | undefined) || {}
      const nextSip = {
        ...currentSip,
        provider: sip_provider ?? currentSip.provider ?? "",
        from_number: sip_from_number ?? twilio_from ?? currentSip.from_number ?? "",
        api_key: africas_talking_api_key ?? currentSip.api_key ?? "",
        username: africas_talking_username ?? currentSip.username ?? "",
        account_sid: twilio_account_sid ?? currentSip.account_sid ?? "",
        auth_token: twilio_auth_token ?? currentSip.auth_token ?? "",
      }
      await supabase.from("settings").upsert({ id: 1, data: { ...global, sip: nextSip } })
      revalidateTag("settings", { expire: 0 })
    }

    return NextResponse.json({ success: true, settings: result })
  } catch (err) {
    console.error("[Azera settings patch error]", err)
    const errorMessage = err instanceof Error
      ? err.message
      : err && typeof err === "object" && "message" in err
        ? String((err as { message?: unknown }).message || "Failed to save settings")
        : "Failed to save settings"
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}
