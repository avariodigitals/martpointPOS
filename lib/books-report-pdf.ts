/* ───────────────────────────  Books review report PDF  ───────────────────────────
 * Server-side (Node, no DOM) investor-grade render of a stored books_reviews row:
 * deterministic findings + metrics tables, then the AI narrative sections.
 * Same jsPDF constraint as invoice-pdf: built-in fonts can't render ₦, so
 * amounts use "NGN 50,000.00".
 */

import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"
import type { BooksMetrics, Finding } from "./books-checks"
import type { BooksNarrative } from "./books-review"

export interface BooksReviewReportData {
  created_at: string
  months: number
  status: string
  model?: string | null
  health_score?: number | null
  verdict?: string | null
  metrics?: BooksMetrics | null
  findings?: Finding[] | null
  narrative?: BooksNarrative | null
}

const MARGIN = 40

function ngn(n: number | undefined | null): string {
  const v = Number(n) || 0
  return `NGN ${v.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function generateBooksReviewPdf(report: BooksReviewReportData): Buffer {
  const doc = new jsPDF({ unit: "pt", format: "a4" })
  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const contentW = pageW - MARGIN * 2
  let y = 0

  const ensureSpace = (needed: number) => {
    if (y + needed > pageH - 30) {
      doc.addPage()
      y = MARGIN
    }
  }

  const heading = (text: string) => {
    ensureSpace(30)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(12)
    doc.setTextColor(20, 30, 60)
    doc.text(text.toUpperCase(), MARGIN, y)
    y += 6
    doc.setDrawColor(20, 30, 60)
    doc.line(MARGIN, y, MARGIN + 60, y)
    y += 12
  }

  const paragraph = (text: string) => {
    doc.setFont("helvetica", "normal")
    doc.setFontSize(10)
    doc.setTextColor(40, 40, 40)
    const lines = doc.splitTextToSize(text || "-", contentW)
    for (const line of lines) {
      ensureSpace(14)
      doc.text(line, MARGIN, y)
      y += 13
    }
    y += 6
  }

  const bullets = (items: string[]) => {
    doc.setFont("helvetica", "normal")
    doc.setFontSize(10)
    doc.setTextColor(40, 40, 40)
    for (const item of items) {
      const lines = doc.splitTextToSize(`•  ${item}`, contentW - 8)
      for (let i = 0; i < lines.length; i++) {
        ensureSpace(14)
        doc.text(lines[i], MARGIN + (i === 0 ? 0 : 12), y)
        y += 13
      }
    }
    y += 6
  }

  const lastTableEnd = () => {
    const sim = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
    if (sim?.finalY) y = sim.finalY + 20
  }

  // ── Title block ──
  y = MARGIN + 10
  doc.setFont("helvetica", "bold")
  doc.setFontSize(20)
  doc.setTextColor(15, 23, 42)
  doc.text("MartPoint — Books Review", MARGIN, y)
  y += 18
  doc.setFont("helvetica", "normal")
  doc.setFontSize(10)
  doc.setTextColor(90, 90, 90)
  const periodLabel = report.metrics?.period_start ? `Period from ${report.metrics.period_start}` : `Last ${report.months} months`
  doc.text(
    `${periodLabel}  ·  Generated ${new Date(report.created_at).toLocaleString("en-NG")}  ·  Internal — not tax or legal advice`,
    MARGIN,
    y,
  )
  y += 24

  if (report.status !== "COMPLETED") {
    paragraph(`This review run did not complete (status: ${report.status}). No report content is available.`)
    return Buffer.from(doc.output("arraybuffer"))
  }

  // ── Verdict banner ──
  const score = Number(report.health_score ?? 0)
  const verdict = report.verdict || "—"
  doc.setFillColor(score >= 80 ? 220 : score >= 60 ? 250 : 254, score >= 80 ? 231 : score >= 60 ? 240 : 226, score >= 80 ? 222 : score >= 60 ? 212 : 212)
  doc.roundedRect(MARGIN, y - 14, contentW, 44, 6, 6, "F")
  doc.setFont("helvetica", "bold")
  doc.setFontSize(14)
  doc.setTextColor(30, 30, 30)
  doc.text(`Health score ${score}/100  —  ${verdict}`, MARGIN + 14, y + 10)
  y += 48

  const m = report.metrics
  if (m) {
    heading("Key figures")
    autoTable(doc, {
      startY: y,
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 5 },
      head: [["Measure", "Value", "Measure", "Value"]],
      body: [
        ["Revenue invoiced", ngn(m.revenue_invoiced), "Cash collected", ngn(m.cash_collected)],
        ["Expenses (journal)", ngn(m.expenses_total), "Net result", ngn(m.net_result)],
        ["Gross cash / bank", ngn(m.gross_cash), "Receivables owed", ngn(m.receivables_owed)],
        ["VAT payable balance", ngn(m.vat_payable_balance), "Avg monthly net (last 3)", ngn(m.avg_monthly_net)],
        [
          "Runway",
          m.runway_months != null ? `${m.runway_months} months` : "n/a (not burning)",
          "Overdue invoices",
          `${m.overdue_invoices.count} (${ngn(m.overdue_invoices.amount)})`,
        ],
        [
          "Invoices in period",
          String(m.volumes.invoices),
          "Journal entries",
          String(m.volumes.journal_entries),
        ],
      ],
      margin: { left: MARGIN, right: MARGIN },
    })
    lastTableEnd()

    if (m.monthly?.length) {
      heading("Monthly revenue vs expenses (from the journal)")
      autoTable(doc, {
        startY: y,
        theme: "striped",
        styles: { fontSize: 9, cellPadding: 4 },
        head: [["Month", "Revenue", "Expenses", "Net"]],
        body: m.monthly.map((r) => [r.month, ngn(r.revenue), ngn(r.expenses), ngn(r.revenue - r.expenses)]),
        margin: { left: MARGIN, right: MARGIN },
      })
      lastTableEnd()
    }

    if (m.expense_by_category?.length) {
      heading("Top expense categories (finance transactions)")
      autoTable(doc, {
        startY: y,
        theme: "striped",
        styles: { fontSize: 9, cellPadding: 4 },
        head: [["Category", "Amount", "Share of listed spend"]],
        body: (() => {
          const total = m.expense_by_category.reduce((s, e) => s + e.amount, 0) || 1
          return m.expense_by_category.map((e) => [e.category, ngn(e.amount), `${Math.round((e.amount / total) * 100)}%`])
        })(),
        margin: { left: MARGIN, right: MARGIN },
      })
      lastTableEnd()
    }

    if (m.top_customers?.length) {
      heading("Customer concentration (share of invoiced revenue)")
      autoTable(doc, {
        startY: y,
        theme: "striped",
        styles: { fontSize: 9, cellPadding: 4 },
        head: [["Customer", "Invoiced", "Share"]],
        body: m.top_customers.map((c) => [c.name, ngn(c.amount), `${c.share}%`]),
        margin: { left: MARGIN, right: MARGIN },
      })
      lastTableEnd()
    }
  }

  heading("Automated integrity findings")
  const findings = report.findings || []
  if (findings.length === 0) {
    paragraph("None — all automated integrity checks passed for this period (balanced journal, ledger coverage, VAT plausibility, duplicate-payment screen, cash sign, receivables reconciliation).")
  } else {
    autoTable(doc, {
      startY: y,
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 5 },
      head: [["Severity", "Check", "Detail"]],
      body: findings.map((f) => [f.severity.toUpperCase(), f.title, f.detail]),
      margin: { left: MARGIN, right: MARGIN },
    })
    lastTableEnd()
  }

  const n = report.narrative
  if (n) {
    heading("Executive summary")
    paragraph(n.executive_summary)

    heading("Sustainability of the business")
    paragraph(n.sustainability)

    heading("Compliance posture")
    bullets(n.compliance_posture)

    if (n.red_flags.length > 0) {
      heading("Red flags")
      bullets(n.red_flags)
    }

    heading("Cash & runway")
    paragraph(n.cash_and_runway)

    heading("Revenue quality")
    paragraph(n.revenue_quality)

    heading("Recommended actions")
    bullets(n.recommended_actions)

    heading("Investor readiness")
    paragraph(n.investor_readiness)
  }

  // Footer on every page
  const pageCount = doc.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(8)
    doc.setTextColor(150, 150, 150)
    doc.text(
      `MartPoint internal books review${report.model ? ` · model ${report.model}` : ""} · figures computed from the ledger, narrative AI-assisted · page ${i} of ${pageCount}`,
      MARGIN,
      pageH - 18,
    )
  }

  return Buffer.from(doc.output("arraybuffer"))
}
