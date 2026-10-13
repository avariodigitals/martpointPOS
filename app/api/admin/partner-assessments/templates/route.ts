import { NextResponse } from "next/server"
import { z } from "zod"
import { authorizeAdmin } from "@/lib/admin-auth"
import { auditContextFromSession, recordAudit, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit"
import { listTemplates, upsertTemplate } from "@/lib/partner-assessments"

const templateSchema = z.object({
  id: z.string().uuid().optional(),
  tierId: z.string().uuid(),
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).optional().default(""),
  instructions: z.string().trim().max(4000).optional().default(""),
  timeLimitMinutes: z.coerce.number().int().min(1).max(480),
  passingScore: z.coerce.number().int().min(0).max(100),
  conditionalScore: z.coerce.number().int().min(0).max(100),
  maxAttempts: z.coerce.number().int().min(1).max(20),
  shuffleQuestions: z.boolean().optional().default(false),
  shuffleOptions: z.boolean().optional().default(false),
  questionSampleCount: z.coerce.number().int().min(1).max(200).nullable().optional().default(null),
  showResultImmediately: z.boolean().optional().default(true),
  showCorrectAnswers: z.boolean().optional().default(false),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).optional().default("DRAFT"),
})

export async function GET(request: Request) {
  const auth = await authorizeAdmin("partners", "view")
  if (auth.denied) return auth.denied
  const params = new URL(request.url).searchParams
  const tierId = params.get("tierId") || undefined
  const statusParam = params.get("status")
  const status = statusParam === "DRAFT" || statusParam === "ACTIVE" || statusParam === "ARCHIVED"
    ? statusParam
    : undefined
  const { templates, questionCount } = await listTemplates({ tierId, status })
  return NextResponse.json({ templates, questionCount })
}

export async function POST(request: Request) {
  const auth = await authorizeAdmin("partners", "manage")
  if (auth.denied) return auth.denied
  const parsed = templateSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid template" }, { status: 400 })
  }
  const result = await upsertTemplate({ ...parsed.data, createdBy: auth.session.userId })
  if (!result.ok || !result.template) return NextResponse.json({ error: result.error }, { status: 400 })
  await recordAudit(auditContextFromSession(auth.session, request), {
    action: parsed.data.id ? AUDIT_ACTIONS.PARTNER_ASSESSMENT_TEMPLATE_UPDATED : AUDIT_ACTIONS.PARTNER_ASSESSMENT_TEMPLATE_CREATED,
    entityType: AUDIT_ENTITIES.PARTNER_ASSESSMENT_TEMPLATE,
    entityId: result.template.id,
    metadata: { name: result.template.name, tierId: result.template.tierId, status: result.template.status },
  })
  return NextResponse.json({ success: true, template: result.template })
}
