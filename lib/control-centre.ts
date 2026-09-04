import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import type { AdminTask } from "./tasks"

export type ControlCentrePeriod = "today" | "7d" | "30d" | "this_month" | "quarter" | "year"

export const CONTROL_CENTRE_PERIODS: ControlCentrePeriod[] = [
  "today",
  "7d",
  "30d",
  "this_month",
  "quarter",
  "year",
]

const VALID_PERIODS = new Set<string>(CONTROL_CENTRE_PERIODS)

export function parseControlPeriod(
  raw: string | string[] | undefined
): ControlCentrePeriod {
  const value = Array.isArray(raw) ? raw[0] : raw
  return value && VALID_PERIODS.has(value) ? (value as ControlCentrePeriod) : "30d"
}

type Range = { start: string; end: string }

function getRange(period: ControlCentrePeriod): Range {
  const now = new Date()
  const start = new Date(now)

  switch (period) {
    case "today":
      start.setHours(0, 0, 0, 0)
      break
    case "7d":
      start.setTime(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      break
    case "30d":
      start.setTime(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      break
    case "this_month":
      start.setDate(1)
      start.setHours(0, 0, 0, 0)
      break
    case "quarter": {
      const qStartMonth = Math.floor(now.getMonth() / 3) * 3
      start.setMonth(qStartMonth, 1)
      start.setHours(0, 0, 0, 0)
      break
    }
    case "year":
      start.setMonth(0, 1)
      start.setHours(0, 0, 0, 0)
      break
  }

  return { start: start.toISOString(), end: now.toISOString() }
}

function inRange(date: string | undefined | null, range: Range): boolean {
  if (!date) return false
  return date >= range.start && date <= range.end
}

function sumBy(
  rows: Array<Record<string, unknown>> | null | undefined,
  key: string
): number {
  return (rows || []).reduce((acc, row) => {
    const v = Number(row[key])
    return acc + (Number.isFinite(v) ? v : 0)
  }, 0)
}

/* ─────────────────────────────────────────────────────────────────────────────
   CURRENT STATE
   ───────────────────────────────────────────────────────────────────────────── */

export type CurrentState = {
  activeBusinesses: number
  businessesOnboarding: number
  activePartners: number
  openOpportunities: number
  openSupportTickets: number
  atRiskCustomers: number
  outstandingReceivables: number
  renewalsDue: number
}

async function getCurrentState(): Promise<CurrentState> {
  if (!isSupabaseConfigured()) {
    return {
      activeBusinesses: 0,
      businessesOnboarding: 0,
      activePartners: 0,
      openOpportunities: 0,
      openSupportTickets: 0,
      atRiskCustomers: 0,
      outstandingReceivables: 0,
      renewalsDue: 0,
    }
  }

  const in30 = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0]

  const [
    activeBusinesses,
    businessesOnboarding,
    activePartners,
    opportunities,
    supportTickets,
    atRisk,
    invoices,
    renewals,
  ] = await Promise.all([
    supabase
      .from("businesses")
      .select("id", { count: "exact", head: true })
      .eq("status", "ACTIVE"),
    supabase
      .from("businesses")
      .select("id", { count: "exact", head: true })
      .eq("status", "ONBOARDING"),
    supabase
      .from("partners")
      .select("id", { count: "exact", head: true })
      .eq("status", "ACTIVE"),
    supabase.from("leads").select("status"),
    supabase.from("support_tickets").select("status"),
    supabase
      .from("customer_success_profiles")
      .select("id", { count: "exact", head: true })
      .in("health", ["CRITICAL", "AT_RISK"]),
    supabase
      .from("invoices")
      .select("balance_due, status")
      .in("status", ["ISSUED", "PARTIALLY_PAID", "OVERDUE"]),
    supabase
      .from("subscription_renewals")
      .select("id", { count: "exact", head: true })
      .lte("renewal_due_date", in30)
      .in("status", ["UPCOMING", "DUE", "OVERDUE"]),
  ])

  const openOpportunities = (
    (opportunities.data as { status: string }[] | null) || []
  ).filter((l) => l.status !== "Won" && l.status !== "Lost").length

  const openSupportTickets = (
    (supportTickets.data as { status: string }[] | null) || []
  ).filter(
    (t) => !["RESOLVED", "CLOSED", "CANCELLED"].includes(t.status)
  ).length

  const outstanding = (
    (invoices.data as { balance_due: number }[] | null) || []
  ).reduce((s, i) => s + (Number(i.balance_due) || 0), 0)

  return {
    activeBusinesses: activeBusinesses.count ?? 0,
    businessesOnboarding: businessesOnboarding.count ?? 0,
    activePartners: activePartners.count ?? 0,
    openOpportunities,
    openSupportTickets,
    atRiskCustomers: atRisk.count ?? 0,
    outstandingReceivables: outstanding,
    renewalsDue: renewals.count ?? 0,
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   PERIOD SUMMARY
   ───────────────────────────────────────────────────────────────────────────── */

export type PeriodMetrics = {
  revenueCollected: number
  newCustomers: number
  churned: number
  ticketsResolved: number
  partnerApplications: number
  partnerLeads: number
  partnerWon: number
  attributedRevenue: number
  commission: number
}

async function getPeriodMetrics(
  period: ControlCentrePeriod
): Promise<PeriodMetrics> {
  const zero = {
    revenueCollected: 0,
    newCustomers: 0,
    churned: 0,
    ticketsResolved: 0,
    partnerApplications: 0,
    partnerLeads: 0,
    partnerWon: 0,
    attributedRevenue: 0,
    commission: 0,
  }

  if (!isSupabaseConfigured()) return zero

  const range = getRange(period)

  const [
    payments,
    businesses,
    churnedBusinesses,
    resolvedTickets,
    partnerApplications,
    partnerLeads,
    wonLeads,
    commissions,
  ] = await Promise.all([
    supabase
      .from("payments")
      .select("amount")
      .eq("status", "CONFIRMED")
      .gte("paid_at", range.start)
      .lte("paid_at", range.end),
    supabase
      .from("businesses")
      .select("id", { count: "exact", head: true })
      .gte("created_at", range.start)
      .lte("created_at", range.end),
    supabase
      .from("businesses")
      .select("id", { count: "exact", head: true })
      .eq("status", "CHURNED")
      .gte("updated_at", range.start)
      .lte("updated_at", range.end),
    supabase
      .from("support_tickets")
      .select("resolved_at, status")
      .eq("status", "RESOLVED")
      .gte("resolved_at", range.start)
      .lte("resolved_at", range.end),
    supabase
      .from("partner_applications")
      .select("id", { count: "exact", head: true })
      .gte("created_at", range.start)
      .lte("created_at", range.end),
    supabase
      .from("partner_leads")
      .select("id", { count: "exact", head: true })
      .gte("created_at", range.start)
      .lte("created_at", range.end),
    supabase
      .from("partner_leads")
      .select("estimated_deal_value, status, updated_at")
      .eq("status", "WON"),
    supabase
      .from("partner_commissions")
      .select("commission_amount, earned_at, created_at, status")
      .not("status", "in", '("CANCELLED")'),
  ])

  const wonInPeriod = (
    (wonLeads.data as { estimated_deal_value: number; updated_at: string }[] | null) || []
  ).filter((l) => inRange(l.updated_at, range))

  const commissionInPeriod = (
    (commissions.data as {
      commission_amount: number
      earned_at: string | null
      created_at: string
    }[] | null) || []
  ).filter((c) => inRange(c.earned_at || c.created_at, range))

  return {
    revenueCollected: sumBy(payments.data, "amount"),
    newCustomers: businesses.count ?? 0,
    churned: churnedBusinesses.count ?? 0,
    ticketsResolved: resolvedTickets.data?.length ?? 0,
    partnerApplications: partnerApplications.count ?? 0,
    partnerLeads: partnerLeads.count ?? 0,
    partnerWon: wonInPeriod.length,
    attributedRevenue: wonInPeriod.reduce(
      (s, l) => s + (Number(l.estimated_deal_value) || 0),
      0
    ),
    commission: commissionInPeriod.reduce(
      (s, c) => s + (Number(c.commission_amount) || 0),
      0
    ),
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   CONTROL CENTRE METRICS
   ───────────────────────────────────────────────────────────────────────────── */

export type ControlCentreMetrics = {
  selectedPeriod: ControlCentrePeriod
  current: CurrentState
  period: PeriodMetrics
}

export async function getControlCentreMetrics(
  period: string
): Promise<ControlCentreMetrics> {
  const p = parseControlPeriod(period)
  const [current, periodMetrics] = await Promise.all([
    getCurrentState(),
    getPeriodMetrics(p),
  ])
  return { selectedPeriod: p, current, period: periodMetrics }
}

/* ─────────────────────────────────────────────────────────────────────────────
   REQUIRES ATTENTION
   ───────────────────────────────────────────────────────────────────────────── */

export type { AdminTask as RequiresAttentionItem }

export async function getRequiresAttention(): Promise<AdminTask[]> {
  if (!isSupabaseConfigured()) return []

  const { data, error } = await supabase
    .from("admin_tasks")
    .select("*")
    .in("status", ["OPEN", "IN_PROGRESS"])
    .order("due_at", { ascending: true })

  if (error) {
    if ((error as { code?: string }).code !== "PGRST205") {
      console.warn("[getRequiresAttention]", error.message, error)
    }
    return []
  }

  return (data as AdminTask[] | null) || []
}

/* ─────────────────────────────────────────────────────────────────────────────
   FINANCIAL SNAPSHOT
   ───────────────────────────────────────────────────────────────────────────── */

export type FinancialSnapshot = {
  revenueCollected: number
  outstanding: number
  renewals: number
  commission: number
}

export async function getFinancialSnapshot(
  period: string
): Promise<FinancialSnapshot> {
  const zero = { revenueCollected: 0, outstanding: 0, renewals: 0, commission: 0 }
  if (!isSupabaseConfigured()) return zero

  const p = parseControlPeriod(period)
  const range = getRange(p)

  const [payments, invoices, renewals, commissions] = await Promise.all([
    supabase
      .from("payments")
      .select("amount")
      .eq("status", "CONFIRMED")
      .gte("paid_at", range.start)
      .lte("paid_at", range.end),
    supabase
      .from("invoices")
      .select("balance_due, status")
      .not("status", "in", '("PAID","CANCELLED","VOID","DRAFT")')
      .gte("created_at", range.start)
      .lte("created_at", range.end),
    supabase
      .from("subscription_renewals")
      .select("id", { count: "exact", head: true })
      .gte("renewal_due_date", range.start.split("T")[0])
      .lte("renewal_due_date", range.end.split("T")[0])
      .not("status", "in", '("RENEWED","NOT_RENEWING")'),
    supabase
      .from("partner_commissions")
      .select("commission_amount, earned_at, created_at, status")
      .not("status", "in", '("CANCELLED")'),
  ])

  const commissionInPeriod = (
    (commissions.data as {
      commission_amount: number
      earned_at: string | null
      created_at: string
    }[] | null) || []
  ).filter((c) => inRange(c.earned_at || c.created_at, range))

  return {
    revenueCollected: sumBy(payments.data, "amount"),
    outstanding: sumBy(
      (invoices.data as { balance_due: number }[] | null) || [],
      "balance_due"
    ),
    renewals: renewals.count ?? 0,
    commission: commissionInPeriod.reduce(
      (s, c) => s + (Number(c.commission_amount) || 0),
      0
    ),
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   PARTNER SNAPSHOT
   ───────────────────────────────────────────────────────────────────────────── */

export type PartnerSnapshot = {
  activePartners: number
  applications: number
  leads: number
  won: number
  attributedRevenue: number
  commission: number
}

export async function getPartnerSnapshot(
  period: string
): Promise<PartnerSnapshot> {
  const zero = {
    activePartners: 0,
    applications: 0,
    leads: 0,
    won: 0,
    attributedRevenue: 0,
    commission: 0,
  }
  if (!isSupabaseConfigured()) return zero

  const p = parseControlPeriod(period)
  const range = getRange(p)

  const [active, applications, leads, won, commissions] = await Promise.all([
    supabase
      .from("partners")
      .select("id", { count: "exact", head: true })
      .eq("status", "ACTIVE"),
    supabase
      .from("partner_applications")
      .select("id", { count: "exact", head: true })
      .gte("created_at", range.start)
      .lte("created_at", range.end),
    supabase
      .from("partner_leads")
      .select("id", { count: "exact", head: true })
      .gte("created_at", range.start)
      .lte("created_at", range.end),
    supabase
      .from("partner_leads")
      .select("estimated_deal_value, status, updated_at")
      .eq("status", "WON"),
    supabase
      .from("partner_commissions")
      .select("commission_amount, earned_at, created_at, status")
      .not("status", "in", '("CANCELLED")'),
  ])

  const wonInPeriod = (
    (won.data as { estimated_deal_value: number; updated_at: string }[] | null) || []
  ).filter((l) => inRange(l.updated_at, range))

  const commissionInPeriod = (
    (commissions.data as {
      commission_amount: number
      earned_at: string | null
      created_at: string
    }[] | null) || []
  ).filter((c) => inRange(c.earned_at || c.created_at, range))

  return {
    activePartners: active.count ?? 0,
    applications: applications.count ?? 0,
    leads: leads.count ?? 0,
    won: wonInPeriod.length,
    attributedRevenue: wonInPeriod.reduce(
      (s, l) => s + (Number(l.estimated_deal_value) || 0),
      0
    ),
    commission: commissionInPeriod.reduce(
      (s, c) => s + (Number(c.commission_amount) || 0),
      0
    ),
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   CUSTOMER SNAPSHOT
   ───────────────────────────────────────────────────────────────────────────── */

export type CustomerSnapshot = {
  health: Record<"HEALTHY" | "WATCH" | "AT_RISK" | "CRITICAL", number>
  onboarding: number
  churned: number
}

export async function getCustomerSnapshot(): Promise<CustomerSnapshot> {
  const zero = {
    health: { HEALTHY: 0, WATCH: 0, AT_RISK: 0, CRITICAL: 0 },
    onboarding: 0,
    churned: 0,
  }
  if (!isSupabaseConfigured()) return zero

  const { data, error } = await supabase
    .from("customer_success_profiles")
    .select("health, stage")

  if (error) {
    if ((error as { code?: string }).code !== "PGRST205") {
      console.warn("[getCustomerSnapshot]", error.message, error)
    }
    return zero
  }

  const rows = (data as { health: string; stage: string }[] | null) || []

  const health: CustomerSnapshot["health"] = {
    HEALTHY: 0,
    WATCH: 0,
    AT_RISK: 0,
    CRITICAL: 0,
  }

  for (const row of rows) {
    if (row.health in health) {
      health[row.health as keyof CustomerSnapshot["health"]]++
    }
  }

  return {
    health,
    onboarding: rows.filter((r) => r.stage === "ONBOARDING").length,
    churned: rows.filter((r) => r.stage === "CHURNED").length,
  }
}

/* ─────────────────────────────────────────────────────────────────────────────
   SUPPORT SNAPSHOT
   ───────────────────────────────────────────────────────────────────────────── */

export type SupportSnapshot = {
  open: number
  urgent: number
  escalated: number
  slaBreached: number
  resolved: number
}

export async function getSupportSnapshot(
  period: string
): Promise<SupportSnapshot> {
  const zero = { open: 0, urgent: 0, escalated: 0, slaBreached: 0, resolved: 0 }
  if (!isSupabaseConfigured()) return zero

  const p = parseControlPeriod(period)
  const range = getRange(p)

  const { data, error } = await supabase.from("support_tickets").select(
    "status, priority, created_at, resolved_at, first_response_due_at, resolution_due_at, first_responded_at"
  )

  if (error) {
    if ((error as { code?: string }).code !== "PGRST205") {
      console.warn("[getSupportSnapshot]", error.message, error)
    }
    return zero
  }

  const rows =
    (data as {
      status: string
      priority: string
      created_at: string
      resolved_at: string | null
      first_response_due_at: string | null
      resolution_due_at: string | null
      first_responded_at: string | null
    }[] | null) || []

  const now = new Date().toISOString()

  const open = rows.filter(
    (r) => !["RESOLVED", "CLOSED", "CANCELLED"].includes(r.status)
  )

  return {
    open: open.length,
    urgent: rows.filter(
      (r) => r.priority === "URGENT" && inRange(r.created_at, range)
    ).length,
    escalated: rows.filter(
      (r) => r.status === "ESCALATED" && inRange(r.created_at, range)
    ).length,
    slaBreached: open.filter(
      (r) =>
        (r.resolution_due_at && r.resolution_due_at < now) ||
        (r.first_response_due_at &&
          r.first_response_due_at < now &&
          !r.first_responded_at)
    ).length,
    resolved: rows.filter(
      (r) => r.status === "RESOLVED" && inRange(r.resolved_at, range)
    ).length,
  }
}
