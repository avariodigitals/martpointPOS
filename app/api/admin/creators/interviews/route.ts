import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"

export const dynamic = "force-dynamic"

export async function GET() {
  const { denied } = await authorizeAdmin("creator.view")
  if (denied) return denied
  if (!isSupabaseConfigured()) return NextResponse.json({ interviews: [] })

  const { data } = await supabase
    .from("creator_interviews")
    .select("id, application_id, status, scheduled_at, duration_minutes, meeting_url, meeting_location, interviewer_name, result, created_at, creator_applications(full_name, reference_number, email)")
    .order("scheduled_at", { ascending: false, nullsFirst: false })
    .limit(200)

  return NextResponse.json({ interviews: data || [] })
}
