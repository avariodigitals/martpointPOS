"use server"

import { supabase, isSupabaseConfigured } from "@/lib/supabase"

export type ReportPeriod = "today" | "7d" | "30d" | "this_month" | "quarter" | "year"

export type RevenueByItem = {
  name: string
  item_type: string
  count: number
  revenue: number
}

export type CommercialReport = {
  revenue_collected: number
  outstanding_invoices: number
  outstanding_balance: number
  overdue_invoices: number
  overdue_balance: number
  renewals_due: number
  revenue_by_product_plan: RevenueByItem[]
  commission_liability: number
  commission_paid: number
}

export type CustomerReport = {
  active_businesses: number
  new_businesses: number
  onboarding: number
  health_distribution: { health: string; count: number }[]
  at_risk: number
  churned: number
  renewals: number
}

export type PartnerReport = {
  applications: number
  active_partners: number
  partner_leads: number
  won_opportunities: number
  partner_sourced_businesses: number
  attributed_revenue: number
  commission_earned: number
  commission_paid: number
}

export type SupportReport = {
  tickets_opened: number
  tickets_resolved: number
  open_backlog: number
  sla_breaches: number
  escalations: number
  category_distribution: { category: string; count: number }[]
  priority_distribution: { priority: string; count: number }[]
}

export type OperationsReport = {
  pending_deployments: number
  onboarding_awaiting_review: number
  compliance_outstanding: number
  open_incidents: number
  critical_incidents: number
}

type PeriodBounds = {
  start: string
  end: string
}

function startOfDay(d: Date) {
  const c = new Date(d)
  c.setHours(0, 0, 0, 0)
  return c
}

function getPeriodBounds(period: ReportPeriod): PeriodBounds {
  const end = new Date()
  const start = startOfDay(new Date(end))

  switch (period) {
    case "today":
      break
    case "7d":
      start.setDate(start.getDate() - 7)
      break
    case "30d":
      start.setDate(start.getDate() - 30)
      break
    case "this_month":
      start.setDate(1)
      break
    case "quarter": {
      const quarter = Math.floor(start.getMonth() / 3)
      start.setMonth(quarter * 3)
      start.setDate(1)
      break
    }
    case "year":
      start.setMonth(0)
      start.setDate(1)
      break
  }

  return { start: start.toISOString(), end: end.toISOString() }
}

function numeric(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function countResult(res: { count?: number | null; error?: { message: string } | null }): number {
  if (res.error) {
    console.error("report count error:", res.error.message)
    return 0
  }
  return res.count ?? 0
}

function sumAmounts(rows: unknown[] | null, key = "amount"): number {
  return (rows || []).reduce((sum: number, row: any) => sum + numeric(row[key]), 0)
}

export async function commercialReport(period: ReportPeriod): Promise<CommercialReport> {
  const empty: CommercialReport = {
    revenue_collected: 0,
    outstanding_invoices: 0,
    outstanding_balance: 0,
    overdue_invoices: 0,
    overdue_balance: 0,
    renewals_due: 0,
    revenue_by_product_plan: [],
    commission_liability: 0,
    commission_paid: 0,
  }

  if (!isSupabaseConfigured()) return empty

  const { start, end } = getPeriodBounds(period)

  try {
    const revenue = await supabase
      .from("payments")
      .select("amount", { count: "exact" })
      .eq("status", "CONFIRMED")
      .not("paid_at", "is", null)
      .gte("paid_at", start)
      .lte("paid_at", end)
    const revenueRows = (revenue.data as any[]) || []

    const outstanding = await supabase
      .from("invoices")
      .select("balance_due", { count: "exact" })
      .in("status", ["ISSUED", "PARTIALLY_PAID", "OVERDUE"])
      .gt("balance_due", 0)
    const outstandingRows = (outstanding.data as any[]) || []

    const overdue = await supabase
      .from("invoices")
      .select("balance_due", { count: "exact" })
      .lt("due_date", end.split("T")[0])
      .in("status", ["ISSUED", "PARTIALLY_PAID", "OVERDUE"])
      .gt("balance_due", 0)
    const overdueRows = (overdue.data as any[]) || []

    const renewals = await supabase
      .from("subscription_renewals")
      .select("id", { count: "exact", head: true })
      .gte("renewal_due_date", start)
      .lte("renewal_due_date", end.split("T")[0])

    const { data: invData, error: invErr } = await supabase
      .from("invoices")
      .select("*, invoice_items(*)")
      .gte("issue_date", start)
      .lte("issue_date", end.split("T")[0])
      .in("status", ["ISSUED", "PAID", "PARTIALLY_PAID", "OVERDUE"])
    if (invErr) console.error("revenue by plan error:", invErr.message)
    const invoices = (invData as any[]) || []
    const byItem: Record<string, RevenueByItem> = {}
    for (const inv of invoices) {
      for (const item of (inv.invoice_items || []) as any[]) {
        const key = `${item.item_type || "UNKNOWN"}::${item.description || "Unknown"}`
        if (!byItem[key]) {
          byItem[key] = {
            name: item.description || "Unknown",
            item_type: String(item.item_type || "UNKNOWN"),
            count: 0,
            revenue: 0,
          }
        }
        byItem[key].count += 1
        byItem[key].revenue += numeric(item.line_total)
      }
    }

    const { data: liabRows, error: liabErr } = await supabase
      .from("partner_commissions")
      .select("commission_amount")
      .in("status", ["PENDING", "ELIGIBLE", "APPROVED", "SCHEDULED"])
    if (liabErr) console.error("commission liability error:", liabErr.message)

    const { data: paidRows, error: paidErr } = await supabase
      .from("partner_commissions")
      .select("commission_amount")
      .eq("status", "PAID")
      .not("paid_at", "is", null)
      .gte("paid_at", start)
      .lte("paid_at", end)
    if (paidErr) console.error("commission paid error:", paidErr.message)

    return {
      revenue_collected: sumAmounts(revenueRows),
      outstanding_invoices: outstandingRows.length,
      outstanding_balance: outstandingRows.reduce((sum, r: any) => sum + numeric(r.balance_due), 0),
      overdue_invoices: overdueRows.length,
      overdue_balance: overdueRows.reduce((sum, r: any) => sum + numeric(r.balance_due), 0),
      renewals_due: countResult(renewals),
      revenue_by_product_plan: Object.values(byItem),
      commission_liability: sumAmounts(liabRows, "commission_amount"),
      commission_paid: sumAmounts(paidRows, "commission_amount"),
    }
  } catch (err: any) {
    console.error("commercial report error:", err?.message)
    return empty
  }
}

export async function customersReport(period: ReportPeriod): Promise<CustomerReport> {
  const empty: CustomerReport = {
    active_businesses: 0,
    new_businesses: 0,
    onboarding: 0,
    health_distribution: [],
    at_risk: 0,
    churned: 0,
    renewals: 0,
  }

  if (!isSupabaseConfigured()) return empty

  const { start, end } = getPeriodBounds(period)

  try {
    const active = await supabase
      .from("businesses")
      .select("id", { count: "exact", head: true })
      .eq("status", "ACTIVE")

    const newBusinesses = await supabase
      .from("businesses")
      .select("id", { count: "exact", head: true })
      .gte("created_at", start)
      .lte("created_at", end)

    const onboarding = await supabase
      .from("businesses")
      .select("id", { count: "exact", head: true })
      .eq("status", "ONBOARDING")

    const { data: healthData, error: healthErr } = await supabase
      .from("customer_success_profiles")
      .select("health")
    if (healthErr) console.error("health distribution error:", healthErr.message)
    const healthRows = (healthData as any[]) || []
    const healthDist: Record<string, number> = {}
    for (const row of healthRows) {
      const h = row.health || "UNKNOWN"
      healthDist[h] = (healthDist[h] || 0) + 1
    }

    const atRisk = await supabase
      .from("customer_success_profiles")
      .select("id", { count: "exact", head: true })
      .in("health", ["AT_RISK", "CRITICAL"])

    const churned = await supabase
      .from("customer_success_profiles")
      .select("id", { count: "exact", head: true })
      .eq("stage", "CHURNED")

    const renewals = await supabase
      .from("subscription_renewals")
      .select("id", { count: "exact", head: true })
      .gte("renewal_due_date", start)
      .lte("renewal_due_date", end.split("T")[0])

    return {
      active_businesses: countResult(active),
      new_businesses: countResult(newBusinesses),
      onboarding: countResult(onboarding),
      health_distribution: Object.entries(healthDist).map(([health, count]) => ({ health, count })),
      at_risk: countResult(atRisk),
      churned: countResult(churned),
      renewals: countResult(renewals),
    }
  } catch (err: any) {
    console.error("customers report error:", err?.message)
    return empty
  }
}

export async function partnersReport(period: ReportPeriod): Promise<PartnerReport> {
  const empty: PartnerReport = {
    applications: 0,
    active_partners: 0,
    partner_leads: 0,
    won_opportunities: 0,
    partner_sourced_businesses: 0,
    attributed_revenue: 0,
    commission_earned: 0,
    commission_paid: 0,
  }

  if (!isSupabaseConfigured()) return empty

  const { start, end } = getPeriodBounds(period)

  try {
    const applications = await supabase
      .from("partner_applications")
      .select("id", { count: "exact", head: true })
      .gte("created_at", start)
      .lte("created_at", end)

    const active = await supabase
      .from("partners")
      .select("id", { count: "exact", head: true })
      .eq("status", "ACTIVE")

    const leads = await supabase
      .from("partner_leads")
      .select("id", { count: "exact", head: true })
      .gte("created_at", start)
      .lte("created_at", end)

    const won = await supabase
      .from("partner_leads")
      .select("id", { count: "exact", head: true })
      .eq("status", "WON")
      .gte("updated_at", start)
      .lte("updated_at", end)

    const sourced = await supabase
      .from("businesses")
      .select("id", { count: "exact", head: true })
      .not("originating_partner_id", "is", null)
      .gte("created_at", start)
      .lte("created_at", end)

    const { data: attrData, error: attrErr } = await supabase
      .from("payments")
      .select("amount, businesses!inner(originating_partner_id)")
      .eq("status", "CONFIRMED")
      .not("paid_at", "is", null)
      .gte("paid_at", start)
      .lte("paid_at", end)
      .not("businesses.originating_partner_id", "is", null)
    if (attrErr) console.error("attributed revenue error:", attrErr.message)
    const attrRows = (attrData as any[]) || []

    const { data: earnedData, error: earnedErr } = await supabase
      .from("partner_commissions")
      .select("commission_amount")
      .not("earned_at", "is", null)
      .gte("earned_at", start)
      .lte("earned_at", end)
      .in("status", ["PENDING", "ELIGIBLE", "APPROVED", "SCHEDULED", "PAID"])
    if (earnedErr) console.error("commission earned error:", earnedErr.message)

    const { data: paidData, error: paidErr } = await supabase
      .from("partner_commissions")
      .select("commission_amount")
      .eq("status", "PAID")
      .not("paid_at", "is", null)
      .gte("paid_at", start)
      .lte("paid_at", end)
    if (paidErr) console.error("partner commission paid error:", paidErr.message)

    return {
      applications: countResult(applications),
      active_partners: countResult(active),
      partner_leads: countResult(leads),
      won_opportunities: countResult(won),
      partner_sourced_businesses: countResult(sourced),
      attributed_revenue: sumAmounts(attrRows, "amount"),
      commission_earned: sumAmounts(earnedData, "commission_amount"),
      commission_paid: sumAmounts(paidData, "commission_amount"),
    }
  } catch (err: any) {
    console.error("partners report error:", err?.message)
    return empty
  }
}

export async function supportReport(period: ReportPeriod): Promise<SupportReport> {
  const empty: SupportReport = {
    tickets_opened: 0,
    tickets_resolved: 0,
    open_backlog: 0,
    sla_breaches: 0,
    escalations: 0,
    category_distribution: [],
    priority_distribution: [],
  }

  if (!isSupabaseConfigured()) return empty

  const { start, end } = getPeriodBounds(period)

  try {
    const opened = await supabase
      .from("support_tickets")
      .select("id", { count: "exact", head: true })
      .gte("created_at", start)
      .lte("created_at", end)

    const resolved = await supabase
      .from("support_tickets")
      .select("id", { count: "exact", head: true })
      .in("status", ["RESOLVED", "CLOSED"])
      .not("resolved_at", "is", null)
      .gte("resolved_at", start)
      .lte("resolved_at", end)

    const openBacklog = await supabase
      .from("support_tickets")
      .select("id", { count: "exact", head: true })
      .in("status", ["NEW", "ASSIGNED", "IN_PROGRESS", "WAITING_CUSTOMER", "WAITING_PARTNER", "ESCALATED"])

    const { data: periodTickets, error: periodErr } = await supabase
      .from("support_tickets")
      .select(
        "category, priority, created_at, resolved_at, resolution_due_at, first_responded_at, first_response_due_at"
      )
      .gte("created_at", start)
      .lte("created_at", end)
    if (periodErr) console.error("support period error:", periodErr.message)
    const tickets = (periodTickets as any[]) || []

    const { data: escalationData, error: escErr } = await supabase
      .from("support_ticket_events")
      .select("id", { count: "exact" })
      .eq("event_type", "ESCALATED")
      .gte("created_at", start)
      .lte("created_at", end)
    if (escErr) console.error("escalation error:", escErr.message)

    const categoryDist: Record<string, number> = {}
    const priorityDist: Record<string, number> = {}
    let breaches = 0

    for (const t of tickets) {
      categoryDist[t.category] = (categoryDist[t.category] || 0) + 1
      priorityDist[t.priority] = (priorityDist[t.priority] || 0) + 1

      const resolved = t.resolved_at ? new Date(t.resolved_at) : null
      const resolutionDue = t.resolution_due_at ? new Date(t.resolution_due_at) : null
      const firstResponded = t.first_responded_at ? new Date(t.first_responded_at) : null
      const firstResponseDue = t.first_response_due_at ? new Date(t.first_response_due_at) : null

      if (resolved && resolutionDue && resolved > resolutionDue) breaches += 1
      else if (firstResponded && firstResponseDue && firstResponded > firstResponseDue) breaches += 1
    }

    const { data: openTickets } = await supabase
      .from("support_tickets")
      .select("resolution_due_at")
      .in("status", ["NEW", "ASSIGNED", "IN_PROGRESS", "WAITING_CUSTOMER", "WAITING_PARTNER", "ESCALATED"])
    for (const t of (openTickets as any[]) || []) {
      const due = t.resolution_due_at ? new Date(t.resolution_due_at) : null
      if (due && new Date() > due) breaches += 1
    }

    return {
      tickets_opened: countResult(opened),
      tickets_resolved: countResult(resolved),
      open_backlog: countResult(openBacklog),
      sla_breaches: breaches,
      escalations: countResult(escalationData as any),
      category_distribution: Object.entries(categoryDist).map(([category, count]) => ({ category, count })),
      priority_distribution: Object.entries(priorityDist).map(([priority, count]) => ({ priority, count })),
    }
  } catch (err: any) {
    console.error("support report error:", err?.message)
    return empty
  }
}

export async function operationsReport(period: ReportPeriod): Promise<OperationsReport> {
  const empty: OperationsReport = {
    pending_deployments: 0,
    onboarding_awaiting_review: 0,
    compliance_outstanding: 0,
    open_incidents: 0,
    critical_incidents: 0,
  }

  if (!isSupabaseConfigured()) return empty

  const { start } = getPeriodBounds(period)
  const today = start.split("T")[0]

  try {
    const pendingDeployments = await supabase
      .from("business_deployments")
      .select("id", { count: "exact", head: true })
      .eq("status", "PENDING")

    const onboardingAwaiting = await supabase
      .from("admin_tasks")
      .select("id", { count: "exact", head: true })
      .eq("task_type", "CUSTOMER_ONBOARDING_REVIEW")
      .eq("status", "OPEN")

    const compliance = await supabase
      .from("compliance_records")
      .select("id", { count: "exact", head: true })
      .in("status", ["REQUESTED", "SUBMITTED", "UNDER_REVIEW", "REJECTED", "EXPIRED"])

    const openIncidents = await supabase
      .from("customer_incidents")
      .select("id", { count: "exact", head: true })
      .eq("status", "OPEN")

    const criticalIncidents = await supabase
      .from("customer_incidents")
      .select("id", { count: "exact", head: true })
      .eq("severity", "CRITICAL")
      .not("status", "eq", "CLOSED")

    return {
      pending_deployments: countResult(pendingDeployments),
      onboarding_awaiting_review: countResult(onboardingAwaiting),
      compliance_outstanding: countResult(compliance),
      open_incidents: countResult(openIncidents),
      critical_incidents: countResult(criticalIncidents),
    }
  } catch (err: any) {
    console.error("operations report error:", err?.message)
    return empty
  }
}
