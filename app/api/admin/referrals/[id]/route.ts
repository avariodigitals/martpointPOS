import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { auditContextFromSession } from "@/lib/audit"
import { z } from "zod"
import { referralAdminCan } from "@/lib/referral-permissions"
import { getReferralReviewDetail } from "@/lib/referral-review"
import { decideReferralReview, requestReferralInformation, type ReferralActor } from "@/lib/referral"
import { extendReferralProtection } from "@/lib/referral-attribution"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"

/* ───────────────────────────  Referral decision endpoint  ───────────────────────────
 * Every control here is checked twice: the admin page permission and the referral
 * action matrix. Partners have no route to any of these decisions.
 */

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("request_information"), message: z.string().min(3), dueAt: z.string().nullable().optional() }),
  z.object({ action: z.literal("accept"), reason: z.string().min(3), protectionDays: z.coerce.number().int().positive().optional() }),
  z.object({ action: z.literal("duplicate"), reason: z.string().min(3) }),
  z.object({ action: z.literal("reject"), reason: z.string().min(3) }),
  z.object({ action: z.literal("extend_protection"), days: z.coerce.number().int().positive(), reason: z.string().min(3) }),
  z.object({ action: z.literal("assign"), salesOwner: z.string().min(1) }),
])

const ACTION_PERMISSION: Record<"request_information" | "accept" | "duplicate" | "reject" | "extend_protection" | "assign", "referral:review" | "referral:attribute"> = {
  request_information: "referral:review",
  accept: "referral:review",
  duplicate: "referral:review",
  reject: "referral:review",
  extend_protection: "referral:attribute",
  assign: "referral:attribute",
}

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await authorizeAdmin("partners", "view")
  if (auth.denied) return auth.denied
  const role = auth.session.role

  const detail = await getReferralReviewDetail(id)
  if (!detail) return NextResponse.json({ error: "Referral not found" }, { status: 404 })
  return NextResponse.json({
    ...detail,
    can: {
      review: referralAdminCan(role, "referral:review"),
      attribute: referralAdminCan(role, "referral:attribute"),
    },
  })
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await authorizeAdmin("partners", "manage")
  if (auth.denied) return auth.denied
  const session = auth.session

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid request" }, { status: 400 })
  }
  const body = parsed.data

  if (!referralAdminCan(session.role, ACTION_PERMISSION[body.action])) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Not configured" }, { status: 500 })

  const ctx = auditContextFromSession(session, request)
  const actor: ReferralActor = { actorType: "ADMIN", actorId: session.userId, actorName: session.name }

  if (body.action === "assign") {
    // Owner is internal routing, not a workflow decision — still audited.
    const { error } = await supabase
      .from("partner_leads")
      .update({ sales_owner: body.salesOwner, updated_at: new Date().toISOString() })
      .eq("id", id)
      .not("referral_reference", "is", null)
    if (error) return NextResponse.json({ error: "Failed to assign" }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  const result =
    body.action === "request_information"
      ? await requestReferralInformation(id, body.message, body.dueAt ?? null, actor, ctx)
      : body.action === "extend_protection"
        ? await extendReferralProtection(id, body.days, body.reason, actor, ctx)
        : await decideReferralReview(
            id,
            body.action === "accept" ? "ACCEPTED" : body.action === "duplicate" ? "DUPLICATE" : "REJECTED",
            actor,
            ctx,
            { reason: body.reason, protectionDays: body.action === "accept" ? body.protectionDays : undefined }
          )

  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ ok: true })
}
