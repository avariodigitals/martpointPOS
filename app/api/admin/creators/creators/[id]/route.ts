import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { getCreatorById } from "@/lib/creators"
import { listCreatorAdminNotes, getCreatorOverviewStats } from "@/lib/creator-applications"

export const dynamic = "force-dynamic"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { denied } = await authorizeAdmin("creator.view")
  if (denied) return denied
  const { id } = await params

  const creator = await getCreatorById(id)
  if (!creator) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const [notes, stats, socials, flags] = await Promise.all([
    listCreatorAdminNotes({ creatorId: id }),
    getCreatorOverviewStats(id),
    isSupabaseConfigured()
      ? supabase.from("creator_social_profiles").select("*").eq("creator_id", id).then((r) => r.data || [])
      : Promise.resolve([]),
    isSupabaseConfigured()
      ? supabase.from("creator_flags").select("*").eq("creator_id", id).order("created_at", { ascending: false }).then((r) => r.data || [])
      : Promise.resolve([]),
  ])

  return NextResponse.json({ creator, notes, stats, socials, flags })
}
