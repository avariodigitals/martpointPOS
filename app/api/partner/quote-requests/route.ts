import { NextResponse } from "next/server"
import { getPartnerSession, authorizePartner } from "@/lib/partner-auth"
import { createQuoteRequest, listPartnerQuoteRequests } from "@/lib/partner-quote-requests"

/* ─── GET: partner's quotation requests ─── */
export async function GET() {
  const session = await getPartnerSession()
  const auth = await authorizePartner({ session, permission: "quotes:request_own" })
  if (!auth.authorized) return auth.response

  const requests = await listPartnerQuoteRequests(auth.partner!.id)
  return NextResponse.json({ requests })
}

/* ─── POST: request a MartPoint-issued quote on a registered lead ─── */
export async function POST(request: Request) {
  const session = await getPartnerSession()
  const auth = await authorizePartner({ session, permission: "quotes:request_own" })
  if (!auth.authorized) return auth.response

  const body = await request.json().catch(() => ({}))
  if (!body?.partnerLeadId) {
    return NextResponse.json({ error: "Opportunity is required" }, { status: 400 })
  }

  const result = await createQuoteRequest(
    auth.partner!.id,
    { id: auth.user!.id, name: auth.user!.fullName },
    {
      partnerLeadId: String(body.partnerLeadId),
      planName: body?.planName ? String(body.planName) : undefined,
      locations: body?.locations ? String(body.locations) : undefined,
      usersEstimate: body?.usersEstimate ? String(body.usersEstimate) : undefined,
      servicesRequested: body?.servicesRequested ? String(body.servicesRequested) : undefined,
      assumptions: body?.assumptions ? String(body.assumptions) : undefined,
      notes: body?.notes ? String(body.notes) : undefined,
      dueDate: body?.dueDate ? String(body.dueDate) : null,
    }
  )
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json({ success: true, request: result.request })
}
