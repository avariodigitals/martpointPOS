import { NextResponse } from "next/server"
import { z } from "zod"
import { getSession } from "@/lib/admin-auth"
import { hasFinanceAction } from "@/lib/finance-permissions"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { closeCommissionPeriod } from "@/lib/referral-finance"
import { referralAdminCan } from "@/lib/referral-permissions"
import type { UserRole } from "@/lib/admin-types"

/* ───────────────────────────  Monthly commission close  ───────────────────────────
 * Finance closes each month; approved payouts are then due inside the payout
 * window carried on the partner's signed Commission Schedule. Closing stamps the
 * period and issues one controlled statement per partner with referral earnings.
 */

function periodKeyOf(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`
}

function rangeFor(periodKey: string): { start: string; end: string } {
  const [y, m] = periodKey.split("-").map(Number)
  const start = new Date(Date.UTC(y, m - 1, 1))
  const end = new Date(Date.UTC(y, m, 0, 23, 59, 59))
  return { start: start.toISOString(), end: end.toISOString() }
}

async function countInRange(status: string, periodKey: string): Promise<number> {
  const { start, end } = rangeFor(periodKey)
  const column = status === "APPROVED" ? "approved_at" : status === "PAID" ? "paid_at" : "created_at"
  const { count } = await supabase
    .from("partner_commissions")
    .select("id", { count: "exact", head: true })
    .eq("status", status)
    .not("earning_kind", "is", null)
    .gte(column, start)
    .lte(column, end)
  return count || 0
}

export async function GET(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!hasFinanceAction(session.role as UserRole, "finance:commissions:view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Not configured" }, { status: 500 })

  const url = new URL(request.url)
  const periodKey = url.searchParams.get("period") || periodKeyOf(new Date())

  const [{ data: periods }, eligibleCount, approvedCount, paidCount, heldCount, disputedCount] = await Promise.all([
    supabase.from("commission_close_periods").select("*").order("period_key", { ascending: false }).limit(24),
    countInRange("ELIGIBLE", periodKey),
    countInRange("APPROVED", periodKey),
    countInRange("PAID", periodKey),
    countInRange("HELD", periodKey),
    countInRange("DISPUTED", periodKey),
  ])

  const current = ((periods || []) as Record<string, unknown>[]).find((p) => p.period_key === periodKey) || null

  return NextResponse.json({
    periodKey,
    periods: (periods || []) as Record<string, unknown>[],
    current: current ? { status: String(current.status), closedAt: current.closed_at, closedBy: current.closed_by } : { status: "OPEN" },
    counts: { eligible: eligibleCount, approved: approvedCount, paid: paidCount, held: heldCount, disputed: disputedCount },
    canClose: referralAdminCan(session.role, "finance:approve") && String(current?.status || "OPEN") !== "CLOSED",
  })
}

const schema = z.object({ periodKey: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/) })

export async function POST(request: Request) {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (!referralAdminCan(session.role, "finance:approve")) {
    return NextResponse.json({ error: "Only Finance or Management can close a commission period" }, { status: 403 })
  }

  const parsed = schema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: "periodKey must be YYYY-MM" }, { status: 400 })

  const res = await closeCommissionPeriod(parsed.data.periodKey, { actorId: session.userId, actorName: session.name })
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 400 })
  // One statement document is issued per partner holding earnings in the period.
  return NextResponse.json({ ok: true, stamped: res.stamped ?? 0 })
}
