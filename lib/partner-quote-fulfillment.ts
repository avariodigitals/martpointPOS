import { supabase, isSupabaseConfigured } from "./supabase"
import { convertPartnerLeadToBusiness } from "./partner-leads"
import { recordAudit, type AuditContext, type ActorType, AUDIT_ACTIONS, AUDIT_ENTITIES } from "./audit"
import { getPublicSiteSettings } from "./settings"
import { resolveQuoteTemplate } from "./quote-templates"
import { nextInvoiceNumber, recalculateInvoice, logFinanceAudit } from "./finance-commercial"
import { sendInvoiceEmail, type SendInvoiceEmailResult } from "./invoice-emails"
import { notifyPartnerInvoiceCreated } from "./partner-notifications"

export type PartnerQuoteFulfillmentActor = {
  type: Extract<ActorType, "PARTNER" | "ADMIN" | "SYSTEM">
  id: string
  name?: string | null
}

export type PartnerQuoteFulfillmentResult = {
  ok: boolean
  error?: string
  invoice?: Record<string, unknown>
  invoiceEmail?: SendInvoiceEmailResult
  businessCreated?: boolean
  alreadyFulfilled?: boolean
}

function auditContext(actor: PartnerQuoteFulfillmentActor): AuditContext {
  return { actorType: actor.type, actorId: actor.id, actorName: actor.name || null }
}

/**
 * Complete the accepted partner quote handoff in one server-side workflow:
 * accepted quote → customer business → issued invoice → client email and
 * partner notification. Existing invoices are reused so retries are safe.
 */
export async function fulfillAcceptedPartnerQuote(
  quoteId: string,
  actor: PartnerQuoteFulfillmentActor,
): Promise<PartnerQuoteFulfillmentResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Database not configured" }

  const { data: quote, error: quoteError } = await supabase
    .from("quotes")
    .select("*, quote_items(*)")
    .eq("id", quoteId)
    .single()
  if (quoteError || !quote) return { ok: false, error: "Quote not found" }
  if (!["ACCEPTED", "CONVERTED"].includes(String(quote.status))) {
    return { ok: false, error: "The quote must be accepted before invoicing" }
  }

  const { data: lead } = quote.partner_lead_id
    ? await supabase.from("partner_leads").select("business_name, contact_name, email, industry").eq("id", quote.partner_lead_id).maybeSingle()
    : { data: null }

  let { data: invoice } = await supabase
    .from("invoices")
    .select("*")
    .eq("quote_id", quoteId)
    .maybeSingle()

  let businessCreated = false
  let invoiceCreated = false

  if (!invoice) {
    let businessId = quote.business_id as string | null
    if (!businessId) {
      if (!quote.partner_lead_id) return { ok: false, error: "The accepted quote has no customer lead" }
      const converted = await convertPartnerLeadToBusiness(
        quote.partner_lead_id as string,
        actor.id,
        auditContext(actor),
        { allowQuoteAccepted: true },
      )
      if (!converted.ok || !converted.business?.id) {
        return { ok: false, error: converted.error || "Customer business could not be created" }
      }
      businessId = String(converted.business.id)
      businessCreated = true
      const { error: attachError } = await supabase
        .from("quotes")
        .update({ business_id: businessId, updated_at: new Date().toISOString() })
        .eq("id", quoteId)
        .is("business_id", null)
      if (attachError) return { ok: false, error: "Customer business was created but could not be linked to the quote" }
    }

    const siteSettings = await getPublicSiteSettings()
    const template = resolveQuoteTemplate((quote.template_industry as string | null) || (lead?.industry as string | null) || null)
    const paymentTerms = String(quote.payment_terms || "").trim() || template.paymentTerms
    const bankDetails = String(quote.bank_details || "").trim() || siteSettings.accountNumber.trim() || null
    const invoiceNumber = await nextInvoiceNumber()
    const today = new Date().toISOString().slice(0, 10)
    const dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

    const inserted = await supabase.from("invoices").insert({
      invoice_number: invoiceNumber,
      business_id: businessId,
      quote_id: quoteId,
      currency: quote.currency,
      issue_date: today,
      due_date: dueDate,
      subtotal: quote.subtotal,
      discount_amount: quote.discount_amount,
      tax_amount: quote.tax_amount,
      total_amount: quote.total_amount,
      amount_paid: 0,
      balance_due: quote.total_amount,
      payment_terms: paymentTerms,
      bank_details: bankDetails,
      template_industry: quote.template_industry || null,
      notes_public: quote.notes_public || null,
      notes_internal: quote.notes_internal || null,
      status: "ISSUED",
      created_by: actor.id,
      issued_by: actor.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }).select().single()
    if (inserted.error || !inserted.data) {
      // A concurrent retry may have created the invoice after our initial
      // lookup. Re-read it before reporting a failure.
      const retry = await supabase.from("invoices").select("*").eq("quote_id", quoteId).maybeSingle()
      if (!retry.data) return { ok: false, error: inserted.error?.message || "Invoice could not be created" }
      invoice = retry.data
    } else {
      invoice = inserted.data
      invoiceCreated = true
      const invoiceItems = ((quote.quote_items || []) as Record<string, unknown>[]).map((item) => ({
        invoice_id: invoice!.id,
        item_type: item.item_type || "CUSTOM",
        reference_id: item.reference_id || null,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        discount: item.discount,
        tax: item.tax,
        line_total: item.line_total,
      }))
      if (invoiceItems.length > 0) {
        const { error: itemError } = await supabase.from("invoice_items").insert(invoiceItems)
        if (itemError) {
          await supabase.from("invoices").delete().eq("id", invoice.id)
          return { ok: false, error: `Invoice could not be completed: ${itemError.message}` }
        }
      }
      await recalculateInvoice(invoice.id as string)
      await supabase.from("quotes").update({ status: "CONVERTED", updated_at: new Date().toISOString() }).eq("id", quoteId)
      await logFinanceAudit(actor.type, actor.id, "QUOTE_CONVERTED", "QUOTE", quoteId, { invoice_id: invoice.id, automatic: true })
      await logFinanceAudit(actor.type, actor.id, "INVOICE_CREATED", "INVOICE", invoice.id, { quote_id: quoteId, automatic: true })
    }
  }

  if (!invoice) return { ok: false, error: "Invoice could not be loaded" }

  // If a draft existed from an earlier manual conversion, acceptance still
  // completes the promised automatic handoff by issuing that same invoice.
  if (invoice.status === "DRAFT") {
    const { data: issued } = await supabase
      .from("invoices")
      .update({ status: "ISSUED", issued_by: actor.id, updated_at: new Date().toISOString() })
      .eq("id", invoice.id)
      .select()
      .single()
    if (issued) {
      invoice = issued
      await recalculateInvoice(invoice.id as string)
    }
  }

  if (String(quote.status) !== "CONVERTED") {
    await supabase.from("quotes").update({ status: "CONVERTED", updated_at: new Date().toISOString() }).eq("id", quoteId)
  }

  let invoiceEmail: SendInvoiceEmailResult = { ok: true }
  let clientEmailDeliveredNow = false
  if (!invoice.invoice_email_sent_at) {
    invoiceEmail = await sendInvoiceEmail(invoice.id as string, "invoice", { type: actor.type === "ADMIN" ? "ADMIN" : "SYSTEM", id: actor.id })
    clientEmailDeliveredNow = invoiceEmail.ok
  }

  if (invoiceCreated || clientEmailDeliveredNow) {
    const businessName = String(lead?.business_name || "Your customer")
    await notifyPartnerInvoiceCreated(String(quote.partner_id || ""), {
      businessName,
      invoiceNumber: String(invoice.invoice_number),
      total: Number(invoice.total_amount) || 0,
      currency: String(invoice.currency || "NGN"),
      dueDate: String(invoice.due_date || ""),
      clientEmailSent: invoiceEmail.ok,
      link: "/partner/quotes",
    }).catch((error) => console.error("[partner quote] invoice notification failed", error))
  }

  await recordAudit(auditContext(actor), {
    action: AUDIT_ACTIONS.PARTNER_QUOTE_REQUEST_DECIDED,
    entityType: AUDIT_ENTITIES.PARTNER_QUOTE_REQUEST,
    entityId: (quote.partner_quote_request_id as string | null) || null,
    metadata: {
      partnerId: quote.partner_id,
      quoteId,
      invoiceId: invoice.id,
      action: "AUTO_INVOICE_ON_ACCEPT",
      businessCreated,
      clientEmailSent: invoiceEmail.ok,
    },
  })

  return {
    ok: true,
    invoice,
    invoiceEmail,
    businessCreated,
    alreadyFulfilled: !invoiceCreated,
  }
}
