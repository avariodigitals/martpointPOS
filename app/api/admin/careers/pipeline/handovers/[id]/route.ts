import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { recordAudit, auditContextFromSession, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit"
import { HANDOVER_ACCEPTANCE_STATUSES } from "@/lib/careers-pipeline"

export const dynamic = "force-dynamic"

type Ctx = { params: Promise<{ id: string }> }

/* PATCH: update handover acceptance status / notes. Requires careers.performance.manage. */
export async function PATCH(request: Request, ctx: Ctx) {
  const { session, denied } = await authorizeAdmin("careers.performance.manage")
  if (denied) return denied
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Database not configured" }, { status: 503 })
  const { id } = await ctx.params

  const body = await request.json().catch(() => ({}))
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }

  if (body.acceptance_status) {
    const status = String(body.acceptance_status).toUpperCase()
    if (!HANDOVER_ACCEPTANCE_STATUSES.includes(status as never)) {
      return NextResponse.json({ error: "Invalid acceptance status" }, { status: 400 })
    }
    update.acceptance_status = status
    update.accepted_at = status === "PENDING" ? null : new Date().toISOString()
  }
  if (body.notes !== undefined) update.notes = body.notes || null
  if (body.required_action !== undefined) update.required_action = body.required_action || null
  if (body.deadline !== undefined) update.deadline = body.deadline || null

  const { error } = await supabase.from("career_pipeline_handovers").update(update).eq("id", id)
  if (error) return NextResponse.json({ error: "Failed to update handover" }, { status: 500 })

  await recordAudit(auditContextFromSession(session, request), {
    action: AUDIT_ACTIONS.CAREER_PIPELINE_HANDOVER_UPDATED,
    entityType: AUDIT_ENTITIES.CAREER_PIPELINE_HANDOVER,
    entityId: id,
    metadata: update,
  })
  return NextResponse.json({ success: true })
}
