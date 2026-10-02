import { NextResponse } from "next/server"
import { z } from "zod"
import { authorizeAdmin } from "@/lib/admin-auth"
import { supabase } from "@/lib/supabase"
import { recordAudit, AUDIT_ACTIONS, AUDIT_ENTITIES, auditContextFromSession } from "@/lib/audit"
import { pushCreatorNotification } from "@/lib/creator-notifications"
import { CREATOR_PLATFORMS } from "@/lib/creator-constants"

export const dynamic = "force-dynamic"

const decisionSchema = z.object({
  action: z.enum(["approve", "reject"]),
  reviewNote: z.string().trim().max(500).nullish(),
})

const payloadSchema = z.object({
  platform: z.enum(CREATOR_PLATFORMS).optional(),
  profileUrl: z.string().trim().url().max(500).optional(),
  username: z.string().trim().max(100).nullish(),
  followers: z.number().int().min(0).max(500_000_000).nullish(),
  isPrimary: z.boolean().optional(),
})

async function clearOtherPrimaries(creatorId: string, exceptId?: string) {
  let q = supabase.from("creator_social_profiles").update({ is_primary: false }).eq("creator_id", creatorId)
  if (exceptId) q = q.neq("id", exceptId)
  await q
}

async function applyRequest(req: Record<string, unknown>): Promise<{ ok: boolean; error?: string }> {
  const payload = payloadSchema.parse(req.payload || {})
  const type = req.request_type as string
  const creatorId = req.creator_id as string
  const socialProfileId = req.social_profile_id as string | null

  const row = {
    platform: payload.platform,
    profile_url: payload.profileUrl,
    username: payload.username ?? null,
    followers: payload.followers ?? null,
    is_primary: !!payload.isPrimary,
  }

  if (type === "ADD") {
    if (!row.platform || !row.profile_url) return { ok: false, error: "Incomplete add payload" }
    if (row.is_primary) await clearOtherPrimaries(creatorId)
    const { error } = await supabase.from("creator_social_profiles").insert({
      application_id: req.application_id,
      creator_id: creatorId,
      platform: row.platform,
      profile_url: row.profile_url,
      username: row.username,
      followers: row.followers,
      is_primary: row.is_primary,
    })
    return error ? { ok: false, error: "Failed to add profile" } : { ok: true }
  }

  if (!socialProfileId) return { ok: false, error: "Missing profile reference" }

  if (type === "REMOVE") {
    // Idempotent — already-gone profiles still mark the request approved.
    const { error } = await supabase
      .from("creator_social_profiles")
      .delete()
      .eq("id", socialProfileId)
      .eq("creator_id", creatorId)
    return error ? { ok: false, error: "Failed to remove profile" } : { ok: true }
  }

  // UPDATE
  const patch: Record<string, unknown> = {}
  if (row.platform !== undefined) patch.platform = row.platform
  if (row.profile_url !== undefined) patch.profile_url = row.profile_url
  if (payload.username !== undefined) patch.username = row.username
  if (payload.followers !== undefined) patch.followers = row.followers
  if (payload.isPrimary !== undefined) {
    if (payload.isPrimary) await clearOtherPrimaries(creatorId, socialProfileId)
    patch.is_primary = payload.isPrimary
  }
  if (Object.keys(patch).length === 0) return { ok: true }

  const { data, error } = await supabase
    .from("creator_social_profiles")
    .update(patch)
    .eq("id", socialProfileId)
    .eq("creator_id", creatorId)
    .select("id")
  if (error) return { ok: false, error: "Failed to update profile" }
  if (!data || data.length === 0) return { ok: false, error: "Profile no longer exists" }
  return { ok: true }
}

/** POST { action: "approve" | "reject", reviewNote? } */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, denied } = await authorizeAdmin("creator.manage")
  if (denied) return denied
  const { id } = await params

  try {
    const body = decisionSchema.parse(await request.json())

    const { data: req, error: fetchErr } = await supabase
      .from("creator_social_change_requests")
      .select("*")
      .eq("id", id)
      .single()
    if (fetchErr || !req) return NextResponse.json({ error: "Request not found" }, { status: 404 })
    if (req.status !== "PENDING") {
      return NextResponse.json({ error: "Request already processed" }, { status: 409 })
    }
    if (body.action === "reject" && !body.reviewNote?.trim()) {
      return NextResponse.json({ error: "A note is required when rejecting" }, { status: 400 })
    }

    if (body.action === "approve") {
      const applied = await applyRequest(req)
      if (!applied.ok) return NextResponse.json({ error: applied.error }, { status: 500 })
    }

    await supabase
      .from("creator_social_change_requests")
      .update({
        status: body.action === "approve" ? "APPROVED" : "REJECTED",
        reviewed_by: session?.userId ?? null,
        review_note: body.reviewNote?.trim() || null,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)

    const typeLabel = (req.request_type as string).toLowerCase()
    await pushCreatorNotification({
      creatorId: req.creator_id as string,
      type: "PROFILE_UPDATE",
      title: body.action === "approve" ? "Profile change approved" : "Profile change declined",
      body:
        body.action === "approve"
          ? `Your request to ${typeLabel} a social profile has been approved.`
          : `Your request to ${typeLabel} a social profile was not approved. ${body.reviewNote || ""}`.trim(),
      link: "/creator/profile",
    })

    await recordAudit(auditContextFromSession(session, request), {
      action: AUDIT_ACTIONS.CREATOR_PROFILE_UPDATED,
      entityType: AUDIT_ENTITIES.CREATOR_SOCIAL_CHANGE_REQUEST,
      entityId: id,
      metadata: {
        change: `social_request_${body.action}d`,
        requestType: req.request_type,
        creatorId: req.creator_id,
        socialProfileId: req.social_profile_id,
        payload: req.payload,
        reviewNote: body.reviewNote || null,
      },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", issues: err.issues }, { status: 400 })
    }
    console.error("[social-requests] decision failed:", err)
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 })
  }
}
