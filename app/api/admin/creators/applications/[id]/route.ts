import { NextResponse } from "next/server"
import { z } from "zod"
import { authorizeAdmin } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { getCreatorApplicationById, getApplicationSocialProfiles } from "@/lib/creators"
import { listInterviews, listCreatorAdminNotes, deleteCreatorApplication, isApplicationDeleted } from "@/lib/creator-applications"
import { auditContextFromSession } from "@/lib/audit"

export const dynamic = "force-dynamic"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { denied } = await authorizeAdmin("creator.view")
  if (denied) return denied
  const { id } = await params

  const application = await getCreatorApplicationById(id)
  if (!application || (await isApplicationDeleted(id))) {
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

const deleteSchema = z.object({
  reason: z.string().max(1000).optional().nullable(),
})

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, denied } = await authorizeAdmin("creator.application.review")
  if (denied) return denied
  const { id } = await params

  const body = deleteSchema.safeParse(await request.json().catch(() => ({})))
  const actor = { id: session.userId, name: session.name || session.username }
  const ctx = auditContextFromSession(session, request)

  const result = await deleteCreatorApplication(id, actor, ctx, body.success ? body.data.reason ?? null : null)
  if (!result.ok) {
    return NextResponse.json({ error: result.error || "Delete failed" }, { status: result.error === "Application not found" ? 404 : 400 })
  }
  return NextResponse.json({ success: true })
}
