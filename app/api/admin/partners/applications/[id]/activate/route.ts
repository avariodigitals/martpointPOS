import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { generatePartnerId, recordStatusHistory, type PartnerType, type PartnerStatus } from "@/lib/partners"
import { seedPartnerCapabilities, createPartnerInvitation } from "@/lib/partner-service"
import { recordAudit, AUDIT_ACTIONS, AUDIT_ENTITIES, auditContextFromSession, type AuditContext } from "@/lib/audit"

/* ─── POST: activate a partner from an approved application ───
 * Validates required conditions (application must be APPROVED or AGREEMENT_PENDING/TRAINING/CERTIFICATION_PENDING).
 * Creates/confirms Partner record, generates immutable Partner ID, sets ACTIVE + partner_since.
 * Auto-invites the original applicant as PARTNER_OWNER so they can set a password and access the portal.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, denied } = await authorizeAdmin("partners", "activate")
  if (denied) return denied

  const { id } = await params
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Not configured" }, { status: 500 })
  }

  try {
    const body = await request.json().catch(() => ({}))
    const { publicProfileEnabled, publicEmail, publicPhone, website, displayName, logoUrl } = body

    const { data: app, error } = await supabase
      .from("partner_applications")
      .select("*")
      .eq("id", id)
      .single()
    if (error || !app) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 })
    }

    const allowed = ["APPROVED", "AGREEMENT_PENDING", "TRAINING", "CERTIFICATION_PENDING", "ACTIVE"]
    if (!allowed.includes(app.status)) {
      return NextResponse.json({ error: "Application must be approved before activation" }, { status: 400 })
    }

    // Check if a partner already exists for this application
    const { data: existing } = await supabase
      .from("partners")
      .select("*")
      .eq("application_id", id)
      .maybeSingle()

    const now = new Date().toISOString()
    const ctx = auditContextFromSession(session, request)

    if (existing) {
      // Confirm/activate existing partner record
      const { data: activated, error: actErr } = await supabase
        .from("partners")
        .update({
          status: "ACTIVE",
          partner_since: existing.partner_since || now,
          updated_at: now,
          public_profile_enabled: publicProfileEnabled ?? existing.public_profile_enabled,
          public_email: publicEmail ?? existing.public_email,
          public_phone: publicPhone ?? existing.public_phone,
          website: website ?? existing.website,
          display_name: displayName ?? existing.display_name,
          logo_url: logoUrl ?? existing.logo_url,
        })
        .eq("id", existing.id)
        .select()
        .single()
      if (actErr || !activated) {
        return NextResponse.json({ error: "Activation failed" }, { status: 500 })
      }
      await recordStatusHistory(id, existing.id, existing.status, "ACTIVE", null, session!.userId)
      await recordAudit(ctx, {
        action: AUDIT_ACTIONS.PARTNER_ACTIVATED,
        entityType: AUDIT_ENTITIES.PARTNER,
        entityId: existing.id,
        metadata: { partnerId: existing.partner_id, applicationId: id },
      })
      await seedPartnerCapabilities(existing.id, existing.partner_type as PartnerType, session!.userId)
      // Also mark application ACTIVE
      await supabase.from("partner_applications").update({ status: "ACTIVE", updated_at: now }).eq("id", id)
      // Auto-invite the original applicant as PARTNER_OWNER (best-effort, non-blocking)
      const inviteResult = await autoInviteApplicant(existing.id, app, session!.userId, ctx)
      return NextResponse.json({ success: true, partner: activated, alreadyExisted: true, invitation: inviteResult })
    }

    // Create new partner record
    const partnerId = await generatePartnerId(app.country)
    const { data: partner, error: pErr } = await supabase
      .from("partners")
      .insert({
        partner_id: partnerId,
        application_id: id,
        business_name: app.business_name || app.full_name,
        display_name: displayName || app.business_name || app.full_name,
        partner_type: app.requested_partner_type as PartnerType,
        status: "ACTIVE" as PartnerStatus,
        country: app.country,
        state: app.state,
        city: app.city,
        public_email: publicEmail || null,
        public_phone: publicPhone || null,
        website: website || app.website || null,
        logo_url: logoUrl || null,
        public_profile_enabled: publicProfileEnabled ?? false,
        partner_since: now,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single()
    if (pErr || !partner) {
      return NextResponse.json({ error: "Failed to create partner" }, { status: 500 })
    }

    await recordStatusHistory(id, partner.id, app.status, "ACTIVE", null, session!.userId)
    await recordAudit(ctx, {
      action: AUDIT_ACTIONS.PARTNER_CREATED,
      entityType: AUDIT_ENTITIES.PARTNER,
      entityId: partner.id,
      metadata: { partnerId, applicationId: id, businessName: partner.business_name },
    })
    await recordAudit(ctx, {
      action: AUDIT_ACTIONS.PARTNER_ACTIVATED,
      entityType: AUDIT_ENTITIES.PARTNER,
      entityId: partner.id,
      metadata: { partnerId, applicationId: id },
    })
    await seedPartnerCapabilities(partner.id, partner.partner_type as PartnerType, session!.userId)

    // Mark application ACTIVE
    await supabase.from("partner_applications").update({ status: "ACTIVE", updated_at: now }).eq("id", id)

    // Auto-invite the original applicant as PARTNER_OWNER (best-effort, non-blocking)
    const inviteResult = await autoInviteApplicant(partner.id, app, session!.userId, ctx)
    return NextResponse.json({ success: true, partner, invitation: inviteResult })
  } catch {
    return NextResponse.json({ error: "Activation failed" }, { status: 500 })
  }
}

/* ─── Helper: auto-invite the original applicant as PARTNER_OWNER ───
 * Uses the email + name from the application. If a user with that email already
 * exists (e.g. re-activation), the invitation is skipped gracefully.
 */
async function autoInviteApplicant(
  partnerId: string,
  app: Record<string, unknown>,
  adminUserId: string,
  ctx: AuditContext
): Promise<{ sent: boolean; reason?: string } | null> {
  const email = (app.email as string) || ""
  const fullName = (app.full_name as string) || ""
  if (!email || !fullName) return { sent: false, reason: "Missing email or name on application" }

  const result = await createPartnerInvitation({
    partnerId,
    fullName,
    email,
    role: "PARTNER_OWNER",
    invitedBy: adminUserId,
    actorType: ctx.actorType,
  })

  if (result.ok) {
    return { sent: true }
  }
  // "already exists" is expected on re-activation — not an error
  return { sent: false, reason: result.error }
}
