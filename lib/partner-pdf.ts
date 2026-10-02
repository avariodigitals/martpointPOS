import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"

/* ───────────────────────────  Shared MartPoint-styled PDF scaffold  ───────────────────────────
 * Letterhead, typography, field tables, signature blocks and footers shared by
 * every portal-generated partner document. Mirrors the visual language of the
 * Partner Agreement generator (lib/partner-agreement.ts).
 */

export const BRAND_BLUE: [number, number, number] = [0, 87, 255]
export const BRAND_COMPANY_LINES = ["MartPoint", "hello@martpoint.com.ng", "+234 803 797 8230", "www.martpoint.com.ng"]

export const NOT_APPLICABLE = "Not applicable"
export function orNA(value: string | null | undefined): string {
  const v = (value ?? "").trim()
  return v || NOT_APPLICABLE
}

export interface GeneratedPdf {
  bytes: Buffer
  fileName: string
  pageCount: number
}

interface DocLastTable {
  lastAutoTable?: { finalY: number }
}

export class PartnerDocBuilder {
  private doc: jsPDF
  private margin = 56
  private pageW: number
  private pageH: number
  private contentW: number
  private bottomLimit: number
  private y = 0
  private footerRef: string

  constructor(opts: { logoDataUrl?: string; footerRef: string }) {
    this.doc = new jsPDF({ unit: "pt", format: "a4" })
    this.pageW = this.doc.internal.pageSize.getWidth()
    this.pageH = this.doc.internal.pageSize.getHeight()
    this.contentW = this.pageW - this.margin * 2
    this.bottomLimit = this.pageH - 76
    this.y = this.margin
    this.footerRef = opts.footerRef
    this.letterhead(opts.logoDataUrl)
  }

  private ensureSpace(needed: number) {
    if (this.y + needed > this.bottomLimit) {
      this.doc.addPage()
      this.y = this.margin
    }
  }

  /** Current cursor position (pt from page top) — for tests/callers. */
  get cursorY() { return this.y }
  /** Lowest y (pt) body content may reach — keeps clear of the footer band. */
  get contentBottom() { return this.bottomLimit }

  /* Branded letterhead: logo left, company details right. */
  private letterhead(logoDataUrl?: string) {
    const { doc, margin, pageW } = this
    let logoH = 0
    if (logoDataUrl) {
      try {
        const props = doc.getImageProperties(logoDataUrl)
        const scale = Math.min(140 / props.width, 44 / props.height, 1)
        const w = Math.max(1, Math.round(props.width * scale))
        const h = Math.max(1, Math.round(props.height * scale))
        doc.addImage(logoDataUrl, "PNG", margin, this.y, w, h)
        logoH = h
      } catch {
        logoH = this.textLogo()
      }
    } else {
      logoH = this.textLogo()
    }

    doc.setFont("helvetica", "normal")
    doc.setFontSize(9)
    doc.setTextColor(107, 114, 128)
    BRAND_COMPANY_LINES.forEach((line, i) => {
      doc.text(line, pageW - margin, this.y + 9 + i * 13, { align: "right" })
    })
    this.y += Math.max(logoH, BRAND_COMPANY_LINES.length * 13) + 12

    doc.setDrawColor(...BRAND_BLUE)
    doc.setLineWidth(1.2)
    doc.line(margin, this.y, pageW - margin, this.y)
    this.y += 22
  }

  private textLogo(): number {
    this.doc.setFont("helvetica", "bold")
    this.doc.setFontSize(18)
    this.doc.setTextColor(...BRAND_BLUE)
    this.doc.text("MartPoint", this.margin, this.y + 20)
    return 30
  }

  title(text: string, subtitle?: string) {
    const { doc, pageW } = this
    doc.setFont("times", "bold")
    doc.setFontSize(17)
    doc.setTextColor(17, 24, 39)
    // Reserve room for the full title block so it never straddles a page break.
    this.ensureSpace(subtitle ? 52 : 34)
    doc.text(text, pageW / 2, this.y, { align: "center" })
    this.y += 24
    if (subtitle) {
      doc.setFont("times", "normal")
      doc.setFontSize(10)
      doc.text(subtitle, pageW / 2, this.y, { align: "center" })
      this.y += 18
    }
    this.y += 8
  }

  heading(text: string) {
    const { doc, margin, pageW } = this
    // 70pt ≈ heading + rule + first body line — prevents orphaned headings.
    this.ensureSpace(70)
    this.y += 10
    doc.setFont("times", "bold")
    doc.setFontSize(12.5)
    doc.setTextColor(...BRAND_BLUE)
    doc.text(text, margin, this.y)
    this.y += 11
    doc.setDrawColor(...BRAND_BLUE)
    doc.setLineWidth(0.8)
    doc.line(margin, this.y, pageW - margin, this.y)
    this.y += 14
  }

  subHeading(text: string) {
    const { doc, margin } = this
    this.ensureSpace(60)
    doc.setFont("times", "bold")
    doc.setFontSize(10.5)
    doc.setTextColor(17, 24, 39)
    doc.text(text, margin, this.y)
    this.y += 15
  }

  para(text: string, opts: { size?: number; gap?: number; bold?: boolean } = {}) {
    const { doc, margin } = this
    const { size = 10, gap = 8, bold = false } = opts
    doc.setFont("times", bold ? "bold" : "normal")
    doc.setFontSize(size)
    doc.setTextColor(31, 41, 55)
    const lines = doc.splitTextToSize(text, this.contentW) as string[]
    for (const line of lines) {
      this.ensureSpace(size * 1.35)
      doc.text(line, margin, this.y)
      this.y += size * 1.35
    }
    this.y += gap
  }

  /* Bulleted/numbered list item with a hanging indent — page-break safe. */
  listItem(text: string, opts: { marker?: string; size?: number; indent?: number } = {}) {
    const { doc, margin } = this
    const { marker = "•", size = 10, indent = 14 } = opts
    const lineH = size * 1.35
    doc.setFont("times", "normal")
    doc.setFontSize(size)
    doc.setTextColor(31, 41, 55)
    const textW = this.contentW - indent - 8
    const lines = doc.splitTextToSize(text, textW) as string[]
    lines.forEach((line, i) => {
      this.ensureSpace(lineH)
      if (i === 0) doc.text(marker, margin + 4, this.y)
      doc.text(line, margin + indent + 8, this.y)
      this.y += lineH
    })
    this.y += 2
  }

  /* Bordered callout/highlight box — wraps line-by-line so it can split across
   * pages instead of clipping. */
  callout(text: string, opts: { title?: string } = {}) {
    const { doc, margin } = this
    const size = 9.5
    const lineH = size * 1.4
    const padX = 10
    const padY = 8
    doc.setFont("times", "normal")
    doc.setFontSize(size)
    const innerW = this.contentW - padX * 2 - 6
    const lines: string[] = []
    if (opts.title) lines.push(...(doc.splitTextToSize(opts.title, innerW) as string[]))
    lines.push(...(doc.splitTextToSize(text, innerW) as string[]))

    this.y += 4
    const titleLines = opts.title ? (doc.splitTextToSize(opts.title, innerW) as string[]).length : 0
    lines.forEach((line, i) => {
      const isFirst = i === 0
      const isLast = i === lines.length - 1
      this.ensureSpace(lineH + (isFirst || isLast ? padY : 0))
      // Per-line background segment + left rule so a split callout still reads as one block.
      const lineTop = this.y - lineH + 2
      const top = lineTop - (isFirst ? padY : 0)
      const h = lineH + (isFirst ? padY : 0) + (isLast ? padY : 0)
      doc.setFillColor(239, 246, 255)
      doc.setDrawColor(...BRAND_BLUE)
      doc.setLineWidth(2)
      doc.rect(margin, top, this.contentW, h, "F")
      doc.line(margin, top, margin, top + h)
      doc.setFont("times", i < titleLines ? "bold" : "normal")
      doc.setFontSize(size)
      doc.setTextColor(30, 58, 138)
      doc.text(line, margin + padX, this.y)
      this.y += lineH + (isLast ? padY : 0)
    })
    this.y += 10
    doc.setTextColor(31, 41, 55)
  }

  /* Image fitted inside the printable area; moves to a new page when it does
   * not fit rather than overflowing the footer zone. */
  image(dataUrl: string, opts: { maxHeight?: number; caption?: string } = {}) {
    const { doc, margin } = this
    const maxH = Math.min(opts.maxHeight ?? 320, this.bottomLimit - this.margin)
    const props = doc.getImageProperties(dataUrl)
    const scale = Math.min(this.contentW / props.width, maxH / props.height, 1)
    const w = props.width * scale
    const h = props.height * scale
    const captionH = opts.caption ? 16 : 0
    this.ensureSpace(h + captionH + 6)
    doc.addImage(dataUrl, "PNG", margin, this.y, w, h)
    this.y += h
    if (opts.caption) {
      doc.setFont("times", "italic")
      doc.setFontSize(8.5)
      doc.setTextColor(107, 114, 128)
      doc.text(opts.caption, margin, this.y + 11)
      this.y += captionH
    }
    this.y += 6
    doc.setTextColor(31, 41, 55)
  }

  /* Label/value field table (used for control fields and record details). */
  fieldTable(rows: [string, string][], head: [string, string] = ["Field", "Value"]) {
    this.ensureSpace(70)
    autoTable(this.doc, {
      startY: this.y,
      margin: { left: this.margin, right: this.margin, bottom: 76 },
      head: [head],
      body: rows,
      styles: { font: "times", fontSize: 9.5, cellPadding: 5, overflow: "linebreak", valign: "top", textColor: [31, 41, 55] },
      headStyles: { fillColor: BRAND_BLUE, textColor: 255, fontStyle: "bold", font: "times" },
      alternateRowStyles: { fillColor: [248, 249, 250] },
      columnStyles: { 0: { cellWidth: 170, fontStyle: "bold" }, 1: { cellWidth: "auto" } },
    })
    this.y = ((this.doc as unknown as DocLastTable).lastAutoTable?.finalY || this.y) + 14
  }

  /* Generic multi-column table (line items, milestone rows, ...). */
  table(
    head: string[],
    rows: string[][],
    columnStyles?: Record<number, { cellWidth?: number | "auto"; fontStyle?: "normal" | "bold" | "italic" | "bolditalic" }>
  ) {
    this.ensureSpace(70)
    autoTable(this.doc, {
      startY: this.y,
      margin: { left: this.margin, right: this.margin, bottom: 76 },
      head: [head],
      body: rows,
      styles: { font: "times", fontSize: 9, cellPadding: 5, overflow: "linebreak", valign: "top", textColor: [31, 41, 55] },
      headStyles: { fillColor: BRAND_BLUE, textColor: 255, fontStyle: "bold", font: "times" },
      alternateRowStyles: { fillColor: [248, 249, 250] },
      ...(columnStyles ? { columnStyles } : {}),
    })
    this.y = ((this.doc as unknown as DocLastTable).lastAutoTable?.finalY || this.y) + 14
  }

  /* Signature/authorisation table for named signatories. */
  signatureTable(signatories: { side: string; name: string; title: string; email: string }[]) {
    const cols = Math.min(Math.max(signatories.length, 1), 3)
    const head = [signatories.map((s) => `For ${s.side}`)]
    const rowFor = (key: "name" | "title" | "email", label: string) =>
      signatories.map((s) => `${label}: ${orNA(s[key])}`)
    this.ensureSpace(70)
    autoTable(this.doc, {
      startY: this.y,
      margin: { left: this.margin, right: this.margin, bottom: 76 },
      head,
      body: [
        rowFor("name", "Name"),
        rowFor("title", "Title"),
        signatories.map(() => "Signature: ______________________________"),
        signatories.map(() => "Date: ______________________________"),
        rowFor("email", "Email"),
      ],
      styles: { font: "times", fontSize: 10, cellPadding: 8, overflow: "linebreak", valign: "top", textColor: [31, 41, 55] },
      headStyles: { fillColor: BRAND_BLUE, textColor: 255, fontStyle: "bold", font: "times" },
      columnStyles: Object.fromEntries(Array.from({ length: cols }, (_, i) => [i, { cellWidth: this.contentW / cols }])),
    })
    this.y = ((this.doc as unknown as DocLastTable).lastAutoTable?.finalY || this.y) + 16
  }

  finish(fileName: string): GeneratedPdf {
    const doc = this.doc
    const totalPages = (doc as unknown as { getNumberOfPages: () => number }).getNumberOfPages()
    for (let i = 1; i <= totalPages; i++) {
      ;(doc as unknown as { setPage: (n: number) => void }).setPage(i)
      const footerY = this.pageH - 34
      doc.setDrawColor(229, 231, 235)
      doc.setLineWidth(0.5)
      doc.line(this.margin, footerY - 8, this.pageW - this.margin, footerY - 8)
      doc.setFont("times", "normal")
      doc.setFontSize(8.5)
      doc.setTextColor(107, 114, 128)
      doc.text(this.footerRef, this.margin, footerY)
      doc.text(`Page ${i} of ${totalPages}`, this.pageW - this.margin, footerY, { align: "right" })
    }
    return {
      bytes: Buffer.from(doc.output("arraybuffer")),
      fileName,
      pageCount: totalPages,
    }
  }
}
