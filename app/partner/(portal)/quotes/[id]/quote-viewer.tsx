"use client"

/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Check, Download, FileText, Loader2, X } from "lucide-react"
import { generateQuotationPdf } from "@/lib/quotation-pdf"
import type { LeadSummary, Quotation } from "@/lib/quotations"
import { formatMoney } from "@/lib/money-format"

type Row = Record<string, any>

function money(value: unknown, currency = "NGN") {
  return formatMoney(Number(value || 0), currency)
}

export function PartnerQuoteViewer({ requestId, lead, quote }: { requestId: string; lead: Row; quote: Row | null }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")

  if (!quote) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
        Sales has marked this request as issued, but the Finance quote document is not linked yet. Please ask MartPoint Admin to create the Finance quote and issue it using its quote number.
      </div>
    )
  }

  const leadSummary: LeadSummary = {
    id: lead.id as string,
    fullName: (lead.contact_name as string) || "",
    businessName: (lead.business_name as string) || "",
    email: (lead.email as string) || "",
    phone: (lead.phone as string) || "",
    productInterest: (lead.interested_product as string) || "",
    businessType: (lead.business_type as string) || "",
    industry: (lead.industry as string) || "",
  }
  const quotation = {
    id: quote.id as string,
    lead_id: lead.id as string,
    quote_number: quote.quote_number as string,
    title: `MartPoint quote for ${leadSummary.businessName}`,
    status: quote.status as Quotation["status"],
    currency: (quote.currency as string) || "NGN",
    subtotal: Number(quote.subtotal) || 0,
    discount_amount: Number(quote.discount_amount) || 0,
    tax_amount: Number(quote.tax_amount) || 0,
    total_amount: Number(quote.total_amount) || 0,
    valid_until: (quote.valid_until as string | null) || null,
    notes_public: (quote.notes_public as string | null) || null,
    notes_internal: null,
    payment_terms: (quote.payment_terms as string | null) || null,
    converted_business_id: null,
    converted_invoice_id: null,
    public_token: "",
    token_expires_at: null,
    viewed_at: null,
    sent_at: null,
    created_by: null,
    created_at: quote.created_at as string,
    updated_at: quote.updated_at as string,
    allow_changes: false,
    allow_counter_offer: false,
    items: ((quote.quote_items || []) as Row[]).map((item) => ({
      id: item.id as string,
      quotation_id: quote.id as string,
      description: item.description as string,
      quantity: Number(item.quantity) || 0,
      unit_price: Number(item.unit_price) || 0,
      discount: Number(item.discount) || 0,
      tax: Number(item.tax) || 0,
      tax_rate: null,
      line_total: Number(item.line_total) || 0,
    })),
  } satisfies Quotation

  async function respond(action: "accept" | "decline") {
    setBusy(true)
    setMessage("")
    try {
      const res = await fetch(`/api/partner/quote-requests/${requestId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) setMessage(data.error || "Unable to update the quote")
      else router.refresh()
    } catch {
      setMessage("Unable to update the quote")
    } finally {
      setBusy(false)
    }
  }

  const canRespond = quote.status === "SENT"
  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-6">
      {message && <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{message}</p>}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2"><FileText className="w-5 h-5 text-retail" /><h3 className="text-lg font-semibold">{quotation.quote_number}</h3></div>
          <p className="text-sm text-muted-foreground mt-1">Prepared for {leadSummary.businessName}</p>
        </div>
        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">{quote.status as string}</span>
      </div>
      <div className="space-y-2">
        {quotation.items?.map((item) => <div key={item.id} className="flex justify-between gap-4 border-b border-border py-2 text-sm"><span>{item.description} × {item.quantity}</span><span className="font-medium">{money(item.line_total, quotation.currency)}</span></div>)}
        <div className="flex justify-between text-lg font-semibold pt-2"><span>Total</span><span className="text-retail">{money(quotation.total_amount, quotation.currency)}</span></div>
      </div>
      {quotation.valid_until && <p className="text-sm text-muted-foreground">Valid until {new Date(quotation.valid_until).toLocaleDateString("en-NG")}</p>}
      {quotation.payment_terms && <div className="rounded-md bg-muted/40 p-3 text-sm whitespace-pre-line"><p className="font-medium mb-1">Payment terms</p>{quotation.payment_terms}</div>}
      {quotation.notes_public && <p className="rounded-md bg-muted/40 p-3 text-sm whitespace-pre-line">{quotation.notes_public}</p>}
      <div className="flex flex-wrap gap-2 border-t border-border pt-4">
        <Button variant="outline" onClick={() => generateQuotationPdf(quotation, leadSummary)}><Download className="w-4 h-4 mr-2" /> Download quote PDF</Button>
        {canRespond && <>
          <Button onClick={() => respond("accept")} disabled={busy}><Check className="w-4 h-4 mr-2" /> Accept quote</Button>
          <Button variant="outline" onClick={() => respond("decline")} disabled={busy}>{busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <X className="w-4 h-4 mr-2" />} Decline</Button>
        </>}
      </div>
      {quote.status === "ACCEPTED" && <p className="text-sm text-green-700 bg-green-50 rounded-md p-3">Quote accepted. MartPoint Finance can now convert it to an invoice and issue payment instructions.</p>}
    </div>
  )
}
