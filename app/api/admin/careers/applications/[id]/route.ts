import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { recordAudit, auditContextFromSession, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit"
import { changeApplicationStatus, APPLICATION_STATUSES, type ApplicationStatus } from "@/lib/careers"
import { sendCareerNotification, templateForStatusChange } from "@/lib/careers-notifications"

export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_request: Request, ctx: Ctx) {
  const { session, denied } = await authorizeAdmin("careers.applications.view")
  if (denied) return denied
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Database not configured" }, { status: 503 })
  const { id } = await ctx.params

  const { data: app } = await supabase
    .from("career_applications")
    .select("*, career_vacancies(id, title, slug, reference_number)")
    .eq("id", id)
    .maybeSingle()
  if (!app) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (session.role === "Hiring Manager") {
    const vac = app.career_vacancies as { id?: string } | null
    const { data: v } = await supabase.from("career_vacancies").select("hiring_manager_id").eq("id", vac?.id || "").single()
    if (v?.hiring_manager_id !== session.userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
  }

  const [answers, documents, history, notes, otherApps] = await Promise.all([
    supabase
      .from("career_application_answers")
      .select("*, career_screening_questions(question_text, answer_type, sort_order)")
      .eq("application_id", id),
    supabase
      .from("career_application_documents")
      .select("id, kind, original_filename, mime_type, file_size, created_at")
      .eq("application_id", id),
    supabase
      .from("career_application_status_history")
      .select("*")
      .eq("application_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("career_application_notes")
      .select("*")
      .eq("application_id", id)
      .order("created_at", { ascending: false }),
    // Previous applications by the same email — duplicate detection.
    supabase
      .from("career_applications")
      .select("id, reference_number, status, submitted_at, career_vacancies(title)")
      .ilike("email", app.email)
      .neq("id", id)
      .order("submitted_at", { ascending: false }),
  ])

  return NextResponse.json({
    application: app,
    answers: (answers.data || []).map((a) => {
      const q = a.career_screening_questions as { question_text?: string; answer_type?: string; sort_order?: number } | null
      return { ...a, question_text: q?.question_text, answer_type: q?.answer_type, sort_order: q?.sort_order }
    }),
    documents: documents.data || [],
    history: history.data || [],
    notes: notes.data || [],
    otherApplications: otherApps.data || [],
  })
}

/* PATCH: {status?, reviewScore?, assignedReviewerId?, notify?} */
export async function PATCH(request: Request, ctx: Ctx) {
  const { session, denied } = await authorizeAdmin("careers.applications.review")
  if (denied) return denied
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Database not configured" }, { status: 503 })
  const { id } = await ctx.params

  const body = await request.json().catch(() => ({}))
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (body.reviewScore !== undefined) {
    const n = Number(body.reviewScore)
    if (body.reviewScore !== null && (!Number.isFinite(n) || n < 0 || n > 100)) {
      return NextResponse.json({ error: "Score must be between 0 and 100" }, { status: 400 })
    }
    patch.review_score = body.reviewScore === null ? null : n
  }
  if (body.assignedReviewerId !== undefined) {
    patch.assigned_reviewer_id = body.assignedReviewerId || null
  }

  if (Object.keys(patch).length > 1) {
    const { error } = await supabase.from("career_applications").update(patch).eq("id", id)
    if (error) return NextResponse.json({ error: "Failed to update" }, { status: 500 })
  }

  if (body.status !== undefined) {
    if (!APPLICATION_STATUSES.includes(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 })
    }
    const ok = await changeApplicationStatus(id, body.status, { id: session.userId, name: session.name }, body.reason)
    if (!ok) return NextResponse.json({ error: "Failed to change status" }, { status: 500 })

    await recordAudit(auditContextFromSession(session, request), {
      action: AUDIT_ACTIONS.CAREER_APPLICATION_STATUS_CHANGED,
      entityType: AUDIT_ENTITIES.CAREER_APPLICATION,
      entityId: id,
      metadata: { newStatus: body.status, reason: body.reason || null },
    })

    if (body.notify === true) {
      const tpl = templateForStatusChange(body.status)
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

  return NextResponse.json({ success: true })
}

/* DELETE: remove an application (careers.applications.delete). */
export async function DELETE(request: Request, ctx: Ctx) {
  const { session, denied } = await authorizeAdmin("careers.applications.delete")
  if (denied) return denied
  const { id } = await ctx.params
  const { error } = await supabase.from("career_applications").delete().eq("id", id)
  if (error) return NextResponse.json({ error: "Failed to delete" }, { status: 500 })
  await recordAudit(auditContextFromSession(session, request), {
    action: AUDIT_ACTIONS.CAREER_APPLICATION_DELETED,
    entityType: AUDIT_ENTITIES.CAREER_APPLICATION,
    entityId: id,
  })
  return NextResponse.json({ success: true })
}
