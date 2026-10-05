import { resolveIndustryName } from "./industries"

export interface LeadSummary {
  id: string
  fullName: string
  businessName: string
  email: string
  phone: string
  productInterest: string
  businessType?: string
  industry?: string
}

export interface QuotationItemInput {
  id?: string
  description: string
  quantity: number
  unitPrice: number
  discount?: number
  /** Fixed tax amount — only used when taxRate is null/undefined. */
  tax?: number
  /** Percentage rate. `null`/undefined = fixed `tax` amount; `0` = no tax. */
  taxRate?: number | null
  lineTotal?: number
}

export type QuoteDiscountType = "none" | "percent" | "fixed"

export interface QuoteDiscountInput {
  type?: QuoteDiscountType | string | null
  value?: number | null
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
  /** Canonical industry name (from lib/industries.ts) used for reporting and templates. */
  industry?: string | null
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
  discount_type?: string | null
  discount_value?: number | null
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

/** Map of common currency symbols to their ISO 4217 codes.
 *  Used to sanitise free-text fields before PDF rendering, because jsPDF's
 *  standard fonts do not support these Unicode characters. */
const CURRENCY_SYMBOL_MAP: Record<string, string> = {
  "\u20A6": "NGN", // ₦ Naira
  "\u0024": "USD", // $ Dollar
  "\u20AC": "EUR", // € Euro
  "\u00A3": "GBP", // £ Pound
  "\u00A5": "JPY", // ¥ Yen
  "\u20B5": "GHS", // ₵ Cedi
  "\u20A9": "KRW", // ₩ Won
  "\u20AA": "ILS", // ₪ Shekel
  "\u20B1": "PHP", // ₱ Peso
  "\u20B9": "INR", // ₹ Rupee
  "\u20BD": "RUB", // ₽ Ruble
  "\u20B4": "UAH", // ₴ Hryvnia
  "\u20B8": "KZT", // ₸ Tenge
  "\u20BA": "TRY", // ₺ Lira
  "\u20AB": "VND", // ₫ Dong
  "\u0E3F": "THB", // ฿ Baht
  "\u20B2": "PYG", // ₲ Guarani
  "\u20A1": "CRC", // ₡ Colón
  "\u20AD": "LAK", // ₭ Kip
  "\u20AE": "MNT", // ₮ Tugrik
  "KSh": "KES", // Kenyan Shilling (text)
  "TSh": "TZS", // Tanzanian Shilling (text)
  "USh": "UGX", // Ugandan Shilling (text)
}

/** Replace common currency symbols with their ISO 4217 codes.
 *  jsPDF's built-in fonts only support Windows-1252 / Latin-1, so Unicode
 *  currency characters like ₦ (U+20A6) cause text-layout corruption.
 *  Use this before rendering free-text fields that may contain them. */
export function replaceCurrencySymbols(text: string): string {
  let result = text
  // Replace multi-character text symbols first.
  result = result.replaceAll("KSh", "KES")
  result = result.replaceAll("TSh", "TZS")
  result = result.replaceAll("USh", "UGX")
  // Then replace single Unicode currency characters.
  const singleChars = ["\u20A6", "\u0024", "\u20AC", "\u00A3", "\u00A5",
    "\u20B5", "\u20A9", "\u20AA", "\u20B1", "\u20B9", "\u20BD", "\u20B4",
    "\u20B8", "\u20BA", "\u20AB", "\u0E3F", "\u20B2", "\u20A1", "\u20AD",
    "\u20AE"]
  for (const ch of singleChars) {
    if (ch in CURRENCY_SYMBOL_MAP) {
      result = result.replaceAll(ch, CURRENCY_SYMBOL_MAP[ch])
    }
  }
  return result
}

export interface ComputedQuotationItem extends QuotationItemInput {
  lineTotal: number
}

export interface QuoteTotals {
  subtotal: number
  /** Line-item discounts plus the quote-level discount. */
  discountAmount: number
  lineDiscountAmount: number
  quoteDiscountAmount: number
  taxAmount: number
  total: number
  items: ComputedQuotationItem[]
}

export function recalculateQuote(items: QuotationItemInput[], quoteDiscount?: QuoteDiscountInput | null): QuoteTotals {
  const computed = items.map((it) => {
    const qty = Math.max(0, Number(it.quantity) || 0)
    const unit = Math.max(0, Number(it.unitPrice) || 0)
    const lineSubtotal = qty * unit
    const disc = Math.min(lineSubtotal, Math.max(0, Number(it.discount) || 0))
    // taxRate semantics: a number (including 0 = "No tax") drives a percentage of
    // the discounted line amount; null/undefined means `tax` is a fixed amount.
    const rate = it.taxRate == null ? null : Math.max(0, Number(it.taxRate) || 0)
    const taxableAmount = lineSubtotal - disc
    const tax = rate == null ? Math.max(0, Number(it.tax) || 0) : Math.max(0, taxableAmount * rate / 100)
    const lineTotal = Math.max(0, taxableAmount + tax)
    return {
      ...it,
      quantity: qty,
      unitPrice: unit,
      discount: disc,
      taxRate: rate,
      tax,
      lineTotal,
    }
  })

  const subtotal = computed.reduce((sum, it) => sum + it.quantity * it.unitPrice, 0)
  const lineDiscountAmount = computed.reduce((sum, it) => sum + (it.discount || 0), 0)
  const net = Math.max(0, subtotal - lineDiscountAmount)

  const qdType = quoteDiscount?.type === "percent" || quoteDiscount?.type === "fixed" ? quoteDiscount.type : "none"
  const qdValue = Math.max(0, Number(quoteDiscount?.value) || 0)
  const quoteDiscountAmount =
    qdType === "percent" ? net * Math.min(100, qdValue) / 100 :
    qdType === "fixed" ? Math.min(net, qdValue) : 0

  // A quote-level discount reduces each rate-based line's taxable base
  // proportionally, so tax is charged on the discounted price. Fixed-amount
  // tax lines (taxRate null) keep their tax unchanged.
  const share = net > 0 ? quoteDiscountAmount / net : 0
  if (share > 0) {
    for (const it of computed) {
      if (it.taxRate == null) continue
      const lineNet = Math.max(0, it.quantity * it.unitPrice - (it.discount || 0))
      const effTaxable = lineNet * (1 - share)
      it.tax = Math.max(0, effTaxable * (it.taxRate || 0) / 100)
      it.lineTotal = Math.max(0, effTaxable + it.tax)
    }
  }

  const taxAmount = computed.reduce((sum, it) => sum + (it.tax || 0), 0)
  const discountAmount = lineDiscountAmount + quoteDiscountAmount
  const total = Math.max(0, net - quoteDiscountAmount + taxAmount)

  return {
    subtotal,
    discountAmount,
    lineDiscountAmount,
    quoteDiscountAmount,
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

/** Map a lead_quotations row (with lead + items joins) to the shared Quotation shape. */
export function mapQuotation(row: Record<string, unknown>): Quotation {
  const leadRawMaybe = row.lead as Record<string, unknown> | Record<string, unknown>[] | undefined
  const leadRaw = Array.isArray(leadRawMaybe) ? leadRawMaybe[0] : leadRawMaybe
  const itemsRaw = Array.isArray(row.items) ? (row.items as unknown as Record<string, unknown>[]) : []

  return {
    id: row.id as string,
    lead_id: row.lead_id as string,
    quote_number: row.quote_number as string,
    title: (row.title as string) || "",
    status: row.status as Quotation["status"],
    currency: (row.currency as string) || "NGN",
    subtotal: Number(row.subtotal) || 0,
    discount_amount: Number(row.discount_amount) || 0,
    discount_type: (row.discount_type as string) || "none",
    discount_value: Number(row.discount_value) || 0,
    tax_amount: Number(row.tax_amount) || 0,
    total_amount: Number(row.total_amount) || 0,
    valid_until: (row.valid_until as string | null) || null,
    notes_public: (row.notes_public as string | null) || null,
    notes_internal: (row.notes_internal as string | null) || null,
    payment_terms: (row.payment_terms as string | null) || null,
    // Resolved so a legacy stored value still reads as the exact industry.
    industry: resolveIndustryName((row.industry as string) || "") || null,
    converted_business_id: (row.converted_business_id as string | null) || null,
    converted_invoice_id: (row.converted_invoice_id as string | null) || null,
    public_token: row.public_token as string,
    token_expires_at: (row.token_expires_at as string | null) || null,
    viewed_at: (row.viewed_at as string | null) || null,
    sent_at: (row.sent_at as string | null) || null,
    created_by: (row.created_by as string | null) || null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    allow_changes: Boolean(row.allow_changes),
    allow_counter_offer: Boolean(row.allow_counter_offer),
    lead: leadRaw
      ? {
          id: row.lead_id as string,
          fullName: leadRaw.full_name as string,
          businessName: leadRaw.business_name as string,
          email: leadRaw.email as string,
          phone: leadRaw.phone as string,
          productInterest: leadRaw.product_interest as string,
          businessType: (leadRaw.business_type as string) || undefined,
          industry:
            resolveIndustryName(
              (leadRaw.industry as string) || (leadRaw.business_type as string) || ""
            ) || undefined,
        }
      : undefined,
    items: itemsRaw.map((it) => ({
      id: it.id as string,
      quotation_id: it.quotation_id as string,
      description: it.description as string,
      quantity: Number(it.quantity) || 0,
      unit_price: Number(it.unit_price) || 0,
      discount: Number(it.discount) || 0,
      tax: Number(it.tax) || 0,
      tax_rate: it.tax_rate != null ? Number(it.tax_rate) : null,
      line_total: Number(it.line_total) || 0,
    })) as QuotationItem[],
  }
}
