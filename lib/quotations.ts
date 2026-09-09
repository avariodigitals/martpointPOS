export interface LeadSummary {
  id: string
  fullName: string
  businessName: string
  email: string
  phone: string
  productInterest: string
}

export interface QuotationItemInput {
  id?: string
  description: string
  quantity: number
  unitPrice: number
  discount?: number
  tax?: number
  taxRate?: number
  lineTotal?: number
}

export interface QuotationItem {
  id: string
  quotation_id: string
  description: string
  quantity: number
  unit_price: number
  discount: number
  tax: number
  tax_rate: number | null
  line_total: number
}

export type QuotationStatus =
  | "DRAFT"
  | "SENT"
  | "ACCEPTED"
  | "DECLINED"
  | "EXPIRED"
  | "CONVERTED"
  | "CHANGE_REQUESTED"
  | "COUNTER_OFFERED"
  | "REVISED"

export interface Quotation {
  id: string
  lead_id: string
  quote_number: string
  title: string
  status: QuotationStatus
  currency: string
  subtotal: number
  discount_amount: number
  tax_amount: number
  total_amount: number
  valid_until: string | null
  notes_public: string | null
  notes_internal: string | null
  payment_terms: string | null
  converted_business_id: string | null
  converted_invoice_id: string | null
  public_token: string
  token_expires_at: string | null
  viewed_at: string | null
  sent_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  allow_changes: boolean
  allow_counter_offer: boolean
  lead?: LeadSummary
  items?: QuotationItem[]
}

export type ChangeRequestType = "scope" | "counter_offer"
export type ChangeRequestStatus = "pending" | "approved" | "declined"

export interface QuoteChangeRequest {
  id: string
  quotation_id: string
  request_type: ChangeRequestType
  payload: {
    /** scope: items the lead wants to keep, with adjusted quantities. */
    items?: Array<{ item_id: string | null; description: string; quantity: number }>
    /** scope: optional budget the lead is signalling. */
    proposed_budget?: number | null
    /** counter_offer: the total the lead is proposing. */
    proposed_total?: number | null
  }
  client_note: string | null
  status: ChangeRequestStatus
  admin_note: string | null
  resolved_by: string | null
  resolved_at: string | null
  created_at: string
  updated_at: string
}

export function formatNgn(n: number): string {
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `₦${(n / 1_000).toFixed(0)}K`
  return `₦${n.toFixed(0)}`
}

export function formatNgnFull(n: number): string {
  return `₦${n.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export interface ComputedQuotationItem extends QuotationItemInput {
  lineTotal: number
}

export interface QuoteTotals {
  subtotal: number
  discountAmount: number
  taxAmount: number
  total: number
  items: ComputedQuotationItem[]
}

export function recalculateQuote(items: QuotationItemInput[]): QuoteTotals {
  const computed = items.map((it) => {
    const qty = Math.max(0, Number(it.quantity) || 0)
    const unit = Math.max(0, Number(it.unitPrice) || 0)
    const disc = Math.max(0, Number(it.discount) || 0)
    const rate = Math.max(0, Number(it.taxRate) || 0)
    const lineSubtotal = qty * unit
    const taxableAmount = Math.max(0, lineSubtotal - disc)
    const tax = rate > 0 ? Math.max(0, taxableAmount * rate / 100) : Math.max(0, Number(it.tax) || 0)
    const lineTotal = Math.max(0, taxableAmount + tax)
    return {
      ...it,
      quantity: qty,
      unitPrice: unit,
      discount: disc,
      taxRate: rate,
      tax: tax,
      lineTotal,
    }
  })

  const subtotal = computed.reduce((sum, it) => sum + it.quantity * it.unitPrice, 0)
  const discountAmount = computed.reduce((sum, it) => sum + it.discount, 0)
  const taxAmount = computed.reduce((sum, it) => sum + it.tax, 0)
  const total = Math.max(0, subtotal - discountAmount + taxAmount)

  return {
    subtotal,
    discountAmount,
    taxAmount,
    total,
    items: computed,
  }
}

export function buildQuotePublicUrl(token: string): string {
  const base = process.env.NEXT_PUBLIC_BASE_URL || "https://martpoint.com.ng"
  return `${base}/quote/${token}`
}

export function buildWhatsAppLink(phone: string, message: string): string {
  const normalized = phone.replace(/[^\d+]/g, "")
  const number = normalized.startsWith("+") ? normalized.replace(/\+/g, "") : `234${normalized.replace(/^0/, "")}`
  const encoded = encodeURIComponent(message)
  return `https://wa.me/${number}?text=${encoded}`
}

export function buildQuoteEmailSubject(quote: Pick<Quotation, "quote_number" | "title">): string {
  return `Quotation ${quote.quote_number}${quote.title ? ` — ${quote.title}` : ""} from MartPoint`
}

export function buildQuoteWhatsAppMessage(
  quote: Pick<Quotation, "quote_number" | "title" | "total_amount">,
  publicUrl: string
): string {
  return `Hello,\n\nPlease find your MartPoint quotation below:\n\nQuote: ${quote.quote_number}${quote.title ? `\nTitle: ${quote.title}` : ""}\nTotal: ${formatNgnFull(quote.total_amount)}\n\nView it here:\n${publicUrl}\n\nReply to this message if you have any questions.`
}

export function buildQuoteEmailHtml(
  quote: Pick<Quotation, "quote_number" | "title" | "total_amount" | "valid_until" | "notes_public">,
  lead: LeadSummary,
  publicUrl: string
): string {
  const validUntil = quote.valid_until
    ? new Date(quote.valid_until).toLocaleDateString("en-NG", { year: "numeric", month: "long", day: "numeric" })
    : "Not specified"

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>MartPoint Quotation ${quote.quote_number}</title>
</head>
<body style="margin:0;padding:0;background:#F8FAFC;font-family:Inter,system-ui,-apple-system,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F8FAFC;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #E5E7EB;">
          <tr>
            <td style="padding:32px 32px 0;">
              <h1 style="font-size:20px;font-weight:700;color:#111827;margin:0 0 8px;">Quotation ${quote.quote_number}</h1>
              <p style="color:#6B7280;font-size:14px;margin:0;">Prepared for ${lead.fullName} — ${lead.businessName}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px;">
              <p style="font-size:16px;color:#111827;font-weight:600;margin:0 0 16px;">Total: ${formatNgnFull(quote.total_amount)}</p>
              <p style="font-size:14px;color:#6B7280;margin:0 0 4px;">Valid until: ${validUntil}</p>
              ${quote.notes_public ? `<p style="font-size:14px;color:#6B7280;margin:0 0 24px;white-space:pre-line;">${quote.notes_public.replace(/</g, "&lt;")}</p>` : ""}
              <a href="${publicUrl}" style="display:inline-block;background:#0057FF;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 24px;border-radius:8px;">View Quotation</a>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 32px;">
              <p style="font-size:12px;color:#9CA3AF;margin:0;">If the button does not work, copy and paste this link into your browser:</p>
              <p style="font-size:12px;color:#0057FF;margin:4px 0 0;word-break:break-all;">${publicUrl}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()
}

export function buildQuotePublicPageDescription(quote: Pick<Quotation, "quote_number" | "title">): string {
  return `Quotation ${quote.quote_number}${quote.title ? ` — ${quote.title}` : ""} from MartPoint`
}
