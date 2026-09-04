import { supabase, isSupabaseConfigured } from "./supabase"

export async function getAdminDashboardCounters(): Promise<{
  partnerLeadsAwaitingReview: number
  duplicateLeadReviews: number
  expiringLeadProtections: number
  businessesAwaitingDeployment: number
  partnerOnboardingsInProgress: number
  onboardingsAwaitingReview: number
}> {
  if (!isSupabaseConfigured()) {
    return {
      partnerLeadsAwaitingReview: 0,
      duplicateLeadReviews: 0,
      expiringLeadProtections: 0,
      businessesAwaitingDeployment: 0,
      partnerOnboardingsInProgress: 0,
      onboardingsAwaitingReview: 0,
    }
  }

  const now = new Date().toISOString()
  const soon = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  const [
    { count: awaiting },
    { count: duplicates },
    { count: expiring },
    { count: awaitingDeployment },
    { count: inProgress },
    { count: awaitingReview },
  ] = await Promise.all([
    supabase.from("partner_leads").select("id", { count: "exact" }).eq("protection_status", "PENDING"),
    supabase.from("partner_leads").select("id", { count: "exact" }).not("matched_business_id", "is", null),
    supabase.from("partner_leads").select("id", { count: "exact" }).eq("protection_status", "PROTECTED").gt("protection_expires_at", now).lt("protection_expires_at", soon),
    supabase.from("business_deployments").select("id", { count: "exact" }).eq("status", "PENDING"),
    supabase.from("businesses").select("id", { count: "exact" }).eq("status", "ONBOARDING"),
    supabase.from("businesses").select("id", { count: "exact" }).eq("status", "PARTNER_COMPLETED"),
  ])

  return {
    partnerLeadsAwaitingReview: awaiting ?? 0,
    duplicateLeadReviews: duplicates ?? 0,
    expiringLeadProtections: expiring ?? 0,
    businessesAwaitingDeployment: awaitingDeployment ?? 0,
    partnerOnboardingsInProgress: inProgress ?? 0,
    onboardingsAwaitingReview: awaitingReview ?? 0,
  }
}
