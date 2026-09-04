import { supabase, isSupabaseConfigured } from "./supabase"

export type Receipt = {
  receiptNumber: string
  businessName: string
  businessEmail?: string | null
  businessPhone?: string | null
  invoiceNumber: string
  paymentReference: string
  amount: number
  currency: string
  paymentMethod: string
  paymentDate: string
}

export async function getReceiptByNumber(receiptNumber: string): Promise<Receipt | null> {
  if (!isSupabaseConfigured()) return null

  const { data: payment, error } = await supabase
    .from("payments")
    .select("receipt_number, payment_reference, amount, currency, payment_method, payment_date, invoice_id")
    .eq("receipt_number", receiptNumber)
    .eq("status", "CONFIRMED")
    .maybeSingle()

  if (error || !payment) return null

  const { data: invoice } = await supabase
    .from("invoices")
    .select("invoice_number, business_id")
    .eq("id", (payment as any).invoice_id)
    .maybeSingle()

  if (!invoice) return null

  const { data: business } = await supabase
    .from("businesses")
    .select("business_name, primary_email, primary_phone")
    .eq("id", (invoice as any).business_id)
    .maybeSingle()

  if (!business) return null

  return {
    receiptNumber: (payment as any).receipt_number,
    businessName: (business as any).business_name,
    businessEmail: (business as any).primary_email,
    businessPhone: (business as any).primary_phone,
    invoiceNumber: (invoice as any).invoice_number,
    paymentReference: (payment as any).payment_reference,
    amount: (payment as any).amount,
    currency: (payment as any).currency,
    paymentMethod: (payment as any).payment_method,
    paymentDate: (payment as any).payment_date,
  }
}
