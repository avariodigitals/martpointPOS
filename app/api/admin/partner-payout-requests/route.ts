import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { auditContextFromSession, recordAudit, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { createCommissionPayout } from "@/lib/finance-commercial"
import { sendEmail } from "@/lib/email"
import { renderEmailTemplate } from "@/lib/email-templates"
import { z } from "zod"

const decisionSchema = z.object({
  id: z.string().uuid(),
  action: z.enum(["approve", "reject"]),
  notes: z.string().max(500).optional().nullable(),
})

export async function GET() {
  const { denied } = await authorizeAdmin("finance", "view")
  if (denied) return denied
  if (!isSupabaseConfigured()) return NextResponse.json({ requests: [] })

  const { data, error } = await supabase
    .from("partner_payout_requests")
    .select(
      "*, partners:partner_id (business_name, display_name, partner_id), partner_users:requested_by (full_name, email)"
    )
    .order("created_at", { ascending: false })

  if (error) return NextResponse.json({ error: "Failed to load requests" }, { status: 500 })
  return NextResponse.json({ requests: data || [] })
}

export async function POST(request: Request) {
  const { session, denied } = await authorizeAdmin("finance", "manage")
  if (denied) return denied
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Database not configured" }, { status: 500 })

  try {
    const body = await request.json()
    const parsed = decisionSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 })
    }
    const { id, action, notes } = parsed.data

    const { data: req } = await supabase
      .from("partner_payout_requests")
      .select("*, partner_users:requested_by (email, full_name)")
      .eq("id", id)
      .single()
    if (!req) return NextResponse.json({ error: "Request not found" }, { status: 404 })
    if (req.status !== "PENDING") {
      return NextResponse.json({ error: "Request already reviewed" }, { status: 400 })
    }

    const now = new Date().toISOString()
    const ctx = auditContextFromSession(session, request)

    if (action === "reject") {
      await supabase
        .from("partner_payout_requests")
        .update({ status: "REJECTED", review_notes: notes ?? null, reviewed_by: session.userId, reviewed_at: now, updated_at: now })
        .eq("id", id)

      await recordAudit(ctx, {
        action: AUDIT_ACTIONS.PARTNER_PAYOUT_REQUEST_REVIEWED,
        entityType: AUDIT_ENTITIES.PARTNER_PAYOUT_REQUEST,
        entityId: id,
        metadata: { decision: "REJECTED", partnerId: req.partner_id },
      })

      const user = req.partner_users as { email?: string; full_name?: string } | null
      if (user?.email) {
        renderEmailTemplate("payout_rejected", {
          fullName: user.full_name || "",
          amount: Number(req.amount).toLocaleString(),
          reasonBlock: notes ? `\n\nReason: ${notes}` : "",
        })
          .then((tpl) => sendEmail({ to: user.email!, subject: tpl.subject, text: tpl.text, html: tpl.html }))
          .catch(() => {})
      }

      return NextResponse.json({ success: true })
    }

    // Approve: schedule all currently-APPROVED commissions for the partner into a payout batch
    const { data: commissions } = await supabase
      .from("partner_commissions")
      .select("id")
      .eq("partner_id", req.partner_id)
      .eq("status", "APPROVED")
      .order("created_at", { ascending: true })

    const ids = ((commissions as { id: string }[] | null) || []).map((c) => c.id)
    if (ids.length === 0) {
      return NextResponse.json({ error: "Partner has no approved commissions to pay out" }, { status: 400 })
    }

    const payout = await createCommissionPayout(req.partner_id as string, ids, session.userId)

    await supabase
      .from("partner_payout_requests")
      .update({ status: "APPROVED", review_notes: notes ?? null, reviewed_by: session.userId, reviewed_at: now, payout_id: payout.id, updated_at: now })
      .eq("id", id)

    await recordAudit(ctx, {
      action: AUDIT_ACTIONS.PARTNER_PAYOUT_REQUEST_REVIEWED,
      entityType: AUDIT_ENTITIES.PARTNER_PAYOUT_REQUEST,
      entityId: id,
      metadata: { decision: "APPROVED", partnerId: req.partner_id, payoutId: payout.id, payoutReference: payout.payout_reference },
    })

    const user = req.partner_users as { email?: string; full_name?: string } | null
    if (user?.email) {
      renderEmailTemplate("payout_approved", {
        fullName: user.full_name || "",
        amount: Number(req.amount).toLocaleString(),
        payoutReference: payout.payout_reference,
      })
        .then((tpl) => sendEmail({ to: user.email!, subject: tpl.subject, text: tpl.text, html: tpl.html }))
        .catch(() => {})
    }

    return NextResponse.json({ success: true, payout })
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Failed to process request"
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
