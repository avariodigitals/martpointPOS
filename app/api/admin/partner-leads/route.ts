import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { auditContextFromSession } from "@/lib/audit"
import { listAllPartnerLeads, adminUpdateLead, extendProtection, convertPartnerLeadToBusiness, createPartnerLead, createLeadInvite } from "@/lib/partner-leads"
import { listPartnerUsers } from "@/lib/partner-service"
import { sendEmail } from "@/lib/email"
import { renderEmailTemplate } from "@/lib/email-templates"
import { z } from "zod"

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://www.martpoint.com.ng"

const decisionSchema = z.object({
  status: z.enum(["REGISTERED", "UNDER_REVIEW", "QUALIFIED", "DEMO", "PROPOSAL", "NEGOTIATION", "WON", "LOST", "EXPIRED"]).optional(),
  protectionStatus: z.enum(["PENDING", "PROTECTED", "REJECTED", "EXPIRED"]).optional(),
  protectionDays: z.coerce.number().int().min(1).optional(),
  matchedLeadId: z.string().uuid().optional().nullable(),
  matchedBusinessId: z.string().uuid().optional().nullable(),
  action: z.enum(["decide", "extend", "convert", "invite"]).optional(),
  extendDays: z.coerce.number().int().min(1).optional(),
})

const createSchema = z.object({
  partnerId: z.string().uuid().optional().nullable(),
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

    if (body?.action === "create") {
      const session = auth.session
      const ctx = auditContextFromSession(session, request)
      const parsedCreate = createSchema.safeParse(body)
      if (!parsedCreate.success) {
        return NextResponse.json({ error: parsedCreate.error.issues[0].message }, { status: 400 })
      }

      const { partnerId, ...input } = parsedCreate.data
      let submittedBy: string | null = null
      if (partnerId) {
        const users = await listPartnerUsers(partnerId)
        const submitter = users.find((u) => u.role === "PARTNER_OWNER" && u.status === "ACTIVE") ?? users.find((u) => u.status === "ACTIVE") ?? users[0]
        submittedBy = submitter?.id ?? null
      }

      const result = await createPartnerLead(input, partnerId ?? null, submittedBy, ctx)
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 })
      return NextResponse.json({ lead: result.lead, warning: result.warning })
    }

    const { id, ...decision } = body
    const parsed = decisionSchema.safeParse(decision)
    if (!id || !parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 })
    }

    const session = auth.session
    const ctx = auditContextFromSession(session, request)

    if (parsed.data.action === "invite") {
      const result = await createLeadInvite(id, ctx)
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })

      const inviteLink = `${baseUrl}/partners/apply?invite=${result.token}`
      const lead = result.lead
      const tpl = await renderEmailTemplate("partner_lead_invite", {
        contactName: lead.contactName || "there",
        businessName: lead.businessName || "",
        inviteLink,
      })
      await sendEmail({ to: lead.email!, subject: tpl.subject, text: tpl.text, html: tpl.html })

      return NextResponse.json({ lead: result.lead, inviteLink })
    }

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
