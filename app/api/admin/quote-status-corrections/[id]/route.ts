import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { auditContextFromSession, recordAudit } from "@/lib/audit"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, denied } = await authorizeAdmin("quotations")
  if (denied) return denied
  if (session.role !== "Admin") return NextResponse.json({ error: "Only an Admin can approve or reject quote corrections." }, { status: 403 })
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Database unavailable" }, { status: 503 })
  const { id } = await params
  try {
    const body = await request.json()
    const decision = body.decision === "approve" ? "APPROVED" : body.decision === "reject" ? "REJECTED" : null
    const decisionNote = String(body.decisionNote || "").trim()
    if (!decision || (decision === "REJECTED" && decisionNote.length < 4)) return NextResponse.json({ error: "Choose approve or reject; a rejection needs a short explanation." }, { status: 400 })
    const { data: approval, error } = await supabase.from("quote_status_correction_requests").select("*").eq("id", id).eq("status", "PENDING").maybeSingle()
    if (error) throw error
    if (!approval) return NextResponse.json({ error: "This request is no longer pending." }, { status: 409 })

    if (decision === "APPROVED") {
      let updateResult: { data: Record<string, unknown> | null; error: { message: string } | null }
      if (approval.source_type === "lead_quote") {
        updateResult = await supabase.from("lead_quotations").update({ status: approval.to_status, updated_at: new Date().toISOString() }).eq("id", approval.quote_id).eq("status", "ACCEPTED").select("id,quote_number,status").maybeSingle()
      } else if (approval.source_type === "finance_quote") {
        const { data: quote, error: quoteError } = await supabase.from("quotes").select("id,status").eq("id", approval.quote_id).maybeSingle()
        if (quoteError) throw quoteError
        const { data: invoice, error: invoiceError } = await supabase.from("invoices").select("id").eq("quote_id", approval.quote_id).maybeSingle()
        if (invoiceError) throw invoiceError
        if (!quote || quote.status !== "ACCEPTED" || invoice) {
          const message = invoice ? "An invoice is linked to this quote. Resolve it with Finance before correcting the quote status." : "Quote is no longer Accepted; no status was changed."
          await supabase.from("quote_status_correction_requests").update({ status: "FAILED", decided_by: session.userId, decided_by_name: session.name || session.username, decision_note: message, decided_at: new Date().toISOString() }).eq("id", id).eq("status", "PENDING")
          return NextResponse.json({ error: message }, { status: 409 })
        }
        updateResult = await supabase.from("quotes").update({ status: approval.to_status, updated_at: new Date().toISOString() }).eq("id", approval.quote_id).eq("status", "ACCEPTED").select("id,quote_number,status").maybeSingle()
      } else {
        return NextResponse.json({ error: "Unsupported quote source." }, { status: 400 })
      }
      if (updateResult.error) throw updateResult.error
      if (!updateResult.data) {
        const message = "Quote is no longer Accepted; no status was changed."
        await supabase.from("quote_status_correction_requests").update({ status: "FAILED", decided_by: session.userId, decided_by_name: session.name || session.username, decision_note: message, decided_at: new Date().toISOString() }).eq("id", id).eq("status", "PENDING")
        return NextResponse.json({ error: message }, { status: 409 })
      }
    }

    const decidedAt = new Date().toISOString()
    const { data: updated, error: decisionError } = await supabase.from("quote_status_correction_requests").update({
      status: decision, decided_by: session.userId, decided_by_name: session.name || session.username,
      decision_note: decisionNote || null, decided_at: decidedAt, applied_at: decision === "APPROVED" ? decidedAt : null,
    }).eq("id", id).eq("status", "PENDING").select("id").maybeSingle()
    if (decisionError) throw decisionError
    if (!updated) return NextResponse.json({ error: "Another administrator already handled this request." }, { status: 409 })
    await recordAudit(auditContextFromSession(session, request), { action: decision === "APPROVED" ? "QUOTE_STATUS_CORRECTION_APPROVED" : "QUOTE_STATUS_CORRECTION_REJECTED", entityType: "QUOTE_STATUS_CORRECTION", entityId: id, metadata: { source_type: approval.source_type, quote_id: approval.quote_id, quote_number: approval.quote_number, to: approval.to_status, requester: approval.requested_by_name, decision_note: decisionNote } })
    return NextResponse.json({ success: true, decision })
  } catch (error) {
    console.error("[quote-status-corrections] PATCH", error)
    return NextResponse.json({ error: "Could not process the quote correction request." }, { status: 500 })
  }
}
