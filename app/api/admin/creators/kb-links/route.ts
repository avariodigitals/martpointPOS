import { NextResponse } from "next/server"
import { z } from "zod"
import { authorizeAdmin } from "@/lib/admin-auth"
import { listKbLinks, saveKbLink, deleteKbLink } from "@/lib/creator-resources"
import { recordAudit, AUDIT_ACTIONS, auditContextFromSession } from "@/lib/audit"

export const dynamic = "force-dynamic"

const kbSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(2).max(200),
  description: z.string().max(500).nullish(),
  url: z.string().trim().min(1).max(2000),
  category: z.string().trim().max(60).optional(),
  sortOrder: z.number().int().optional(),
  active: z.boolean().optional(),
  delete: z.boolean().optional(),
})

export async function GET() {
  const { denied } = await authorizeAdmin("creator.learning.manage")
  if (denied) return denied
  const items = await listKbLinks()
  return NextResponse.json({ items })
}

export async function POST(request: Request) {
  const { session, denied } = await authorizeAdmin("creator.learning.manage")
  if (denied) return denied
  try {
    const body = kbSchema.parse(await request.json())
    if (body.delete && body.id) {
      await deleteKbLink(body.id)
      return NextResponse.json({ success: true })
    }
    const { id, error } = await saveKbLink(body, session.userId, body.id)
    if (error) return NextResponse.json({ error }, { status: 400 })
    await recordAudit(auditContextFromSession(session, request), {
      action: AUDIT_ACTIONS.CREATOR_KB_LINK_SAVED,
      entityType: "creator_kb_link",
      entityId: id,
      metadata: { title: body.title },
    })
    return NextResponse.json({ success: true, id })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 })
    }
    return NextResponse.json({ error: "Failed to save" }, { status: 500 })
  }
}
