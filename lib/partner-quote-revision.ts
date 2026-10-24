import { supabase } from "./supabase"
import { logFinanceAudit } from "./finance-commercial"
import { notifyPartnerCustomerEvent } from "./partner-notifications"

/** Withdraw an unanswered issued quote before editing its commercial terms. */
export async function reopenPartnerQuoteForRevision(id: string, actorId: string) {
  const { data: quote, error } = await supabase.from("quotes").select("*, quote_items(*)").eq("id", id).maybeSingle()
  if (error) return { ok: false, error: error.message, status: 500 }
  if (!quote) return { ok: false, error: "Quote not found", status: 404 }
  if (!quote.partner_id || !quote.partner_lead_id) return { ok: false, error: "This action is for partner quotes", status: 400 }
  if (quote.status !== "SENT") return { ok: false, error: "Only an issued quote awaiting a response can be reopened. Refresh to see its current status.", status: 409 }

  const invoice = await supabase.from("invoices").select("id").eq("quote_id", id).limit(1).maybeSingle()
  if (invoice.error) return { ok: false, error: invoice.error.message, status: 500 }
  if (invoice.data) return { ok: false, error: "This quote already has an invoice and cannot be reopened.", status: 409 }

  const requestResult = await supabase.from("partner_quote_requests").select("id").eq("quote_id", id).maybeSingle()
  if (requestResult.error) return { ok: false, error: requestResult.error.message, status: 500 }
  if (!requestResult.data) return { ok: false, error: "The linked partner request could not be found.", status: 409 }
  const requestId = requestResult.data.id as string

  // A partner's response and a revision compete for the same SENT row. Never
  // reopen a quote which was accepted after the initial read.
  let update = supabase.from("quotes").update({ status: "DRAFT", updated_at: new Date().toISOString() }).eq("id", id).eq("status", "SENT")
  if (quote.updated_at) update = update.eq("updated_at", quote.updated_at)
  const changed = await update.select("*").maybeSingle()
  if (changed.error) return { ok: false, error: changed.error.message, status: 500 }
  if (!changed.data) return { ok: false, error: "The quote changed while you were opening it. Refresh and try again.", status: 409 }

  // Retain the entire previously issued document, including lines, for audit.
  await logFinanceAudit("ADMIN", actorId, "QUOTE_UPDATED", "QUOTE", id, { reason: "Reopened for revision", previous_quote: quote })
  const requestUpdate = await supabase.from("partner_quote_requests").update({
    status: "UNDER_REVIEW", decision_reason: `Quote ${quote.quote_number} is being revised`, updated_at: new Date().toISOString(),
  }).eq("id", requestId).eq("status", "ISSUED")
  // The quote's DRAFT status always blocks acceptance, even if this secondary
  // request update fails. Both portals derive revision state from the quote.
  if (requestUpdate.error) console.error("[partner quote revision] request status", requestUpdate.error.message)

  await notifyPartnerCustomerEvent(quote.partner_id, {
    subject: `Quote ${quote.quote_number} is being revised`,
    title: "Quote being revised",
    businessName: quote.quote_number,
    body: "Finance has reopened this quote to make corrections. It is temporarily unavailable for acceptance or download. We will notify you when the updated quote is issued.",
    link: `/partner/quotes/${requestId}`,
  }).catch((notificationError) => console.error("[partner quote revision] notification", notificationError))

  return { ok: true, quote: { ...changed.data, quote_items: quote.quote_items }, requestId }
}
