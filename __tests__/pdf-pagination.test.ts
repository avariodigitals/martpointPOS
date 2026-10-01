import { describe, it, expect, vi, beforeEach } from "vitest"
import { PartnerDocBuilder } from "@/lib/partner-pdf"
import { renderDocBody, generateCreatorDocPdf } from "@/lib/creator-doc-pdf"
import { generateQuotationPdf } from "@/lib/quotation-pdf"
import type { Quotation, LeadSummary } from "@/lib/quotations"

/* ────────────────────────────────────────────────────────────────────────────
 * PDF pagination regression tests.
 *
 * Every text() draw call is recorded with its page and baseline y. Footer
 * drawing is identified by the public setPage() calls the builders make in
 * their finish/footer passes — addPage() uses jsPDF internals and does not
 * trip the flag. Asserting "no body text drawn inside the footer band or off
 * the page" catches the page-boundary cutoff bug.
 * ────────────────────────────────────────────────────────────────────────── */

const PAGE_H = 841.89 // A4 in pt
const BODY_LIMIT = PAGE_H - 62 // below this y is footer/off-page territory

const FOOTER_MARKERS = [
  "Page ", "Prices are quoted in Nigerian Naira", "TEST-001", "CREATOR-DOC",
  "MartPoint Creator Network —",
]
function isFooterText(text: string | string[]): boolean {
  const first = String(Array.isArray(text) ? text[0] ?? "" : text ?? "")
  if (/^Page \d+ of \d+$/.test(first)) return true
  return FOOTER_MARKERS.some((m) => first.startsWith(m))
}

// jsPDF assigns API methods as own-properties at construction, so spy by
// subclassing the module export — every builder gets the recording variant.
const capture = vi.hoisted(() => ({
  body: [] as { page: number; y: number }[],
  footer: [] as { page: number; y: number }[],
}))

vi.mock("jspdf", async (importOriginal) => {
  const mod = await importOriginal<typeof import("jspdf")>()
  // API methods (text/save) are assigned as own-properties per instance, so
  // wrap them in the subclass constructor — prototype overrides never fire.
  class SpyJsPDF extends mod.jsPDF {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(...args: any[]) {
      super(...args)
      const origText = this.text.bind(this)
      const internal = this.internal as unknown as {
        getCurrentPageInfo(): { pageNumber: number }
        getFontSize(): number
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.text = ((text: any, x: number, y: number, opts?: any) => {
        const page = internal.getCurrentPageInfo().pageNumber
        const lineH = internal.getFontSize() * 1.2
        const ys: number[] = Array.isArray(text)
          ? text.map((_, i) => (y as number) + i * lineH)
          : [y as number]
        const bucket = isFooterText(text) && (y as number) > PAGE_H - 62 ? capture.footer : capture.body
        ys.forEach((yy) => bucket.push({ page, y: yy }))
        return origText(text, x, y, opts)
      }) as typeof this.text
      this.save = (() => this) as unknown as typeof this.save // needs DOM — no-op in tests
    }
  }
  return { ...mod, jsPDF: SpyJsPDF, default: SpyJsPDF }
})

beforeEach(() => {
  capture.body.length = 0
  capture.footer.length = 0
})

function assertNoClippedBodyText(c: typeof capture) {
  const violations = c.body.filter((t: { page: number; y: number }) => t.y > BODY_LIMIT)
  expect(
    violations,
    `body text drawn below y=${BODY_LIMIT.toFixed(0)}pt: ${JSON.stringify(violations.slice(0, 5))}`
  ).toHaveLength(0)
}

const lead: LeadSummary = {
  id: "l1",
  fullName: "Adaeze Okonkwo",
  businessName: "Ada Stores Ltd",
  email: "ada@example.com",
  phone: "+234 800 000 0000",
  productInterest: "Retail",
}

function makeQuote(overrides: Partial<Quotation> = {}): Quotation {
  return {
    id: "q1",
    lead_id: "l1",
    quote_number: "MPQ-2026-0001",
    title: "POS + Inventory rollout",
    status: "SENT",
    currency: "NGN",
    subtotal: 1250000,
    discount_amount: 50000,
    tax_amount: 90000,
    total_amount: 1290000,
    valid_until: "2026-12-31",
    notes_public: null,
    notes_internal: null,
    payment_terms: null,
    converted_business_id: null,
    converted_invoice_id: null,
    public_token: "tok",
    token_expires_at: null,
    viewed_at: null,
    sent_at: null,
    created_by: null,
    created_at: "2026-01-15T10:00:00.000Z",
    updated_at: "2026-01-15T10:00:00.000Z",
    allow_changes: true,
    allow_counter_offer: true,
    items: [
      { id: "i1", quotation_id: "q1", description: "POS terminal deployment", quantity: 2, unit_price: 350000, discount: 0, tax: 52500, tax_rate: 7.5, line_total: 700000 },
      { id: "i2", quotation_id: "q1", description: "Inventory module licence (annual)", quantity: 1, unit_price: 250000, discount: 25000, tax: 16875, tax_rate: 7.5, line_total: 241875 },
      { id: "i3", quotation_id: "q1", description: "Staff onboarding & training", quantity: 3, unit_price: 100000, discount: 25000, tax: 20625, tax_rate: 7.5, line_total: 295625 },
    ],
    ...overrides,
  }
}

describe("quotation PDF pagination", () => {
  it("keeps long payment terms, bank details and notes inside page bounds", async () => {
    const longTerms = Array.from({ length: 40 }, (_, i) =>
      `Term ${i + 1}: Payment is due within fourteen days of invoice date and covers the scoped deliverables described above.`
    ).join(" ")
    const longNotes = Array.from({ length: 30 }, (_, i) =>
      `Note ${i + 1}: This quotation remains subject to the stated validity window and agreed scope.`
    ).join(" ")
    await generateQuotationPdf(
      makeQuote({ payment_terms: longTerms, notes_public: longNotes }),
      lead,
      "Bank Name: Test Bank Plc\nAccount Name: MartPoint Test\nAccount Number: 0123456789\n" +
        Array.from({ length: 12 }, (_, i) => `Reference ${i + 1}: REF-${i}`).join("\n")
    )
    assertNoClippedBodyText(capture)
    expect(capture.footer.length).toBeGreaterThan(0)
  })

  it("paginates long item tables without stranding the totals band", async () => {
    const many = Array.from({ length: 45 }, (_, i) => ({
      id: `i${i}`, quotation_id: "q1",
      description: `Line item ${i + 1} — implementation work package`,
      quantity: 1, unit_price: 50000, discount: 0, tax: 3750, tax_rate: 7.5, line_total: 53750,
    }))
    await generateQuotationPdf(makeQuote({ items: many }), lead, "Bank Name: Test Bank\nAccount Number: 0000000000")
    assertNoClippedBodyText(capture)
  })
})

describe("shared PartnerDocBuilder pagination", () => {
  it("flows a long document across pages without clipping text", () => {
    const b = new PartnerDocBuilder({ footerRef: "TEST-001" })
    b.title("Regression Document", "testing page breaks")
    for (let i = 0; i < 8; i++) {
      b.heading(`Section ${i + 1}`)
      b.para("Body copy for the section. ".repeat(24))
      b.listItem(`Bullet point ${i} explaining a rule. `.repeat(2))
      b.callout(`Important note ${i + 1}: `.repeat(8))
    }
    const pdf = b.finish("test.pdf")
    expect(pdf.pageCount).toBeGreaterThan(1)
    assertNoClippedBodyText(capture)
    // every page gets a footer (ref + page number)
    const pagesWithFooter = new Set(capture.footer.map((f) => f.page))
    expect(pagesWithFooter.size).toBe(pdf.pageCount)
  })
})

describe("creator document PDF", () => {
  const body = [
    "# First Section",
    "",
    "Introductory paragraph. ".repeat(20),
    "",
    "## Details",
    "- Point one about the rule",
    "- Point two about the rule",
    "1. First numbered step",
    "2. Second numbered step",
    "> Important: never fabricate MartPoint interfaces. Always use official assets.",
    "",
    "| Field | Value |",
    "|---|---|",
    "| POS | Fast checkout |",
    "| Inventory | Live stock counts |",
    "",
    "# Second Section",
    ...Array.from({ length: 30 }, (_, i) => `Filler paragraph ${i + 1}. `.repeat(15)),
  ].join("\n")

  it("renders CMS markup and paginates cleanly", () => {
    const b = new PartnerDocBuilder({ footerRef: "CREATOR-DOC" })
    b.title("MartPoint Creator Playbook", "Version v0.1")
    renderDocBody(b, body)
    const pdf = b.finish("MartPoint-Creator-Playbook.pdf")
    expect(pdf.fileName).toBe("MartPoint-Creator-Playbook.pdf")
    expect(pdf.pageCount).toBeGreaterThan(1)
    expect(pdf.bytes.byteLength).toBeGreaterThan(5000)
    assertNoClippedBodyText(capture)
  })

  it("generateCreatorDocPdf produces a branded PDF from a CMS body", () => {
    const pdf = generateCreatorDocPdf({
      title: "MartPoint Creator Quick Guide",
      version: "v0.1",
      body: "# Overview\n\nWelcome.\n\n- One\n- Two\n\n> Stay honest.",
      footerRef: "MartPoint Creator Network — test",
    })
    expect(pdf.pageCount).toBeGreaterThanOrEqual(1)
    expect(pdf.fileName).toBe("MartPoint-Creator-Quick-Guide.pdf")
    expect(capture.footer.length).toBeGreaterThan(0)
  })
})
