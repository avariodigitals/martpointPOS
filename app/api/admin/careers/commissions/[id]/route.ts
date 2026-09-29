import { NextResponse } from "next/server"
import crypto from "crypto"
import { authorizeAdmin } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { recordAudit, auditContextFromSession, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit"

export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

/* PATCH {action: "approve"|"reject"|"pay"|"reverse"|"mark_payable"}
 * approve/reject/reverse → careers.commissions.approve
 * pay                  → careers.commissions.pay
 * mark_payable         → careers.commissions.approve (threshold review)
 */
export async function PATCH(request: Request, ctx: Ctx) {
  const { id } = await ctx.params
  const body = await request.json().catch(() => ({}))
  const action = String(body.action || "")

  const permission = action === "pay" ? "careers.commissions.pay" : "careers.commissions.approve"
  const { session, denied } = await authorizeAdmin(permission)
  if (denied) return denied
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Database not configured" }, { status: 503 })

  const { data: row } = await supabase.from("career_commissions").select("*").eq("id", id).maybeSingle()
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const now = new Date().toISOString()
  let update: Record<string, unknown> | null = null
  let auditAction: string = AUDIT_ACTIONS.CAREER_COMMISSION_APPROVED

  switch (action) {
    case "approve":
      if (row.approval_status !== "PENDING") return NextResponse.json({ error: "Only pending commissions can be approved" }, { status: 409 })
      update = { approval_status: "APPROVED", approved_by: session.userId, updated_at: now }
      break
    case "reject":
      if (row.approval_status !== "PENDING") return NextResponse.json({ error: "Only pending commissions can be rejected" }, { status: 409 })
      update = { approval_status: "REJECTED", approved_by: session.userId, updated_at: now }
      auditAction = AUDIT_ACTIONS.CAREER_COMMISSION_REJECTED
      break
    case "mark_payable":
      if (row.payment_status !== "EARNED") return NextResponse.json({ error: "Commission is already payable or paid" }, { status: 409 })
      update = { payment_status: "PAYABLE", payable_at: now, updated_at: now }
      break
    case "pay":
      if (row.approval_status !== "APPROVED") return NextResponse.json({ error: "Commission must be approved before payment" }, { status: 409 })
      if (row.payment_status === "PAID") return NextResponse.json({ error: "Already paid" }, { status: 409 })
      update = { payment_status: "PAID", paid_at: now, paid_by: session.userId, updated_at: now }
      auditAction = AUDIT_ACTIONS.CAREER_COMMISSION_PAID
      break
    case "reverse": {
      if (row.payment_status === "REVERSED") return NextResponse.json({ error: "Already reversed" }, { status: 409 })
      update = { payment_status: "REVERSED", updated_at: now }
      auditAction = AUDIT_ACTIONS.CAREER_COMMISSION_REVERSED
      // Record the reversal as a negative ledger entry for traceability.
      await supabase.from("career_commissions").insert({
        id: crypto.randomUUID(),
        earner_label: row.earner_label,
        candidate_id: row.candidate_id,
        user_id: row.user_id,
        vacancy_id: row.vacancy_id,
        role_template_id: row.role_template_id,
        lead_id: row.lead_id,
        business_id: row.business_id,
        revenue_category: row.revenue_category,
        lead_source: row.lead_source,
        qualifying_amount_kobo: 0,
        basis: row.basis,
        rate: row.rate,
        amount_kobo: -(row.amount_kobo || 0),
        approval_status: "APPROVED",
        payment_status: "REVERSED",
        reversal_of_id: row.id,
        notes: body.reason ? `Reversal: ${body.reason}` : "Reversal",
      })
      break
    }
    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  }

  const { error } = await supabase.from("career_commissions").update(update).eq("id", id)
  if (error) return NextResponse.json({ error: "Failed to update commission" }, { status: 500 })

  await recordAudit(auditContextFromSession(session, request), {
    action: auditAction,
    entityType: AUDIT_ENTITIES.CAREER_COMMISSION,
    entityId: id,
    metadata: { action, earner: row.earner_label },
  })
  return NextResponse.json({ success: true })
}
