import { beforeEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({
  payment: { id: "6ea03762-bb18-4fcb-b8b9-5207638a315d", business_id: "c67b7e1a-6732-4faf-b52b-64536510ed68", invoice_id: null, amount: 3762.5, currency: "NGN", status: "CONFIRMED", payment_reference: "MPP-2026-00001" },
  receipt: null as Record<string, unknown> | null,
  receiptInserts: [] as Record<string, unknown>[],
  paymentUpdates: [] as Record<string, unknown>[],
  audits: [] as Record<string, unknown>[],
  email: vi.fn(),
  postJournal: vi.fn(),
}))

vi.mock("@/lib/supabase", () => ({
  isSupabaseConfigured: () => true,
  supabase: {
    rpc: vi.fn(async () => ({ data: "MPR-2026-00001", error: null })),
    from: (table: string) => {
      let operation = "select"
      let row: Record<string, unknown> = {}
      const run = () => {
        if (table === "payments") {
          if (operation === "update") {
            state.paymentUpdates.push(row)
            if (state.payment.status !== "PENDING") return { data: null, error: null }
            Object.assign(state.payment, row)
            return { data: { id: state.payment.id }, error: null }
          }
          return { data: { ...state.payment }, error: null }
        }
        if (table === "receipts") {
          if (operation === "insert") {
            // Model the real PostgreSQL UUID constraint that caused the outage.
            if (row.issued_by !== null && !/^[a-f0-9-]{36}$/i.test(String(row.issued_by))) {
              return { data: null, error: { message: "invalid input syntax for type uuid" } }
            }
            state.receiptInserts.push(row)
            state.receipt = { id: "receipt-id", ...row }
          }
          return { data: state.receipt, error: null }
        }
        if (table === "finance_audit_events" && operation === "insert") state.audits.push(row)
        return { data: null, error: null }
      }
      const query: Record<string, unknown> = {}
      for (const method of ["select", "eq", "order", "limit"]) query[method] = () => query
      for (const method of ["insert", "update"]) query[method] = (value: Record<string, unknown>) => { operation = method; row = value; return query }
      query.single = query.maybeSingle = async () => run()
      query.then = (resolve: (result: ReturnType<typeof run>) => unknown) => Promise.resolve(run()).then(resolve)
      return query
    },
  },
}))
vi.mock("@/lib/businesses", () => ({ getBusinessById: vi.fn(async () => null), setOnboardingStage: vi.fn() }))
vi.mock("@/lib/finance-ledger", () => ({ postPaymentJournal: state.postJournal, postInvoiceJournal: vi.fn() }))
vi.mock("@/lib/partner-notifications", () => ({ notifyPartnerPaymentConfirmed: vi.fn(), notifyPartnerPaymentRejected: vi.fn() }))
vi.mock("@/lib/payment-emails", () => ({ sendPaymentConfirmationEmail: state.email }))

import { confirmPayment, createReceipt } from "@/lib/finance-commercial"

beforeEach(() => {
  state.payment.status = "CONFIRMED"
  state.receipt = null
  state.receiptInserts.length = state.paymentUpdates.length = state.audits.length = 0
  state.email.mockClear()
  state.postJournal.mockClear()
})

describe("automatic payment receipts", () => {
  it.each(["Central Paystack verification", "Paystack invoice verification", "Central billing recovery", "Central administrator operator", ""])("issues a receipt for system source %j without writing text into UUID columns", async (source) => {
    const receipt = await createReceipt(state.payment.id, source)
    expect(receipt.amount).toBe(3762.5)
    expect(state.receiptInserts[0].issued_by).toBeNull()
    expect(state.audits[0]).toMatchObject({ actor_type: "SYSTEM", actor_id: undefined, metadata: { issued_by: source || "SYSTEM" } })
  })

  it("preserves the administrator UUID", async () => {
    const adminId = "7349fa28-a010-4e4b-9d0b-5a991ba99cc8"
    await createReceipt(state.payment.id, adminId)
    expect(state.receiptInserts[0].issued_by).toBe(adminId)
    expect(state.audits[0]).toMatchObject({ actor_type: "ADMIN", actor_id: adminId })
  })

  it("returns the existing receipt when recovery repeats", async () => {
    const first = await createReceipt(state.payment.id, "Central Paystack verification")
    const replay = await createReceipt(state.payment.id, "Central billing recovery")
    expect(replay.id).toBe(first.id)
    expect(state.receiptInserts).toHaveLength(1)
  })

  it("does not issue receipts for unconfirmed payments", async () => {
    state.payment.status = "PENDING"
    await expect(createReceipt(state.payment.id, "Central billing recovery")).rejects.toThrow("unconfirmed payment")
    expect(state.receiptInserts).toHaveLength(0)
  })
})

describe("confirmation recovery", () => {
  it("confirms a system payment once and does not send another customer email on replay", async () => {
    state.payment.status = "PENDING"
    await confirmPayment(state.payment.id, "Central Paystack verification")
    await confirmPayment(state.payment.id, "Central billing recovery")
    expect(state.payment.status).toBe("CONFIRMED")
    expect(state.paymentUpdates[0].confirmed_by).toBeNull()
    expect(state.email).toHaveBeenCalledTimes(1)
    expect(state.email).toHaveBeenCalledWith(state.payment.id, { type: "SYSTEM" })
    expect(state.postJournal).toHaveBeenCalledTimes(2)
  })
})
