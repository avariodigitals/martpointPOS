import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { recalculateQuote, buildQuotePublicUrl, buildQuoteEmailHtml } from "@/lib/quotations"
import { sendEmail } from "@/lib/email"
import { renderEmailTemplate } from "@/lib/email-templates"

/* ─── POST: resolve a change request ───
 * Body:
 *   { action: "approve" | "decline", adminNote?, items?, notesPublic?, validUntil? }
 *   - approve:  admin issues a revised quote (update in place). items is the new
 *              line-item set with our final prices. Quote status -> REVISED,
 *              change request -> approved, client is emailed.
 *   - decline: change request -> declined, quote status -> SENT (client can still
 *              accept/decline the original). No email to client by default.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string; rid: string }> }) {
  const { session, denied } = await authorizeAdmin("quotations")
  if (denied) return denied

  const { id, rid } = await params

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 })
  }

  try {
    const body = await request.json()
    const { action, adminNote, items, notesPublic, validUntil } = body as {
      action: "approve" | "decline"
      adminNote?: string
      items?: Array<{ description: string; quantity: number; unitPrice: number; discount?: number; tax?: number }>
      notesPublic?: string
      validUntil?: string
    }

    if (!["approve", "decline"].includes(action)) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 })
    }

    const { data: changeReq, error: crError } = await supabase
      .from("lead_quote_change_requests")
      .select("id, quotation_id, status")
      .eq("id", rid)
      .eq("quotation_id", id)
      .single()

    if (crError || !changeReq) {
      return NextResponse.json({ error: "Change request not found" }, { status: 404 })
    }
    if (changeReq.status !== "pending") {
      return NextResponse.json({ error: "Change request already resolved" }, { status: 400 })
    }

    const now = new Date().toISOString()

    if (action === "decline") {
      const { error: crUpdateErr } = await supabase
        .from("lead_quote_change_requests")
        .update({
          status: "declined",
          admin_note: adminNote || null,
          resolved_by: session?.username || null,
          resolved_at: now,
          updated_at: now,
        })
        .eq("id", rid)
      if (crUpdateErr) {
        console.error("[admin/change-requests/resolve] decline cr update", crUpdateErr)
        return NextResponse.json({ error: "Failed to update change request" }, { status: 500 })
      }

      // Restore quote to SENT so the lead can still accept/decline the original.
      await supabase
        .from("lead_quotations")
        .update({ status: "SENT", updated_at: now })
        .eq("id", id)

      return NextResponse.json({ success: true, status: "declined" })
    }

    // ── approve: issue revised quote in place ──
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "At least one revised item is required" }, { status: 400 })
    }

    const totals = recalculateQuote(items.map((it) => ({
      description: it.description,
      quantity: Number(it.quantity) || 1,
      unitPrice: Number(it.unitPrice) || 0,
      discount: Number(it.discount) || 0,
      tax: Number(it.tax) || 0,
    })))

    const { data: quote, error: quoteError } = await supabase
      .from("lead_quotations")
      .select("*, lead:leads (full_name, business_name, email, phone, product_interest)")
      .eq("id", id)
      .single()
    if (quoteError || !quote) {
      return NextResponse.json({ error: "Quotation not found" }, { status: 404 })
    }

    const leadRawMaybe = quote.lead as unknown as Record<string, unknown> | Record<string, unknown>[] | undefined
    const leadRaw = Array.isArray(leadRawMaybe) ? leadRawMaybe[0] : leadRawMaybe
    const lead = leadRaw
      ? {
          id: quote.lead_id as string,
          fullName: leadRaw.full_name as string,
          businessName: leadRaw.business_name as string,
          email: leadRaw.email as string,
          phone: leadRaw.phone as string,
          productInterest: leadRaw.product_interest as string,
        }
      : null

    const { error: quoteUpdateErr } = await supabase
      .from("lead_quotations")
      .update({
        status: "REVISED",
        subtotal: totals.subtotal,
        discount_amount: totals.discountAmount,
        tax_amount: totals.taxAmount,
        total_amount: totals.total,
        notes_public: notesPublic != null ? notesPublic : (quote.notes_public as string | null) || null,
        valid_until: validUntil || (quote.valid_until as string | null) || null,
        updated_at: now,
      })
      .eq("id", id)
    if (quoteUpdateErr) {
      console.error("[admin/change-requests/resolve] quote update", quoteUpdateErr)
      return NextResponse.json({ error: "Failed to update quotation" }, { status: 500 })
    }

    // Replace items: delete old, insert new.
    await supabase.from("lead_quotation_items").delete().eq("quotation_id", id)
    const itemRows = totals.items.map((it) => ({
      quotation_id: id,
      description: it.description,
      quantity: it.quantity,
      unit_price: it.unitPrice,
      discount: it.discount,
      tax: it.tax,
      line_total: it.lineTotal,
    }))
    const { error: itemsErr } = await supabase.from("lead_quotation_items").insert(itemRows)
    if (itemsErr) {
      console.error("[admin/change-requests/resolve] items insert", itemsErr)
      return NextResponse.json({ error: "Failed to save revised items" }, { status: 500 })
    }

    const { error: crUpdateErr } = await supabase
      .from("lead_quote_change_requests")
      .update({
        status: "approved",
        admin_note: adminNote || null,
        resolved_by: session?.username || null,
        resolved_at: now,
        updated_at: now,
      })
      .eq("id", rid)
    if (crUpdateErr) {
      console.error("[admin/change-requests/resolve] approve cr update", crUpdateErr)
    }

    // Email the client that a revised quote is available.
    if (lead?.email) {
      const publicUrl = buildQuotePublicUrl(quote.public_token as string)
      const subjTpl = await renderEmailTemplate("quotation_revised_subject", {
        quoteNumber: quote.quote_number as string,
        titleBlock: (quote.title as string) ? ` — ${quote.title as string}` : "",
      })
      const textTpl = await renderEmailTemplate("quotation_revised", {
        fullName: lead.fullName,
        quoteNumber: quote.quote_number as string,
        publicUrl,
      })
      await sendEmail({
        to: lead.email,
        subject: subjTpl.subject,
        text: textTpl.text,
        html: buildQuoteEmailHtml(
          {
            quote_number: quote.quote_number as string,
            title: (quote.title as string) || "",
            total_amount: totals.total,
            valid_until: validUntil || (quote.valid_until as string | null) || null,
            notes_public: notesPublic != null ? notesPublic : (quote.notes_public as string | null) || "",
          },
          lead,
          publicUrl
        ),
      })
    }

    return NextResponse.json({ success: true, status: "approved" })
  } catch (e) {
    console.error("[admin/change-requests/resolve] POST", e)
    return NextResponse.json({ error: "Failed to resolve change request" }, { status: 500 })
  }
}
