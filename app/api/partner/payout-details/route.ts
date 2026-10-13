import { NextResponse } from "next/server"
import { z } from "zod"
import { getPartnerSession, authorizePartner } from "@/lib/partner-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { checkRateLimit } from "@/lib/rate-limit"
import { requestBankChange } from "@/lib/referral-bank-changes"

export const dynamic = "force-dynamic"

/* ─── GET: the payout account on file and the partner's own change requests ─── */
export async function GET() {
  const session = await getPartnerSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const auth = await authorizePartner({ session, permission: "commissions:view_own" })
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Not configured" }, { status: 500 })

  const [{ data: profile }, { data: requests }] = await Promise.all([
    supabase
      .from("partner_payout_profiles")
      .select("bank_name, account_number, account_name, verification_status, tax_reference")
      .eq("partner_id", session.partnerId)
      .maybeSingle(),
    supabase
      .from("partner_bank_change_requests")
      .select("id, status, new_bank_name, new_account_number, reason, created_at, rejection_reason")
      .eq("partner_id", session.partnerId)
      .order("created_at", { ascending: false })
      .limit(10),
  ])

  const row = (profile as Record<string, unknown> | null) ?? null
  const digits = String(row?.account_number || "").replace(/\D/g, "")
  return NextResponse.json({
    account: row
      ? {
          bankName: String(row.bank_name || ""),
          accountLast4: digits.slice(-4),
          accountName: String(row.account_name || ""),
          verificationStatus: String(row.verification_status || "PENDING"),
          taxReference: String(row.tax_reference || ""),
        }
      : null,
    requests: ((requests || []) as Record<string, unknown>[]).map((r) => ({
      id: String(r.id),
      status: String(r.status),
      bankName: String(r.new_bank_name || ""),
      accountLast4: String(r.new_account_number || "").replace(/\D/g, "").slice(-4),
      reason: String(r.reason || ""),
      createdAt: String(r.created_at),
      rejectionReason: r.rejection_reason ? String(r.rejection_reason) : null,
    })),
  })
}

const schema = z.object({
  newBankName: z.string().min(2).max(120),
  newAccountNumber: z.string().min(9).max(20),
  newAccountName: z.string().min(2).max(160),
  reason: z.string().min(5).max(1000),
})

/* ─── POST: request a payout account change (never applied directly) ─── */
export async function POST(request: Request) {
  const session = await getPartnerSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const auth = await authorizePartner({ session, permission: "commissions:view_own" })
  if (!auth.authorized) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const parsed = schema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: "Check the new account details" }, { status: 400 })

  const limit = await checkRateLimit(request, { key: "partner-payout-change", max: 5, windowSeconds: 3600 })
  if (!limit.allowed) return NextResponse.json({ error: "Too many change requests — try again later" }, { status: 429 })

  const res = await requestBankChange({
    partnerId: session.partnerId,
    actor: { actorType: "PARTNER", actorId: session.partnerUserId, actorName: session.name },
    ...parsed.data,
  })
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 })

  return NextResponse.json({ ok: true, id: res.id })
}
