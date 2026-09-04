import { NextResponse } from "next/server"
import { getPartnerSession, authorizePartner, canPartnerAccessBusiness } from "@/lib/partner-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"

/* ─── GET: safe commercial status for a partner's assigned customer ─── */
export async function GET(request: Request, props: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await props.params

  const session = await getPartnerSession()
  if (!session) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  const auth = await authorizePartner({ session, permission: "customers:view_assigned" })
  if (!auth.authorized) {
    return auth.response!
  }

  const access = await canPartnerAccessBusiness(session.partnerId, businessId, {
    partnerUserId: auth.user!.id,
    userPermission: "customers:view_assigned",
  })
  if (!access.allowed) {
    return NextResponse.json({ success: false, error: "Access denied" }, { status: 403 })
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ success: true, data: { invoices: [], payments: [], subscriptions: [], renewals: [] } })
  }

  const [invoicesRes, paymentsRes, subscriptionsRes] = await Promise.all([
    supabase
      .from("invoices")
      .select("id, invoice_number, issue_date, due_date, total_amount, amount_paid, balance_due, status, currency")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false }),
    supabase
      .from("payments")
      .select("id, payment_reference, amount, currency, payment_method, status, paid_at")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false }),
    supabase.from("subscriptions").select("*, plans(*)").eq("business_id", businessId).order("created_at", { ascending: false }),
  ])

  const subscriptionIds = (subscriptionsRes.data || []).map((s: any) => s.id as string)
  const renewalsRes = subscriptionIds.length
    ? await supabase
        .from("subscription_renewals")
        .select("*")
        .in("subscription_id", subscriptionIds)
        .order("renewal_due_date", { ascending: true })
    : { data: [], error: null }

  if (invoicesRes.error || paymentsRes.error || subscriptionsRes.error || renewalsRes.error) {
    console.error("[partner/customers/finance] query error:", {
      invoices: invoicesRes.error?.message,
      payments: paymentsRes.error?.message,
      subscriptions: subscriptionsRes.error?.message,
      renewals: renewalsRes.error?.message,
    })
    return NextResponse.json({ success: false, error: "Failed to load finance data" }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    data: {
      invoices: invoicesRes.data || [],
      payments: paymentsRes.data || [],
      subscriptions: subscriptionsRes.data || [],
      renewals: renewalsRes.data || [],
    },
  })
}
