import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { recordStatusHistory, APPLICATION_STATUS_LABELS, type ApplicationStatus } from "@/lib/partners"
import { recordAudit, AUDIT_ACTIONS, AUDIT_ENTITIES, auditContextFromSession } from "@/lib/audit"

const VALID_STATUSES: ApplicationStatus[] = [
  "UNDER_REVIEW", "MORE_INFORMATION_REQUIRED", "DISCOVERY_CALL", "APPROVED_CONDITIONAL",
  "APPROVED", "AGREEMENT_PENDING", "TRAINING", "CERTIFICATION_PENDING", "ACTIVE",
  "SUSPENDED", "REJECTED", "INACTIVE",
]

/* ─── PATCH: change application status (admin action) ───
 * Body: { status, reason, internalNotes?, informationRequestMessage?, rejectionMessagePublic? }
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, denied } = await authorizeAdmin("partners", "manage")
  if (denied) return denied

  const { id } = await params
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Not configured" }, { status: 500 })
  }

  try {
    const body = await request.json()
    const newStatus = body.status as ApplicationStatus
    if (!VALID_STATUSES.includes(newStatus)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 })
    }

    // Rejection requires an internal reason
    if (newStatus === "REJECTED" && !body.reason) {
      return NextResponse.json({ error: "An internal reason is required for rejection" }, { status: 400 })
    }

    const { data: current, error: curErr } = await supabase
      .from("partner_applications")
      .select("id, status, reference_number, email, full_name")
      .eq("id", id)
      .single()
    if (curErr || !current) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 })
    }

    const previousStatus = current.status as ApplicationStatus
    const now = new Date().toISOString()

    const update: Record<string, unknown> = {
      status: newStatus,
      updated_at: now,
      reviewed_at: now,
      reviewed_by: session!.userId,
    }
    if (body.internalNotes !== undefined) update.internal_notes = body.internalNotes
    if (body.riskComplianceNotes !== undefined) update.risk_compliance_notes = body.riskComplianceNotes
    if (body.informationRequestMessage !== undefined) update.information_request_message = body.informationRequestMessage
    if (body.rejectionMessagePublic !== undefined) update.rejection_message_public = body.rejectionMessagePublic

    const { data: updated, error } = await supabase
      .from("partner_applications")
      .update(update)
      .eq("id", id)
      .select()
      .single()
    if (error || !updated) {
      return NextResponse.json({ error: "Update failed" }, { status: 500 })
    }

    await recordStatusHistory(id, null, previousStatus, newStatus, body.reason || null, session!.userId)

    const ctx = auditContextFromSession(session, request)
    const action =
      newStatus === "MORE_INFORMATION_REQUIRED" ? AUDIT_ACTIONS.PARTNER_APPLICATION_INFORMATION_REQUESTED
      : AUDIT_ACTIONS.PARTNER_APPLICATION_STATUS_CHANGED
    await recordAudit(ctx, {
      action,
      entityType: AUDIT_ENTITIES.PARTNER_APPLICATION,
      entityId: id,
      metadata: {
        reference: current.reference_number,
        previousStatus,
        newStatus,
        reason: body.reason || null,
      },
    })

    // If information requested or rejected, notify applicant (best-effort)
    if (newStatus === "MORE_INFORMATION_REQUIRED" || newStatus === "REJECTED") {
      await notifyApplicant(
        current.email,
        current.full_name,
        current.reference_number,
        newStatus,
        newStatus === "MORE_INFORMATION_REQUIRED" ? body.informationRequestMessage : body.rejectionMessagePublic
      )
    }

    return NextResponse.json({ success: true, application: updated, statusLabel: APPLICATION_STATUS_LABELS[newStatus] })
  } catch {
    return NextResponse.json({ error: "Failed to update status" }, { status: 500 })
  }
}

async function notifyApplicant(email: string, name: string, reference: string, status: string, message?: string) {
  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey || !message) return
  const subject = status === "REJECTED"
    ? `MartPoint Partner Application Update — ${reference}`
    : `MartPoint Partner Application — More Information Required — ${reference}`
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "MartPoint Partners <partners@martpoint.com.ng>",
        to: email,
        subject,
        text: `Hi ${name},\n\n${message}\n\nApplication Reference: ${reference}\n\nMartPoint Partner Team`,
      }),
    })
  } catch (err) {
    console.error("[partner] applicant notify failed:", err)
  }
}
