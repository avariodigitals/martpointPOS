import { NextResponse } from "next/server"
import crypto from "crypto"
import { authorizeAdmin } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { recordAudit, auditContextFromSession, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit"
import { generateVacancyReference, slugify } from "@/lib/careers"

export const dynamic = "force-dynamic"

/* POST: duplicate a vacancy (as a new DRAFT), copying locations & questions. */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { session, denied } = await authorizeAdmin("careers.vacancies.create")
  if (denied) return denied
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Database not configured" }, { status: 503 })
  const { id } = await ctx.params

  const { data: src } = await supabase.from("career_vacancies").select("*").eq("id", id).single()
  if (!src) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const newId = crypto.randomUUID()
  let slug = slugify(`${src.slug}-copy`)
  const { data: clash } = await supabase.from("career_vacancies").select("id").eq("slug", slug).maybeSingle()
  if (clash) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`

  const { id: _i, created_at: _c, updated_at: _u, published_at: _p, closed_at: _cl, archived_at: _a, ...rest } = src
  const { error } = await supabase.from("career_vacancies").insert({
    ...rest,
    id: newId,
    title: `${src.title} (Copy)`,
    slug,
    reference_number: generateVacancyReference(),
    status: "DRAFT",
    featured: false,
    scheduled_publish_at: null,
    deleted_at: null,
    created_by: session.userId,
    updated_by: session.userId,
  })
  if (error) {
    console.error("[careers] duplicate failed:", error.message)
    return NextResponse.json({ error: "Failed to duplicate vacancy" }, { status: 500 })
  }

  const { data: locs } = await supabase.from("career_vacancy_locations").select("*").eq("vacancy_id", id)
  if (locs?.length) {
    await supabase.from("career_vacancy_locations").insert(
      locs.map(({ id: _li, created_at: _lc, ...l }) => ({ ...l, vacancy_id: newId }))
    )
  }

  const { data: questions } = await supabase.from("career_screening_questions").select("*").eq("vacancy_id", id).order("sort_order")
  if (questions?.length) {
    for (const { id: qid, created_at: _qc, updated_at: _qu, ...q } of questions) {
      const { data: newQ } = await supabase
        .from("career_screening_questions")
        .insert({ ...q, vacancy_id: newId })
        .select("id")
        .single()
      if (newQ) {
        const { data: opts } = await supabase.from("career_question_options").select("*").eq("question_id", qid)
        if (opts?.length) {
          await supabase.from("career_question_options").insert(
            opts.map(({ id: _oi, created_at: _oc, ...o }) => ({ ...o, question_id: newQ.id }))
          )
        }
      }
    }
  }

  await recordAudit(auditContextFromSession(session, request), {
    action: AUDIT_ACTIONS.CAREER_VACANCY_DUPLICATED,
    entityType: AUDIT_ENTITIES.CAREER_VACANCY,
    entityId: newId,
    metadata: { sourceVacancyId: id, sourceTitle: src.title },
  })

  return NextResponse.json({ success: true, id: newId, slug })
}
