import { NextResponse } from "next/server"
import { z } from "zod"
import { authorizeAdmin } from "@/lib/admin-auth"
import { addCreatorAdminNote } from "@/lib/creator-applications"
import { recordAudit, AUDIT_ACTIONS, AUDIT_ENTITIES, auditContextFromSession } from "@/lib/audit"

const schema = z.object({ note: z.string().min(1).max(4000) })

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, denied } = await authorizeAdmin("creator.application.review")
  if (denied) return denied
  const { id } = await params

  try {
    const { note } = schema.parse(await request.json())
    const ok = await addCreatorAdminNote(
      { applicationId: id, note },
      { id: session.userId, name: session.name || session.username }
    )
    if (!ok) return NextResponse.json({ error: "Failed to add note" }, { status: 500 })
    await recordAudit(auditContextFromSession(session, request), {
      action: AUDIT_ACTIONS.CREATOR_APPLICATION_NOTE_ADDED,
      entityType: AUDIT_ENTITIES.CREATOR_APPLICATION,
      entityId: id,
    })
    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Note is required" }, { status: 400 })
    }
    return NextResponse.json({ error: "Failed to add note" }, { status: 500 })
  }
}
