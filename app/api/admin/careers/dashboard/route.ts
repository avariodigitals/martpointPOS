import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"

export const dynamic = "force-dynamic"

/* GET: careers dashboard metrics + breakdowns + recent activity. */
export async function GET() {
  const { denied } = await authorizeAdmin("careers.dashboard.view")
  if (denied) return denied
  if (!isSupabaseConfigured()) return NextResponse.json({ stats: {}, byVacancy: [], byState: [], recent: [] })

  const [vacancies, applications, candidates, deployments, deploymentsWorkers] = await Promise.all([
    supabase.from("career_vacancies").select("id, title, status, application_closes_at").is("deleted_at", null),
    supabase.from("career_applications").select("id, vacancy_id, status, state, submitted_at, career_vacancies(title)"),
    supabase.from("career_candidate_profiles").select("id, status, verification_status, state").is("deleted_at", null),
    supabase.from("career_deployments").select("id, status"),
    supabase.from("career_deployment_workers").select("id, status, career_deployments(status)"),
  ])

  const vacs = vacancies.data || []
  const apps = applications.data || []
  const cands = candidates.data || []
  const deps = deployments.data || []
  const workers = deploymentsWorkers.data || []

  const soon = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  const now = new Date()

  const stats = {
    draftVacancies: vacs.filter((v) => v.status === "DRAFT").length,
    publishedVacancies: vacs.filter((v) => v.status === "PUBLISHED").length,
    closingSoon: vacs.filter(
      (v) => v.status === "PUBLISHED" && v.application_closes_at && new Date(v.application_closes_at) > now && new Date(v.application_closes_at) <= soon
    ).length,
    totalApplications: apps.length,
    newApplications: apps.filter((a) => a.status === "NEW").length,
    shortlisted: apps.filter((a) => a.status === "SHORTLISTED").length,
    assessmentPending: apps.filter((a) => a.status === "ASSESSMENT_INVITED").length,
    verified: apps.filter((a) => a.status === "VERIFIED" || a.status === "SELECTED").length,
    availableWorkers: cands.filter((c) => c.status === "ACTIVE" && c.verification_status === "VERIFIED").length,
    deployedWorkers: workers.filter((w) => {
      const d = w.career_deployments as { status?: string } | null
      return (w.status === "ACTIVE" || w.status === "CONFIRMED" || w.status === "ASSIGNED") && d?.status === "ACTIVE"
    }).length,
    activeDeployments: deps.filter((d) => d.status === "ACTIVE").length,
    talentPool: cands.length,
  }

  // Applications by vacancy
  const byVacancyMap = new Map<string, { title: string; count: number }>()
  for (const a of apps) {
    const vac = a.career_vacancies as { title?: string } | null
    const key = a.vacancy_id
    const cur = byVacancyMap.get(key) || { title: vac?.title || "Unknown", count: 0 }
    cur.count += 1
    byVacancyMap.set(key, cur)
  }
  const byVacancy = [...byVacancyMap.entries()]
    .map(([vacancyId, v]) => ({ vacancyId, ...v }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  // Applications by location (applicant state)
  const byStateMap = new Map<string, number>()
  for (const a of apps) {
    const s = a.state || "Unknown"
    byStateMap.set(s, (byStateMap.get(s) || 0) + 1)
  }
  const byState = [...byStateMap.entries()]
    .map(([state, count]) => ({ state, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  // Recent recruitment activity (shared audit log, careers entities)
  const { data: recent } = await supabase
    .from("audit_logs")
    .select("id, action, actor_name, entity_type, entity_id, metadata, created_at")
    .like("entity_type", "career_%")
    .order("created_at", { ascending: false })
    .limit(20)

  return NextResponse.json({ stats, byVacancy, byState, recent: recent || [] })
}
