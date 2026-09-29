import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { recordAudit, auditContextFromSession, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit"
import { listStageOwners, listHandovers } from "@/lib/careers-pipeline"

export const dynamic = "force-dynamic"

/* GET: stage ownership map + handover log. Requires careers.performance.view. */
export async function GET(request: Request) {
  const { denied } = await authorizeAdmin("careers.performance.view")
  if (denied) return denied
  if (!isSupabaseConfigured()) return NextResponse.json({ stages: [], handovers: [], admins: [] })

  const { searchParams } = new URL(request.url)
  const [stages, handovers, admins] = await Promise.all([
    listStageOwners(),
    listHandovers({
      stage: searchParams.get("stage") || undefined,
      leadId: searchParams.get("lead_id") || undefined,
    }),
    supabase.from("users").select("id, name, role").eq("status", "ACTIVE").order("name"),
  ])

  return NextResponse.json({ stages, handovers, admins: admins.data || [] })
}

/* PATCH: update the responsible role for a pipeline stage.
 * Requires careers.performance.manage. */
export async function PATCH(request: Request) {
  const { session, denied } = await authorizeAdmin("careers.performance.manage")
  if (denied) return denied
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Database not configured" }, { status: 503 })

  const body = await request.json().catch(() => ({}))
  const stageKey = String(body.stage_key || "").trim()
  const role = String(body.responsible_role || "").trim()
  if (!stageKey || !role) return NextResponse.json({ error: "stage_key and responsible_role are required" }, { status: 400 })

  const { error } = await supabase
    .from("career_pipeline_stage_owners")
    .update({ responsible_role: role, updated_by: session.userId, updated_at: new Date().toISOString() })
    .eq("stage_key", stageKey)
  if (error) return NextResponse.json({ error: "Failed to update stage owner" }, { status: 500 })

  await recordAudit(auditContextFromSession(session, request), {
    action: AUDIT_ACTIONS.CAREER_PIPELINE_STAGE_OWNER_UPDATED,
    entityType: AUDIT_ENTITIES.CAREER_PIPELINE_STAGE,
    entityId: stageKey,
    metadata: { responsible_role: role },
  })
  return NextResponse.json({ success: true })
}
