import { NextResponse } from "next/server"
import { z } from "zod"
import { authorizeAdmin } from "@/lib/admin-auth"
import { saveGuide, deleteGuide } from "@/lib/creator-resources"
import { allIndustries } from "@/lib/industries"
import { recordAudit, AUDIT_ACTIONS, auditContextFromSession } from "@/lib/audit"
import { CONTENT_STATUSES } from "@/lib/creator-constants"

export const dynamic = "force-dynamic"

const industrySlugs = new Set(allIndustries.map((i) => i.slug))
type Params = { params: Promise<{ id: string }> }

const guideSchema = z.object({
  industrySlug: z.string(),
  title: z.string().trim().min(2).max(200),
  overview: z.string().max(5000).nullable().default(null),
  commonProblems: z.array(z.string()).default([]),
  howHelps: z.string().max(10000).nullable().default(null),
  features: z.array(z.string()).default([]),
  contentAngles: z.array(z.string()).default([]),
  hooks: z.array(z.string()).default([]),
  useCases: z.array(z.string()).default([]),
  claimsToAvoid: z.array(z.string()).default([]),
  recommendedCta: z.string().max(2000).nullable().default(null),
  relatedLinks: z.array(z.object({ label: z.string(), url: z.string() })).default([]),
  status: z.enum(CONTENT_STATUSES).default("DRAFT"),
  sortOrder: z.number().int().optional(),
})

export async function PUT(request: Request, { params }: Params) {
  const { session, denied } = await authorizeAdmin("creator.learning.manage")
  if (denied) return denied
  const { id } = await params

  try {
    const body = guideSchema.parse(await request.json())
    if (!industrySlugs.has(body.industrySlug)) {
      return NextResponse.json({ error: "Unknown business type" }, { status: 400 })
    }
    const { error } = await saveGuide(body, session.userId, id)
    if (error) return NextResponse.json({ error }, { status: 400 })
    await recordAudit(auditContextFromSession(session, request), {
      action: AUDIT_ACTIONS.CREATOR_GUIDE_SAVED,
      entityType: "creator_business_guide",
      entityId: id,
      metadata: { industrySlug: body.industrySlug },
    })
    return NextResponse.json({ success: true })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", issues: err.issues }, { status: 400 })
    }
    return NextResponse.json({ error: "Failed to save guide" }, { status: 500 })
  }
}

export async function DELETE(request: Request, { params }: Params) {
  const { session, denied } = await authorizeAdmin("creator.learning.manage")
  if (denied) return denied
  const { id } = await params
  const { error } = await deleteGuide(id)
  if (error) return NextResponse.json({ error }, { status: 500 })
  await recordAudit(auditContextFromSession(session, request), {
    action: AUDIT_ACTIONS.CREATOR_GUIDE_SAVED,
    entityType: "creator_business_guide",
    entityId: id,
    metadata: { deleted: true },
  })
  return NextResponse.json({ success: true })
}
