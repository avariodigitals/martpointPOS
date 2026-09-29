import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"

export const dynamic = "force-dynamic"

/* GET: vacancy activity history (from the shared audit log). */
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { denied } = await authorizeAdmin("careers.vacancies.view")
  if (denied) return denied
  if (!isSupabaseConfigured()) return NextResponse.json({ events: [] })
  const { id } = await ctx.params

  const { data } = await supabase
    .from("audit_logs")
    .select("id, action, actor_name, metadata, created_at")
    .eq("entity_type", "career_vacancy")
    .eq("entity_id", id)
    .order("created_at", { ascending: false })
    .limit(100)

  return NextResponse.json({ events: data || [] })
}
