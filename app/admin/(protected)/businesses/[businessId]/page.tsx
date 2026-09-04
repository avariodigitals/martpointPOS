import { notFound } from "next/navigation"
import { requireAdminPage } from "@/lib/admin-auth"
import { getBusinessById } from "@/lib/businesses"
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

  return (
    <BusinessDetail
      business={business}
      onboardingRecords={onboardingRecords}
      activity={activity}
      actorName={session.name || session.username}
    />
  )
}
