import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { recordAudit, auditContextFromSession, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit"
import { getVacancy, slugify } from "@/lib/careers"
import { buildVacancyRow, replaceVacancyLocations, type VacancyInput } from "../route"

export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

async function canAccessVacancy(session: { userId: string; role: string }, vacancyId: string): Promise<boolean> {
  if (session.role !== "Hiring Manager") return true
  const { data } = await supabase.from("career_vacancies").select("hiring_manager_id").eq("id", vacancyId).single()
  return data?.hiring_manager_id === session.userId
}

export async function GET(_request: Request, ctx: Ctx) {
  const { session, denied } = await authorizeAdmin("careers.vacancies.view")
  if (denied) return denied
  const { id } = await ctx.params
  if (!(await canAccessVacancy(session, id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  const vacancy = await getVacancy(id)
  if (!vacancy) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json({ vacancy })
}

export async function PATCH(request: Request, ctx: Ctx) {
  const { session, denied } = await authorizeAdmin("careers.vacancies.edit")
  if (denied) return denied
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Database not configured" }, { status: 503 })
  const { id } = await ctx.params
  if (!(await canAccessVacancy(session, id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const input = (await request.json().catch(() => ({}))) as VacancyInput
  const { row, error } = buildVacancyRow(input)
  if (error || !row) return NextResponse.json({ error: error || "Invalid input" }, { status: 400 })

  if (input.slug) {
    const slug = slugify(input.slug)
    const { data: clash } = await supabase
      .from("career_vacancies").select("id").eq("slug", slug).neq("id", id).maybeSingle()
    if (clash) return NextResponse.json({ error: "Slug is already in use" }, { status: 409 })
    row.slug = slug
  }

  const { error: upErr } = await supabase
    .from("career_vacancies")
    .update({ ...row, updated_by: session.userId })
    .eq("id", id)
  if (upErr) {
    console.error("[careers] vacancy update failed:", upErr.message)
    return NextResponse.json({ error: "Failed to update vacancy" }, { status: 500 })
  }

  if (Array.isArray(input.locations)) {
    await replaceVacancyLocations(id, input.locations)
  }

  await recordAudit(auditContextFromSession(session, request), {
    action: AUDIT_ACTIONS.CAREER_VACANCY_UPDATED,
    entityType: AUDIT_ENTITIES.CAREER_VACANCY,
    entityId: id,
    metadata: { title: row.title },
  })

  return NextResponse.json({ success: true })
}

/* DELETE → soft-delete/archive */
export async function DELETE(request: Request, ctx: Ctx) {
  const { session, denied } = await authorizeAdmin("careers.vacancies.close")
  if (denied) return denied
  const { id } = await ctx.params
  const { error } = await supabase
    .from("career_vacancies")
    .update({ status: "ARCHIVED", archived_at: new Date().toISOString(), deleted_at: new Date().toISOString(), updated_by: session.userId })
    .eq("id", id)
  if (error) return NextResponse.json({ error: "Failed to archive" }, { status: 500 })

  await recordAudit(auditContextFromSession(session, request), {
    action: AUDIT_ACTIONS.CAREER_VACANCY_STATUS_CHANGED,
    entityType: AUDIT_ENTITIES.CAREER_VACANCY,
    entityId: id,
    metadata: { newStatus: "ARCHIVED" },
  })
  return NextResponse.json({ success: true })
}
