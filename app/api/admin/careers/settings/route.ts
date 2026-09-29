import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"

export const dynamic = "force-dynamic"

/* GET: departments, categories, settings, and admin users (for hiring-manager assignment). */
export async function GET() {
  const { denied } = await authorizeAdmin("careers.dashboard.view")
  if (denied) return denied
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ departments: [], categories: [], settings: {}, admins: [] })
  }

  const [departments, categories, settings, admins] = await Promise.all([
    supabase.from("career_departments").select("*").order("sort_order"),
    supabase.from("career_job_categories").select("*").order("sort_order"),
    supabase.from("career_settings").select("key, value"),
    supabase.from("users").select("id, name, username, role").eq("status", "ACTIVE").order("name"),
  ])

  const settingsMap: Record<string, unknown> = {}
  for (const s of settings.data || []) settingsMap[s.key] = s.value

  return NextResponse.json({
    departments: departments.data || [],
    categories: categories.data || [],
    settings: settingsMap,
    admins: admins.data || [],
  })
}

/* POST {type: "department"|"category"|"setting", ...} */
export async function POST(request: Request) {
  const { denied } = await authorizeAdmin("careers.settings.manage")
  if (denied) return denied
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Database not configured" }, { status: 503 })

  const body = await request.json().catch(() => ({}))
  const name = String(body.name || "").trim()

  if (body.type === "setting") {
    const key = String(body.key || "").trim()
    if (!key) return NextResponse.json({ error: "key required" }, { status: 400 })
    const { error } = await supabase
      .from("career_settings")
      .upsert({ key, value: body.value ?? {}, updated_at: new Date().toISOString() })
    if (error) return NextResponse.json({ error: "Failed to save setting" }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 })
  const table = body.type === "category" ? "career_job_categories" : "career_departments"
  const { error } = await supabase
    .from(table)
    .upsert(
      {
        ...(body.id ? { id: body.id } : {}),
        name,
        description: body.description || null,
        active: body.active !== false,
        sort_order: body.sort_order != null ? Number(body.sort_order) : 0,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "name" }
    )
  if (error) return NextResponse.json({ error: "Failed to save" }, { status: 500 })
  return NextResponse.json({ success: true })
}
