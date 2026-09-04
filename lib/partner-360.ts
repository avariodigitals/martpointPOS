import { supabase, isSupabaseConfigured } from "./supabase"
import { getPartnerById, listPartnerCapabilities, listPartnerUsers } from "./partner-service"
import type { PartnerType } from "./partners"
import {
  PARTNER_TYPE_DEFAULT_CAPABILITIES,
  partnerCapabilityFlags,
  type PartnerOrgCapability,
} from "./partner-permissions"

export {
  partnerCapabilityFlags,
  relevantPartnerTabs,
  PARTNER_360_TABS,
  type Partner360Tab,
  type PartnerCapabilityFlags,
} from "./partner-permissions"

/* ───────────────────────────  Partner 360 / performance data helpers  ───────────────────────────
 * Aggregates partner performance signals across leads, customer assignments,
 * commissions, onboarding, support and compliance. No single universal score
 * is produced — each dimension is reported separately and only surfaced where
 * it is relevant to the partner's type / granted capabilities.
 */

export type PerformancePeriod = "ALL" | "30D" | "90D" | "12M"

export interface PartnerPerformanceFilters {
  partnerType?: string
  status?: string
  country?: string
  state?: string
  period?: PerformancePeriod
}

export type ComplianceSummaryStatus = "COMPLIANT" | "PENDING" | "ATTENTION" | "NOT_REQUIRED"

export interface PartnerPerformanceRow {
  partnerId: string
  partnerCode: string
  businessName: string
  displayName: string
  partnerType: PartnerType
  status: string
  country: string
  state: string
  city: string
  location: string
  capabilities: PartnerOrgCapability[]
  // relevance flags — UIs should only show dimension columns when true
  hasLeadCapability: boolean
  hasCustomerCapability: boolean
  hasImplementationCapability: boolean
  hasSupportCapability: boolean
  hasCommercialCapability: boolean
  // metrics
  leadsRegistered: number
  protectedLeads: number
  wonBusinesses: number
  assignedCustomers: number
  attributedRevenue: number
  currency: string
  commissionEarned: number
  commissionPaid: number
  complianceStatus: ComplianceSummaryStatus
  onboardingCompleted: number
  onboardingTotal: number
  supportTicketsHandled: number
  escalations: number
}

export interface Partner360Bundle {
  partner: Record<string, unknown> | null
  capabilities: PartnerOrgCapability[]
  defaultCapabilities: PartnerOrgCapability[]
  users: Record<string, unknown>[]
  leads: Record<string, unknown>[]
  customers: Record<string, unknown>[]
  onboardingTasks: Record<string, unknown>[]
  supportTickets: Record<string, unknown>[]
  escalations: Record<string, unknown>[]
  complianceRecords: Record<string, unknown>[]
  documents: Record<string, unknown>[]
  commissions: Record<string, unknown>[]
  activity: Record<string, unknown>[]
  performance: PartnerPerformanceRow | null
}

export function periodToSince(period?: PerformancePeriod | string): string | null {
  const now = Date.now()
  switch (period) {
    case "30D":
      return new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString()
    case "90D":
      return new Date(now - 90 * 24 * 60 * 60 * 1000).toISOString()
    case "12M":
      return new Date(now - 365 * 24 * 60 * 60 * 1000).toISOString()
    default:
      return null
  }
}

export function deriveComplianceStatus(records: { status?: string | null }[]): ComplianceSummaryStatus {
  const relevant = records.filter((r) => r.status && r.status !== "NOT_REQUIRED")
  if (relevant.length === 0) return "NOT_REQUIRED"
  if (relevant.some((r) => r.status === "REJECTED" || r.status === "EXPIRED")) return "ATTENTION"
  if (relevant.some((r) => r.status === "REQUESTED" || r.status === "SUBMITTED" || r.status === "UNDER_REVIEW")) return "PENDING"
  return "COMPLIANT"
}

export function capabilityFlags(capabilities: PartnerOrgCapability[]) {
  return partnerCapabilityFlags(capabilities)
}

/* ───────────────────────────  Performance table  ─────────────────────────── */

export async function getPartnerPerformanceRows(
  filters: PartnerPerformanceFilters = {}
): Promise<PartnerPerformanceRow[]> {
  if (!isSupabaseConfigured()) return []

  const since = periodToSince(filters.period)

  let partnerQuery = supabase.from("partners").select("*").order("created_at", { ascending: false })
  if (filters.partnerType) partnerQuery = partnerQuery.eq("partner_type", filters.partnerType)
  if (filters.status) partnerQuery = partnerQuery.eq("status", filters.status)
  if (filters.country) partnerQuery = partnerQuery.eq("country", filters.country)
  if (filters.state) partnerQuery = partnerQuery.eq("state", filters.state)

  const { data: partners, error } = await partnerQuery
  if (error || !partners) return []
  const partnerRows = partners as Record<string, unknown>[]
  if (partnerRows.length === 0) return []

  const ids = partnerRows.map((p) => p.id as string)
  const nowIso = new Date().toISOString()

  const applySince = <T extends { gte: (col: string, val: string) => T }>(q: T, col = "created_at"): T =>
    since ? q.gte(col, since) : q

  const [capsRes, leadsRes, assignRes, commRes, compRes, tasksRes, ticketsRes] = await Promise.all([
    supabase
      .from("partner_capabilities")
      .select("partner_id, capability, expires_at")
      .in("partner_id", ids)
      .eq("enabled", true),
    applySince(supabase.from("partner_leads").select("partner_id, status, protection_status, created_at").in("partner_id", ids)),
    supabase
      .from("partner_customer_assignments")
      .select("partner_id, business_id")
      .in("partner_id", ids)
      .eq("status", "ACTIVE"),
    applySince(
      supabase
        .from("partner_commissions")
        .select("partner_id, commission_amount, currency, status, created_at")
        .in("partner_id", ids)
    ),
    supabase
      .from("compliance_records")
      .select("partner_id, status")
      .eq("subject_type", "PARTNER")
      .in("partner_id", ids),
    applySince(
      supabase.from("partner_onboarding_tasks").select("partner_id, status, created_at").in("partner_id", ids)
    ),
    applySince(
      supabase
        .from("support_tickets")
        .select("assigned_partner_id, status, created_at")
        .in("assigned_partner_id", ids)
    ),
  ])

  const capabilityMap = new Map<string, PartnerOrgCapability[]>()
  for (const c of (capsRes.data || []) as Record<string, unknown>[]) {
    const exp = c.expires_at as string | null
    if (exp && exp <= nowIso) continue
    const list = capabilityMap.get(c.partner_id as string) || []
    list.push(c.capability as PartnerOrgCapability)
    capabilityMap.set(c.partner_id as string, list)
  }

  const leads = (leadsRes.data || []) as Record<string, unknown>[]
  const assignments = (assignRes.data || []) as Record<string, unknown>[]
  const commissions = (commRes.data || []) as Record<string, unknown>[]
  const compliance = (compRes.data || []) as Record<string, unknown>[]
  const tasks = (tasksRes.data || []) as Record<string, unknown>[]
  const tickets = (ticketsRes.data || []) as Record<string, unknown>[]

  // Attributed revenue: confirmed payments on businesses currently assigned to the partner.
  const businessIds = Array.from(new Set(assignments.map((a) => a.business_id as string)))
  const paymentsByBusiness = new Map<string, { amount: number; currency: string }>()
  if (businessIds.length > 0) {
    let payQuery = supabase
      .from("payments")
      .select("business_id, amount, currency, created_at")
      .in("business_id", businessIds)
      .eq("status", "CONFIRMED")
    if (since) payQuery = payQuery.gte("created_at", since)
    const { data: payments } = await payQuery
    for (const p of (payments || []) as Record<string, unknown>[]) {
      const cur = paymentsByBusiness.get(p.business_id as string) || { amount: 0, currency: (p.currency as string) || "NGN" }
      cur.amount += Number(p.amount) || 0
      cur.currency = (p.currency as string) || cur.currency
      paymentsByBusiness.set(p.business_id as string, cur)
    }
  }

  return partnerRows.map((p) => {
    const id = p.id as string
    const caps = capabilityMap.get(id) || []
    const flags = capabilityFlags(caps)

    const pLeads = leads.filter((l) => l.partner_id === id)
    const pAssign = assignments.filter((a) => a.partner_id === id)
    const pComm = commissions.filter((c) => c.partner_id === id)
    const pComp = compliance.filter((c) => c.partner_id === id)
    const pTasks = tasks.filter((t) => t.partner_id === id)
    const pTickets = tickets.filter((t) => t.assigned_partner_id === id)

    let attributedRevenue = 0
    let currency = "NGN"
    for (const a of pAssign) {
      const pay = paymentsByBusiness.get(a.business_id as string)
      if (pay) {
        attributedRevenue += pay.amount
        currency = pay.currency
      }
    }

    const location = [p.city, p.state, p.country].filter(Boolean).join(", ")

    return {
      partnerId: id,
      partnerCode: (p.partner_id as string) || "",
      businessName: (p.business_name as string) || "",
      displayName: (p.display_name as string) || "",
      partnerType: p.partner_type as PartnerType,
      status: (p.status as string) || "",
      country: (p.country as string) || "",
      state: (p.state as string) || "",
      city: (p.city as string) || "",
      location,
      capabilities: caps,
      ...flags,
      leadsRegistered: pLeads.length,
      protectedLeads: pLeads.filter((l) => l.protection_status === "PROTECTED").length,
      wonBusinesses: pLeads.filter((l) => l.status === "WON").length,
      assignedCustomers: pAssign.length,
      attributedRevenue,
      currency,
      commissionEarned: pComm
        .filter((c) => c.status !== "REVERSED" && c.status !== "CANCELLED")
        .reduce((s, c) => s + (Number(c.commission_amount) || 0), 0),
      commissionPaid: pComm
        .filter((c) => c.status === "PAID")
        .reduce((s, c) => s + (Number(c.commission_amount) || 0), 0),
      complianceStatus: deriveComplianceStatus(pComp),
      onboardingCompleted: pTasks.filter((t) => t.status === "COMPLETED" || t.status === "VERIFIED").length,
      onboardingTotal: pTasks.length,
      supportTicketsHandled: pTickets.filter((t) => t.status !== "CANCELLED").length,
      escalations: pTickets.filter((t) => t.status === "ESCALATED").length,
    }
  })
}

/* ───────────────────────────  Partner 360 bundle  ─────────────────────────── */

export async function getPartner360(partnerId: string): Promise<Partner360Bundle> {
  const empty: Partner360Bundle = {
    partner: null,
    capabilities: [],
    defaultCapabilities: [],
    users: [],
    leads: [],
    customers: [],
    onboardingTasks: [],
    supportTickets: [],
    escalations: [],
    complianceRecords: [],
    documents: [],
    commissions: [],
    activity: [],
    performance: null,
  }
  if (!isSupabaseConfigured()) return empty

  const partner = await getPartnerById(partnerId)
  if (!partner) return empty

  const [capabilities, users] = await Promise.all([
    listPartnerCapabilities(partnerId),
    listPartnerUsers(partnerId),
  ])

  const partnerType = partner.partnerType as PartnerType
  const defaultCapabilities = PARTNER_TYPE_DEFAULT_CAPABILITIES[partnerType] || []

  const [leadsRes, customersRes, tasksRes, ticketsRes, compRes, docsRes, commRes] = await Promise.all([
    supabase
      .from("partner_leads")
      .select("*")
      .eq("partner_id", partnerId)
      .order("created_at", { ascending: false }),
    supabase
      .from("partner_customer_assignments")
      .select("*, businesses(id, business_name, status, country, state, city)")
      .eq("partner_id", partnerId)
      .order("assigned_at", { ascending: false }),
    supabase
      .from("partner_onboarding_tasks")
      .select("*, businesses(business_name)")
      .eq("partner_id", partnerId)
      .order("created_at", { ascending: false }),
    supabase
      .from("support_tickets")
      .select("*, businesses(business_name)")
      .or(`assigned_partner_id.eq.${partnerId},partner_id.eq.${partnerId},complained_about_partner_id.eq.${partnerId}`)
      .order("created_at", { ascending: false }),
    supabase
      .from("compliance_records")
      .select("*")
      .eq("subject_type", "PARTNER")
      .eq("partner_id", partnerId)
      .order("created_at", { ascending: false }),
    supabase
      .from("partner_documents")
      .select("*")
      .eq("partner_id", partnerId)
      .order("uploaded_at", { ascending: false }),
    supabase
      .from("partner_commissions")
      .select("*, businesses(business_name)")
      .eq("partner_id", partnerId)
      .order("created_at", { ascending: false }),
  ])

  const supportTickets = (ticketsRes.data || []) as Record<string, unknown>[]
  const escalations = supportTickets.filter((t) => t.status === "ESCALATED")

  // Activity: audit events where the entity is the partner (uuid or code) or metadata references it
  const activityOr = `entity_id.eq.${partnerId},entity_id.eq.${partner.partnerId},metadata->>partnerId.eq.${partnerId},metadata->>partner_id.eq.${partnerId}`
  const { data: activity } = await supabase
    .from("audit_logs")
    .select("*")
    .or(activityOr)
    .order("created_at", { ascending: false })
    .limit(100)

  const perfRows = await getPartnerPerformanceRows({})
  const performance = perfRows.find((r) => r.partnerId === partnerId) || null

  return {
    partner: partner as unknown as Record<string, unknown>,
    capabilities,
    defaultCapabilities,
    users: users as unknown as Record<string, unknown>[],
    leads: (leadsRes.data || []) as Record<string, unknown>[],
    customers: (customersRes.data || []) as Record<string, unknown>[],
    onboardingTasks: (tasksRes.data || []) as Record<string, unknown>[],
    supportTickets,
    escalations,
    complianceRecords: (compRes.data || []) as Record<string, unknown>[],
    documents: (docsRes.data || []) as Record<string, unknown>[],
    commissions: (commRes.data || []) as Record<string, unknown>[],
    activity: (activity || []) as Record<string, unknown>[],
    performance,
  }
}

/* ───────────────────────────  Tab relevance  ───────────────────────────
 * Tab-relevance helpers live in lib/partner-permissions.ts (pure, client-safe)
 * and are re-exported above.
 */
