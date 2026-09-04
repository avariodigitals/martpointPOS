import { NextResponse } from "next/server"
import { getPartnerSession, authorizePartner } from "@/lib/partner-auth"
import { auditContextFromPartnerSession } from "@/lib/audit"
import { getPartnerLeadByIdForPartner, updatePartnerLead } from "@/lib/partner-leads"
import { z } from "zod"

const updateSchema = z.object({
  businessName: z.string().min(2).optional(),
  contactName: z.string().min(2).optional(),
  phone: z.string().min(5).optional(),
  email: z.string().email().optional(),
  country: z.string().min(1).optional(),
  state: z.string().min(1).optional(),
  city: z.string().min(1).optional(),
  industry: z.string().min(1).optional(),
  businessType: z.string().min(1).optional(),
  estimatedBranches: z.coerce.number().int().min(1).optional().nullable(),
  estimatedUsers: z.coerce.number().int().min(1).optional().nullable(),
  interestedProduct: z.string().min(1).optional(),
  estimatedDealValue: z.coerce.number().optional().nullable(),
  notes: z.string().optional().nullable(),
})

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getPartnerSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const auth = await authorizePartner({ session, permission: "leads:view" })
  if (!auth.authorized) return auth.response!

  const lead = await getPartnerLeadByIdForPartner(id, session.partnerId)
  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 })
  }
  return NextResponse.json({ lead })
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getPartnerSession()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const auth = await authorizePartner({ session, permission: "leads:update" })
  if (!auth.authorized) return auth.response!

  try {
    const body = await request.json()
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
    }

    const ctx = auditContextFromPartnerSession(session, request)
    const result = await updatePartnerLead(id, session.partnerId, session.partnerUserId, parsed.data, ctx)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ lead: result.lead })
  } catch {
    return NextResponse.json({ error: "Failed to update lead" }, { status: 500 })
  }
}
