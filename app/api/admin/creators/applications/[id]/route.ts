import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { getCreatorApplicationById, getApplicationSocialProfiles } from "@/lib/creators"
import { listInterviews, listCreatorAdminNotes } from "@/lib/creator-applications"

export const dynamic = "force-dynamic"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { denied } = await authorizeAdmin("creator.view")
  if (denied) return denied
  const { id } = await params

  const application = await getCreatorApplicationById(id)
  if (!application) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const [socials, interviews, notes, aiReviews] = await Promise.all([
    getApplicationSocialProfiles(id),
    listInterviews(id),
    listCreatorAdminNotes({ applicationId: id }),
    isSupabaseConfigured()
      ? supabase
          .from("creator_ai_reviews")
          .select("*")
          .eq("application_id", id)
          .order("created_at", { ascending: false })
          .then((r) => r.data || [])
      : Promise.resolve([]),
  ])

  // Strip the raw model response from list payloads (kept in DB for debugging).
  const reviews = aiReviews.map(({ raw_response, ...rest }) => {
    void raw_response
    return rest
  })

  return NextResponse.json({ application, socials, interviews, notes, aiReviews: reviews })
}
