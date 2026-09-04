import { NextResponse } from "next/server"
import { getPartnerSession, authorizePartner } from "@/lib/partner-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"

/* ─── GET: a partner's own commission rows ─── */
export async function GET() {
  const session = await getPartnerSession()
  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  const auth = await authorizePartner({ session, permission: "commissions:view_own" })
  if (!auth.authorized) {
    return auth.response!
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ success: true, data: [] })
  }

  const { data, error } = await supabase
    .from("partner_commissions")
    .select(
      "*, commission_plans:commission_plan_id (name, commission_basis, applies_to, percentage, fixed_amount), businesses:business_id (business_name)"
    )
    .eq("partner_id", session.partnerId)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("[partner/commissions] query error:", error.message)
    return NextResponse.json({ success: false, error: "Failed to load commissions" }, { status: 500 })
  }

  const rows = (data || []).map((row: any) => ({
    id: row.id as string,
    business_id: row.business_id as string,
    business_name: (row.businesses as { business_name?: string | null } | null)?.business_name,
    attribution_type: row.attribution_type as string,
    applies_to: (row.commission_plans as { applies_to?: string | null } | null)?.applies_to,
    commission_basis: (row.commission_plans as { commission_basis?: string | null } | null)?.commission_basis,
    percentage: (row.commission_plans as { percentage?: number | null } | null)?.percentage,
    fixed_amount: (row.commission_plans as { fixed_amount?: number | null } | null)?.fixed_amount,
    commission_amount: row.commission_amount as number,
    currency: row.currency as string,
    status: row.status as string,
    earned_at: row.earned_at as string | null,
    paid_at: row.paid_at as string | null,
    created_at: row.created_at as string,
  }))

  return NextResponse.json({ success: true, data: rows })
}
