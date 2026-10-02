import { NextResponse } from "next/server"
import { authorizeAdmin } from "@/lib/admin-auth"
import { hasFinanceAction } from "@/lib/finance-permissions"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { generateInvoicePdf } from "@/lib/invoice-pdf"

/* GET /api/admin/finance/invoice-pdf?id= — downloads the invoice as a PDF. */
export async function GET(request: Request) {
  const { session, denied } = await authorizeAdmin("finance")
  if (denied) return denied
  if (!session || !hasFinanceAction(session.role, "finance:view")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 500 })
  }

  const id = new URL(request.url).searchParams.get("id")
  if (!id) return NextResponse.json({ error: "Invoice ID required" }, { status: 400 })

  const { data: inv, error } = await supabase
    .from("invoices")
    .select("*, invoice_items(*), businesses:business_id (business_name, primary_contact_name, primary_email, primary_phone)")
    .eq("id", id)
    .single()
  if (error || !inv) {
    return NextResponse.json({ error: error?.message || "Invoice not found" }, { status: 404 })
  }

  const pdf = generateInvoicePdf({
    invoice_number: inv.invoice_number,
    currency: inv.currency || "NGN",
    issue_date: inv.issue_date,
    due_date: inv.due_date,
    status: inv.status,
    subtotal: inv.subtotal,
    discount_amount: inv.discount_amount,
    tax_amount: inv.tax_amount,
    total_amount: inv.total_amount,
    amount_paid: inv.amount_paid,
    balance_due: inv.balance_due,
    notes_public: inv.notes_public,
    items: inv.invoice_items || [],
    business: inv.businesses || {},
  })

  return new NextResponse(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="MartPoint-Invoice-${inv.invoice_number}.pdf"`,
    },
  })
}
