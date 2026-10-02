import { NextResponse } from "next/server"
import { z } from "zod"
import { authorizeCreator } from "@/lib/creator-auth"
import { supabase } from "@/lib/supabase"
import { recordAudit, AUDIT_ACTIONS, AUDIT_ENTITIES, auditContextFromCreatorSession } from "@/lib/audit"
import { CREATOR_PLATFORMS } from "@/lib/creator-constants"

export const dynamic = "force-dynamic"

/* Declared social profiles feed AI screening, challenge eligibility and the
 * Rising Creator baseline — they must not silently change post-approval.
 * Add/edit/remove become review requests (creator_social_change_requests)
 * that an authorised admin approves. The only direct mutation left is the
 * isPrimary flag, which carries no verification weight.
 */

const socialPayloadSchema = z.object({
  platform: z.enum(CREATOR_PLATFORMS),
  profileUrl: z.string().trim().url().max(500),
  username: z.string().trim().max(100).nullish(),
  followers: z.number().int().min(0).max(500_000_000).nullish(),
  isPrimary: z.boolean().optional(),
})

const requestSchema = socialPayloadSchema.extend({
  note: z.string().trim().max(500).nullish(),
})

const updateRequestSchema = requestSchema.partial().extend({ id: z.string().uuid() })

async function clearOtherPrimaries(creatorId: string, exceptId?: string) {
  let q = supabase.from("creator_social_profiles").update({ is_primary: false }).eq("creator_id", creatorId)
  if (exceptId) q = q.neq("id", exceptId)
  await q
}

async function hasPendingRequest(creatorId: string, socialProfileId?: string) {
  let q = supabase
    .from("creator_social_change_requests")
    .select("id", { count: "exact", head: true })
    .eq("creator_id", creatorId)
    .eq("status", "PENDING")
  if (socialProfileId) q = q.eq("social_profile_id", socialProfileId)
  const { count } = await q
  return (count ?? 0) > 0
}

/** GET — the creator's own change requests (most recent first). */
export async function GET() {
  const { creator, denied } = await authorizeCreator()
  if (denied) return denied

  const { data, error } = await supabase
    .from("creator_social_change_requests")
    .select("id, request_type, payload, note, status, review_note, created_at")
    .eq("creator_id", creator.id)
    .order("created_at", { ascending: false })
    .limit(20)
  if (error) return NextResponse.json({ error: "Failed to load requests" }, { status: 500 })

  const requests = (data || []).map((r) => ({
    id: r.id,
    requestType: r.request_type,
    payload: r.payload,
    note: r.note,
    status: r.status,
    reviewNote: r.review_note,
    createdAt: r.created_at,
  }))
  return NextResponse.json({ requests })
}

/** POST — request to add a new social profile (reviewed before it counts). */
export async function POST(request: Request) {
  const { creator, session, denied } = await authorizeCreator()
  if (denied) return denied

  try {
    const body = requestSchema.parse(await request.json())
    const { error } = await supabase.from("creator_social_change_requests").insert({
      creator_id: creator.id,
      application_id: creator.applicationId,
      social_profile_id: null,
      request_type: "ADD",
      payload: {
        platform: body.platform,
        profileUrl: body.profileUrl,
        username: body.username || null,
        followers: body.followers ?? null,
        isPrimary: !!body.isPrimary,
      },
      note: body.note || null,
    })
    if (error) return NextResponse.json({ error: "Failed to submit request" }, { status: 500 })

    await recordAudit(auditContextFromCreatorSession(session, request), {
      action: AUDIT_ACTIONS.CREATOR_PROFILE_UPDATED,
      entityType: AUDIT_ENTITIES.CREATOR_SOCIAL_CHANGE_REQUEST,
      entityId: creator.id,
      metadata: { change: "social_add_requested", platform: body.platform, profileUrl: body.profileUrl },
    })
    return NextResponse.json({ success: true, pending: true })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", issues: err.issues }, { status: 400 })
    }
    return NextResponse.json({ error: "Failed to submit request" }, { status: 500 })
  }
}

/** PATCH — isPrimary alone applies instantly; any other field becomes a review request. */
export async function PATCH(request: Request) {
  const { creator, session, denied } = await authorizeCreator()
  if (denied) return denied

  try {
    const body = updateRequestSchema.parse(await request.json())

    // Verify ownership of the target profile
    const { data: profile } = await supabase
      .from("creator_social_profiles")
      .select("id")
      .eq("id", body.id)
      .eq("creator_id", creator.id)
      .maybeSingle()
    if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 })

    const substantive =
      body.platform !== undefined || body.profileUrl !== undefined ||
      body.username !== undefined || body.followers !== undefined

    if (!substantive && body.isPrimary !== undefined) {
      // Cosmetic flag — safe to apply immediately
      if (body.isPrimary) await clearOtherPrimaries(creator.id, body.id)
      const { error } = await supabase
        .from("creator_social_profiles")
        .update({ is_primary: body.isPrimary })
        .eq("id", body.id)
        .eq("creator_id", creator.id)
      if (error) return NextResponse.json({ error: "Failed to update profile" }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    if (!substantive) return NextResponse.json({ error: "Nothing to change" }, { status: 400 })

    if (await hasPendingRequest(creator.id, body.id)) {
      return NextResponse.json(
        { error: "A change request for this profile is already awaiting review." },
        { status: 409 }
      )
    }

    const payload: Record<string, unknown> = {}
    if (body.platform !== undefined) payload.platform = body.platform
    if (body.profileUrl !== undefined) payload.profileUrl = body.profileUrl
    if (body.username !== undefined) payload.username = body.username || null
    if (body.followers !== undefined) payload.followers = body.followers ?? null
    if (body.isPrimary !== undefined) payload.isPrimary = body.isPrimary

    const { error } = await supabase.from("creator_social_change_requests").insert({
      creator_id: creator.id,
      application_id: creator.applicationId,
      social_profile_id: body.id,
      request_type: "UPDATE",
      payload,
      note: body.note || null,
    })
    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "A change request for this profile is already awaiting review." },
          { status: 409 }
        )
      }
      return NextResponse.json({ error: "Failed to submit request" }, { status: 500 })
    }

    await recordAudit(auditContextFromCreatorSession(session, request), {
      action: AUDIT_ACTIONS.CREATOR_PROFILE_UPDATED,
      entityType: AUDIT_ENTITIES.CREATOR_SOCIAL_CHANGE_REQUEST,
      entityId: creator.id,
      metadata: { change: "social_update_requested", socialId: body.id, fields: Object.keys(payload) },
    })
    return NextResponse.json({ success: true, pending: true })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", issues: err.issues }, { status: 400 })
    }
    return NextResponse.json({ error: "Failed to submit request" }, { status: 500 })
  }
}

/**
 * DELETE ?id=<profileId>  → request removal of a profile (reviewed).
 * DELETE ?request=<requestId> → cancel the creator's own pending request.
 */
export async function DELETE(request: Request) {
  const { creator, session, denied } = await authorizeCreator()
  if (denied) return denied

  const url = new URL(request.url)
  const requestId = url.searchParams.get("request")
  const id = url.searchParams.get("id")

  if (requestId) {
    const { data, error } = await supabase
      .from("creator_social_change_requests")
      .update({ status: "CANCELLED", updated_at: new Date().toISOString() })
      .eq("id", requestId)
      .eq("creator_id", creator.id)
      .eq("status", "PENDING")
      .select("id")
    if (error) return NextResponse.json({ error: "Failed to cancel request" }, { status: 500 })
    if (!data || data.length === 0) {
      return NextResponse.json({ error: "Request not found or already reviewed" }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  }

  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })

  const { data: profile } = await supabase
    .from("creator_social_profiles")
    .select("id, platform")
    .eq("id", id)
    .eq("creator_id", creator.id)
    .maybeSingle()
  if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 })

  if (await hasPendingRequest(creator.id, id)) {
    return NextResponse.json(
      { error: "A change request for this profile is already awaiting review." },
      { status: 409 }
    )
  }

  const { error } = await supabase.from("creator_social_change_requests").insert({
    creator_id: creator.id,
    application_id: creator.applicationId,
    social_profile_id: id,
    request_type: "REMOVE",
    payload: {},
    note: url.searchParams.get("note")?.slice(0, 500) || null,
  })
  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: "A change request for this profile is already awaiting review." },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: "Failed to submit request" }, { status: 500 })
  }

  await recordAudit(auditContextFromCreatorSession(session, request), {
    action: AUDIT_ACTIONS.CREATOR_PROFILE_UPDATED,
    entityType: AUDIT_ENTITIES.CREATOR_SOCIAL_CHANGE_REQUEST,
    entityId: creator.id,
    metadata: { change: "social_remove_requested", socialId: id, platform: profile.platform },
  })
  return NextResponse.json({ success: true, pending: true })
}
