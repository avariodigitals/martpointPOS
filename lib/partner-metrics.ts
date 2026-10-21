import { supabase } from "./supabase"

export interface CalculatedMetrics {
  acceptedReferrals6m: number
  acceptedReferrals12m: number
  paidConversions6m: number
  paidConversions12m: number
  validSubmissionRate: number
  refundRate: number
  consecutivePassingReviews: number
  activeAgreement: boolean
  orientationCompleted: boolean
  daysSinceActivation: number
  misleadingClaim: boolean
  consentFailure: boolean
  strategicContribution: boolean
  managementApproved: boolean
}

export async function calculatePartnerMetrics(partnerId: string): Promise<CalculatedMetrics> {
  const now = new Date()
  const sixMonthsAgo = new Date(new Date().setMonth(now.getMonth() - 6)).toISOString()
  const twelveMonthsAgo = new Date(new Date().setMonth(now.getMonth() - 12)).toISOString()

  // 1. Count Accepted Referrals
  const { count: acc6m } = await supabase
    .from("db_referrals")
    .select("*", { count: 'exact', head: true })
    .eq("partner_id", partnerId)
    .eq("status", "ACCEPTED")
    .gte("created_at", sixMonthsAgo)

  const { count: acc12m } = await supabase
    .from("db_referrals")
    .select("*", { count: 'exact', head: true })
    .eq("partner_id", partnerId)
    .eq("status", "ACCEPTED")
    .gte("created_at", twelveMonthsAgo)

  // 2. Count Paid Conversions (assuming linked to sales/invoices)
  const { count: paid6m } = await supabase
    .from("db_sales")
    .select("*", { count: 'exact', head: true })
    .eq("referral_partner_id", partnerId)
    .eq("payment_status", "PAID")
    .gte("created_at", sixMonthsAgo)

  const { count: paid12m } = await supabase
    .from("db_sales")
    .select("*", { count: 'exact', head: true })
    .eq("referral_partner_id", partnerId)
    .eq("payment_status", "PAID")
    .gte("created_at", twelveMonthsAgo)

  // 3. Rates
  const { count: totalSubs } = await supabase
    .from("db_referrals")
    .select("*", { count: 'exact', head: true })
    .eq("partner_id", partnerId)

  const totalSubmissionCount = totalSubs || 0
  const validRate = totalSubmissionCount > 0 ? (acc12m || 0) / totalSubmissionCount * 100 : 0

  const { count: refunds } = await supabase
    .from("db_sales")
    .select("*", { count: 'exact', head: true })
    .eq("referral_partner_id", partnerId)
    .eq("status", "REFUNDED")

  const paidConversionCount12m = paid12m || 0
  const refundRate = paidConversionCount12m > 0 ? (refunds || 0) / paidConversionCount12m * 100 : 0

  // 4. Profile & History
  const { data: profile } = await supabase
    .from("partners")
    .select("partner_since, current_grade, status, application_id")
    .eq("id", partnerId)
    .maybeSingle()

  const { data: history } = await supabase
    .from("partner_grade_history")
    .select("new_grade")
    .eq("partner_id", partnerId)
    .order("created_at", { ascending: false })

  // Simple consecutive pass count (simplified for demo)
  const passing = history?.filter(h => h.new_grade !== "SILVER").length || 0

  const [{ data: agreement }, { data: application }] = await Promise.all([
    supabase
      .from("partner_agreements")
      .select("id")
      .eq("partner_id", partnerId)
      .eq("agreement_kind", "REFERRAL_PARTNER_AGREEMENT")
      .in("status", ["EXECUTED", "ACTIVE"])
      .limit(1),
    profile?.application_id
      ? supabase
          .from("partner_applications")
          .select("orientation_completed_at")
          .eq("id", profile.application_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const activationDate = profile?.partner_since ? new Date(profile.partner_since) : new Date()
  const daysSince = Math.floor((now.getTime() - activationDate.getTime()) / (1000 * 60 * 60 * 24))

  return {
    acceptedReferrals6m: acc6m || 0,
    acceptedReferrals12m: acc12m || 0,
    paidConversions6m: paid6m || 0,
    paidConversions12m: paid12m || 0,
    validSubmissionRate: Math.round(validRate),
    refundRate: Math.round(refundRate),
    consecutivePassingReviews: passing,
    activeAgreement: Array.isArray(agreement) ? agreement.length > 0 : Boolean(agreement),
    orientationCompleted: Boolean(application?.orientation_completed_at),
    daysSinceActivation: daysSince,
    misleadingClaim: false, // Default to false, would check compliance table
    consentFailure: false,
    strategicContribution: false, // Manual flag
    managementApproved: false,
  }
}
