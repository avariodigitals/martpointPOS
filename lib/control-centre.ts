import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { getIndustryByName, resolveIndustryName } from "./industries"
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

  const closedLeadStatuses = new Set(["won", "lost"])
  const openOpportunities = (
    (opportunities.data as { status: string }[] | null) || []
  ).filter((l) => !closedLeadStatuses.has(l.status?.toLowerCase() || "")).length

  const closedTicketStatuses = new Set(["resolved", "closed", "cancelled"])
  const openSupportTickets = (
    (supportTickets.data as { status: string }[] | null) || []
  ).filter(
    (t) => !closedTicketStatuses.has(t.status?.toLowerCase() || "")
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

  const [businesses, profiles] = await Promise.all([
    supabase.from("businesses").select("id, status"),
    supabase.from("customer_success_profiles").select("business_id, health"),
  ])

  if (businesses.error) {
    if ((businesses.error as { code?: string }).code !== "PGRST205") {
      console.warn("[getCustomerSnapshot]", businesses.error.message, businesses.error)
    }
    return zero
  }
  if (profiles.error && (profiles.error as { code?: string }).code !== "PGRST205") {
    console.warn("[getCustomerSnapshot]", profiles.error.message, profiles.error)
  }

  const businessRows = (businesses.data as { id: string; status: string }[] | null) || []
  const profileMap = new Map<string, string>()
  for (const p of (profiles.data as { business_id: string; health: string }[] | null) || []) {
    profileMap.set(p.business_id, p.health)
  }

  const health: CustomerSnapshot["health"] = {
    HEALTHY: 0,
    WATCH: 0,
    AT_RISK: 0,
    CRITICAL: 0,
  }
  let onboarding = 0
  let churned = 0

  for (const b of businessRows) {
    if (b.status === "ONBOARDING") onboarding++
    if (b.status === "CHURNED") churned++
    const h = profileMap.get(b.id) || "HEALTHY"
    if (h in health) {
      health[h as keyof CustomerSnapshot["health"]]++
    }
  }

  return { health, onboarding, churned }
}

/* ─────────────────────────────────────────────────────────────────────────────
   INDUSTRY FOOTPRINT
   Leads counted by industry, and deployed businesses counted by industry.
   ───────────────────────────────────────────────────────────────────────────── */

export interface IndustryCount {
  name: string
  count: number
  /** True when `name` is a canonical industry from the code registry
   *  (lib/industries.ts). "Unspecified", "Other" and leftover free text are
   *  false, and are excluded from `industriesDeployed`. */
  canonical: boolean
}

export interface IndustrySnapshot {
  /** Leads grouped by industry (industry column, falling back to business type). */
  leadsByIndustry: IndustryCount[]
  /** Deployed businesses grouped by industry. */
  deployedByIndustry: IndustryCount[]
  totalLeads: number
  /** Total deployed businesses across all industries. */
  totalDeployed: number
  /** Number of distinct *canonical* industries with at least one deployed business. */
  industriesDeployed: number
  /** Deployed businesses whose industry could not be resolved to a canonical
   *  industry (blank, "Other", or free text). Counted in `totalDeployed` but
   *  deliberately not in `industriesDeployed`. */
  unresolvedDeployed: number
}

export async function getIndustrySnapshot(): Promise<IndustrySnapshot> {
  const zero: IndustrySnapshot = {
    leadsByIndustry: [],
    deployedByIndustry: [],
    totalLeads: 0,
    totalDeployed: 0,
    industriesDeployed: 0,
    unresolvedDeployed: 0,
  }
  if (!isSupabaseConfigured()) return zero

  const [leadsRes, businessesRes, deploymentsRes] = await Promise.all([
    supabase.from("leads").select("industry, business_type"),
    supabase.from("businesses").select("id, industry, business_type, status"),
    supabase.from("business_deployments").select("business_id, status"),
  ])

  const isMissingTable = (error: { code?: string } | null) => error?.code === "PGRST205"

  const leadRows =
    (leadsRes.data as IndustryLeadRow[] | null) || []
  const businessRows =
    (businessesRes.data as IndustryBusinessRow[] | null) || []
  const deploymentRows =
    (deploymentsRes.data as IndustryDeploymentRow[] | null) || []

  if (leadsRes.error && !isMissingTable(leadsRes.error)) {
    console.warn("[getIndustrySnapshot] leads", leadsRes.error.message)
  }
  if (businessesRes.error && !isMissingTable(businessesRes.error)) {
    console.warn("[getIndustrySnapshot] businesses", businessesRes.error.message)
  }

  return summarizeIndustries(leadRows, businessRows, deploymentRows)
}

export interface IndustryLeadRow {
  industry: string | null
  business_type: string | null
}

export interface IndustryBusinessRow extends IndustryLeadRow {
  id: string
  status: string
}

export interface IndustryDeploymentRow {
  business_id: string
  status: string
}

/** Statuses that make a business count as deployed, on its own record… */
export const DEPLOYED_BUSINESS_STATUSES = ["ACTIVE", "GO_LIVE_APPROVED"]
/** …or via a deployment record. */
export const DEPLOYED_DEPLOYMENT_STATUSES = ["LIVE", "PROVISIONED"]

/**
 * Pure aggregation behind {@link getIndustrySnapshot}.
 *
 * Two rules matter for the dashboard:
 *  1. Values are resolved through `resolveIndustryName` at read time, so a
 *     legacy stored value ("Fashion Retailer") folds into the exact industry
 *     ("Fashion Stores") instead of becoming a phantom industry.
 *  2. Only *canonical* industries count toward `industriesDeployed`.
 *     "Unspecified", "Other" and leftover free text are reported separately in
 *     `unresolvedDeployed` so they can never inflate the headline number.
 */
export function summarizeIndustries(
  leadRows: IndustryLeadRow[],
  businessRows: IndustryBusinessRow[],
  deploymentRows: IndustryDeploymentRow[]
): IndustrySnapshot {
  const industryOf = (industry: string | null, businessType: string | null): string =>
    resolveIndustryName((industry || "").trim() || businessType || "") || "Unspecified"

  const isCanonical = (name: string): boolean => Boolean(getIndustryByName(name))

  // Canonical industries first, then by volume — unresolved buckets are shown
  // but sorted to the bottom so the real industries read at a glance.
  const toSorted = (counts: Map<string, number>): IndustryCount[] =>
    [...counts.entries()]
      .map(([name, count]) => ({ name, count, canonical: isCanonical(name) }))
      .sort(
        (a, b) =>
          Number(b.canonical) - Number(a.canonical) ||
          b.count - a.count ||
          a.name.localeCompare(b.name)
      )

  const leadCounts = new Map<string, number>()
  for (const l of leadRows) {
    const name = industryOf(l.industry, l.business_type)
    leadCounts.set(name, (leadCounts.get(name) || 0) + 1)
  }

  // A business counts as deployed when it is live/approved, or when it has a
  // provisioned/live deployment record. Counted once per business.
  const businessMap = new Map(businessRows.map((b) => [b.id, b]))
  const deployedIds = new Set<string>()
  for (const b of businessRows) {
    if (DEPLOYED_BUSINESS_STATUSES.includes(b.status)) deployedIds.add(b.id)
  }
  for (const d of deploymentRows) {
    if (DEPLOYED_DEPLOYMENT_STATUSES.includes(d.status)) deployedIds.add(d.business_id)
  }

  const deployedCounts = new Map<string, number>()
  let totalDeployed = 0
  for (const id of deployedIds) {
    // Skip ids with no business row (an orphan deployment record): counting one
    // would make the total disagree with the sum of the per-industry rows.
    const b = businessMap.get(id)
    if (!b) continue
    totalDeployed += 1
    const name = industryOf(b.industry, b.business_type)
    deployedCounts.set(name, (deployedCounts.get(name) || 0) + 1)
  }

  const deployedByIndustry = toSorted(deployedCounts)
  return {
    leadsByIndustry: toSorted(leadCounts),
    deployedByIndustry,
    totalLeads: leadRows.length,
    totalDeployed,
    industriesDeployed: deployedByIndustry.filter((r) => r.canonical).length,
    unresolvedDeployed: deployedByIndustry
      .filter((r) => !r.canonical)
      .reduce((sum, r) => sum + r.count, 0),
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
