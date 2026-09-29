import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { recordAudit, auditContextFromSession, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit"
import type { VacancyStatus } from "@/lib/careers"

export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

const LIFECYCLE: Record<string, { to: VacancyStatus; perm: string; patch?: () => Record<string, unknown> }> = {
  publish: {
    to: "PUBLISHED",
    perm: "careers.vacancies.publish",
    patch: () => ({ published_at: new Date().toISOString() }),
  },
  schedule: {
    to: "SCHEDULED",
    perm: "careers.vacancies.publish",
  },
  pause: {
    to: "PAUSED",
    perm: "careers.vacancies.publish",
  },
  close: {
    to: "CLOSED",
    perm: "careers.vacancies.close",
    patch: () => ({ closed_at: new Date().toISOString() }),
  },
  archive: {
    to: "ARCHIVED",
    perm: "careers.vacancies.close",
    patch: () => ({ archived_at: new Date().toISOString() }),
  },
  reopen: {
    to: "PUBLISHED",
    perm: "careers.vacancies.publish",
    patch: () => ({ closed_at: null, closed_reason: null, published_at: new Date().toISOString() }),
  },
  unpublish: {
    to: "DRAFT",
    perm: "careers.vacancies.publish",
  },
}

/* POST {action} — vacancy lifecycle transitions. */
export async function POST(request: Request, ctx: Ctx) {
  const { id } = await ctx.params
  const body = await request.json().catch(() => ({}))
  const action = String(body.action || "")
  const spec = LIFECYCLE[action]
  if (!spec) {
    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  }

  const { session, denied } = await authorizeAdmin(spec.perm)
  if (denied) return denied
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Database not configured" }, { status: 503 })

  const { data: v } = await supabase.from("career_vacancies").select("status, title").eq("id", id).single()
  if (!v) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const patch: Record<string, unknown> = {
    status: spec.to,
    updated_at: new Date().toISOString(),
    updated_by: session.userId,
    ...(spec.patch ? spec.patch() : {}),
  }

  if (action === "schedule") {
    const at = body.scheduledPublishAt || body.scheduled_publish_at
    if (!at || Number.isNaN(Date.parse(at))) {
      return NextResponse.json({ error: "A valid publication date/time is required" }, { status: 400 })
    }
    patch.scheduled_publish_at = new Date(at).toISOString()
  }
  if (action === "close") {
    patch.closed_reason = body.reason || null
  }

  const { error } = await supabase.from("career_vacancies").update(patch).eq("id", id)
  if (error) {
    return NextResponse.json({ error: "Failed to update status" }, { status: 500 })
  }

  await recordAudit(auditContextFromSession(session, request), {
    action: spec.to === "PUBLISHED" ? AUDIT_ACTIONS.CAREER_VACANCY_PUBLISHED : AUDIT_ACTIONS.CAREER_VACANCY_STATUS_CHANGED,
    entityType: AUDIT_ENTITIES.CAREER_VACANCY,
    entityId: id,
    metadata: { action, previousStatus: v.status, newStatus: spec.to, reason: body.reason || null },
  })

  return NextResponse.json({ success: true, status: spec.to })
}
