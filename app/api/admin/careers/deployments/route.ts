import { NextResponse } from "next/server"
import crypto from "crypto"
import { authorizeAdmin } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { recordAudit, auditContextFromSession, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit"
import { generateDeploymentReference } from "@/lib/careers"

export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  const { denied } = await authorizeAdmin("careers.deployments.view")
  if (denied) return denied
  if (!isSupabaseConfigured()) return NextResponse.json({ deployments: [] })

  const { searchParams } = new URL(request.url)
  let query = supabase
    .from("career_deployments")
    .select("*, career_vacancies(title), career_candidate_profiles!career_deployments_team_lead_candidate_id_fkey(full_name)")
    .order("created_at", { ascending: false })
  if (searchParams.get("status")) query = query.eq("status", searchParams.get("status"))
  if (searchParams.get("state")) query = query.eq("state", searchParams.get("state"))

  const { data, error } = await query
  if (error) return NextResponse.json({ error: "Failed to load deployments" }, { status: 500 })
  return NextResponse.json({ deployments: (data || []).map(decorate) })
}

function decorate(d: Record<string, unknown>) {
  return {
    ...d,
    vacancy_title: (d.career_vacancies as { title?: string } | null)?.title,
    team_lead_name: (d.career_candidate_profiles as { full_name?: string } | null)?.full_name,
    career_vacancies: undefined,
    career_candidate_profiles: undefined,
  }
}

export async function POST(request: Request) {
  const { session, denied } = await authorizeAdmin("careers.deployments.manage")
  if (denied) return denied
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Database not configured" }, { status: 503 })

  const body = await request.json().catch(() => ({}))
  const name = String(body.name || "").trim()
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 })

  const num = (v: unknown) => (v === null || v === undefined || v === "" ? null : Number(v))
  const id = crypto.randomUUID()
  const { error } = await supabase.from("career_deployments").insert({
    id,
    reference_number: generateDeploymentReference(),
    name,
    project_client: body.project_client || null,
    vacancy_id: body.vacancy_id || null,
    state: body.state || null,
    lga: body.lga || null,
    city: body.city || null,
    site_address: body.site_address || null,
    start_date: body.start_date || null,
    end_date: body.end_date || null,
    team_lead_candidate_id: body.team_lead_candidate_id || null,
    daily_rate_kobo: num(body.daily_rate_kobo),
    transport_allowance_kobo: num(body.transport_allowance_kobo),
    feeding_arrangement: body.feeding_arrangement || null,
    expected_daily_target: num(body.expected_daily_target),
    notes: body.notes || null,
    created_by: session.userId,
  })
  if (error) {
    console.error("[careers] deployment insert failed:", error.message)
    return NextResponse.json({ error: "Failed to create deployment" }, { status: 500 })
  }

  await recordAudit(auditContextFromSession(session, request), {
    action: AUDIT_ACTIONS.CAREER_DEPLOYMENT_CREATED,
    entityType: AUDIT_ENTITIES.CAREER_DEPLOYMENT,
    entityId: id,
    metadata: { name },
  })

  return NextResponse.json({ success: true, id })
}
