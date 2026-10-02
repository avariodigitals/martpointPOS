/* ───────────────────────────  Invoice PDF  ───────────────────────────
 * Server-side invoice PDF (Node — no DOM). Mirrors the visual structure of
 * the client-side quotation PDF but returns a Buffer so it can be attached
 * to outbound invoice/reminder emails or streamed to the admin for download.
 *
 * jsPDF's built-in fonts can't render ₦, so amounts use the currency code
 * (NGN 50,000.00) like the quotation PDF does.
 */

import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"

export interface InvoicePdfItem {
  description: string
  quantity: number
  unit_price: number
  discount: number
  tax: number
  line_total: number
}

export interface InvoicePdfBusiness {
  business_name?: string
  primary_contact_name?: string
  primary_email?: string
  primary_phone?: string
}

export interface InvoicePdfData {
  invoice_number: string
  currency: string
  issue_date: string
  due_date: string
  status: string
  subtotal: number
  discount_amount: number
  tax_amount: number
  total_amount: number
  amount_paid: number
  balance_due: number
  notes_public?: string | null
  items: InvoicePdfItem[]
  business: InvoicePdfBusiness
}

function fmt(n: number, currency: string): string {
  const v = Number(n) || 0
  return `${currency} ${v.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function generateInvoicePdf(inv: InvoicePdfData): Buffer {
  const doc = new jsPDF({ unit: "pt", format: "a4" })
  const margin = 40
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const rightCol = pageW - margin
  const cur = inv.currency || "NGN"
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
  doc.text("INVOICE", margin, y)
  doc.setFontSize(10)
  doc.setTextColor(107, 114, 128)
  doc.text(inv.status.replace(/_/g, " "), rightCol, y, { align: "right" })
  y += 28

  // Two-column block: billed-to (left) and invoice details (right).
  const blockY = y
  doc.setFontSize(11)
  doc.setTextColor(17, 24, 39)
  doc.text("Billed to", margin, blockY)
  doc.setFontSize(10)
  doc.setTextColor(107, 114, 128)
  const clientLines = [
    inv.business.business_name,
    inv.business.primary_contact_name,
    inv.business.primary_email,
    inv.business.primary_phone,
  ].filter((l): l is string => !!l)
  clientLines.forEach((line, i) => doc.text(line, margin, blockY + 16 + i * 14))

  doc.setFontSize(11)
  doc.setTextColor(17, 24, 39)
  doc.text("Invoice details", rightCol, blockY, { align: "right" })
  doc.setFontSize(10)
  doc.setTextColor(107, 114, 128)
  const detailLines = [
    `Invoice #: ${inv.invoice_number}`,
    `Issued: ${inv.issue_date}`,
    `Due: ${inv.due_date}`,
  ]
  detailLines.forEach((line, i) => doc.text(line, rightCol, blockY + 16 + i * 14, { align: "right" }))

  y = Math.max(blockY + 16 + clientLines.length * 14, blockY + 16 + detailLines.length * 14) + 20

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin, bottom: 80 },
    head: [["Description", "Qty", "Unit Price", "Disc.", "Tax", "Total"]],
    body: inv.items.map((it) => [
      it.description,
      String(it.quantity),
      fmt(it.unit_price, cur),
      fmt(it.discount, cur),
      fmt(it.tax, cur),
      fmt(it.line_total, cur),
    ]),
    styles: { fontSize: 9, cellPadding: 6, overflow: "linebreak", valign: "middle" },
    headStyles: { fillColor: [0, 87, 255], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 249, 250] },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { cellWidth: 40, halign: "center" },
      2: { cellWidth: 75, halign: "right" },
      3: { cellWidth: 60, halign: "right" },
      4: { cellWidth: 60, halign: "right" },
      5: { cellWidth: 80, halign: "right", fontStyle: "bold" },
    },
  })

  const FOOTER_TOP = pageH - 80
  let finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || y + 80
  if (finalY + 200 > FOOTER_TOP) {
    doc.addPage()
    finalY = 50
  }

  // Totals block (right column).
  const totalsX = pageW - margin - 190
  const totalsValueX = pageW - margin
  let totalsY = finalY + 20
  const totalRow = (label: string, value: string, opts: { bold?: boolean; blue?: boolean; gap?: number } = {}) => {
    doc.setFontSize(opts.bold ? 12 : 10)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(107, 114, 128)
    doc.text(label, totalsX, totalsY)
    doc.setFont("helvetica", "bold")
    if (opts.blue) doc.setTextColor(0, 87, 255)
    else doc.setTextColor(17, 24, 39)
    doc.text(value, totalsValueX, totalsY, { align: "right" })
    totalsY += opts.gap ?? 16
    doc.setFont("helvetica", "normal")
  }

  totalRow("Subtotal:", fmt(inv.subtotal, cur))
  totalRow("Discount:", fmt(inv.discount_amount, cur))
  totalRow("Tax:", fmt(inv.tax_amount, cur), { gap: 20 })
  doc.setDrawColor(229, 231, 235)
  doc.line(totalsX, totalsY - 6, totalsValueX, totalsY - 6)
  totalRow("Total:", fmt(inv.total_amount, cur), { bold: true, blue: true, gap: 20 })
  totalRow("Paid:", fmt(inv.amount_paid, cur))
  doc.setDrawColor(229, 231, 235)
  doc.line(totalsX, totalsY - 6, totalsValueX, totalsY - 6)
  totalRow("Balance due:", fmt(inv.balance_due, cur), { bold: true, blue: true })

  // Payment instructions + notes (left column, page-break aware).
  let bandY = finalY + 20
  let bandW = Math.max(200, totalsX - margin - 30)
  const startNewPage = () => {
    doc.addPage()
    bandY = 50
    bandW = pageW - margin * 2
  }
  const writeBand = (text: string, size = 9, bold = false) => {
    const lineH = size * 1.35
    doc.setFontSize(size)
    doc.setFont("helvetica", bold ? "bold" : "normal")
    doc.setTextColor(17, 24, 39)
    for (const line of doc.splitTextToSize(text, bandW) as string[]) {
      if (bandY + lineH > FOOTER_TOP) startNewPage()
      doc.text(line, margin, bandY)
      bandY += lineH
    }
    bandY += 6
  }

  writeBand("Payment", 10, true)
  writeBand(`Please pay by bank transfer quoting invoice ${inv.invoice_number} as the payment reference, and send proof of payment in reply to the invoice email.`)
  if (inv.notes_public) {
    writeBand("Notes", 10, true)
    writeBand(inv.notes_public)
  }

  // Footer on every page.
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    const footerY = pageH - 36
    doc.setDrawColor(229, 231, 235)
    doc.line(margin, footerY - 10, pageW - margin, footerY - 10)
    doc.setFontSize(8)
    doc.setTextColor(107, 114, 128)
    doc.text("MartPoint · hello@martpoint.com.ng · www.martpoint.com.ng", margin, footerY)
    doc.text(`Page ${i} of ${totalPages}`, pageW - margin, footerY, { align: "right" })
  }

  return Buffer.from(doc.output("arraybuffer"))
}
