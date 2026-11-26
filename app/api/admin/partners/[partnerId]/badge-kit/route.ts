import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { createPartnerResource, updatePartnerResource, deletePartnerResource } from "@/lib/partner-service"
import { recordAudit, AUDIT_ACTIONS, AUDIT_ENTITIES, type AuditContext } from "@/lib/audit"
import { isPartnerBadgeTier, PARTNER_BADGE_TIER_LABELS } from "@/lib/partner-badges"
import { issueGradeConfirmation } from "@/lib/partner-generated-docs"

/* Admin endpoint for issuing a partner's badge kit.
 * "Generate" sets partners.badge_tier and upserts a private partner_resources
 * row (category 'Badge') that links the partner's Docs to the portal
 * badge-kit page, where they copy tier-correct embed snippets. */

const KIT_URL = "/partner/badge-kit"

async function findKitResource(partnerId: string) {
  const { data } = await supabase
    .from("partner_resources")
    .select("id")
    .eq("partner_id", partnerId)
    .eq("external_url", KIT_URL)
    .maybeSingle()
  return data
}

async function eventCount(partnerId: string, eventType: string): Promise<number> {
  const { count } = await supabase
    .from("partner_profile_events")
    .select("*", { count: "exact", head: true })
    .eq("partner_id", partnerId)
    .eq("event_type", eventType)
  return count ?? 0
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ partnerId: string }> }
) {
  const { denied } = await authorizeAdmin("partners", "view")
  if (denied) return denied
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Not configured" }, { status: 500 })

  const { partnerId } = await params
  const { data: exists } = await supabase
    .from("partners")
    .select("id")
    .eq("id", partnerId)
    .maybeSingle()
  if (!exists) return NextResponse.json({ error: "Partner not found" }, { status: 404 })

  // Badge columns come from migration 045 — if it hasn't been applied yet,
  // degrade gracefully so the admin can still see the issue.
  const { data: partner, error: badgeErr } = await supabase
    .from("partners")
    .select("badge_tier, badge_kit_issued_at")
    .eq("id", partnerId)
    .single()

  const [impressions, clicks] = await Promise.all([
    eventCount(partnerId, "badge_impression"),
    eventCount(partnerId, "badge_click"),
  ])

  return NextResponse.json({
    tier: (partner?.badge_tier as string | null) ?? null,
    issuedAt: (partner?.badge_kit_issued_at as string | null) ?? null,
    stats: { impressions, clicks },
    ...(badgeErr ? { badgeSchemaMissing: true } : {}),
  })
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ partnerId: string }> }
) {
  const { session, denied } = await authorizeAdmin("partners", "manage")
  if (denied) return denied
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Not configured" }, { status: 500 })

  const { partnerId } = await params
  const body = await request.json().catch(() => null)
  const tier = typeof body?.tier === "string" ? body.tier.toUpperCase() : ""
  const partnerType = body?.partnerType === "CHANNEL" || body?.partnerType === "IMPLEMENTATION" ? body.partnerType : null
  if (!isPartnerBadgeTier(tier) || tier === "DIAMOND" || !partnerType) {
    return NextResponse.json({ error: "Choose a Silver, Gold or Platinum grade and the approved Partner Type" }, { status: 400 })
  }

  const { data: partner } = await supabase
    .from("partners")
    .select("id, partner_type, badge_tier")
    .eq("id", partnerId)
    .single()
  if (!partner) return NextResponse.json({ error: "Partner not found" }, { status: 404 })
  const allowedType = String(partner.partner_type || "").includes(partnerType)
  if (!allowedType) return NextResponse.json({ error: "This partner is not approved for that Partner Type" }, { status: 409 })
  const { data: gradeRecord } = await supabase.from("partner_type_grades").select("current_grade").eq("partner_id", partnerId).eq("partner_type", partnerType).maybeSingle()
  if (gradeRecord?.current_grade !== tier) return NextResponse.json({ error: "A badge can be issued only after Management formally records the same grade for this Partner Type" }, { status: 409 })
  const { data: delivery } = await supabase.from("partner_delivery_verifications").select("id").eq("partner_id", partnerId).eq("partner_type", partnerType).eq("approved", true).limit(1).maybeSingle()
  if (!delivery) return NextResponse.json({ error: "A verified qualifying business delivery is required before issuing a graded badge" }, { status: 409 })

  const { error } = await supabase
    .from("partners")
    .update({ badge_kit_issued_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", partnerId)
  if (error) return NextResponse.json({ error: "Failed to update partner" }, { status: 500 })

  const label = PARTNER_BADGE_TIER_LABELS[tier]
  const kit = {
    title: `Official MartPoint ${label} ${partnerType === "CHANNEL" ? "Channel" : "Implementation"} Partner Badge Kit`,
    description: `Embeddable ${label} ${partnerType === "CHANNEL" ? "Channel" : "Implementation"} verification badge (horizontal & vertical) with copy-ready HTML snippets and PNG downloads.`,
    category: "Badge",
    externalUrl: KIT_URL,
    visibility: "PARTNER" as const,
    partnerId,
    active: true,
  }

  const existing = await findKitResource(partnerId)
  const result = existing
    ? await updatePartnerResource(existing.id as string, kit, session!.userId)
    : await createPartnerResource(kit, session!.userId)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 })

  const ctx: AuditContext = { actorType: "ADMIN", actorId: session!.userId }
  await recordAudit(ctx, {
    action: AUDIT_ACTIONS.PARTNER_UPDATED,
    entityType: AUDIT_ENTITIES.PARTNER,
    entityId: partnerId,
    metadata: { badgeTier: tier, partnerType, previousBadgeTier: gradeRecord.current_grade ?? null },
  })

  // Grade & Certification Confirmation document (best-effort).
  try {
    await issueGradeConfirmation(
      partnerId,
      { newGrade: tier, previousGrade: (gradeRecord.current_grade as string | null) ?? null, partnerType },
      { id: session!.userId, name: session!.name || session!.username }
    )
  } catch (e) {
    console.error("[badge-kit] grade confirmation failed:", e)
  }

  return NextResponse.json({ success: true, tier })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ partnerId: string }> }
) {
  const { session, denied } = await authorizeAdmin("partners", "manage")
  if (denied) return denied
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Not configured" }, { status: 500 })

  const { partnerId } = await params
  const { error } = await supabase
    .from("partners")
    .update({ badge_tier: null, badge_kit_issued_at: null, updated_at: new Date().toISOString() })
    .eq("id", partnerId)
  if (error) return NextResponse.json({ error: "Failed to update partner" }, { status: 500 })

  const existing = await findKitResource(partnerId)
  if (existing) await deletePartnerResource(existing.id as string, session!.userId)

  const ctx: AuditContext = { actorType: "ADMIN", actorId: session!.userId }
  await recordAudit(ctx, {
    action: AUDIT_ACTIONS.PARTNER_UPDATED,
    entityType: AUDIT_ENTITIES.PARTNER,
    entityId: partnerId,
    metadata: { badgeTier: null, badgeKitRevoked: true },
  })

  return NextResponse.json({ success: true })
}
