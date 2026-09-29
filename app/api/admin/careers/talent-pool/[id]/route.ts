import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { recordAudit, auditContextFromSession, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit"
import { CANDIDATE_STATUSES, VERIFICATION_STATUSES } from "@/lib/careers"

export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

/* GET: full candidate profile — skills, applications, deployments, performance. */
export async function GET(_request: Request, ctx: Ctx) {
  const { denied } = await authorizeAdmin("careers.talent_pool.view")
  if (denied) return denied
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Database not configured" }, { status: 503 })
  const { id } = await ctx.params

  const [profile, skills, availability, apps, workerRows, perf] = await Promise.all([
    supabase.from("career_candidate_profiles").select("*").eq("id", id).is("deleted_at", null).maybeSingle(),
    supabase.from("career_candidate_skills").select("skill").eq("candidate_id", id),
    supabase.from("career_candidate_availability").select("*").eq("candidate_id", id),
    supabase
      .from("career_applications")
      .select("id, reference_number, status, submitted_at, career_vacancies(title)")
      .eq("candidate_profile_id", id)
      .order("submitted_at", { ascending: false }),
    supabase
      .from("career_deployment_workers")
      .select("id, role, status, created_at, career_deployments(id, name, status, city, state, start_date, end_date)")
      .eq("candidate_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("career_deployment_performance")
      .select("work_date, products_captured, verified_products, errors, supervisor_rating, career_deployments(name)")
      .eq("candidate_id", id)
      .order("work_date", { ascending: false }),
  ])

  if (!profile.data) return NextResponse.json({ error: "Not found" }, { status: 404 })

  return NextResponse.json({
    candidate: {
      ...profile.data,
      skills: (skills.data || []).map((s) => s.skill),
      availability: availability.data || [],
      applications: apps.data || [],
      deployments: (workerRows.data || []).map((w) => {
        const d = w.career_deployments as unknown as Record<string, unknown> | null
        return { ...w, deployment: d }
      }),
      performance: (perf.data || []).map((p) => ({
        ...p,
        deployment_name: (p.career_deployments as { name?: string } | null)?.name,
        career_deployments: undefined,
      })),
    },
  })
}

/* PATCH: update profile fields (verification, status, ratings, roles, etc.) */
export async function PATCH(request: Request, ctx: Ctx) {
  const { session, denied } = await authorizeAdmin("careers.talent_pool.manage")
  if (denied) return denied
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Database not configured" }, { status: 503 })
  const { id } = await ctx.params

  const body = await request.json().catch(() => ({}))
  const allowed = [
    "full_name", "phone", "whatsapp", "state", "lga", "city", "residential_area",
    "qualified_roles", "employment_preferences", "availability_notes", "earliest_available_date",
    "other_work_cities", "highest_qualification", "field_of_study", "years_experience",
    "equipment", "performance_rating", "accuracy_rating", "team_lead_eligible",
    "supervisor_comments", "last_contacted_at",
  ] as const
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const key of allowed) {
    if (body[key] !== undefined) patch[key] = body[key]
  }
  if (body.verification_status !== undefined) {
    if (!VERIFICATION_STATUSES.includes(body.verification_status)) {
      return NextResponse.json({ error: "Invalid verification status" }, { status: 400 })
    }
    patch.verification_status = body.verification_status
  }
  if (body.status !== undefined) {
    if (!CANDIDATE_STATUSES.includes(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 })
    }
    patch.status = body.status
  }
  if (body.consent_talent_pool !== undefined) {
    patch.consent_talent_pool = body.consent_talent_pool === true
    if (patch.consent_talent_pool) patch.consent_at = new Date().toISOString()
  }

  const { error } = await supabase.from("career_candidate_profiles").update(patch).eq("id", id)
  if (error) return NextResponse.json({ error: "Failed to update" }, { status: 500 })

  await recordAudit(auditContextFromSession(session, request), {
    action: AUDIT_ACTIONS.CAREER_CANDIDATE_UPDATED,
    entityType: AUDIT_ENTITIES.CAREER_CANDIDATE,
    entityId: id,
    metadata: { fields: Object.keys(patch).filter((k) => k !== "updated_at") },
  })

  return NextResponse.json({ success: true })
}
