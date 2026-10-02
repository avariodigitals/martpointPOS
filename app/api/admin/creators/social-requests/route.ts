import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"

export const dynamic = "force-dynamic"

/** GET /api/admin/creators/social-requests?status=PENDING&creatorId=<uuid> */
export async function GET(request: Request) {
  const { denied } = await authorizeAdmin("creator.view")
  if (denied) return denied
  if (!isSupabaseConfigured()) return NextResponse.json({ requests: [] })

  const url = new URL(request.url)
  const status = url.searchParams.get("status") || "PENDING"
  const creatorId = url.searchParams.get("creatorId")

  let q = supabase
    .from("creator_social_change_requests")
    .select("*, creators(full_name, creator_id)")
    .order("created_at", { ascending: false })
    .limit(100)
  if (status !== "ALL") q = q.eq("status", status)
  if (creatorId) q = q.eq("creator_id", creatorId)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: "Failed to load requests" }, { status: 500 })

  const requests = (data || []).map((r) => {
    const rel = r.creators as { full_name: string; creator_id: string } | { full_name: string; creator_id: string }[] | null
    const creator = Array.isArray(rel) ? rel[0] : rel
    return {
      id: r.id,
      creatorId: r.creator_id,
      creatorName: creator?.full_name || null,
      creatorPublicId: creator?.creator_id || null,
      socialProfileId: r.social_profile_id,
      requestType: r.request_type,
      payload: r.payload,
      note: r.note,
      status: r.status,
      reviewNote: r.review_note,
      createdAt: r.created_at,
      reviewedAt: r.reviewed_at,
    }
  })
  return NextResponse.json({ requests })
}
