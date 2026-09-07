import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"

export async function GET(request: Request) {
  const { denied } = await authorizeAdmin("settings")
  if (denied) return denied

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const to = searchParams.get("to")
    const status = searchParams.get("status")
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "25", 10)))
    const offset = (page - 1) * limit

    let q = supabase
      .from("email_logs")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })

    if (to) q = q.ilike("to", `%${to}%`)
    if (status) q = q.eq("status", status)

    const { data, error, count } = await q.range(offset, offset + limit - 1)
    if (error) throw error

    return NextResponse.json({
      success: true,
      logs: data || [],
      count: count || 0,
      page,
      limit,
    })
  } catch (e) {
    console.error("[admin/email-logs] GET", e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
