"use client"

import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"
import type { Quotation, QuotationItem, LeadSummary } from "./quotations"

function formatPdfNgn(n: number): string {
  return `NGN ${n.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

async function getLogoDataUrl(logoPath: string): Promise<string | null> {
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
    const canvas = document.createElement("canvas")
    canvas.width = img.width || 200
    canvas.height = img.height || 60
    const ctx = canvas.getContext("2d")
    if (!ctx) {
      URL.revokeObjectURL(url)
      return null
    }
    ctx.drawImage(img, 0, 0)
    URL.revokeObjectURL(url)
    return canvas.toDataURL("image/png")
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
  const logoDataUrl = await getLogoDataUrl(logoUrl)
  if (logoDataUrl) {
    const logoW = 90
    const logoH = 36
    try {
      doc.addImage(logoDataUrl, "PNG", margin, y, logoW, logoH)
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
  y += 60

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
    margin: { left: margin, right: margin },
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

  const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || y + 80

  let summaryY = finalY + 20
  const summaryX = 320
  const valueX = 520

  doc.setFontSize(10)
  doc.setTextColor(107, 114, 128)
  doc.text("Subtotal:", summaryX, summaryY)
  doc.setTextColor(17, 24, 39)
  doc.text(formatPdfNgn(quote.subtotal), valueX, summaryY, { align: "right" })
  summaryY += 16

  doc.setTextColor(107, 114, 128)
  doc.text("Discount:", summaryX, summaryY)
  doc.setTextColor(17, 24, 39)
  doc.text(formatPdfNgn(quote.discount_amount), valueX, summaryY, { align: "right" })
  summaryY += 16

  doc.setTextColor(107, 114, 128)
  doc.text("Tax:", summaryX, summaryY)
  doc.setTextColor(17, 24, 39)
  doc.text(formatPdfNgn(quote.tax_amount), valueX, summaryY, { align: "right" })
  summaryY += 20

  doc.setDrawColor(229, 231, 235)
  doc.line(summaryX, summaryY - 6, valueX, summaryY - 6)

  doc.setFontSize(12)
  doc.setTextColor(0, 87, 255)
  doc.text("Total:", summaryX, summaryY)
  doc.text(formatPdfNgn(quote.total_amount), valueX, summaryY, { align: "right" })
  summaryY += 28

  if (quote.payment_terms) {
    doc.setFontSize(10)
    doc.setTextColor(107, 114, 128)
    doc.text("Payment Terms:", margin, summaryY)
    summaryY += 14
    doc.setTextColor(17, 24, 39)
    const splitTerms = doc.splitTextToSize(quote.payment_terms, 520)
    doc.text(splitTerms, margin, summaryY)
    summaryY += splitTerms.length * 12 + 8
  }

  if (accountNumber) {
    doc.setFontSize(10)
    doc.setTextColor(107, 114, 128)
    doc.text("Wire / Bank Account Number:", margin, summaryY)
    summaryY += 14
    doc.setFontSize(11)
    doc.setTextColor(17, 24, 39)
    doc.text(accountNumber, margin, summaryY)
    summaryY += 20
  }

  if (quote.notes_public) {
    doc.setFontSize(10)
    doc.setTextColor(107, 114, 128)
    doc.text("Notes:", margin, summaryY)
    summaryY += 14
    doc.setTextColor(17, 24, 39)
    const splitNotes = doc.splitTextToSize(quote.notes_public, 520)
    doc.text(splitNotes, margin, summaryY)
    summaryY += splitNotes.length * 12 + 8
  }

  // Footer note.
  const pageH = doc.internal.pageSize.getHeight()
  const footerY = pageH - 40
  doc.setDrawColor(229, 231, 235)
  doc.line(margin, footerY - 10, pageW - margin, footerY - 10)
  doc.setFontSize(9)
  doc.setTextColor(107, 114, 128)
  const footerNote =
    "Prices are quoted in Nigerian Naira (NGN). Taxes are calculated per line item. " +
    "Software licenses include standard support during business hours. " +
    "Implementation, training and customisation are scoped separately unless expressly included."
  const footerLines = doc.splitTextToSize(footerNote, pageW - margin * 2)
  doc.text(footerLines, margin, footerY)

  doc.save(`MartPoint-Quotation-${quote.quote_number}.pdf`)
}
