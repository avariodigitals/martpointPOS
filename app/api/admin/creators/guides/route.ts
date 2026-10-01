import { NextResponse } from "next/server"
import { z } from "zod"
import { authorizeAdmin } from "@/lib/admin-auth"
import { listGuides, saveGuide } from "@/lib/creator-resources"
import { allIndustries } from "@/lib/industries"
import { recordAudit, AUDIT_ACTIONS, auditContextFromSession } from "@/lib/audit"
import { CONTENT_STATUSES } from "@/lib/creator-constants"

export const dynamic = "force-dynamic"

const industrySlugs = new Set(allIndustries.map((i) => i.slug))

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

export async function GET() {
  const { denied } = await authorizeAdmin("creator.learning.manage")
  if (denied) return denied
  const items = await listGuides()
  return NextResponse.json({
    items,
    // All supported business types for the picker — from the canonical registry.
    industries: allIndustries.map((i) => ({ slug: i.slug, name: i.name, category: i.category })),
  })
}

export async function POST(request: Request) {
  const { session, denied } = await authorizeAdmin("creator.learning.manage")
  if (denied) return denied

  try {
    const body = guideSchema.parse(await request.json())
    if (!industrySlugs.has(body.industrySlug)) {
      return NextResponse.json({ error: "Unknown business type" }, { status: 400 })
    }
    const { id, error } = await saveGuide(body, session.userId)
    if (error) return NextResponse.json({ error }, { status: 400 })
    await recordAudit(auditContextFromSession(session, request), {
      action: AUDIT_ACTIONS.CREATOR_GUIDE_SAVED,
      entityType: "creator_business_guide",
      entityId: id,
      metadata: { industrySlug: body.industrySlug, title: body.title },
    })
    return NextResponse.json({ success: true, id })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Invalid input", issues: err.issues }, { status: 400 })
    }
    return NextResponse.json({ error: "Failed to save guide" }, { status: 500 })
  }
}
