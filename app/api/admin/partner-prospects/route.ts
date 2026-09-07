import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { auditContextFromSession } from "@/lib/audit"
import { listPartnerProspects, createPartnerProspect, updatePartnerProspect, createProspectInvite, deletePartnerProspect } from "@/lib/partner-prospects"
import { sendEmail } from "@/lib/email"
import { renderEmailTemplate } from "@/lib/email-templates"
import { z } from "zod"

const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://www.martpoint.com.ng"

const createSchema = z.object({
  source: z.string().optional().nullable(),
  fullName: z.string().min(2),
  businessName: z.string().optional().nullable(),
  email: z.string().email("A valid email is required"),
  phone: z.string().min(5, "Phone is required"),
  country: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  interestedPartnerType: z.string().optional().nullable(),
  owner: z.string().optional().nullable(),
  status: z.enum(["NEW_LEAD", "CONTACTED", "INTERESTED", "INVITED_TO_APPLY", "APPLICATION_SUBMITTED", "CONVERTED", "NOT_INTERESTED", "DISQUALIFIED"]).optional(),
  notes: z.string().optional().nullable(),
  nextFollowUp: z.string().optional().nullable(),
})

const updateSchema = createSchema.partial()

export async function GET() {
  const auth = await authorizeAdmin("partners", "view")
  if (auth.denied) return auth.denied
  const prospects = await listPartnerProspects()
  return NextResponse.json({ prospects })
}

export async function POST(request: Request) {
  const auth = await authorizeAdmin("partners", "manage")
  if (auth.denied) return auth.denied

  try {
    const body = await request.json()
    const ctx = auditContextFromSession(auth.session, request)

    if (body.action === "create") {
      const parsed = createSchema.safeParse(body)
      if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
      const result = await createPartnerProspect(parsed.data, ctx)
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 })
      return NextResponse.json({ prospect: result.prospect })
    }

    if (body.action === "invite") {
      const id = body.id as string
      if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 })
      const result = await createProspectInvite(id, ctx)
      if (!result.ok || !result.prospect) return NextResponse.json({ error: result.error }, { status: 400 })
      const inviteLink = `${baseUrl}/partners/apply?invite=${result.token}`
      const tpl = await renderEmailTemplate("partner_lead_invite", {
        contactName: result.prospect.fullName,
        inviteLink,
      })
      if (result.prospect.email) {
        await sendEmail({ to: result.prospect.email, subject: tpl.subject, text: tpl.text, html: tpl.html })
      }
      return NextResponse.json({ prospect: result.prospect, inviteLink })
    }

    if (body.action === "delete") {
      const id = body.id as string
      if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 })
      const ok = await deletePartnerProspect(id, ctx)
      if (!ok) return NextResponse.json({ error: "Failed to delete" }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    const id = body.id as string
    const parsed = updateSchema.safeParse(body)
    if (!id || !parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 })
    const result = await updatePartnerProspect(id, parsed.data, ctx)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 500 })
    return NextResponse.json({ prospect: result.prospect })
  } catch {
    return NextResponse.json({ error: "Failed to process request" }, { status: 500 })
  }
}
