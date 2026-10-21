import { NextResponse } from "next/server"
import { getPartnerSession, authorizePartner } from "@/lib/partner-auth"
import { getPartnerQuoteRequestForPartner } from "@/lib/partner-quote-requests"
import { recordAudit, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"

export const dynamic = "force-dynamic"

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getPartnerSession()
  const auth = await authorizePartner({ session, permission: "quotes:request_own" })
  if (!auth.authorized) return auth.response!

  const { id } = await params
  const result = await getPartnerQuoteRequestForPartner(id, auth.partner!.id)
  if (!result) return NextResponse.json({ error: "Quote request not found" }, { status: 404 })
  return NextResponse.json(result)
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getPartnerSession()
  const auth = await authorizePartner({ session, permission: "quotes:request_own" })
  if (!auth.authorized) return auth.response!
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Not configured" }, { status: 503 })

  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const action = body?.action === "accept" || body?.action === "decline" ? body.action : null
  if (!action) return NextResponse.json({ error: "A valid quote action is required" }, { status: 400 })

  const result = await getPartnerQuoteRequestForPartner(id, auth.partner!.id)
  if (!result?.quote || result.request.status !== "ISSUED") {
    return NextResponse.json({ error: "An issued Finance quote is required before it can be accepted" }, { status: 400 })
  }

  const quote = result.quote
  if (action === "accept" && !["SENT", "ACCEPTED"].includes(String(quote.status))) {
    return NextResponse.json({ error: "This quote is no longer available for acceptance" }, { status: 400 })
  }
  if (action === "decline" && !["SENT", "DECLINED"].includes(String(quote.status))) {
    return NextResponse.json({ error: "This quote is no longer available for response" }, { status: 400 })
  }

  const nextStatus = action === "accept" ? "ACCEPTED" : "DECLINED"
  const { error } = await supabase
    .from("quotes")
    .update({ status: nextStatus, updated_at: new Date().toISOString() })
    .eq("id", quote.id)
  if (error) return NextResponse.json({ error: "Failed to update quote" }, { status: 500 })

  await recordAudit(
    { actorType: "PARTNER", actorId: auth.user!.id, actorName: auth.user!.fullName },
    {
      action: AUDIT_ACTIONS.PARTNER_QUOTE_REQUEST_DECIDED,
      entityType: AUDIT_ENTITIES.PARTNER_QUOTE_REQUEST,
      entityId: id,
      metadata: { partnerId: auth.partner!.id, quoteId: quote.id, action },
    },
  )

  return NextResponse.json({ success: true, status: nextStatus })
}
