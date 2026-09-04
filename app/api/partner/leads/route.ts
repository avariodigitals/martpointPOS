import { NextResponse } from "next/server"
import { getPartnerSession, authorizePartner, partnerHasCapability } from "@/lib/partner-auth"
import { auditContextFromPartnerSession } from "@/lib/audit"
import { createPartnerLead, listPartnerLeads } from "@/lib/partner-leads"
import { checkRateLimit } from "@/lib/rate-limit"
import { z } from "zod"

const createSchema = z.object({
  businessName: z.string().min(2),
  contactName: z.string().min(2),
  phone: z.string().min(5),
  email: z.string().email(),
  country: z.string().min(1),
  state: z.string().min(1),
  city: z.string().min(1),
  industry: z.string().min(1),
  businessType: z.string().min(1),
  estimatedBranches: z.coerce.number().int().min(1).optional().nullable(),
  estimatedUsers: z.coerce.number().int().min(1).optional().nullable(),
  interestedProduct: z.string().min(1),
  estimatedDealValue: z.coerce.number().optional().nullable(),
  notes: z.string().optional().nullable(),
})

export async function GET() {
  const session = await getPartnerSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const auth = await authorizePartner({ session, permission: "leads:view" })
  if (!auth.authorized) return auth.response!

  const hasSales = await partnerHasCapability(session.partnerId, "SALES")
  const hasReferrals = await partnerHasCapability(session.partnerId, "REFERRALS")
  if (!hasSales && !hasReferrals) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const leads = await listPartnerLeads(session.partnerId)
  return NextResponse.json({ leads })
}

export async function POST(request: Request) {
  const session = await getPartnerSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const auth = await authorizePartner({ session, permission: "leads:create" })
  if (!auth.authorized) return auth.response!

  const hasSales = await partnerHasCapability(session.partnerId, "SALES")
  const hasReferrals = await partnerHasCapability(session.partnerId, "REFERRALS")
  if (!hasSales && !hasReferrals) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const limit = await checkRateLimit(request, {
    key: "partner-lead-create",
    max: 10,
    windowSeconds: 3600,
  })
  if (!limit.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 })
  }

  try {
    const body = await request.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const ctx = auditContextFromPartnerSession(session, request)
    const result = await createPartnerLead(parsed.data, session.partnerId, session.partnerUserId, ctx)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({ lead: result.lead, warning: result.warning })
  } catch {
    return NextResponse.json({ error: "Failed to process lead" }, { status: 500 })
  }
}
