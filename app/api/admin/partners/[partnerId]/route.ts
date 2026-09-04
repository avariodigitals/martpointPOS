import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { recordStatusHistory, type PartnerStatus } from "@/lib/partners"
import {
  seedPartnerCapabilities,
  listPartnerCapabilities,
  listPartnerProfileUpdateRequests,
} from "@/lib/partner-service"
import { recordAudit, AUDIT_ACTIONS, AUDIT_ENTITIES, auditContextFromSession } from "@/lib/audit"

/* ─── GET: partner overview for admin detail ─── */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ partnerId: string }> }
) {
  const { denied } = await authorizeAdmin("partners", "view")
  if (denied) return denied

  const { partnerId } = await params
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Not configured" }, { status: 500 })
  }

  try {
    const { data: partner, error } = await supabase
      .from("partners")
      .select("*")
      .eq("id", partnerId)
      .single()

    if (error || !partner) {
      return NextResponse.json({ error: "Partner not found" }, { status: 404 })
    }

    const [capabilities, pendingProfileUpdates] = await Promise.all([
      listPartnerCapabilities(partnerId),
      listPartnerProfileUpdateRequests(partnerId, "PENDING"),
    ])

    return NextResponse.json({ partner, capabilities, pendingProfileUpdates })
  } catch {
    return NextResponse.json({ error: "Failed to load partner" }, { status: 500 })
  }
}

/* ─── PATCH: update a partner record (status, public profile fields) ─── */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ partnerId: string }> }
) {
  const { session, denied } = await authorizeAdmin("partners", "manage")
  if (denied) return denied

  const { partnerId } = await params
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Not configured" }, { status: 500 })
  }

  try {
    const body = await request.json()
    const { data: current, error: curErr } = await supabase
      .from("partners")
      .select("*")
      .eq("id", partnerId)
      .single()
    if (curErr || !current) {
      return NextResponse.json({ error: "Partner not found" }, { status: 404 })
    }

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
    for (const k of [
      "display_name",
      "business_name",
      "public_email",
      "public_phone",
      "website",
      "logo_url",
      "public_profile_enabled",
      "country",
      "state",
      "city",
    ]) {
      if (body[k] !== undefined) update[k] = body[k]
    }
    if (body.status !== undefined) update.status = body.status

    const { data: updated, error } = await supabase
      .from("partners")
      .update(update)
      .eq("id", partnerId)
      .select()
      .single()
    if (error || !updated) {
      return NextResponse.json({ error: "Update failed" }, { status: 500 })
    }

    if (body.status === "ACTIVE" && current.status !== "ACTIVE") {
      await seedPartnerCapabilities(partnerId, current.partner_type, session!.userId)
    }

    const ctx = auditContextFromSession(session, request)
    if (body.status !== undefined && body.status !== current.status) {
      await recordStatusHistory(
        current.application_id,
        partnerId,
        current.status,
        body.status as PartnerStatus,
        body.reason || null,
        session!.userId
      )
      const action =
        body.status === "SUSPENDED"
          ? AUDIT_ACTIONS.PARTNER_SUSPENDED
          : body.status === "TERMINATED" || body.status === "INACTIVE"
            ? AUDIT_ACTIONS.PARTNER_REJECTED
            : AUDIT_ACTIONS.PARTNER_UPDATED
      await recordAudit(ctx, {
        action,
        entityType: AUDIT_ENTITIES.PARTNER,
        entityId: partnerId,
        metadata: { previousStatus: current.status, newStatus: body.status, partnerId: current.partner_id },
      })
    } else {
      await recordAudit(ctx, {
        action: AUDIT_ACTIONS.PARTNER_UPDATED,
        entityType: AUDIT_ENTITIES.PARTNER,
        entityId: partnerId,
        metadata: { updatedFields: Object.keys(update).filter((k) => k !== "updated_at") },
      })
    }

    return NextResponse.json({ success: true, partner: updated })
  } catch {
    return NextResponse.json({ error: "Failed to update partner" }, { status: 500 })
  }
}
