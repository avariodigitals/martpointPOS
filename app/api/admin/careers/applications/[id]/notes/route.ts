import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { recordAudit, auditContextFromSession, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit"

export const dynamic = "force-dynamic"

/* POST {note} — internal note (never exposed to applicants). */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { session, denied } = await authorizeAdmin("careers.applications.review")
  if (denied) return denied
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Database not configured" }, { status: 503 })
  const { id } = await ctx.params

  const body = await request.json().catch(() => ({}))
  const note = String(body.note || "").trim()
  if (!note) return NextResponse.json({ error: "Note is required" }, { status: 400 })

  const { data, error } = await supabase
    .from("career_application_notes")
    .insert({ application_id: id, author_id: session.userId, author_name: session.name, note })
    .select("id, created_at, author_name, note")
    .single()
  if (error) return NextResponse.json({ error: "Failed to save note" }, { status: 500 })

  await recordAudit(auditContextFromSession(session, request), {
    action: AUDIT_ACTIONS.CAREER_APPLICATION_NOTE_ADDED,
    entityType: AUDIT_ENTITIES.CAREER_APPLICATION,
    entityId: id,
  })

  return NextResponse.json({ success: true, note: data })
}
