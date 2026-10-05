import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { mapQuotation } from "@/lib/quotations"

/* ─── POST: duplicate a quotation as a new DRAFT ───
 * Copies the quote and its line items verbatim, with a fresh quote number and
 * public token (public_token defaults to gen_random_uuid()).
 */
export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { session, denied } = await authorizeAdmin("quotations")
  if (denied) return denied

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 })
  }

  const { id } = await params

  try {
    const { data: src, error } = await supabase
      .from("lead_quotations")
      .select("*, items:lead_quotation_items(*)")
      .eq("id", id)
      .single()

    if (error || !src) {
      return NextResponse.json({ error: "Quotation not found" }, { status: 404 })
    }

    const year = new Date().getFullYear()
    const { data: quoteNumberData, error: quoteNumberError } = await supabase.rpc("next_lead_quote_number", { p_year: year })
    if (quoteNumberError || !quoteNumberData) {
      console.error("[admin/quotations/duplicate] quote number error", quoteNumberError)
      return NextResponse.json({ error: "Failed to generate quote number" }, { status: 500 })
    }

    const { data: created, error: insertError } = await supabase
      .from("lead_quotations")
      .insert({
        lead_id: src.lead_id,
        quote_number: String(quoteNumberData),
        title: src.title || "",
        status: "DRAFT",
        currency: (src.currency as string) || "NGN",
        subtotal: Number(src.subtotal) || 0,
        discount_amount: Number(src.discount_amount) || 0,
        discount_type: (src.discount_type as string) || "none",
        discount_value: Number(src.discount_value) || 0,
        tax_amount: Number(src.tax_amount) || 0,
        total_amount: Number(src.total_amount) || 0,
        valid_until: (src.valid_until as string | null) || null,
        notes_public: (src.notes_public as string | null) || null,
        notes_internal: [`Duplicated from ${src.quote_number}.`, (src.notes_internal as string | null) || ""]
          .join(" ")
          .trim(),
        payment_terms: (src.payment_terms as string | null) || null,
        industry: (src.industry as string | null) || null,
        created_by: session?.username || null,
        sent_at: null,
        allow_changes: Boolean(src.allow_changes),
        allow_counter_offer: Boolean(src.allow_counter_offer),
      })
      .select("*")
      .single()

    if (insertError || !created) {
      console.error("[admin/quotations/duplicate] insert error", insertError)
      return NextResponse.json({ error: "Failed to duplicate quotation" }, { status: 500 })
    }

    const items = (Array.isArray(src.items) ? src.items : []) as Record<string, unknown>[]
    if (items.length > 0) {
      const { error: itemsError } = await supabase.from("lead_quotation_items").insert(
        items.map((it) => ({
          quotation_id: created.id,
          description: it.description,
          quantity: Number(it.quantity) || 1,
          unit_price: Number(it.unit_price) || 0,
          discount: Number(it.discount) || 0,
          tax_rate: it.tax_rate ?? null,
          tax: Number(it.tax) || 0,
          line_total: Number(it.line_total) || 0,
        }))
      )
      if (itemsError) {
        console.error("[admin/quotations/duplicate] items insert error", itemsError)
        return NextResponse.json({ error: "Quotation duplicated but items failed to copy" }, { status: 500 })
      }
    }

    const { data: fullQuote, error: fullError } = await supabase
      .from("lead_quotations")
      .select("*, lead:leads (full_name, business_name, email, phone, product_interest), items:lead_quotation_items(*)")
      .eq("id", created.id)
      .single()

    if (fullError || !fullQuote) {
      return NextResponse.json({ error: "Quotation duplicated but could not be loaded" }, { status: 500 })
    }

    return NextResponse.json({ success: true, quotation: mapQuotation(fullQuote) })
  } catch (e) {
    console.error("[admin/quotations/duplicate] POST", e)
    return NextResponse.json({ error: "Failed to duplicate quotation" }, { status: 500 })
  }
}
