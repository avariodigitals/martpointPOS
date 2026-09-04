import { NextResponse } from "next/server"
import { authorizeAdmin, getSession } from "@/lib/admin-auth"
import { auditContextFromSession } from "@/lib/audit"
import { listAllPartnerLeads, adminUpdateLead, extendProtection, convertPartnerLeadToBusiness } from "@/lib/partner-leads"
import { z } from "zod"

const decisionSchema = z.object({
  status: z.enum(["REGISTERED", "UNDER_REVIEW", "QUALIFIED", "DEMO", "PROPOSAL", "NEGOTIATION", "WON", "LOST", "EXPIRED"]).optional(),
  protectionStatus: z.enum(["PENDING", "PROTECTED", "REJECTED", "EXPIRED"]).optional(),
  protectionDays: z.coerce.number().int().min(1).optional(),
  matchedLeadId: z.string().uuid().optional().nullable(),
  matchedBusinessId: z.string().uuid().optional().nullable(),
  action: z.enum(["decide", "extend", "convert"]).optional(),
  extendDays: z.coerce.number().int().min(1).optional(),
})

export async function GET() {
  const auth = await authorizeAdmin("partners", "view")
  if (auth.denied) return auth.denied
  const leads = await listAllPartnerLeads()
  return NextResponse.json({ leads })
}

export async function POST(request: Request) {
  const auth = await authorizeAdmin("partners", "manage")
  if (auth.denied) return auth.denied

  try {
    const body = await request.json()
    const { id, ...decision } = body
    const parsed = decisionSchema.safeParse(decision)
    if (!id || !parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 })
    }

    const session = auth.session
    const ctx = auditContextFromSession(session, request)

    if (parsed.data.action === "convert") {
      const result = await convertPartnerLeadToBusiness(id, session.userId, ctx)
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
      return NextResponse.json({ business: result.business })
    }

    if (parsed.data.action === "extend") {
      const days = parsed.data.extendDays ?? 30
      const result = await extendProtection(id, days, session.userId, ctx)
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
      const lead = await (await import("@/lib/partner-leads")).getPartnerLeadById(id)
      return NextResponse.json({ lead })
    }

    const result = await adminUpdateLead(
      id,
      {
        status: parsed.data.status,
        protectionStatus: parsed.data.protectionStatus,
        protectionDays: parsed.data.protectionDays,
        matchedLeadId: parsed.data.matchedLeadId,
        matchedBusinessId: parsed.data.matchedBusinessId,
      },
      session.userId,
      ctx
    )
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
    return NextResponse.json({ lead: result.lead })
  } catch {
    return NextResponse.json({ error: "Failed to process lead" }, { status: 500 })
  }
}
