import { NextResponse } from "next/server"
import { getSession, hasPermission } from "@/lib/admin-auth"
import type { SessionPayload, UserRole } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"

async function requireSession(): Promise<SessionPayload | null> {
  const session = await getSession()
  if (!session || !hasPermission(session.role as UserRole, "settings")) {
    return null
  }
  return session
}

export async function GET(request: Request) {
  const session = await requireSession()
  if (!session) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const businessId = searchParams.get("business_id")

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ settings: null })
  }

  if (!businessId) {
    return NextResponse.json({ error: "business_id is required" }, { status: 400 })
  }

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

    return NextResponse.json({ settings: data || null })
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
      business_id,
      widget_enabled,
      widget_title,
      widget_greeting,
      brand_color,
      position,
      ai_enabled,
      ai_prompt,
    } = body

    if (!business_id) {
      return NextResponse.json({ error: "business_id is required" }, { status: 400 })
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (widget_enabled !== undefined) updates.widget_enabled = widget_enabled
    if (widget_title !== undefined) updates.widget_title = widget_title
    if (widget_greeting !== undefined) updates.widget_greeting = widget_greeting
    if (brand_color !== undefined) updates.brand_color = brand_color
    if (position !== undefined) updates.position = position
    if (ai_enabled !== undefined) updates.ai_enabled = ai_enabled
    if (ai_prompt !== undefined) updates.ai_prompt = ai_prompt

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

    return NextResponse.json({ settings: result })
  } catch (err) {
    console.error("[Azera settings patch error]", err)
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 })
  }
}
