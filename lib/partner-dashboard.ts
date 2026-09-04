import { supabase, isSupabaseConfigured } from "./supabase"

export async function getPartnerDashboardMetrics(partnerId: string): Promise<{
  registeredLeads: number
  protectedLeads: number
  openOpportunities: number
  assignedCustomers: number
  customersOnboarding: number
  tasksRequiringAttention: number
}> {
  if (!isSupabaseConfigured()) {
    return {
      registeredLeads: 0,
      protectedLeads: 0,
      openOpportunities: 0,
      assignedCustomers: 0,
      customersOnboarding: 0,
      tasksRequiringAttention: 0,
    }
  }

  const now = new Date().toISOString()

  const [{ count: registered }, { count: protectedCount }, { count: open }, { count: assigned }, { count: onboarding }, { count: tasks }] = await Promise.all([
    supabase.from("partner_leads").select("id", { count: "exact" }).eq("partner_id", partnerId),
    supabase
      .from("partner_leads")
      .select("id", { count: "exact" })
      .eq("partner_id", partnerId)
      .eq("protection_status", "PROTECTED")
      .gt("protection_expires_at", now),
    supabase
      .from("partner_leads")
      .select("id", { count: "exact" })
      .eq("partner_id", partnerId)
      .in("status", ["QUALIFIED", "DEMO", "PROPOSAL", "NEGOTIATION"]),
    supabase
      .from("partner_customer_assignments")
      .select("id", { count: "exact" })
      .eq("partner_id", partnerId)
      .eq("status", "ACTIVE")
      .or(`expires_at.is.null,expires_at.gt.${now}`),
    supabase
      .from("partner_customer_assignments")
      .select("id,businesses!inner(status)", { count: "exact" })
      .eq("partner_id", partnerId)
      .eq("status", "ACTIVE")
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .eq("businesses.status", "ONBOARDING"),
    supabase
      .from("partner_onboarding_tasks")
      .select("id", { count: "exact" })
      .not("business_id", "in", [])
      .eq("partner_id", partnerId)
      .or("status.eq.NOT_STARTED,status.eq.BLOCKED"),
  ])

  return {
    registeredLeads: registered ?? 0,
    protectedLeads: protectedCount ?? 0,
    openOpportunities: open ?? 0,
    assignedCustomers: assigned ?? 0,
    customersOnboarding: onboarding ?? 0,
    tasksRequiringAttention: tasks ?? 0,
  }
}
