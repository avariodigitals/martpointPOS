import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import {
  createOrUpdateProfile,
  recordActivity,
  updateHealth,
  getHealthSignals,
  type CustomerSuccessActivity,
  type CustomerHealth,
} from "@/lib/customer-success"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"

/* ─── GET ─── */
export async function GET(request: Request) {
  const { session, denied } = await authorizeAdmin("businesses", "view")
  if (denied) return denied

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get("id")
    const signals = searchParams.get("signals")

    if (signals) {
      const signalsData = await getHealthSignals(signals)
      return NextResponse.json({ success: true, businessId: signals, signals: signalsData })
    }

    if (id) {
      const { data, error } = await supabase
        .from("customer_success_profiles")
        .select("*")
        .eq("id", id)
        .maybeSingle()
      if (error) throw error
      return NextResponse.json({ success: true, profile: data })
    }

    const business = searchParams.get("business")
    if (business) {
      const [profile, activities, signalsData] = await Promise.all([
        supabase.from("customer_success_profiles").select("*").eq("business_id", business).maybeSingle(),
        supabase.from("customer_success_activities").select("*").eq("business_id", business).order("created_at", { ascending: false }),
        getHealthSignals(business),
      ])
      return NextResponse.json({
        success: true,
        businessId: business,
        profile: profile.data,
        activities: activities.data || [],
        signals: signalsData,
      })
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json({ success: true, profiles: [] })
    }

    const [profiles, businesses, users] = await Promise.all([
      supabase.from("customer_success_profiles").select("*").order("updated_at", { ascending: false }),
      supabase.from("businesses").select("id, business_name"),
      supabase.from("users").select("id, name"),
    ])

    const businessMap = new Map<string, string>()
    for (const b of (businesses.data || []) as Array<{ id: string; business_name: string }>) {
      businessMap.set(b.id, b.business_name)
    }

    const userMap = new Map<string, string>()
    for (const u of (users.data || []) as Array<{ id: string; name: string }>) {
      userMap.set(u.id, u.name)
    }

    const profileRows = (profiles.data || []) as Array<Record<string, unknown>>

    const signalsMap: Record<string, Awaited<ReturnType<typeof getHealthSignals>>> = {}
    if (profileRows.length > 0) {
      const signalsResults = await Promise.all(
        profileRows.map((p) => getHealthSignals(p.business_id as string))
      )
      for (let i = 0; i < profileRows.length; i++) {
        signalsMap[profileRows[i].business_id as string] = signalsResults[i]
      }
    }

    const list = profileRows.map((p) => ({
      ...(p as Record<string, unknown>),
      business_name: businessMap.get(p.business_id as string) || null,
      owner_name: p.owner_admin_user_id ? userMap.get(p.owner_admin_user_id as string) || null : null,
      signals: signalsMap[p.business_id as string],
    }))

    return NextResponse.json({ success: true, profiles: list, signalsMap })
  } catch (err) {
    console.error("[Customer Success API GET]", err)
    return NextResponse.json({ error: "Failed to load customer success data" }, { status: 500 })
  }
}

/* ─── POST ─── */
export async function POST(request: Request) {
  const { session, denied } = await authorizeAdmin("businesses", "manage")
  if (denied) return denied

  try {
    const body = await request.json()
    const { action, data } = body as { action: string; data: Record<string, unknown> }

    if (!action || !data) {
      return NextResponse.json({ error: "Missing action or data" }, { status: 400 })
    }

    if (action === "create_or_update") {
      const businessId = data.business_id as string
      const updates = { ...data }
      delete updates.business_id
      const profile = await createOrUpdateProfile(businessId, updates, session?.userId)
      return NextResponse.json({ success: true, profile })
    }

    if (action === "record_activity") {
      const input = data as Omit<CustomerSuccessActivity, "id" | "created_at">
      const activity = await recordActivity({ ...input, admin_user_id: session?.userId })
      return NextResponse.json({ success: true, activity })
    }

    if (action === "update_health") {
      const { business_id, health, reason } = data as {
        business_id: string
        health: CustomerHealth
        reason?: string
      }
      const profile = await updateHealth(business_id, health, session?.userId, reason)
      return NextResponse.json({ success: true, profile })
    }

    if (action === "get_signals") {
      const { business_id } = data as { business_id: string }
      const signals = await getHealthSignals(business_id)
      return NextResponse.json({ success: true, businessId: business_id, signals })
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  } catch (err) {
    console.error("[Customer Success API POST]", err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
