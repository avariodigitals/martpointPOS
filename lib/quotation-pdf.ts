"use client"

import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"
import type { Quotation, QuotationItem, LeadSummary } from "./quotations"
import { formatNgnFull } from "./quotations"

export function generateQuotationPdf(quote: Quotation, lead: LeadSummary, accountNumber: string = "") {
  const doc = new jsPDF({ unit: "pt", format: "a4" })
  const margin = 40
  let y = 40

  doc.setFontSize(22)
  doc.setTextColor(0, 87, 255)
  doc.text("MartPoint", margin, y)
  y += 28

  doc.setFontSize(12)
  doc.setTextColor(17, 24, 39)
  doc.text("Quotation", margin, y)
  y += 18

  doc.setFontSize(10)
  doc.setTextColor(107, 114, 128)
  doc.text(`Quote #: ${quote.quote_number}`, margin, y)
  y += 14
  doc.text(`Date: ${new Date(quote.created_at).toLocaleDateString("en-NG")}`, margin, y)
  y += 14
  doc.text(`Valid until: ${quote.valid_until ? new Date(quote.valid_until).toLocaleDateString("en-NG") : "Not specified"}`, margin, y)
  y += 28

  doc.setFontSize(11)
  doc.setTextColor(17, 24, 39)
  doc.text("Prepared for", margin, y)
  y += 16
  doc.setFontSize(10)
  doc.setTextColor(107, 114, 128)
  doc.text(lead.fullName, margin, y)
  y += 14
  doc.text(lead.businessName, margin, y)
  y += 14
  doc.text(lead.email, margin, y)
  y += 14
  doc.text(lead.phone, margin, y)
  y += 28

  if (quote.title) {
    doc.setFontSize(11)
    doc.setTextColor(17, 24, 39)
    doc.text(quote.title, margin, y)
    y += 18
  }

  const rows = (quote.items || []).map((item: QuotationItem) => [
    item.description,
    String(item.quantity),
    formatNgnFull(item.unit_price),
    formatNgnFull(item.discount),
    formatNgnFull(item.tax),
    formatNgnFull(item.line_total),
  ])

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["Description", "Qty", "Unit", "Disc.", "Tax", "Total"]],
    body: rows,
    styles: { fontSize: 9, cellPadding: 6 },
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
  doc.text(formatNgnFull(quote.subtotal), valueX, summaryY, { align: "right" })
  summaryY += 16

  doc.setTextColor(107, 114, 128)
  doc.text("Discount:", summaryX, summaryY)
  doc.setTextColor(17, 24, 39)
  doc.text(formatNgnFull(quote.discount_amount), valueX, summaryY, { align: "right" })
  summaryY += 16

  doc.setTextColor(107, 114, 128)
  doc.text("Tax:", summaryX, summaryY)
  doc.setTextColor(17, 24, 39)
  doc.text(formatNgnFull(quote.tax_amount), valueX, summaryY, { align: "right" })
  summaryY += 20

  doc.setDrawColor(229, 231, 235)
  doc.line(summaryX, summaryY - 6, valueX, summaryY - 6)

  doc.setFontSize(12)
  doc.setTextColor(0, 87, 255)
  doc.text("Total:", summaryX, summaryY)
  doc.text(formatNgnFull(quote.total_amount), valueX, summaryY, { align: "right" })
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
  }

  doc.save(`MartPoint-Quotation-${quote.quote_number}.pdf`)
}
