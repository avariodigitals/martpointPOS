import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { auditContextFromSession, recordAudit } from "@/lib/audit"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"

type SourceType = "lead_quote" | "finance_quote"
type TargetStatus = "SENT" | "DECLINED" | "EXPIRED"

async function guard() {
  return authorizeAdmin("quotations")
}

async function applyCorrection(sourceType: SourceType, quoteId: string, target: TargetStatus) {
  if (sourceType === "lead_quote") {
    const { data, error } = await supabase.from("lead_quotations").update({ status: target, updated_at: new Date().toISOString() })
      .eq("id", quoteId).eq("status", "ACCEPTED").select("id,quote_number,status").maybeSingle()
    if (error) throw error
    if (!data) return { error: "The quote is no longer in Accepted status. Refresh and review its current state.", status: 409 as const }
    return { quote: data }
  }

  const { data: quote, error: quoteError } = await supabase.from("quotes").select("id,quote_number,status").eq("id", quoteId).maybeSingle()
  if (quoteError) throw quoteError
  if (!quote) return { error: "Quote not found.", status: 404 as const }
  if (quote.status === "CONVERTED") return { error: "This accepted quote has already been converted. Resolve the linked invoice with Finance before correcting its quote status.", status: 409 as const }
  const { data: invoice, error: invoiceError } = await supabase.from("invoices").select("id,status,amount_paid").eq("quote_id", quoteId).maybeSingle()
  if (invoiceError) throw invoiceError
  if (invoice) return { error: `This quote already has invoice activity (${invoice.status}${Number(invoice.amount_paid) > 0 ? ", payment recorded" : ""}). Correct the invoice with Finance first; quote status was not changed.`, status: 409 as const }
  const { data, error } = await supabase.from("quotes").update({ status: target, updated_at: new Date().toISOString() })
    .eq("id", quoteId).eq("status", "ACCEPTED").select("id,quote_number,status").maybeSingle()
  if (error) throw error
  if (!data) return { error: "The quote is no longer in Accepted status. Refresh and review its current state.", status: 409 as const }
  return { quote: data }
}

export async function GET() {
  const { session, denied } = await guard()
  if (denied) return denied
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Database unavailable" }, { status: 503 })
  const query = supabase.from("quote_status_correction_requests").select("*").order("requested_at", { ascending: false }).limit(100)
  const { data, error } = session.role === "Admin" ? await query : await query.eq("requested_by", session.userId)
  if (error) return NextResponse.json({ error: "Could not load correction requests" }, { status: 500 })
  return NextResponse.json({ requests: data || [], isAdmin: session.role === "Admin" })
}

export async function POST(request: Request) {
  const { session, denied } = await guard()
  if (denied) return denied
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Database unavailable" }, { status: 503 })
  try {
    const body = await request.json()
    const sourceType = body.sourceType as SourceType
    const quoteId = String(body.quoteId || "")
    const targetStatus = body.targetStatus as TargetStatus
    const reason = String(body.reason || "").trim()
    if (!["lead_quote", "finance_quote"].includes(sourceType) || !quoteId || !["SENT", "DECLINED", "EXPIRED"].includes(targetStatus) || reason.length < 8) {
      return NextResponse.json({ error: "Choose a valid correction status and provide a reason of at least 8 characters." }, { status: 400 })
    }
    const table = sourceType === "lead_quote" ? "lead_quotations" : "quotes"
    const { data: quote, error } = await supabase.from(table).select("id,quote_number,status").eq("id", quoteId).maybeSingle()
    if (error) throw error
    if (!quote || quote.status !== "ACCEPTED") return NextResponse.json({ error: "Only an Accepted quote can be corrected. Refresh the page to check its latest status." }, { status: 409 })

    if (session.role === "Admin") {
      const result = await applyCorrection(sourceType, quoteId, targetStatus)
      if (result.error) return NextResponse.json({ error: result.error }, { status: result.status })
      await recordAudit(auditContextFromSession(session, request), { action: "QUOTE_STATUS_CORRECTED", entityType: sourceType === "lead_quote" ? "LEAD_QUOTATION" : "QUOTE", entityId: quoteId, metadata: { quote_number: quote.quote_number, from: "ACCEPTED", to: targetStatus, reason } })
      return NextResponse.json({ success: true, corrected: true, quote: result.quote })
    }

    const { data: created, error: createError } = await supabase.from("quote_status_correction_requests").insert({
      source_type: sourceType, quote_id: quoteId, quote_number: quote.quote_number || quoteId,
      to_status: targetStatus, reason, requested_by: session.userId,
      requested_by_name: session.name || session.username, requested_by_role: session.role,
    }).select("id").single()
    if (createError?.code === "23505") return NextResponse.json({ error: "An approval request for this quote is already pending." }, { status: 409 })
    if (createError) throw createError
    await recordAudit(auditContextFromSession(session, request), { action: "QUOTE_STATUS_CORRECTION_REQUESTED", entityType: sourceType === "lead_quote" ? "LEAD_QUOTATION" : "QUOTE", entityId: quoteId, metadata: { request_id: created.id, quote_number: quote.quote_number, to: targetStatus, reason } })
    return NextResponse.json({ success: true, requested: true, requestId: created.id })
  } catch (error) {
    console.error("[quote-status-corrections] POST", error)
    return NextResponse.json({ error: "Could not submit the quote correction." }, { status: 500 })
  }
}
