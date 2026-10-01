import { NextResponse } from "next/server"
import { z } from "zod"
import { authorizeAdmin } from "@/lib/admin-auth"
import { listFaqs, saveFaq } from "@/lib/creator-resources"
import { recordAudit, AUDIT_ACTIONS, auditContextFromSession } from "@/lib/audit"
import { CREATOR_FAQ_CATEGORIES, CONTENT_STATUSES } from "@/lib/creator-constants"

export const dynamic = "force-dynamic"

const faqSchema = z.object({
  question: z.string().trim().min(3).max(500),
  answer: z.string().trim().min(2).max(10000),
  category: z.enum(CREATOR_FAQ_CATEGORIES).default("GENERAL"),
  sortOrder: z.number().int().optional(),
  status: z.enum(CONTENT_STATUSES).optional(),
})

export async function GET() {
  const { denied } = await authorizeAdmin("creator.learning.manage")
  if (denied) return denied
  const items = await listFaqs()
  return NextResponse.json({ items })
}

export async function POST(request: Request) {
  const { session, denied } = await authorizeAdmin("creator.learning.manage")
  if (denied) return denied
  try {
    const body = faqSchema.parse(await request.json())
    const { id, error } = await saveFaq(body, session.userId)
    if (error) return NextResponse.json({ error }, { status: 400 })
    await recordAudit(auditContextFromSession(session, request), {
      action: AUDIT_ACTIONS.CREATOR_FAQ_SAVED,
      entityType: "creator_faq",
      entityId: id,
      metadata: { question: body.question },
    })
    return NextResponse.json({ success: true, id })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 })
    }
    return NextResponse.json({ error: "Failed to save" }, { status: 500 })
  }
}
