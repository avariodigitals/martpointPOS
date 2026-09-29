import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { recordAudit, auditContextFromSession, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit"
import { APPLICATION_STATUSES, type ApplicationStatus } from "@/lib/careers"
import { changeApplicationStatus } from "@/lib/careers"
import { sendCareerNotification, templateForStatusChange } from "@/lib/careers-notifications"

export const dynamic = "force-dynamic"

/** Hiring managers are scoped to applications for vacancies they own. */
async function hiringManagerVacancyIds(userId: string): Promise<string[]> {
  const { data } = await supabase.from("career_vacancies").select("id").eq("hiring_manager_id", userId)
  return (data || []).map((v) => v.id)
}

export async function GET(request: Request) {
  const { session, denied } = await authorizeAdmin("careers.applications.view")
  if (denied) return denied
  if (!isSupabaseConfigured()) return NextResponse.json({ applications: [] })

  const { searchParams } = new URL(request.url)
  const status = searchParams.get("status")
  const vacancyId = searchParams.get("vacancyId")
  const state = searchParams.get("state")
  const q = searchParams.get("q")

  let query = supabase
    .from("career_applications")
    .select("id, reference_number, vacancy_id, full_name, email, phone, state, city, status, review_score, screening_score, screening_passed, assigned_reviewer_id, submitted_at, consent_talent_pool, career_vacancies(title, slug)")
    .order("submitted_at", { ascending: false })
    .limit(500)

  if (status) query = query.eq("status", status)
  if (vacancyId) query = query.eq("vacancy_id", vacancyId)
  if (state) query = query.eq("state", state)
  if (q) query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%,reference_number.ilike.%${q}%`)

  if (session.role === "Hiring Manager") {
    const ids = await hiringManagerVacancyIds(session.userId)
    if (ids.length === 0) return NextResponse.json({ applications: [] })
    query = query.in("vacancy_id", ids)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: "Failed to load applications" }, { status: 500 })

  const applications = (data || []).map((r) => {
    const row = r as Record<string, unknown>
    const vac = row.career_vacancies as { title?: string; slug?: string } | null
    return { ...row, vacancy_title: vac?.title, vacancy_slug: vac?.slug, career_vacancies: undefined }
  })
  return NextResponse.json({ applications })
}

/* PATCH: bulk status change {ids: string[], status, reason?, notify?} */
export async function PATCH(request: Request) {
  const { session, denied } = await authorizeAdmin("careers.applications.review")
  if (denied) return denied
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Database not configured" }, { status: 503 })

  const body = await request.json().catch(() => ({}))
  const ids = Array.isArray(body.ids) ? body.ids.filter((x: unknown) => typeof x === "string") : []
  const status = body.status as ApplicationStatus
  if (ids.length === 0 || !APPLICATION_STATUSES.includes(status)) {
    return NextResponse.json({ error: "ids[] and a valid status are required" }, { status: 400 })
  }

  const results: { id: string; ok: boolean }[] = []
  for (const id of ids.slice(0, 200)) {
    const ok = await changeApplicationStatus(id, status, { id: session.userId, name: session.name }, body.reason)
    results.push({ id, ok })

    if (ok && body.notify === true) {
      const tpl = templateForStatusChange(status)
      if (tpl) {
        const { data: app } = await supabase
          .from("career_applications")
          .select("email, full_name, reference_number, career_vacancies(title)")
          .eq("id", id)
          .single()
        if (app) {
          const vac = app.career_vacancies as { title?: string } | null
          void sendCareerNotification({
            template: tpl,
            to: app.email,
            applicationId: id,
            vars: {
              fullName: app.full_name,
              reference: app.reference_number,
              vacancyTitle: vac?.title || "",
              statusUrl: `${process.env.NEXT_PUBLIC_SITE_URL || ""}/careers/application-status`,
              assessmentName: body.assessmentName || "",
              assessmentDetails: body.assessmentDetails || "",
              nextSteps: body.nextSteps || "",
            },
          })
        }
      }
    }
  }

  await recordAudit(auditContextFromSession(session, request), {
    action: AUDIT_ACTIONS.CAREER_APPLICATION_STATUS_CHANGED,
    entityType: AUDIT_ENTITIES.CAREER_APPLICATION,
    entityId: null,
    metadata: { ids: ids.slice(0, 200), status, bulk: true },
  })

  return NextResponse.json({ success: true, results })
}
