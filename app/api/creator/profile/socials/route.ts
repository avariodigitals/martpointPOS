import { NextResponse } from "next/server"
import { z } from "zod"
import { authorizeCreator } from "@/lib/creator-auth"
import { supabase } from "@/lib/supabase"
import { recordAudit, AUDIT_ACTIONS, AUDIT_ENTITIES, auditContextFromCreatorSession } from "@/lib/audit"
import { CREATOR_PLATFORMS } from "@/lib/creator-constants"

export const dynamic = "force-dynamic"

const socialSchema = z.object({
  platform: z.enum(CREATOR_PLATFORMS),
  profileUrl: z.string().trim().url().max(500),
  username: z.string().trim().max(100).nullish(),
  followers: z.number().int().min(0).max(500_000_000).nullish(),
  isPrimary: z.boolean().optional(),
})

const updateSchema = socialSchema.partial().extend({ id: z.string().uuid() })

async function clearOtherPrimaries(creatorId: string, exceptId?: string) {
  let q = supabase.from("creator_social_profiles").update({ is_primary: false }).eq("creator_id", creatorId)
  if (exceptId) q = q.neq("id", exceptId)
  await q
}

export async function POST(request: Request) {
  const { creator, session, denied } = await authorizeCreator()
  if (denied) return denied

  try {
    const body = socialSchema.parse(await request.json())
    if (body.isPrimary) await clearOtherPrimaries(creator.id)

    const { data, error } = await supabase
      .from("creator_social_profiles")
      .insert({
        application_id: creator.applicationId,
        creator_id: creator.id,
        platform: body.platform,
        profile_url: body.profileUrl,
        username: body.username || null,
        followers: body.followers ?? null,
        is_primary: !!body.isPrimary,
      })
      .select("id")
      .single()
    if (error) return NextResponse.json({ error: "Failed to add profile" }, { status: 500 })

    await recordAudit(auditContextFromCreatorSession(session, request), {
      action: AUDIT_ACTIONS.CREATOR_PROFILE_UPDATED,
      entityType: AUDIT_ENTITIES.CREATOR,
      entityId: creator.id,
      metadata: { change: "social_added", platform: body.platform, profileUrl: body.profileUrl },
    })
    return NextResponse.json({ success: true, id: data.id })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", issues: err.issues }, { status: 400 })
    }
    return NextResponse.json({ error: "Failed to add profile" }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  const { creator, session, denied } = await authorizeCreator()
  if (denied) return denied

  try {
    const body = updateSchema.parse(await request.json())
    if (body.isPrimary) await clearOtherPrimaries(creator.id, body.id)

    const patch: Record<string, unknown> = {}
    if (body.platform) patch.platform = body.platform
    if (body.profileUrl) patch.profile_url = body.profileUrl
    if (body.username !== undefined) patch.username = body.username || null
    if (body.followers !== undefined) patch.followers = body.followers ?? null
    if (body.isPrimary !== undefined) patch.is_primary = body.isPrimary

    const { error } = await supabase
      .from("creator_social_profiles")
      .update(patch)
      .eq("id", body.id)
      .eq("creator_id", creator.id)
    if (error) return NextResponse.json({ error: "Failed to update profile" }, { status: 500 })

    await recordAudit(auditContextFromCreatorSession(session, request), {
      action: AUDIT_ACTIONS.CREATOR_PROFILE_UPDATED,
      entityType: AUDIT_ENTITIES.CREATOR,
      entityId: creator.id,
      metadata: { change: "social_updated", socialId: body.id, fields: Object.keys(patch) },
    })
    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", issues: err.issues }, { status: 400 })
    }
    return NextResponse.json({ error: "Failed to update profile" }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const { creator, session, denied } = await authorizeCreator()
  if (denied) return denied

  const id = new URL(request.url).searchParams.get("id")
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 })

  const { error } = await supabase
    .from("creator_social_profiles")
    .delete()
    .eq("id", id)
    .eq("creator_id", creator.id)
  if (error) return NextResponse.json({ error: "Failed to remove profile" }, { status: 500 })

  await recordAudit(auditContextFromCreatorSession(session, request), {
    action: AUDIT_ACTIONS.CREATOR_PROFILE_UPDATED,
    entityType: AUDIT_ENTITIES.CREATOR,
    entityId: creator.id,
    metadata: { change: "social_removed", socialId: id },
  })
  return NextResponse.json({ success: true })
}
