import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"

export const dynamic = "force-dynamic"

/* GET: aggregated recruitment + deployment reports.
 * Requires careers.dashboard.view (same data as dashboard + funnels). */
export async function GET() {
  const { denied } = await authorizeAdmin("careers.dashboard.view")
  if (denied) return denied
  if (!isSupabaseConfigured()) return NextResponse.json({})

  const [apps, vacs, cands, perf, attendance, history] = await Promise.all([
    supabase.from("career_applications").select("id, vacancy_id, status, state, source, submitted_at, screening_passed, career_vacancies(title)"),
    supabase.from("career_vacancies").select("id, title").is("deleted_at", null),
    supabase.from("career_candidate_profiles").select("id, state, verification_status, status").is("deleted_at", null),
    supabase.from("career_deployment_performance").select("candidate_id, products_captured, verified_products, errors, supervisor_rating, career_deployments(name)"),
    supabase.from("career_deployment_attendance").select("candidate_id, status, work_date, career_deployments(name)"),
    supabase.from("career_application_status_history").select("application_id, previous_status, new_status, created_at"),
  ])

  const allApps = apps.data || []
  const allCands = cands.data || []
  const allPerf = perf.data || []
  const allAtt = attendance.data || []
  const allHist = history.data || []
  const vacTitles = new Map((vacs.data || []).map((v) => [v.id, v.title]))

  // Funnel
  const funnelOrder = ["NEW", "SCREENING_PASSED", "UNDER_REVIEW", "SHORTLISTED", "ASSESSMENT_INVITED", "ASSESSMENT_COMPLETED", "VERIFIED", "SELECTED", "DEPLOYED", "COMPLETED"]
  const funnel = funnelOrder.map((s) => ({ status: s, count: allApps.filter((a) => a.status === s).length }))

  // By vacancy / location / source
  const group = <T,>(rows: T[], key: (r: T) => string) => {
    const m = new Map<string, number>()
    for (const r of rows) m.set(key(r), (m.get(key(r)) || 0) + 1)
    return [...m.entries()].map(([k, count]) => ({ name: k, count })).sort((a, b) => b.count - a.count)
  }
  const byVacancy = group(allApps, (a) => vacTitles.get(a.vacancy_id) || "Unknown")
  const byLocation = group(allApps, (a) => a.state || "Unknown")
  const bySource = group(allApps, (a) => a.source || "careers_page")

  // Screening pass rate
  const screened = allApps.filter((a) => a.screening_passed !== null)
  const screeningPassRate = screened.length
    ? Math.round((screened.filter((a) => a.screening_passed).length / screened.length) * 100)
    : null

  // Time to shortlist (days from submit → first SHORTLISTED history entry)
  const firstShortlist = new Map<string, number>()
  for (const h of allHist) {
    if (h.new_status === "SHORTLISTED") {
      const t = new Date(h.created_at).getTime()
      if (!firstShortlist.has(h.application_id) || t < firstShortlist.get(h.application_id)!) {
        firstShortlist.set(h.application_id, t)
      }
    }
  }
  const submitted = new Map(allApps.map((a) => [a.id, new Date(a.submitted_at).getTime()]))
  let ttsSum = 0, ttsCount = 0
  for (const [appId, t] of firstShortlist) {
    const sub = submitted.get(appId)
    if (sub) { ttsSum += (t - sub) / 86400000; ttsCount++ }
  }
  const avgDaysToShortlist = ttsCount ? Math.round((ttsSum / ttsCount) * 10) / 10 : null

  // Verified workers by city/state
  const verifiedWorkers = group(
    allCands.filter((c) => c.verification_status === "VERIFIED" && c.status === "ACTIVE"),
    (c) => [c.state].filter(Boolean).join(", ") || "Unknown"
  )

  // Attendance rollup
  const attMap = new Map<string, number>()
  for (const a of allAtt) attMap.set(a.status, (attMap.get(a.status) || 0) + 1)
  const attendanceSummary = [...attMap.entries()].map(([status, count]) => ({ status, count }))

  // Worker output / errors / ratings
  const perWorker = new Map<string, { captured: number; verified: number; errors: number; ratings: number[] }>()
  for (const p of allPerf) {
    const cur = perWorker.get(p.candidate_id) || { captured: 0, verified: 0, errors: 0, ratings: [] }
    cur.captured += p.products_captured || 0
    cur.verified += p.verified_products || 0
    cur.errors += p.errors || 0
    if (p.supervisor_rating != null) cur.ratings.push(Number(p.supervisor_rating))
    perWorker.set(p.candidate_id, cur)
  }
  const workerPerformance = [...perWorker.entries()].map(([candidateId, w]) => ({
    candidateId,
    productsCaptured: w.captured,
    verifiedProducts: w.verified,
    errors: w.errors,
    errorRate: w.captured > 0 ? Math.round((w.errors / w.captured) * 1000) / 10 : 0,
    avgRating: w.ratings.length ? Math.round((w.ratings.reduce((a, b) => a + b, 0) / w.ratings.length) * 10) / 10 : null,
  }))

  return NextResponse.json({
    funnel,
    byVacancy,
    byLocation,
    bySource,
    screeningPassRate,
    avgDaysToShortlist,
    verifiedWorkers,
    attendanceSummary,
    workerPerformance,
  })
}
