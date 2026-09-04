import { supabase, isSupabaseConfigured } from "./supabase"

export type CustomerStage = "ONBOARDING" | "LIVE" | "ADOPTION" | "AT_RISK" | "RENEWAL" | "CHURNED"
export type CustomerHealth = "HEALTHY" | "WATCH" | "AT_RISK" | "CRITICAL"

export type CustomerSuccessProfile = {
  id: string
  business_id: string
  owner_admin_user_id?: string | null
  stage: CustomerStage
  health: CustomerHealth
  last_contact_at?: string | null
  next_follow_up_at?: string | null
  last_training_at?: string | null
  notes_summary?: string | null
  created_at: string
  updated_at: string
}

export type CustomerSuccessActivity = {
  id: string
  business_id: string
  activity_type: string
  summary: string
  outcome?: string | null
  next_action?: string | null
  next_action_at?: string | null
  admin_user_id?: string | null
  created_at: string
}

export type HealthSignals = {
  open_tickets: number
  urgent_tickets: number
  sla_breaches: number
  onboarding_incomplete: boolean
  deployment_not_live: boolean
  subscription_status?: string | null
  outstanding_balance: number
  renewal_approaching: boolean
  last_contact_days?: number | null
  training_complete: boolean
}

function now() {
  return new Date().toISOString()
}

export async function getCustomerSuccessProfile(businessId: string): Promise<CustomerSuccessProfile | null> {
  if (!isSupabaseConfigured()) return null
  const { data, error } = await supabase
    .from("customer_success_profiles")
    .select("*")
    .eq("business_id", businessId)
    .single()
  if (error || !data) return null
  return data as CustomerSuccessProfile
}

export async function createOrUpdateProfile(
  businessId: string,
  updates: Partial<CustomerSuccessProfile>,
  actorId?: string
) {
  if (!isSupabaseConfigured()) throw new Error("Supabase not configured")

  const { data: existing } = await supabase
    .from("customer_success_profiles")
    .select("id")
    .eq("business_id", businessId)
    .single()

  const payload = { ...updates, business_id: businessId, updated_at: now() }

  if (existing) {
    const { data, error } = await supabase
      .from("customer_success_profiles")
      .update(payload)
      .eq("business_id", businessId)
      .select()
      .single()
    if (error || !data) throw new Error(`Profile update failed: ${error?.message || "unknown"}`)
    return data as CustomerSuccessProfile
  }

  const { data, error } = await supabase
    .from("customer_success_profiles")
    .insert({ ...payload, created_at: now() })
    .select()
    .single()
  if (error || !data) throw new Error(`Profile create failed: ${error?.message || "unknown"}`)

  await logCustomerSuccessAudit(actorId, "CUSTOMER_SUCCESS_STAGE_CHANGED", businessId, { stage: data.stage, health: data.health })
  return data as CustomerSuccessProfile
}

export async function recordActivity(input: Omit<CustomerSuccessActivity, "id" | "created_at">) {
  if (!isSupabaseConfigured()) throw new Error("Supabase not configured")

  const { data, error } = await supabase
    .from("customer_success_activities")
    .insert({ ...input, created_at: now() })
    .select()
    .single()

  if (error || !data) throw new Error(`Activity record failed: ${error?.message || "unknown"}`)

  await supabase
    .from("customer_success_profiles")
    .update({
      last_contact_at: now(),
      next_follow_up_at: input.next_action_at,
      updated_at: now(),
    })
    .eq("business_id", input.business_id)

  await logCustomerSuccessAudit(input.admin_user_id, "CUSTOMER_SUCCESS_ACTIVITY_ADDED", input.business_id)
  return data as CustomerSuccessActivity
}

export async function updateHealth(
  businessId: string,
  health: CustomerHealth,
  actorId?: string,
  reason?: string
) {
  if (!isSupabaseConfigured()) throw new Error("Supabase not configured")
  const { data, error } = await supabase
    .from("customer_success_profiles")
    .update({ health, updated_at: now() })
    .eq("business_id", businessId)
    .select()
    .single()
  if (error || !data) throw new Error(`Health update failed: ${error?.message || "unknown"}`)

  await logCustomerSuccessAudit(actorId, "CUSTOMER_HEALTH_CHANGED", businessId, { health, reason })
  return data as CustomerSuccessProfile
}

export async function getHealthSignals(businessId: string): Promise<Partial<HealthSignals>> {
  if (!isSupabaseConfigured()) return {}

  const [tickets, invoices, subscriptions, deployments, onboarding, profile, training] = await Promise.all([
    supabase.from("support_tickets").select("status, priority, first_response_due_at, resolution_due_at").eq("business_id", businessId),
    supabase.from("invoices").select("status, balance_due").eq("business_id", businessId),
    supabase.from("subscriptions").select("status, renewal_date").eq("business_id", businessId).order("created_at", { ascending: false }),
    supabase.from("business_deployments").select("status").eq("business_id", businessId).maybeSingle(),
    supabase.from("onboarding").select("status").eq("business_id", businessId).maybeSingle(),
    supabase.from("customer_success_profiles").select("*").eq("business_id", businessId).maybeSingle(),
    supabase.from("customer_training_records").select("*").eq("business_id", businessId),
  ])

  const openTickets = ((tickets.data as { status: string; priority: string; first_response_due_at?: string; resolution_due_at?: string }[]) || []).filter((t) => t.status !== "RESOLVED" && t.status !== "CLOSED" && t.status !== "CANCELLED")
  const urgentTickets = openTickets.filter((t) => t.priority === "URGENT" || t.priority === "HIGH").length
  const nowTime = Date.now()
  const slaBreaches = openTickets.filter((t) => (t.first_response_due_at && new Date(t.first_response_due_at).getTime() < nowTime) || (t.resolution_due_at && new Date(t.resolution_due_at).getTime() < nowTime)).length

  const outstanding = ((invoices.data as { status: string; balance_due: number }[]) || [])
    .filter((i) => i.status !== "VOID" && i.status !== "CANCELLED")
    .reduce((s, i) => s + i.balance_due, 0)

  const activeSub = (subscriptions.data as { status: string; renewal_date?: string }[] | null)?.[0]
  const renewalApproaching = activeSub?.renewal_date ? new Date(activeSub.renewal_date).getTime() - nowTime < 30 * 24 * 60 * 60 * 1000 : false

  const lastContact = profile.data ? new Date((profile.data as CustomerSuccessProfile).last_contact_at || (profile.data as CustomerSuccessProfile).created_at).getTime() : null
  const lastContactDays = lastContact ? Math.floor((nowTime - lastContact) / (1000 * 60 * 60 * 24)) : null

  return {
    open_tickets: openTickets.length,
    urgent_tickets: urgentTickets,
    sla_breaches: slaBreaches,
    onboarding_incomplete: onboarding.data ? (onboarding.data as { status: string }).status !== "COMPLETED" : true,
    deployment_not_live: deployments.data ? (deployments.data as { status: string }).status !== "LIVE" : true,
    subscription_status: activeSub?.status || null,
    outstanding_balance: outstanding,
    renewal_approaching: renewalApproaching,
    last_contact_days: lastContactDays,
    training_complete: (training.data?.length || 0) > 0,
  }
}

async function logCustomerSuccessAudit(
  actorId: string | null | undefined,
  action: "CUSTOMER_SUCCESS_STAGE_CHANGED" | "CUSTOMER_HEALTH_CHANGED" | "CUSTOMER_SUCCESS_ACTIVITY_ADDED",
  businessId: string,
  metadata?: Record<string, unknown>
) {
  if (!isSupabaseConfigured()) return
  await supabase.from("finance_audit_events").insert({
    actor_type: "ADMIN",
    actor_id: actorId,
    action,
    entity_type: "CUSTOMER_SUCCESS",
    entity_id: businessId,
    metadata,
    created_at: now(),
  })
}
