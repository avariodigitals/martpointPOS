import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { commissionTotals } from "@/lib/careers-commissions"

export const dynamic = "force-dynamic"

/* GET: conversion-first workforce performance dashboard.
 * Requires careers.performance.view. Metrics emphasise conversion, collected
 * revenue, activation, usage and retention — never raw activity alone.
 * Metrics without a data source are returned as null rather than invented. */
export async function GET() {
  const { denied } = await authorizeAdmin("careers.performance.view")
  if (denied) return denied
  if (!isSupabaseConfigured()) return NextResponse.json({ metrics: {} })

  const [leads, meetings, income, businesses, csProfiles, tickets, handovers, commissions] = await Promise.all([
    supabase.from("leads").select("id, status, submitted_at, updated_at"),
    supabase.from("lead_meetings").select("id, lead_id, status, scheduled_at"),
    supabase.from("finance_transactions").select("id, amount, category, lead_id, date").eq("type", "income"),
    supabase.from("businesses").select("id, status, source_lead_id, created_at"),
    supabase.from("customer_success_profiles").select("business_id, stage"),
    supabase.from("support_tickets").select("id, created_at, first_responded_at"),
    supabase.from("career_pipeline_handovers").select("id, lead_id, business_id, pipeline_stage, handed_at, acceptance_status"),
    commissionTotals(),
  ])

  const allLeads = leads.data || []
  const allMeetings = meetings.data || []
  const allIncome = income.data || []
  const allBiz = businesses.data || []
  const allProfiles = csProfiles.data || []
  const allTickets = tickets.data || []
  const allHandovers = handovers.data || []

  const leadsReceived = allLeads.length
  const contacted = allLeads.filter((l) => l.status !== "New" && l.status !== "Lost").length
  const qualified = allLeads.filter((l) => ["Qualified", "Proposal", "Won"].includes(l.status)).length
  const proposalsIssued = allLeads.filter((l) => ["Proposal", "Won"].includes(l.status)).length
  const won = allLeads.filter((l) => l.status === "Won").length

  // First-response time: earliest handover touching each lead vs submitted_at.
  const leadSubmitted = new Map(allLeads.map((l) => [l.id, new Date(l.submitted_at).getTime()]))
  const firstTouch = new Map<string, number>()
  for (const h of allHandovers) {
    if (!h.lead_id) continue
    const t = new Date(h.handed_at).getTime()
    if (!firstTouch.has(h.lead_id) || t < firstTouch.get(h.lead_id)!) firstTouch.set(h.lead_id, t)
  }
  let frSum = 0, frCount = 0
  for (const [leadId, t] of firstTouch) {
    const sub = leadSubmitted.get(leadId)
    if (sub && t >= sub) { frSum += (t - sub) / 60000; frCount++ }
  }

  const demosBooked = allMeetings.length
  const demosCompleted = allMeetings.filter((m) => m.status === "COMPLETED").length
  const demoNoShows = allMeetings.filter((m) => m.status === "NO_SHOW").length
  const demoAttendanceRate = demosCompleted + demoNoShows > 0
    ? Math.round((demosCompleted / (demosCompleted + demoNoShows)) * 1000) / 10
    : null

  const paymentsReceived = allIncome.length
  const revenueCollectedKobo = allIncome.reduce((s, t) => s + (t.amount || 0), 0)

  const completedDemoLeads = new Set(allMeetings.filter((m) => m.status === "COMPLETED").map((m) => m.lead_id))
  const wonSet = new Set(allLeads.filter((l) => l.status === "Won").map((l) => l.id))
  const demoToPayment = completedDemoLeads.size > 0
    ? Math.round(([...completedDemoLeads].filter((id) => wonSet.has(id)).length / completedDemoLeads.size) * 1000) / 10
    : null

  // Average sales cycle: submitted → last update for Won leads (approximation).
  let cycleSum = 0, cycleCount = 0
  for (const l of allLeads) {
    if (l.status !== "Won") continue
    const d = (new Date(l.updated_at).getTime() - new Date(l.submitted_at).getTime()) / 86400000
    if (d >= 0) { cycleSum += d; cycleCount++ }
  }

  const activated = allProfiles.filter((p) => ["LIVE", "ADOPTION", "RENEWAL"].includes(p.stage)).length
  const customersActivated = activated || allBiz.filter((b) => b.status === "ACTIVE").length
  const renewalsDue = allProfiles.filter((p) => p.stage === "RENEWAL").length
  const churned = allProfiles.filter((p) => p.stage === "CHURNED").length + allBiz.filter((b) => b.status === "CHURNED").length

  // Support response time: created → first response.
  let srSum = 0, srCount = 0
  for (const t of allTickets) {
    if (!t.first_responded_at) continue
    const mins = (new Date(t.first_responded_at).getTime() - new Date(t.created_at).getTime()) / 60000
    if (mins >= 0) { srSum += mins; srCount++ }
  }

  const metrics = {
    leadsReceived,
    firstResponseMinutes: frCount ? Math.round((frSum / frCount) * 10) / 10 : null,
    contactRate: leadsReceived ? Math.round((contacted / leadsReceived) * 1000) / 10 : null,
    qualifiedLeads: qualified,
    demosBooked,
    demosCompleted,
    demoAttendanceRate,
    proposalsIssued,
    paymentsReceived,
    leadToPaymentConversion: leadsReceived ? Math.round((won / leadsReceived) * 1000) / 10 : null,
    demoToPaymentConversion: demoToPayment,
    revenueCollectedKobo,
    avgSalesCycleDays: cycleCount ? Math.round((cycleSum / cycleCount) * 10) / 10 : null,
    customersActivated,
    timeToActivationDays: null,
    activeUsage14Days: null,
    activeUsage30Days: null,
    supportResponseMinutes: srCount ? Math.round((srSum / srCount) * 10) / 10 : null,
    customerSatisfaction: null,
    renewalsDue,
    renewalRate: null,
    churnedCustomers: churned,
    commissionEarnedKobo: commissions.earned,
    commissionApprovedKobo: commissions.approved,
    commissionPaidKobo: commissions.paid,
    pendingHandovers: allHandovers.filter((h) => h.acceptance_status === "PENDING").length,
  }

  return NextResponse.json({ metrics })
}
