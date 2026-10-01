import { NextResponse } from "next/server"
import { z } from "zod"
import { authorizeAdmin } from "@/lib/admin-auth"
import { listAllLearning, saveLearning, type LearningInput } from "@/lib/creator-learning"
import { recordAudit, AUDIT_ACTIONS, auditContextFromSession } from "@/lib/audit"
import { LEARNING_TYPES, LEARNING_CATEGORIES, CONTENT_STATUSES } from "@/lib/creator-constants"

export const dynamic = "force-dynamic"

const learningSchema = z.object({
  title: z.string().trim().min(2).max(200),
  slug: z.string().trim().min(2).max(120).regex(/^[a-z0-9-]+$/),
  type: z.enum(LEARNING_TYPES),
  category: z.enum(LEARNING_CATEGORIES),
  description: z.string().max(1000).nullish(),
  body: z.string().max(100000).nullish(),
  videoUrl: z.string().url().nullish().or(z.literal("")),
  thumbnailUrl: z.string().nullish(),
  durationSeconds: z.number().int().min(0).nullish(),
  externalUrl: z.string().url().nullish().or(z.literal("")),
  businessType: z.string().nullish(),
  businessTypes: z.array(z.string()).optional(),
  features: z.array(z.string()).optional(),
  required: z.boolean().optional(),
  isOnboardingStep: z.boolean().optional(),
  onboardingOrder: z.number().int().nullish(),
  sortOrder: z.number().int().optional(),
  relatedLinks: z.array(z.object({ label: z.string(), url: z.string() })).optional(),
  status: z.enum(CONTENT_STATUSES).optional(),
  assessmentConfig: z
    .object({
      passingScore: z.number().min(0).max(100).optional(),
      maxAttempts: z.number().int().min(1).max(10).optional(),
      showIncorrect: z.boolean().optional(),
    })
    .optional(),
})

export async function GET() {
  const { denied } = await authorizeAdmin("creator.learning.manage")
  if (denied) return denied
  const items = await listAllLearning()
  return NextResponse.json({ items })
}

export async function POST(request: Request) {
  const { session, denied } = await authorizeAdmin("creator.learning.manage")
  if (denied) return denied

  try {
    const body = learningSchema.parse(await request.json())
    const { id, error } = await saveLearning(body as LearningInput, session.userId)
    if (error) return NextResponse.json({ error }, { status: 400 })
    await recordAudit(auditContextFromSession(session, request), {
      action: AUDIT_ACTIONS.CREATOR_LEARNING_CONTENT_SAVED,
      entityType: "creator_learning_content",
      entityId: id,
      metadata: { title: body.title, slug: body.slug },
    })
    return NextResponse.json({ success: true, id })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", issues: err.issues }, { status: 400 })
    }
    return NextResponse.json({ error: "Failed to save" }, { status: 500 })
  }
}
