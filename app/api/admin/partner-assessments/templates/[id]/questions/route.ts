import { NextResponse } from "next/server"
import { z } from "zod"
import { authorizeAdmin } from "@/lib/admin-auth"
import { auditContextFromSession, recordAudit, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit"
import { getTemplate, saveTemplateQuestions } from "@/lib/partner-assessments"

const optionSchema = z.object({ key: z.string().trim().min(1).max(40), text: z.string().trim().max(1000) })

const questionSchema = z.object({
  id: z.string().uuid().optional(),
  prompt: z.string().trim().max(4000),
  type: z.enum(["SINGLE", "MULTI", "TRUE_FALSE", "DROPDOWN", "SHORT_TEXT", "LONG_TEXT"]),
  options: z.array(optionSchema).max(30).optional().default([]),
  correctKeys: z.array(z.string().trim().max(40)).max(30).optional().default([]),
  acceptedKeywords: z.array(z.string().trim().max(120)).max(20).optional().default([]),
  keywordMode: z.enum(["ANY", "ALL"]).optional().default("ANY"),
  points: z.coerce.number().int().min(1).max(50).optional().default(1),
  requiresReview: z.boolean().optional().default(false),
  explanation: z.string().trim().max(4000).nullable().optional(),
  helpText: z.string().trim().max(2000).optional().default(""),
  required: z.boolean().optional().default(true),
  sortOrder: z.coerce.number().int().min(0).max(999).optional(),
})

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeAdmin("partners", "manage")
  if (auth.denied) return auth.denied
  const { id } = await params

  const parsed = z.object({ questions: z.array(questionSchema).max(150) }).safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid questions" }, { status: 400 })
  }
  const { template } = await getTemplate(id)
  if (!template) return NextResponse.json({ error: "Template not found" }, { status: 404 })

  const result = await saveTemplateQuestions(id, parsed.data.questions.map((q) => ({
    ...q,
    explanation: q.explanation ?? null,
  })))
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })

  await recordAudit(auditContextFromSession(auth.session, request), {
    action: AUDIT_ACTIONS.PARTNER_ASSESSMENT_QUESTIONS_SAVED,
    entityType: AUDIT_ENTITIES.PARTNER_ASSESSMENT_TEMPLATE,
    entityId: id,
    metadata: { name: template.name, questionCount: parsed.data.questions.length },
  })
  const fresh = await getTemplate(id)
  return NextResponse.json({ success: true, questions: fresh.questions })
}
