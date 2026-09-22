"use client"

import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"
import type { Quotation, QuotationItem, LeadSummary } from "./quotations"

function formatPdfNgn(n: number): string {
  return `NGN ${n.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// Splits free-form bank details into display lines — on existing newlines and
// before common field labels, so a single-line entry still renders line-by-line.
export function bankDetailLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .flatMap((line) =>
      line
        .replace(/\s+(?=(?:bank name|bank|account name|account number|account no|acct\.?\s*name|acct\.?\s*no|sort code|swift|iban|beneficiary)\s*:)/gi, "\n")
        .split("\n")
    )
    .map((l) => l.trim())
    .filter(Boolean)
}

async function getLogoDataUrl(logoPath: string): Promise<{ dataUrl: string; w: number; h: number } | null> {
  if (typeof window === "undefined" || typeof document === "undefined") return null
  try {
    const res = await fetch(logoPath)
    if (!res.ok) return null
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.src = url
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = (err) => reject(err)
    })

    const MAX_W = 140
    const MAX_H = 44
    const naturalW = img.naturalWidth || img.width || 200
    const naturalH = img.naturalHeight || img.height || 60
    const scale = Math.min(MAX_W / naturalW, MAX_H / naturalH, 1)
    const w = Math.max(1, Math.round(naturalW * scale))
    const h = Math.max(1, Math.round(naturalH * scale))

    const canvas = document.createElement("canvas")
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext("2d")
    if (!ctx) {
      URL.revokeObjectURL(url)
      return null
    }
    ctx.drawImage(img, 0, 0, w, h)
    URL.revokeObjectURL(url)
    return { dataUrl: canvas.toDataURL("image/png"), w, h }
  } catch (e) {
    console.error("[quotation-pdf] failed to load logo", e)
    return null
  }
}

export async function generateQuotationPdf(quote: Quotation, lead: LeadSummary, accountNumber: string = "", logoUrl: string = "/logo.webp") {
  const doc = new jsPDF({ unit: "pt", format: "a4" })
  const margin = 40
  const pageW = doc.internal.pageSize.getWidth()
  const rightCol = pageW - margin
  let y = 40

  // Header: logo on the left, company details on the right.
  const logo = await getLogoDataUrl(logoUrl)
  const logoH = logo?.h || 0
  if (logo) {
    try {
      doc.addImage(logo.dataUrl, "PNG", margin, y, logo.w, logo.h)
    } catch (e) {
      console.error("[quotation-pdf] addImage failed", e)
      doc.setFontSize(18)
      doc.setTextColor(0, 87, 255)
      doc.text("MartPoint", margin, y + 20)
    }
  } else {
    doc.setFontSize(18)
    doc.setTextColor(0, 87, 255)
    doc.text("MartPoint", margin, y + 20)
  }

  doc.setFontSize(9)
  doc.setTextColor(107, 114, 128)
  const companyLines = [
    "MartPoint",
    "hello@martpoint.com.ng",
    "+234 803 602 8069",
    "www.martpoint.com.ng",
  ]
  companyLines.forEach((line, i) => {
    doc.text(line, rightCol, y + i * 13, { align: "right" })
  })
  y += Math.max(logoH + 10, companyLines.length * 13 + 10)

  // Two-column block: client (left) and quote details (right).
  const midX = pageW / 2
  const leftY = y
  const rightY = y

  doc.setFontSize(11)
  doc.setTextColor(17, 24, 39)
  doc.text("Prepared for", margin, leftY)

  doc.setFontSize(10)
  doc.setTextColor(107, 114, 128)
  const clientLines = [
    lead.fullName,
    lead.businessName,
    lead.email,
    lead.phone,
  ].filter(Boolean)
  clientLines.forEach((line, i) => {
    doc.text(line, margin, leftY + 16 + i * 14)
  })

  doc.setFontSize(11)
  doc.setTextColor(17, 24, 39)
  doc.text("Quotation details", rightCol, rightY, { align: "right" })

  doc.setFontSize(10)
  doc.setTextColor(107, 114, 128)
  const detailLines = [
    `Quote #: ${quote.quote_number}`,
    `Date: ${new Date(quote.created_at).toLocaleDateString("en-NG")}`,
    `Valid until: ${quote.valid_until ? new Date(quote.valid_until).toLocaleDateString("en-NG") : "Not specified"}`,
    `Status: ${quote.status}`,
  ]
  detailLines.forEach((line, i) => {
    doc.text(line, rightCol, rightY + 16 + i * 14, { align: "right" })
  })

  y = Math.max(leftY + 16 + clientLines.length * 14, rightY + 16 + detailLines.length * 14) + 20

  if (quote.title) {
    doc.setFontSize(13)
    doc.setTextColor(17, 24, 39)
    doc.text(quote.title, margin, y)
    y += 24
  }

  const rows = (quote.items || []).map((item: QuotationItem) => [
    item.description,
    String(item.quantity),
    formatPdfNgn(item.unit_price),
    formatPdfNgn(item.discount),
    formatPdfNgn(item.tax),
    formatPdfNgn(item.line_total),
  ])

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin, bottom: 100 },
    head: [["Description", "Qty", "Unit", "Disc.", "Tax", "Total"]],
    body: rows,
    styles: { fontSize: 9, cellPadding: 6, overflow: "linebreak", valign: "middle" },
    headStyles: { fillColor: [0, 87, 255], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 249, 250] },
    columnStyles: {
      0: { cellWidth: "auto" },
      1: { cellWidth: 40, halign: "center" },
      2: { cellWidth: 70, halign: "right" },
      3: { cellWidth: 60, halign: "right" },
      4: { cellWidth: 60, halign: "right" },
      5: { cellWidth: 80, halign: "right", fontStyle: "bold" },
    },
  })

  const pageH = doc.internal.pageSize.getHeight()
  const pageWNum = Number(doc.internal.pageSize.getWidth())
  let finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || y + 80

  // If the table ends too low, start the summary block on a fresh page.
  const summaryMinH = 240
  if (pageH - finalY < summaryMinH) {
    doc.addPage()
    finalY = 40
  }

  // Draw the totals on the right, payment terms on the left (same band).
  const totalsX = pageWNum - margin - 180
  const totalsValueX = pageWNum - margin
  let totalsY = finalY + 20

  doc.setFontSize(10)
  doc.setTextColor(107, 114, 128)
  doc.text("Subtotal:", totalsX, totalsY)
  doc.setTextColor(17, 24, 39)
  doc.text(formatPdfNgn(quote.subtotal), totalsValueX, totalsY, { align: "right" })
  totalsY += 16

  doc.setTextColor(107, 114, 128)
  doc.text("Discount:", totalsX, totalsY)
  doc.setTextColor(17, 24, 39)
  doc.text(formatPdfNgn(quote.discount_amount), totalsValueX, totalsY, { align: "right" })
  totalsY += 16

  doc.setTextColor(107, 114, 128)
  doc.text("Tax:", totalsX, totalsY)
  doc.setTextColor(17, 24, 39)
  doc.text(formatPdfNgn(quote.tax_amount), totalsValueX, totalsY, { align: "right" })
  totalsY += 20

  doc.setDrawColor(229, 231, 235)
  doc.line(totalsX, totalsY - 6, totalsValueX, totalsY - 6)

  doc.setFontSize(12)
  doc.setTextColor(0, 87, 255)
  doc.text("Total:", totalsX, totalsY)
  doc.text(formatPdfNgn(quote.total_amount), totalsValueX, totalsY, { align: "right" })
  totalsY += 24

  // Left column is bounded by the totals column so text never overlaps it.
  const leftColW = Math.max(200, totalsX - margin - 30)

  let termsY = finalY + 20
  if (quote.payment_terms) {
    doc.setFontSize(10)
    doc.setTextColor(17, 24, 39)
    doc.text("Payment Terms", margin, termsY)
    termsY += 14
    doc.setFontSize(9)
    doc.setTextColor(17, 24, 39)
    const splitTerms = doc.splitTextToSize(quote.payment_terms, leftColW)
    doc.text(splitTerms, margin, termsY)
    termsY += splitTerms.length * 11 + 8
  }

  if (accountNumber) {
    doc.setFontSize(10)
    doc.setTextColor(107, 114, 128)
    doc.text("Bank Details", margin, termsY)
    termsY += 14
    doc.setFontSize(10)
    doc.setTextColor(17, 24, 39)
    for (const line of bankDetailLines(accountNumber)) {
      const wrapped = doc.splitTextToSize(line, leftColW)
      doc.text(wrapped, margin, termsY)
      termsY += wrapped.length * 12 + 2
    }
    termsY += 10
  }

  // Public notes sit above the footer, full width.
  let notesY = Math.max(totalsY, termsY) + 20
  if (notesY > pageH - 140) {
    doc.addPage()
    notesY = 40
  }
  if (quote.notes_public) {
    doc.setFontSize(10)
    doc.setTextColor(107, 114, 128)
    doc.text("Notes:", margin, notesY)
    notesY += 14
    doc.setTextColor(17, 24, 39)
    doc.setFontSize(9)
    const splitNotes = doc.splitTextToSize(quote.notes_public, pageWNum - margin * 2)
    doc.text(splitNotes, margin, notesY)
  }

  // Footer is drawn on every page at a fixed bottom position so it is never disturbed.
  const totalPages = (doc as unknown as { getNumberOfPages: () => number }).getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    ;(doc as unknown as { setPage: (n: number) => void }).setPage(i)
    const footerY = pageH - 40
    doc.setDrawColor(229, 231, 235)
    doc.line(margin, footerY - 10, pageWNum - margin, footerY - 10)
    doc.setFontSize(9)
    doc.setTextColor(107, 114, 128)
    const footerNote =
      "Prices are quoted in Nigerian Naira (NGN). Taxes are calculated per line item. " +
      "Software licenses include standard support during business hours. " +
      "Implementation, training and customisation are scoped separately unless expressly included."
    const footerLines = doc.splitTextToSize(footerNote, pageWNum - margin * 2)
    doc.text(footerLines, margin, footerY)
    doc.setFontSize(8)
    doc.text(`Page ${i} of ${totalPages}`, pageWNum - margin, footerY - 18, { align: "right" })
  }

  doc.save(`MartPoint-Quotation-${quote.quote_number}.pdf`)
}
