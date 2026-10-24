import { beforeEach, describe, expect, it, vi } from "vitest"
import { reopenPartnerQuoteForRevision } from "@/lib/partner-quote-revision"

const mocks = vi.hoisted(() => ({ from: vi.fn(), audit: vi.fn(), notify: vi.fn() }))
vi.mock("@/lib/supabase", () => ({ supabase: { from: mocks.from } }))
vi.mock("@/lib/finance-commercial", () => ({ logFinanceAudit: mocks.audit }))
vi.mock("@/lib/partner-notifications", () => ({ notifyPartnerCustomerEvent: mocks.notify }))

function query(data: unknown, error: { message: string } | null = null) {
  const result = { data, error }
  const builder = {
    select: vi.fn(), eq: vi.fn(), update: vi.fn(), limit: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue(result),
    then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
  }
  for (const fn of [builder.select, builder.eq, builder.update, builder.limit]) fn.mockReturnValue(builder)
  return builder
}

const issued = {
  id: "quote-1", quote_number: "MPQ-2026-00005", status: "SENT", partner_id: "partner-1", partner_lead_id: "lead-1",
  updated_at: "2026-10-24T12:00:00Z", payment_terms: "Annual upfront", bank_details: "Existing account",
  quote_items: [{ description: "Subscription", quantity: 1, unit_price: 137498.93 }],
}

beforeEach(() => { vi.resetAllMocks(); mocks.audit.mockResolvedValue(undefined); mocks.notify.mockResolvedValue(undefined) })

describe("issued partner quote revision", () => {
  it("reopens the same quote, retains lines and terms, saves the old document and notifies the partner", async () => {
    const changed = query({ ...issued, status: "DRAFT" })
    const requestUpdate = query(null)
    for (const q of [query(issued), query(null), query({ id: "request-1" }), changed, requestUpdate]) mocks.from.mockReturnValueOnce(q)
    const result = await reopenPartnerQuoteForRevision(issued.id, "admin-1")
    expect(result).toMatchObject({ ok: true, quote: { id: issued.id, status: "DRAFT", payment_terms: issued.payment_terms, bank_details: issued.bank_details, quote_items: issued.quote_items } })
    expect(changed.eq).toHaveBeenCalledWith("status", "SENT")
    expect(changed.eq).toHaveBeenCalledWith("updated_at", issued.updated_at)
    expect(requestUpdate.update).toHaveBeenCalledWith(expect.objectContaining({ status: "UNDER_REVIEW" }))
    expect(mocks.audit).toHaveBeenCalledWith("ADMIN", "admin-1", "QUOTE_UPDATED", "QUOTE", issued.id, expect.objectContaining({ previous_quote: issued }))
    expect(mocks.notify).toHaveBeenCalledWith("partner-1", expect.objectContaining({ link: "/partner/quotes/request-1" }))
  })

  it.each(["ACCEPTED", "CONVERTED", "DECLINED", "DRAFT"])("does not reopen a %s quote", async (status) => {
    mocks.from.mockReturnValueOnce(query({ ...issued, status }))
    expect(await reopenPartnerQuoteForRevision(issued.id, "admin-1")).toMatchObject({ ok: false, status: 409 })
    expect(mocks.from).toHaveBeenCalledTimes(1)
    expect(mocks.notify).not.toHaveBeenCalled()
  })

  it("refuses a quote already linked to an invoice", async () => {
    mocks.from.mockReturnValueOnce(query(issued)).mockReturnValueOnce(query({ id: "invoice-1" }))
    expect(await reopenPartnerQuoteForRevision(issued.id, "admin-1")).toMatchObject({ ok: false, status: 409 })
    expect(mocks.audit).not.toHaveBeenCalled()
  })

  it("does not overwrite a partner response that won the race", async () => {
    for (const q of [query(issued), query(null), query({ id: "request-1" }), query(null)]) mocks.from.mockReturnValueOnce(q)
    expect(await reopenPartnerQuoteForRevision(issued.id, "admin-1")).toMatchObject({ ok: false, status: 409 })
    expect(mocks.notify).not.toHaveBeenCalled()
    expect(mocks.audit).not.toHaveBeenCalled()
  })

  it("fails closed when invoice lookup fails", async () => {
    mocks.from.mockReturnValueOnce(query(issued)).mockReturnValueOnce(query(null, { message: "Unavailable" }))
    expect(await reopenPartnerQuoteForRevision(issued.id, "admin-1")).toMatchObject({ ok: false, status: 500 })
    expect(mocks.from).toHaveBeenCalledTimes(2)
  })
})
