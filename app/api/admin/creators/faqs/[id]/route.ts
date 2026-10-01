import { NextResponse } from "next/server"
import { z } from "zod"
import { authorizeAdmin } from "@/lib/admin-auth"
import { saveFaq, deleteFaq } from "@/lib/creator-resources"
import { recordAudit, AUDIT_ACTIONS, auditContextFromSession } from "@/lib/audit"
import { CREATOR_FAQ_CATEGORIES, CONTENT_STATUSES } from "@/lib/creator-constants"

export const dynamic = "force-dynamic"

type Params = { params: Promise<{ id: string }> }

const faqSchema = z.object({
  question: z.string().trim().min(3).max(500),
  answer: z.string().trim().min(2).max(10000),
  category: z.enum(CREATOR_FAQ_CATEGORIES).default("GENERAL"),
  sortOrder: z.number().int().optional(),
  status: z.enum(CONTENT_STATUSES).optional(),
})

export async function PUT(request: Request, { params }: Params) {
  const { session, denied } = await authorizeAdmin("creator.learning.manage")
  if (denied) return denied
  const { id } = await params
  try {
    const body = faqSchema.parse(await request.json())
    const { error } = await saveFaq(body, session.userId, id)
    if (error) return NextResponse.json({ error }, { status: 400 })
    await recordAudit(auditContextFromSession(session, request), {
      action: AUDIT_ACTIONS.CREATOR_FAQ_SAVED,
      entityType: "creator_faq",
      entityId: id,
      metadata: { question: body.question },
    })
    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 })
    }
    return NextResponse.json({ error: "Failed to save" }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: Params) {
  const { session, denied } = await authorizeAdmin("creator.learning.manage")
  if (denied) return denied
  const { id } = await params
  const { error } = await deleteFaq(id)
  if (error) return NextResponse.json({ error }, { status: 500 })
  await recordAudit(auditContextFromSession(session, request), {
    action: AUDIT_ACTIONS.CREATOR_FAQ_SAVED,
    entityType: "creator_faq",
    entityId: id,
    metadata: { deleted: true },
  })
  return NextResponse.json({ success: true })
}
