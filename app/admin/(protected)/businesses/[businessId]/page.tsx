import { notFound } from "next/navigation"
import { requireAdminPage } from "@/lib/admin-auth"
import { getBusinessById, listBusinessBranches, listBusinessUsers, type Business } from "@/lib/businesses"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { BusinessDetail } from "./business-detail"

export default async function BusinessDetailPage({
  params,
}: {
  params: Promise<{ businessId: string }>
}) {
  const session = await requireAdminPage("businesses", "view")
  const { businessId } = await params

  const business = await getBusinessById(businessId)
  if (!business) notFound()

  // Linked onboarding records (by lead_id during transition, and business_id)
  let onboardingRecords: Array<Record<string, unknown>> = []
  if (isSupabaseConfigured()) {
    const leadId = business.sourceLeadId
    const { data: byLead } = leadId
      ? await supabase.from("onboarding").select("*").eq("lead_id", leadId)
      : { data: null }
    const { data: byBusiness } = await supabase
      .from("onboarding")
      .select("*")
      .eq("business_id", businessId)
    onboardingRecords = [...(byLead || []), ...(byBusiness || [])] as Array<Record<string, unknown>>
  }

  // Activity: audit logs for this business
  let activity: Array<{ action: string; actorName: string | null; createdAt: string; metadata: Record<string, unknown> | null }> = []
  if (isSupabaseConfigured()) {
    const { data } = await supabase
      .from("audit_logs")
      .select("action, actor_name, created_at, metadata")
      .eq("entity_type", "business")
      .eq("entity_id", businessId)
      .order("created_at", { ascending: false })
      .limit(50)
    activity = (data || []).map((r: Record<string, unknown>) => ({
      action: r.action as string,
      actorName: (r.actor_name as string) ?? null,
      createdAt: r.created_at as string,
      metadata: (r.metadata as Record<string, unknown>) ?? null,
    }))
  }

  // Branches and business users
  const [branches, businessUsers] = await Promise.all([
    listBusinessBranches(businessId),
    listBusinessUsers(businessId),
  ])

  // Training sessions
  let trainingSessions: Array<Record<string, unknown>> = []
  if (isSupabaseConfigured()) {
    const { data: sessions } = await supabase
      .from("onboarding_training_sessions")
      .select("*")
      .eq("business_id", businessId)
      .order("created_at", { ascending: true })
    trainingSessions = (sessions || []) as Array<Record<string, unknown>>
  }

  // Subscription + entitlements + licence
  let subscription: Record<string, unknown> | null = null
  let entitlement: Record<string, unknown> | null = null
  let licence: Record<string, unknown> | null = null
  let invoiceSummary = { total: 0, outstanding: 0, count: 0 }
  if (isSupabaseConfigured()) {
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("*, plans:plan_id (name, code, billing_type)")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    subscription = sub as Record<string, unknown> | null

    const { data: ent } = await supabase
      .from("business_entitlements")
      .select("*")
      .eq("business_id", businessId)
      .maybeSingle()
    entitlement = ent as Record<string, unknown> | null

    const { data: lic } = await supabase
      .from("business_licenses")
      .select("*")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    licence = lic as Record<string, unknown> | null

    const { data: inv } = await supabase
      .from("invoices")
      .select("total_amount, balance_due, status")
      .eq("business_id", businessId)
    if (inv) {
      invoiceSummary = {
        count: inv.length,
        total: inv.reduce((s: number, i: Record<string, unknown>) => s + (Number(i.total_amount) || 0), 0),
        outstanding: inv.reduce((s: number, i: Record<string, unknown>) => s + (Number(i.balance_due) || 0), 0),
      }
    }
  }

  return (
    <BusinessDetail
      business={business}
      onboardingRecords={onboardingRecords}
      trainingSessions={trainingSessions}
      activity={activity}
      branches={branches}
      businessUsers={businessUsers}
      subscription={subscription}
      entitlement={entitlement}
      licence={licence}
      invoiceSummary={invoiceSummary}
      actorName={session.name || session.username}
    />
  )
}
