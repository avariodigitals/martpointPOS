import { NextResponse } from "next/server"
import { z } from "zod"
import { authorizeAdmin } from "@/lib/admin-auth"
import { auditContextFromSession, recordAudit, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit"
import { listAssessmentTiers, upsertTier, deleteTier } from "@/lib/partner-assessments"

const tierSchema = z.object({
  id: z.string().uuid().optional(),
  code: z.string().trim().min(1).max(60),
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).optional().default(""),
  level: z.coerce.number().int().min(1).max(99).optional().default(1),
  audience: z.enum(["APPLICANT", "PARTNER", "BOTH"]).optional().default("APPLICANT"),
  requiredForApproval: z.boolean().optional().default(true),
  active: z.boolean().optional().default(true),
})

export async function GET() {
  const auth = await authorizeAdmin("partners", "view")
  if (auth.denied) return auth.denied
  return NextResponse.json({ tiers: await listAssessmentTiers() })
}

export async function POST(request: Request) {
  const auth = await authorizeAdmin("partners", "manage")
  if (auth.denied) return auth.denied
  const parsed = tierSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || "Invalid tier" }, { status: 400 })
  }
  const result = await upsertTier(parsed.data)
  if (!result.ok || !result.tier) return NextResponse.json({ error: result.error }, { status: 400 })
  await recordAudit(auditContextFromSession(auth.session, request), {
    action: parsed.data.id ? AUDIT_ACTIONS.PARTNER_ASSESSMENT_TIER_UPDATED : AUDIT_ACTIONS.PARTNER_ASSESSMENT_TIER_CREATED,
    entityType: AUDIT_ENTITIES.PARTNER_ASSESSMENT_TIER,
    entityId: result.tier.id,
    metadata: { code: result.tier.code, name: result.tier.name },
  })
  return NextResponse.json({ success: true, tier: result.tier })
}

export async function DELETE(request: Request) {
  const auth = await authorizeAdmin("partners", "manage")
  if (auth.denied) return auth.denied
  const id = new URL(request.url).searchParams.get("id") || ""
  if (!id) return NextResponse.json({ error: "Tier id is required" }, { status: 400 })
  const result = await deleteTier(id)
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  await recordAudit(auditContextFromSession(auth.session, request), {
    action: AUDIT_ACTIONS.PARTNER_ASSESSMENT_TIER_DELETED,
    entityType: AUDIT_ENTITIES.PARTNER_ASSESSMENT_TIER,
    entityId: id,
  })
  return NextResponse.json({ success: true })
}
