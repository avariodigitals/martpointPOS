import { NextResponse } from "next/server"
import { z } from "zod"
import { authorizeAdmin } from "@/lib/admin-auth"
import { supabase } from "@/lib/supabase"
import { recordAudit, AUDIT_ACTIONS, AUDIT_ENTITIES, auditContextFromSession } from "@/lib/audit"

const schema = z.object({
  status: z.enum(["ACTIVE", "SUSPENDED", "REMOVED"]),
  reason: z.string().max(1000).optional().nullable(),
})

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { session, denied } = await authorizeAdmin("creator.manage")
  if (denied) return denied
  const { id } = await params

  try {
    const body = schema.parse(await request.json())
    if ((body.status === "SUSPENDED" || body.status === "REMOVED") && !body.reason?.trim()) {
      return NextResponse.json({ error: "A reason is required." }, { status: 400 })
    }

    const { error } = await supabase
      .from("creators")
      .update({
        status: body.status,
        status_reason: body.reason ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
    if (error) return NextResponse.json({ error: "Failed to update creator" }, { status: 500 })

    await recordAudit(auditContextFromSession(session, request), {
      action:
        body.status === "SUSPENDED" ? AUDIT_ACTIONS.CREATOR_SUSPENDED
        : body.status === "REMOVED" ? AUDIT_ACTIONS.CREATOR_REMOVED
        : AUDIT_ACTIONS.CREATOR_REACTIVATED,
      entityType: AUDIT_ENTITIES.CREATOR,
      entityId: id,
      metadata: { status: body.status, reason: body.reason ?? null },
    })
    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 })
    }
    return NextResponse.json({ error: "Failed to update creator" }, { status: 500 })
  }
}
