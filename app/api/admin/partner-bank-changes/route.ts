import { NextResponse } from "next/server"
import { z } from "zod"
import { authorizeAdmin } from "@/lib/admin-auth"
import { isSupabaseConfigured } from "@/lib/supabase"
import { referralAdminCan } from "@/lib/referral-permissions"
import {
  approveBankChange,
  getBankChangePartnerName,
  listBankChanges,
  markBankChangeReverified,
  rejectBankChange,
} from "@/lib/referral-bank-changes"

/* ─── GET: pending and historic bank changes ─── */
export async function GET(request: Request) {
  const { session, denied } = await authorizeAdmin("partners", "view")
  if (denied) return denied
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Not configured" }, { status: 500 })

  const url = new URL(request.url)
  const status = url.searchParams.get("status")
  const rows = await listBankChanges({ status: status || "PENDING" })

  const changes = await Promise.all(
    rows.map(async (r) => ({
      id: r.id,
      partnerId: r.partner_id,
      partnerName: await getBankChangePartnerName(r),
      status: r.status,
      oldBank: r.old_bank_name,
      oldLast4: r.old_account_last4,
      newBank: r.new_bank_name,
      newLast4: r.new_account_number.replace(/\D/g, "").slice(-4),
      newAccountName: r.new_account_name,
      reason: r.reason,
      requestedByName: r.requested_by_name,
      reverifiedAt: r.reverified_at,
      firstApprovalAt: r.first_approval_at,
      secondApprovalAt: r.second_approval_at,
      createdAt: r.created_at,
    }))
  )

  const role = session.role
  return NextResponse.json({
    changes,
    can: {
      approve: referralAdminCan(role, "bank:approve"),
      manage: referralAdminCan(role, "partner:suspend"),
    },
  })
}

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("reverify"), id: z.string().uuid(), note: z.string().min(3).max(2000) }),
  z.object({ action: z.literal("approve"), id: z.string().uuid() }),
  z.object({ action: z.literal("reject"), id: z.string().uuid(), reason: z.string().min(3).max(2000) }),
])

/* ─── POST ─── */
export async function POST(request: Request) {
  const { session, denied } = await authorizeAdmin("partners", "manage")
  if (denied) return denied
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Not configured" }, { status: 500 })

  const parsed = actionSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  if (!referralAdminCan(session.role, "bank:approve")) {
    return NextResponse.json({ error: "Only Finance or Management can action a payout account change" }, { status: 403 })
  }

  const actor = { actorType: "ADMIN" as const, actorId: session.userId, actorName: session.name || session.username }
  const body = parsed.data

  const res =
    body.action === "reverify"
      ? await markBankChangeReverified(body.id, actor, body.note)
      : body.action === "approve"
        ? await approveBankChange(body.id, actor)
        : await rejectBankChange(body.id, actor, body.reason)

  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 })
  return NextResponse.json({ ok: true, awaitingSecondApproval: "awaitingSecondApproval" in res ? res.awaitingSecondApproval : false })
}
