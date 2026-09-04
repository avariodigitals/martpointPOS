import { supabase, isSupabaseConfigured } from "./supabase"

export type AdminTask = {
  id: string
  task_type: string
  title: string
  description?: string | null
  entity_type?: string | null
  entity_id?: string | null
  status: "OPEN" | "IN_PROGRESS" | "DONE" | "DISMISSED"
  assigned_to?: string | null
  due_at?: string | null
  deep_link?: string | null
  created_at: string
  updated_at: string
}

function now() {
  return new Date().toISOString()
}

export async function generateAdminTasks(): Promise<AdminTask[]> {
  if (!isSupabaseConfigured()) return []
  const tasks: AdminTask[] = []

  const [
    partnerApplications,
    partnerCompliance,
    onboardingReviews,
    pendingDeployments,
    pendingPayments,
    approachingRenewals,
    unassignedTickets,
    slaBreaches,
    followUps,
    expiringCompliance,
  ] = await Promise.all([
    supabase.from("partner_applications").select("id, business_name, submitted_at").eq("status", "SUBMITTED"),
    supabase.from("compliance_records").select("id, partner_id, business_id, requirement_type").eq("status", "REQUESTED"),
    supabase.from("onboarding").select("id, business_name").eq("status", "PENDING_REVIEW"),
    supabase.from("business_deployments").select("id, business_id, status").eq("status", "PENDING"),
    supabase.from("payments").select("id, business_id, payment_reference").eq("status", "PENDING"),
    supabase.from("subscription_renewals").select("id, subscription_id, renewal_due_date").lte("renewal_due_date", new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]).in("status", ["UPCOMING", "DUE"]),
    supabase.from("support_tickets").select("id, ticket_number, subject").is("assigned_admin_user_id", null).in("status", ["NEW", "IN_PROGRESS"]),
    supabase.from("support_tickets").select("id, ticket_number, first_response_due_at, resolution_due_at").in("status", ["NEW", "ASSIGNED", "IN_PROGRESS", "WAITING_CUSTOMER", "WAITING_PARTNER"]),
    supabase.from("customer_success_profiles").select("id, business_id, next_follow_up_at").lte("next_follow_up_at", now()),
    supabase.from("compliance_records").select("id, business_id, partner_id, expires_at").lte("expires_at", new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()).neq("status", "EXPIRED"),
  ])

  for (const a of (partnerApplications.data as { id: string; business_name: string }[] | null) || []) {
    tasks.push({
      id: `pa-${a.id}`,
      task_type: "PARTNER_APPLICATION_REVIEW",
      title: "Review partner application",
      description: a.business_name,
      entity_type: "PARTNER_APPLICATION",
      entity_id: a.id,
      status: "OPEN",
      deep_link: `/admin/partners/applications/${a.id}`,
    } as AdminTask)
  }

  for (const c of (partnerCompliance.data as { id: string; partner_id?: string; business_id?: string; requirement_type: string }[] | null) || []) {
    tasks.push({
      id: `pcr-${c.id}`,
      task_type: "PARTNER_COMPLIANCE_REQUIRED",
      title: `Partner compliance: ${c.requirement_type}`,
      entity_type: "COMPLIANCE_RECORD",
      entity_id: c.id,
      status: "OPEN",
      deep_link: `/admin/compliance?id=${c.id}`,
    } as AdminTask)
  }

  for (const o of (onboardingReviews.data as { id: string; business_name: string }[] | null) || []) {
    tasks.push({
      id: `ob-${o.id}`,
      task_type: "CUSTOMER_ONBOARDING_REVIEW",
      title: `Onboarding review: ${o.business_name}`,
      entity_type: "ONBOARDING",
      entity_id: o.id,
      status: "OPEN",
      deep_link: `/admin/onboarding?id=${o.id}`,
    } as AdminTask)
  }

  for (const d of (pendingDeployments.data as { id: string; business_id: string }[] | null) || []) {
    tasks.push({
      id: `bd-${d.id}`,
      task_type: "BUSINESS_DEPLOYMENT_PENDING",
      title: "Business deployment pending",
      entity_type: "BUSINESS_DEPLOYMENT",
      entity_id: d.id,
      status: "OPEN",
      deep_link: `/admin/businesses/${d.business_id}`,
    } as AdminTask)
  }

  for (const p of (pendingPayments.data as { id: string; payment_reference: string }[] | null) || []) {
    tasks.push({
      id: `pay-${p.id}`,
      task_type: "PAYMENT_CONFIRMATION_PENDING",
      title: `Payment awaiting confirmation: ${p.payment_reference}`,
      entity_type: "PAYMENT",
      entity_id: p.id,
      status: "OPEN",
      deep_link: `/admin/finance/commercial/payments`,
    } as AdminTask)
  }

  for (const r of (approachingRenewals.data as { id: string; subscription_id: string }[] | null) || []) {
    tasks.push({
      id: `ren-${r.id}`,
      task_type: "RENEWAL_APPROACHING",
      title: "Subscription renewal approaching",
      entity_type: "SUBSCRIPTION_RENEWAL",
      entity_id: r.id,
      status: "OPEN",
      deep_link: `/admin/finance/commercial/renewals`,
    } as AdminTask)
  }

  for (const t of (unassignedTickets.data as { id: string; ticket_number: string; subject: string }[] | null) || []) {
    tasks.push({
      id: `st-${t.id}`,
      task_type: "SUPPORT_UNASSIGNED",
      title: `Unassigned ticket: ${t.ticket_number}`,
      description: t.subject,
      entity_type: "SUPPORT_TICKET",
      entity_id: t.id,
      status: "OPEN",
      deep_link: `/admin/support/${t.id}`,
    } as AdminTask)
  }

  const nowTime = Date.now()
  for (const t of (slaBreaches.data as { id: string; ticket_number: string; first_response_due_at?: string; resolution_due_at?: string }[] | null) || []) {
    const due = t.first_response_due_at ? new Date(t.first_response_due_at).getTime() : t.resolution_due_at ? new Date(t.resolution_due_at).getTime() : null
    if (due && due < nowTime) {
      tasks.push({
        id: `sla-${t.id}`,
        task_type: "SLA_BREACH",
        title: `SLA breached: ${t.ticket_number}`,
        entity_type: "SUPPORT_TICKET",
        entity_id: t.id,
        status: "OPEN",
        deep_link: `/admin/support/${t.id}`,
      } as AdminTask)
    }
  }

  for (const f of (followUps.data as { id: string; business_id: string }[] | null) || []) {
    tasks.push({
      id: `fu-${f.id}`,
      task_type: "CUSTOMER_FOLLOW_UP_DUE",
      title: "Customer follow-up due",
      entity_type: "CUSTOMER_SUCCESS_PROFILE",
      entity_id: f.id,
      status: "OPEN",
      deep_link: `/admin/businesses/${f.business_id}`,
    } as AdminTask)
  }

  for (const e of (expiringCompliance.data as { id: string; business_id?: string; partner_id?: string }[] | null) || []) {
    tasks.push({
      id: `exp-${e.id}`,
      task_type: "COMPLIANCE_EXPIRING",
      title: "Compliance record expiring",
      entity_type: "COMPLIANCE_RECORD",
      entity_id: e.id,
      status: "OPEN",
      deep_link: `/admin/compliance?id=${e.id}`,
    } as AdminTask)
  }

  return tasks
}
