import { NextResponse } from "next/server"
import { getPartnerSession, authorizePartner } from "@/lib/partner-auth"
import { auditContextFromPartnerSession, recordAudit, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { sendEmail } from "@/lib/email"
import { renderEmailTemplate } from "@/lib/email-templates"
import { z } from "zod"

const createSchema = z.object({
  amount: z.coerce.number().positive(),
  notes: z.string().max(500).optional().nullable(),
})

async function approvedBalance(partnerId: string): Promise<number> {
  const { data } = await supabase
    .from("partner_commissions")
    .select("commission_amount")
    .eq("partner_id", partnerId)
    .eq("status", "APPROVED")
  return ((data as { commission_amount: number }[] | null) || []).reduce(
    (s, c) => s + (Number(c.commission_amount) || 0), 0
  )
}

export async function GET() {
  const session = await getPartnerSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const auth = await authorizePartner({ session, permission: "commissions:view_own" })
  if (!auth.authorized) return auth.response!

  if (!isSupabaseConfigured()) return NextResponse.json({ requests: [], available: 0 })

  const { data } = await supabase
    .from("partner_payout_requests")
    .select("id, amount, currency, status, notes, review_notes, created_at, reviewed_at")
    .eq("partner_id", session.partnerId)
    .order("created_at", { ascending: false })

  const available = await approvedBalance(session.partnerId)
  return NextResponse.json({ requests: data || [], available })
}

export async function POST(request: Request) {
  const session = await getPartnerSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const auth = await authorizePartner({ session, permission: "commissions:view_own" })
  if (!auth.authorized) return auth.response!

  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Database not configured" }, { status: 500 })

  try {
    const body = await request.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    // Only one open request at a time
    const { data: pending } = await supabase
      .from("partner_payout_requests")
      .select("id")
      .eq("partner_id", session.partnerId)
      .eq("status", "PENDING")
      .limit(1)
    if (pending && pending.length > 0) {
      return NextResponse.json({ error: "You already have a pending payout request" }, { status: 400 })
    }

    const available = await approvedBalance(session.partnerId)
    if (parsed.data.amount > available) {
      return NextResponse.json(
        { error: `Amount exceeds your available balance of ${available.toFixed(2)}` },
        { status: 400 }
      )
    }

    const now = new Date().toISOString()
    const { data, error } = await supabase
      .from("partner_payout_requests")
      .insert({
        partner_id: session.partnerId,
        requested_by: session.partnerUserId,
        amount: parsed.data.amount,
        currency: "NGN",
        status: "PENDING",
        notes: parsed.data.notes ?? null,
        created_at: now,
        updated_at: now,
      })
      .select()
      .single()

    if (error || !data) {
      return NextResponse.json({ error: "Failed to submit request" }, { status: 500 })
    }

    const ctx = auditContextFromPartnerSession(session, request)
    await recordAudit(ctx, {
      action: AUDIT_ACTIONS.PARTNER_PAYOUT_REQUESTED,
      entityType: AUDIT_ENTITIES.PARTNER_PAYOUT_REQUEST,
      entityId: data.id as string,
      metadata: { partnerId: session.partnerId, amount: parsed.data.amount },
    })

    // Notify finance team (best-effort)
    renderEmailTemplate("payout_request_admin", {
      partnerId: session.partnerId,
      amount: parsed.data.amount.toLocaleString(),
      notes: parsed.data.notes || "—",
    })
      .then((tpl) => sendEmail({ route: "partner_payout_request", subject: tpl.subject, text: tpl.text, html: tpl.html }))
      .catch((err) => console.error("[payout-request] notify email failed:", err))

    return NextResponse.json({ request: data })
  } catch {
    return NextResponse.json({ error: "Failed to submit request" }, { status: 500 })
  }
}
