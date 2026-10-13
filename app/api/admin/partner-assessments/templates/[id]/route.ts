import { NextResponse } from "next/server"
import { z } from "zod"
import { authorizeAdmin } from "@/lib/admin-auth"
import { auditContextFromSession, recordAudit, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit"
import { getTemplate, listAssessmentTiers, upsertTemplate, deleteTemplate } from "@/lib/partner-assessments"

const patchSchema = z.object({
  tierId: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(160).optional(),
  description: z.string().trim().max(2000).optional(),
  instructions: z.string().trim().max(4000).optional(),
  timeLimitMinutes: z.coerce.number().int().min(1).max(480).optional(),
  passingScore: z.coerce.number().int().min(0).max(100).optional(),
  conditionalScore: z.coerce.number().int().min(0).max(100).optional(),
  maxAttempts: z.coerce.number().int().min(1).max(20).optional(),
  shuffleQuestions: z.boolean().optional(),
  shuffleOptions: z.boolean().optional(),
  questionSampleCount: z.coerce.number().int().min(1).max(200).nullable().optional(),
  showResultImmediately: z.boolean().optional(),
  showCorrectAnswers: z.boolean().optional(),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).optional(),
})

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeAdmin("partners", "view")
  if (auth.denied) return auth.denied
  const { id } = await params
  const [{ template, questions }, tiers] = await Promise.all([getTemplate(id), listAssessmentTiers()])
  if (!template) return NextResponse.json({ error: "Template not found" }, { status: 404 })
  return NextResponse.json({ template, questions, tiers })
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeAdmin("partners", "manage")
  if (auth.denied) return auth.denied
  const { id } = await params
  const parsed = patchSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid template" }, { status: 400 })
  }
  const current = await getTemplate(id)
  if (!current.template) return NextResponse.json({ error: "Template not found" }, { status: 404 })

  const result = await upsertTemplate({ ...current.template, ...parsed.data, id, createdBy: auth.session.userId })
  if (!result.ok || !result.template) return NextResponse.json({ error: result.error }, { status: 400 })
  await recordAudit(auditContextFromSession(auth.session, request), {
    action: AUDIT_ACTIONS.PARTNER_ASSESSMENT_TEMPLATE_UPDATED,
    entityType: AUDIT_ENTITIES.PARTNER_ASSESSMENT_TEMPLATE,
    entityId: id,
    metadata: { name: result.template.name, status: result.template.status },
  })
  return NextResponse.json({ success: true, template: result.template })
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await authorizeAdmin("partners", "manage")
  if (auth.denied) return auth.denied
  const { id } = await params
  const result = await deleteTemplate(id)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  await recordAudit(auditContextFromSession(auth.session, request), {
    action: AUDIT_ACTIONS.PARTNER_ASSESSMENT_TEMPLATE_DELETED,
    entityType: AUDIT_ENTITIES.PARTNER_ASSESSMENT_TEMPLATE,
    entityId: id,
  })
  return NextResponse.json({ success: true })
}
