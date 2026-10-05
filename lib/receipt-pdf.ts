/* ───────────────────────────  Receipt PDF  ───────────────────────────
 * Server-side receipt PDF (Node — no DOM). Attached to payment confirmation
 * emails so a client has a formal receipt for a confirmed payment.
 *
 * jsPDF's built-in fonts can't render ₦, so amounts use the currency code
 * (NGN 50,000.00) exactly like the invoice and quotation PDFs do.
 */

import { jsPDF } from "jspdf"

export interface ReceiptPdfBusiness {
  business_name?: string
  primary_contact_name?: string
  primary_email?: string
  primary_phone?: string
}

export interface ReceiptPdfData {
  receipt_number: string
  invoice_number: string
  payment_reference: string
  amount: number
  currency: string
  payment_method: string
  paid_at?: string | null
  business: ReceiptPdfBusiness
}

function fmt(n: number, currency: string): string {
  const v = Number(n) || 0
  return `${currency} ${v.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function generateReceiptPdf(rc: ReceiptPdfData): Buffer {
  const doc = new jsPDF({ unit: "pt", format: "a4" })
  const margin = 40
  const pageW = doc.internal.pageSize.getWidth()
  const rightCol = pageW - margin
  const cur = rc.currency || "NGN"
  let y = 40

  // Header: brand mark on the left, company details on the right.
  doc.setFontSize(20)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(0, 87, 255)
  doc.text("MartPoint", margin, y + 18)

  doc.setFont("helvetica", "normal")
  doc.setFontSize(9)
  doc.setTextColor(107, 114, 128)
  const companyLines = ["hello@martpoint.com.ng", "+234 803 797 8230", "www.martpoint.com.ng"]
  companyLines.forEach((line, i) => doc.text(line, rightCol, y + 6 + i * 13, { align: "right" }))
  y += 60

  // Title
  doc.setFontSize(16)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(17, 24, 39)
  doc.text("RECEIPT", margin, y)
  doc.setFontSize(10)
  doc.setTextColor(107, 114, 128)
  doc.text(rc.receipt_number, rightCol, y, { align: "right" })
  y += 28

  // Issued-to block (left) and receipt details (right).
  const blockY = y
  doc.setFontSize(11)
  doc.setTextColor(17, 24, 39)
  doc.text("Received from", margin, blockY)
  doc.setFontSize(10)
  doc.setTextColor(107, 114, 128)
  const clientLines = [
    rc.business.business_name,
    rc.business.primary_contact_name,
    rc.business.primary_email,
    rc.business.primary_phone,
  ].filter((l): l is string => !!l)
  clientLines.forEach((line, i) => doc.text(line, margin, blockY + 16 + i * 14))

  doc.setFontSize(11)
  doc.setTextColor(17, 24, 39)
  doc.text("Receipt details", rightCol, blockY, { align: "right" })
  doc.setFontSize(10)
  doc.setTextColor(107, 114, 128)
  const detailLines = [
    `Receipt #: ${rc.receipt_number}`,
    `Invoice #: ${rc.invoice_number || "—"}`,
    `Payment reference: ${rc.payment_reference}`,
  ]
  detailLines.forEach((line, i) => doc.text(line, rightCol, blockY + 16 + i * 14, { align: "right" }))

  y = Math.max(blockY + 16 + clientLines.length * 14, blockY + 16 + detailLines.length * 14) + 24

  // Payment summary card.
  const cardTop = y
  const cardW = pageW - margin * 2
  doc.setFillColor(248, 249, 250)
  doc.roundedRect(margin, cardTop, cardW, 150, 8, 8, "F")

  const row = (label: string, value: string, yy: number, opts: { bold?: boolean; blue?: boolean } = {}) => {
    doc.setFontSize(10)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(107, 114, 128)
    doc.text(label, margin + 20, yy)
    doc.setFont("helvetica", opts.bold ? "bold" : "normal")
    doc.setTextColor(opts.blue ? 0 : 17, opts.blue ? 87 : 24, opts.blue ? 255 : 39)
    doc.text(value, margin + cardW - 20, yy, { align: "right" })
  }

  let cy = cardTop + 28
  row("Payment method:", rc.payment_method.replace(/_/g, " "), cy)
  cy += 22
  row("Paid on:", rc.paid_at ? new Date(rc.paid_at).toLocaleDateString("en-NG", { year: "numeric", month: "long", day: "numeric" }) : "—", cy)
  cy += 28
  doc.setDrawColor(229, 231, 235)
  doc.line(margin + 20, cy - 8, margin + cardW - 20, cy - 8)
  row("Amount paid:", fmt(rc.amount, cur), cy, { bold: true, blue: true })

  y += 190

  // Footer note.
  const FOOTER_Y = doc.internal.pageSize.getHeight() - 60
  doc.setFontSize(9)
  doc.setTextColor(107, 114, 128)
  const note =
    "This receipt confirms payment received by MartPoint. The amount shown is as received and " +
    "allocated against the referenced invoice. Please keep this receipt for your records."
  const noteLines = doc.splitTextToSize(note, pageW - margin * 2) as string[]
  doc.text(noteLines, margin, FOOTER_Y)

  return Buffer.from(doc.output("arraybuffer"))
}
