import { NextResponse } from "next/server"
import { z } from "zod"
import { authorizeAdmin } from "@/lib/admin-auth"
import { supabase } from "@/lib/supabase"
import { recordAudit, AUDIT_ACTIONS, AUDIT_ENTITIES, auditContextFromSession } from "@/lib/audit"

const schema = z.object({
  status: z.enum(["SCHEDULED", "COMPLETED", "CANCELLED", "NO_SHOW"]).optional(),
  result: z.string().max(2000).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; interviewId: string }> }
) {
  const { session, denied } = await authorizeAdmin("creator.interview.manage")
  if (denied) return denied
  const { id, interviewId } = await params

  try {
    const body = schema.parse(await request.json())
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (body.status) update.status = body.status
    if (body.result !== undefined) update.result = body.result
    if (body.notes !== undefined) update.notes = body.notes

    const { error } = await supabase
      .from("creator_interviews")
      .update(update)
      .eq("id", interviewId)
      .eq("application_id", id)
    if (error) {
      return NextResponse.json({ error: "Failed to update interview" }, { status: 500 })
    }
    await recordAudit(auditContextFromSession(session, request), {
      action: AUDIT_ACTIONS.CREATOR_INTERVIEW_UPDATED,
      entityType: AUDIT_ENTITIES.CREATOR_INTERVIEW,
      entityId: interviewId,
      metadata: { applicationId: id, ...body },
    })
    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 })
    }
    return NextResponse.json({ error: "Failed to update interview" }, { status: 500 })
  }
}
