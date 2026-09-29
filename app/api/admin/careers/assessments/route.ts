import { NextResponse } from "next/server"
import crypto from "crypto"
import { authorizeAdmin } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { recordAudit, auditContextFromSession, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit"

export const dynamic = "force-dynamic"

const ASSESSMENT_TYPES = ["WRITTEN", "PRACTICAL", "PRODUCT_CAPTURE", "INTERVIEW", "OTHER"]

export async function GET(request: Request) {
  const { denied } = await authorizeAdmin("careers.assessments.manage")
  if (denied) return denied
  if (!isSupabaseConfigured()) return NextResponse.json({ assessments: [] })

  const { searchParams } = new URL(request.url)
  let query = supabase
    .from("career_assessments")
    .select("*, career_vacancies(title, slug)")
    .order("created_at", { ascending: false })
  if (searchParams.get("vacancyId")) query = query.eq("vacancy_id", searchParams.get("vacancyId"))
  const { data, error } = await query
  if (error) return NextResponse.json({ error: "Failed to load assessments" }, { status: 500 })

  const rows = (data || []).map((a) => ({
    ...a,
    vacancy_title: (a.career_vacancies as { title?: string } | null)?.title,
    career_vacancies: undefined,
  }))
  return NextResponse.json({ assessments: rows })
}

export async function POST(request: Request) {
  const { session, denied } = await authorizeAdmin("careers.assessments.manage")
  if (denied) return denied
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Database not configured" }, { status: 503 })

  const body = await request.json().catch(() => ({}))
  const name = String(body.name || "").trim()
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 })
  if (body.assessment_type && !ASSESSMENT_TYPES.includes(body.assessment_type)) {
    return NextResponse.json({ error: "Invalid assessment type" }, { status: 400 })
  }

  const id = crypto.randomUUID()
  const { error } = await supabase.from("career_assessments").insert({
    id,
    name,
    vacancy_id: body.vacancy_id || null,
    assessment_type: body.assessment_type || "PRACTICAL",
    instructions: body.instructions || null,
    max_score: body.max_score != null ? Number(body.max_score) : 100,
    pass_score: body.pass_score != null ? Number(body.pass_score) : null,
    scheduled_at: body.scheduled_at || null,
    duration_minutes: body.duration_minutes != null ? Number(body.duration_minutes) : null,
    meeting_link: body.meeting_link || null,
    meeting_location: body.meeting_location || null,
    created_by: session.userId,
  })
  if (error) return NextResponse.json({ error: "Failed to create assessment" }, { status: 500 })

  await recordAudit(auditContextFromSession(session, request), {
    action: AUDIT_ACTIONS.CAREER_ASSESSMENT_CREATED,
    entityType: AUDIT_ENTITIES.CAREER_ASSESSMENT,
    entityId: id,
    metadata: { name },
  })

  return NextResponse.json({ success: true, id })
}
