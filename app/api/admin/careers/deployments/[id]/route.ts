import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { recordAudit, auditContextFromSession, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit"
import { sendCareerNotification } from "@/lib/careers-notifications"
import { DEPLOYMENT_STATUSES } from "@/lib/careers"

export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_request: Request, ctx: Ctx) {
  const { denied } = await authorizeAdmin("careers.deployments.view")
  if (denied) return denied
  const { id } = await ctx.params

  const { data: dep } = await supabase
    .from("career_deployments")
    .select("*, career_vacancies(title, slug), career_candidate_profiles!career_deployments_team_lead_candidate_id_fkey(id, full_name, reference_number)")
    .eq("id", id)
    .maybeSingle()
  if (!dep) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const [workers, attendance, performance] = await Promise.all([
    supabase
      .from("career_deployment_workers")
      .select("*, career_candidate_profiles(id, full_name, reference_number, phone, email, verification_status, city)")
      .eq("deployment_id", id)
      .order("created_at"),
    supabase
      .from("career_deployment_attendance")
      .select("*")
      .eq("deployment_id", id)
      .order("work_date", { ascending: false }),
    supabase
      .from("career_deployment_performance")
      .select("*, career_candidate_profiles(full_name)")
      .eq("deployment_id", id)
      .order("work_date", { ascending: false }),
  ])

  return NextResponse.json({
    deployment: {
      ...dep,
      vacancy_title: (dep.career_vacancies as { title?: string } | null)?.title,
      team_lead: dep.career_candidate_profiles,
      career_vacancies: undefined,
      career_candidate_profiles: undefined,
    },
    workers: (workers.data || []).map((w) => ({
      ...w,
      candidate: w.career_candidate_profiles,
      career_candidate_profiles: undefined,
    })),
    attendance: attendance.data || [],
    performance: (performance.data || []).map((p) => ({
      ...p,
      candidate_name: (p.career_candidate_profiles as { full_name?: string } | null)?.full_name,
      career_candidate_profiles: undefined,
    })),
  })
}

export async function PATCH(request: Request, ctx: Ctx) {
  const { session, denied } = await authorizeAdmin("careers.deployments.manage")
  if (denied) return denied
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Database not configured" }, { status: 503 })
  const { id } = await ctx.params
  const body = await request.json().catch(() => ({}))

  const allowed = [
    "name", "project_client", "vacancy_id", "state", "lga", "city", "site_address",
    "start_date", "end_date", "team_lead_candidate_id", "daily_rate_kobo",
    "transport_allowance_kobo", "feeding_arrangement", "expected_daily_target", "notes",
  ] as const
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const k of allowed) {
    if (body[k] !== undefined) patch[k] = body[k]
  }
  if (body.status !== undefined) {
    if (!DEPLOYMENT_STATUSES.includes(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 })
    }
    patch.status = body.status
  }

  const { error } = await supabase.from("career_deployments").update(patch).eq("id", id)
  if (error) return NextResponse.json({ error: "Failed to update" }, { status: 500 })

  await recordAudit(auditContextFromSession(session, request), {
    action: AUDIT_ACTIONS.CAREER_DEPLOYMENT_UPDATED,
    entityType: AUDIT_ENTITIES.CAREER_DEPLOYMENT,
    entityId: id,
    metadata: { fields: Object.keys(patch).filter((k) => k !== "updated_at") },
  })
  return NextResponse.json({ success: true })
}

/* POST {action: "invite_workers" | "remind_workers"} — notification helpers. */
export async function POST(request: Request, ctx: Ctx) {
  const { denied } = await authorizeAdmin("careers.deployments.manage")
  if (denied) return denied
  const { id } = await ctx.params
  const body = await request.json().catch(() => ({}))

  const { data: dep } = await supabase.from("career_deployments").select("*").eq("id", id).single()
  if (!dep) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const { data: workers } = await supabase
    .from("career_deployment_workers")
    .select("candidate_id, career_candidate_profiles(full_name, email)")
    .eq("deployment_id", id)
    .neq("status", "REMOVED")

  const location = [dep.city, dep.state].filter(Boolean).join(", ")
  const dates = [dep.start_date, dep.end_date].filter(Boolean).join(" – ")
  const template = body.action === "remind_workers" ? "career_deployment_reminder" : "career_deployment_invite"
  const details = [dep.daily_rate_kobo ? `Daily rate: ₦${(dep.daily_rate_kobo / 100).toLocaleString()}` : "", dep.site_address ? `Site: ${dep.site_address}` : "", dep.notes || ""].filter(Boolean).join("\n")

  let sent = 0
  for (const w of workers || []) {
    const c = w.career_candidate_profiles as { full_name?: string; email?: string } | null
    if (!c?.email) continue
    const ok = await sendCareerNotification({
      template,
      to: c.email,
      candidateId: w.candidate_id,
      vars: { fullName: c.full_name || "", deploymentName: dep.name, location, dates, details },
    })
    if (ok) sent++
    if (body.action !== "remind_workers") {
      await supabase.from("career_deployment_workers").update({ status: "INVITED" }).eq("deployment_id", id).eq("candidate_id", w.candidate_id).eq("status", "ASSIGNED")
    }
  }
  return NextResponse.json({ success: true, sent })
}
