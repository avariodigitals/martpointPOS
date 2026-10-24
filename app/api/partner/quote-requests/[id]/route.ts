import { NextResponse } from "next/server"
import { getPartnerSession, authorizePartner } from "@/lib/partner-auth"
import { getPartnerQuoteRequestForPartner } from "@/lib/partner-quote-requests"
import { recordAudit, AUDIT_ACTIONS, AUDIT_ENTITIES } from "@/lib/audit"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { fulfillAcceptedPartnerQuote } from "@/lib/partner-quote-fulfillment"
import { notifyAllAdmins } from "@/lib/admin-notifications"

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
  if (body.quoteUpdatedAt && body.quoteUpdatedAt !== quote.updated_at) {
    return NextResponse.json({ error: "This quote has been updated. Refresh to review the latest terms before responding." }, { status: 409 })
  }
  if (action === "accept" && !["SENT", "ACCEPTED"].includes(String(quote.status))) {
    return NextResponse.json({ error: "This quote is no longer available for acceptance" }, { status: 400 })
  }
  if (action === "decline" && !["SENT", "DECLINED"].includes(String(quote.status))) {
    return NextResponse.json({ error: "This quote is no longer available for response" }, { status: 400 })
  }

  const nextStatus = action === "accept" ? "ACCEPTED" : "DECLINED"
  let responseUpdate = supabase
    .from("quotes")
    .update({ status: nextStatus, updated_at: new Date().toISOString() })
    .eq("id", quote.id)
    .eq("status", quote.status)
  if (quote.updated_at) responseUpdate = responseUpdate.eq("updated_at", quote.updated_at)
  const { data: respondedQuote, error } = await responseUpdate
    .select("id")
    .maybeSingle()
  if (error) return NextResponse.json({ error: "Failed to update quote" }, { status: 500 })
  if (!respondedQuote) return NextResponse.json({ error: "This quote has changed or is being revised. Refresh before responding." }, { status: 409 })

  await recordAudit(
    { actorType: "PARTNER", actorId: auth.user!.id, actorName: auth.user!.fullName },
    {
      action: AUDIT_ACTIONS.PARTNER_QUOTE_REQUEST_DECIDED,
      entityType: AUDIT_ENTITIES.PARTNER_QUOTE_REQUEST,
      entityId: id,
      metadata: { partnerId: auth.partner!.id, quoteId: quote.id, action },
    },
  )

  if (action === "accept") {
    const fulfillment = await fulfillAcceptedPartnerQuote(String(quote.id), {
      type: "PARTNER",
      id: auth.user!.id,
      name: auth.user!.fullName,
    })
    if (!fulfillment.ok) {
      return NextResponse.json({
        error: `Quote accepted, but automatic invoicing needs attention: ${fulfillment.error || "invoice creation failed"}`,
        status: nextStatus,
        invoicePending: true,
      }, { status: 500 })
    }

    await notifyAllAdmins({
      type: "PARTNER_QUOTE_ACCEPTED_INVOICE_CREATED",
      title: "Partner accepted quote — invoice created",
      message: `Quote ${quote.quote_number} was accepted and invoice ${String(fulfillment.invoice?.invoice_number || "created")} was issued automatically.`,
      deep_link: "/admin/partners/quotes?tab=conversion",
      source_type: "partner_quote_request",
      source_id: id,
      roles: ["Admin", "Finance", "Sales"],
    })

    return NextResponse.json({
      success: true,
      status: nextStatus,
      invoice: fulfillment.invoice ? {
        id: fulfillment.invoice.id,
        invoiceNumber: fulfillment.invoice.invoice_number,
        total: fulfillment.invoice.total_amount,
        currency: fulfillment.invoice.currency,
        emailSent: fulfillment.invoiceEmail?.ok ?? false,
      } : null,
    })
  }

  return NextResponse.json({ success: true, status: nextStatus })
}
