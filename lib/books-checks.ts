/* ───────────────────────────  Books review — deterministic checks  ───────────────────────────
 * Reads MartPoint's own commercial books (ledger, invoices, payments, finance
 * transactions) and produces:
 *   - findings: integrity / tax / anomaly checks that run BEFORE an investor
 *     or auditor would spot them. All arithmetic here is plain code — no AI.
 *   - metrics: the computed numbers the AI narrative layer is allowed to use.
 *
 * Rules inherited from the creator-ai pattern: every number is computed by
 * code; the AI only narrates. Money maths uses kobo via toKobo().
 */

import { supabase, isSupabaseConfigured } from "./supabase"
import { toKobo, fromKobo } from "./finance-commercial"
import { getGlBalances, getPaymentAccountBalance } from "./finance-ledger"
import { isInvoiceOverdue } from "./invoice-status"

export type FindingSeverity = "critical" | "warning" | "info"

export type Finding = {
  code: string
  severity: FindingSeverity
  title: string
  detail: string
  count: number
  samples?: string[]
}

export type MonthlyPoint = { month: string; revenue: number; expenses: number }

export type BooksMetrics = {
  period_months: number
  period_start: string
  generated_at: string
  currency: string
  revenue_invoiced: number
  cash_collected: number
  expenses_total: number
  net_result: number
  gross_cash: number
  receivables_owed: number
  vat_payable_balance: number
  monthly: MonthlyPoint[]
  expense_by_category: { category: string; amount: number }[]
  top_customers: { name: string; amount: number; share: number }[]
  avg_monthly_net: number
  runway_months: number | null
  overdue_invoices: { count: number; amount: number }
  volumes: { invoices: number; payments: number; journal_entries: number }
  health_score: number
  verdict: "HEALTHY" | "WATCH" | "ATTENTION"
}

const RECOGNISED_INVOICE_STATUSES = ["ISSUED", "PARTIALLY_PAID", "PAID", "OVERDUE"]
/** Reconciliation tolerance: ₦1 (100 kobo) absorbs rounding-only drift. */
const TOLERANCE_KOBO = 100

/* ───────────────────────────  Pure check inputs  ─────────────────────────── */

export type EntryInput = {
  id: string
  entry_number: string
  status: string
  lines: { debit: number; credit: number }[]
}

export type InvoiceInput = {
  id: string
  invoice_number: string
  status: string
  subtotal: number
  discount_amount: number
  tax_amount: number
  total_amount: number
  posted_ok: boolean
}

export type PaymentInput = {
  id: string
  payment_reference: string
  invoice_id: string | null
  amount: number
  status: string
  date: string // YYYY-MM-DD (paid_at or created_at)
  posted_ok: boolean
}

/* ───────────────────────────  Pure checks (unit tested)  ─────────────────────────── */

export function checkUnbalancedEntries(entries: EntryInput[]): Finding | null {
  const bad: string[] = []
  for (const e of entries) {
    if (e.status !== "POSTED") continue
    let d = 0
    let c = 0
    for (const l of e.lines) {
      d += toKobo(l.debit)
      c += toKobo(l.credit)
    }
    if (d !== c) bad.push(e.entry_number)
  }
  if (bad.length === 0) return null
  return {
    code: "UNBALANCED_ENTRIES",
    severity: "critical",
    title: "Journal entries that do not balance",
    detail: `${bad.length} POSTED journal entry/entries have total debits ≠ total credits. This breaks the core double-entry invariant and is the first thing an auditor checks.`,
    count: bad.length,
    samples: bad.slice(0, 5),
  }
}

export function checkUnpostedInvoices(invoices: InvoiceInput[]): Finding | null {
  const bad = invoices.filter(
    (i) => RECOGNISED_INVOICE_STATUSES.includes(i.status) && toKobo(i.total_amount) > 0 && !i.posted_ok,
  )
  if (bad.length === 0) return null
  return {
    code: "INVOICE_NOT_IN_LEDGER",
    severity: "critical",
    title: "Recognised invoices missing from the ledger",
    detail: `${bad.length} invoice(s) are ISSUED/PARTIALLY_PAID/PAID/OVERDUE but have no balanced POSTED journal entry. Revenue shown on documents but absent from the books understates income.`,
    count: bad.length,
    samples: bad.slice(0, 5).map((i) => i.invoice_number),
  }
}

export function checkUnpostedPayments(payments: PaymentInput[]): Finding | null {
  const bad = payments.filter((p) => p.status === "CONFIRMED" && toKobo(p.amount) > 0 && !p.posted_ok)
  if (bad.length === 0) return null
  return {
    code: "PAYMENT_NOT_IN_LEDGER",
    severity: "warning",
    title: "Confirmed payments with no ledger posting",
    detail: `${bad.length} confirmed payment(s) have no journal entry — cash received will not reconcile to bank balances.`,
    count: bad.length,
    samples: bad.slice(0, 5).map((p) => p.payment_reference),
  }
}

/**
 * VAT plausibility on the invoice header: expected = (subtotal − discount) × rate.
 * Zero-VAT taxable invoices are flagged for review (some are legitimately
 * zero-rated) rather than asserted as errors.
 */
export function checkVatAnomalies(invoices: InvoiceInput[], vatRatePct: number): Finding | null {
  const mismatched: { num: string; diff: number }[] = []
  const zeroVat: string[] = []
  for (const inv of invoices) {
    if (!RECOGNISED_INVOICE_STATUSES.includes(inv.status)) continue
    const baseKobo = toKobo(inv.subtotal) - toKobo(inv.discount_amount || 0)
    if (baseKobo <= 0) continue
    const expectedKobo = Math.round((baseKobo * vatRatePct) / 100)
    const actualKobo = toKobo(inv.tax_amount || 0)
    if (Math.abs(actualKobo - expectedKobo) <= TOLERANCE_KOBO) continue
    if (actualKobo === 0) zeroVat.push(inv.invoice_number)
    else mismatched.push({ num: inv.invoice_number, diff: fromKobo(actualKobo - expectedKobo) })
  }
  if (mismatched.length === 0 && zeroVat.length === 0) return null
  const parts: string[] = []
  if (mismatched.length > 0)
    parts.push(`${mismatched.length} invoice(s) have VAT that does not match ${vatRatePct}% of the taxable base (largest line difference: ₦${Math.max(...mismatched.map((m) => Math.abs(m.diff))).toLocaleString("en-NG", { maximumFractionDigits: 0 })}).`)
  if (zeroVat.length > 0)
    parts.push(`${zeroVat.length} taxable invoice(s) charged zero VAT — confirm each is genuinely zero-rated before filing.`)
  return {
    code: "VAT_ANOMALY",
    severity: mismatched.length > 0 ? "critical" : "warning",
    title: "VAT inconsistencies on invoices",
    detail: parts.join(" "),
    count: mismatched.length + zeroVat.length,
    samples: [...mismatched.slice(0, 3).map((m) => m.num), ...zeroVat.slice(0, 3)],
  }
}

/** Same invoice, same amount, same calendar day, both confirmed — classic double-pay. */
export function checkDuplicatePayments(payments: PaymentInput[]): Finding | null {
  const groups = new Map<string, PaymentInput[]>()
  for (const p of payments) {
    if (p.status !== "CONFIRMED" || !p.invoice_id || toKobo(p.amount) <= 0) continue
    const key = `${p.invoice_id}|${toKobo(p.amount)}|${p.date.slice(0, 10)}`
    const list = groups.get(key) || []
    list.push(p)
    groups.set(key, list)
  }
  const dupes = [...groups.values()].filter((l) => l.length > 1)
  if (dupes.length === 0) return null
  const totalKobo = dupes.reduce(
    (s, l) => s + toKobo(l[0].amount) * (l.length - 1),
    0,
  )
  return {
    code: "DUPLICATE_PAYMENTS",
    severity: "critical",
    title: "Possible duplicate payments",
    detail: `${dupes.length} group(s) show the same invoice paid the same amount on the same day more than once (≈ ₦${fromKobo(totalKobo).toLocaleString("en-NG", { maximumFractionDigits: 0 })} at risk of double-counting).`,
    count: dupes.length,
    samples: dupes.slice(0, 5).map((l) => l.map((p) => p.payment_reference).join(" + ")),
  }
}

export function checkNegativeCash(accounts: { name: string; balance: number }[]): Finding | null {
  const bad = accounts.filter((a) => a.balance < 0)
  if (bad.length === 0) return null
  return {
    code: "NEGATIVE_CASH",
    severity: "critical",
    title: "Negative cash/bank account balance",
    detail: `${bad.length} payment account(s) show a negative book balance: ${bad.map((b) => `${b.name} (₦${b.balance.toLocaleString("en-NG")})`).join(", ")}. A bank account cannot be overdrawn in these books — this indicates a posting error.`,
    count: bad.length,
    samples: bad.map((b) => b.name),
  }
}

/** Σ balance_due of unpaid recognised invoices must equal the AR ledger balance. */
export function checkArReconciliation(
  invoices: { balance_due: number; status: string }[],
  arLedgerBalance: number,
): Finding | null {
  const owedKobo = invoices
    .filter((i) => RECOGNISED_INVOICE_STATUSES.includes(i.status))
    .reduce((s, i) => s + toKobo(i.balance_due || 0), 0)
  const ledgerKobo = toKobo(arLedgerBalance)
  const diff = Math.abs(owedKobo - ledgerKobo)
  if (diff <= TOLERANCE_KOBO) return null
  return {
    code: "AR_MISMATCH",
    severity: "warning",
    title: "Receivables do not reconcile to the ledger",
    detail: `Unpaid invoice balances total ₦${fromKobo(owedKobo).toLocaleString("en-NG", { maximumFractionDigits: 2 })} but the Accounts Receivable ledger shows ₦${fromKobo(ledgerKobo).toLocaleString("en-NG", { maximumFractionDigits: 2 })} (gap ₦${fromKobo(diff).toLocaleString("en-NG", { maximumFractionDigits: 2 })}). Investors' first diligence question is whether receivables reconcile.`,
    count: 1,
  }
}

/** Simple deterministic health: start 100, deduct per finding severity. */
export function computeHealth(findings: Finding[]): { health_score: number; verdict: BooksMetrics["verdict"] } {
  let score = 100
  for (const f of findings) {
    if (f.severity === "critical") score -= 15
    else if (f.severity === "warning") score -= 5
    else score -= 1
  }
  score = Math.max(0, Math.min(100, score))
  const verdict = score >= 80 ? "HEALTHY" : score >= 60 ? "WATCH" : "ATTENTION"
  return { health_score: score, verdict }
}

/* ───────────────────────────  Data collection + run  ─────────────────────────── */

async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null }>): Promise<T[]> {
  const out: T[] = []
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data } = await build(from, from + PAGE - 1)
    const rows = data || []
    out.push(...rows)
    if (rows.length < PAGE) break
  }
  return out
}

export async function runBooksChecks(months: number): Promise<{ metrics: BooksMetrics; findings: Finding[] }> {
  if (!isSupabaseConfigured()) throw new Error("Database not configured")

  const start = new Date()
  start.setMonth(start.getMonth() - months)
  const startDate = start.toISOString().slice(0, 10)

  const [{ data: glAccounts }, invoicesRaw, paymentsRaw, journalRaw, txnCountRow] = await Promise.all([
    supabase.from("gl_accounts").select("id, code, name, type, account_key"),
    fetchAll((from, to) =>
      supabase
        .from("invoices")
        .select("id, invoice_number, business_id, status, subtotal, discount_amount, tax_amount, total_amount, amount_paid, balance_due, due_date, journal_entry_id, businesses:business_id (business_name)")
        .gte("issue_date", startDate)
        .order("id")
        .range(from, to) as never,
    ),
    fetchAll((from, to) =>
      supabase
        .from("payments")
        .select("id, payment_reference, invoice_id, amount, status, paid_at, created_at, journal_entry_id")
        .gte("created_at", start.toISOString())
        .order("id")
        .range(from, to) as never,
    ),
    fetchAll((from, to) =>
      supabase
        .from("journal_entries")
        .select("id, entry_number, entry_date, status, source_type, source_id, journal_lines(id, gl_account_id, debit, credit)")
        .gte("entry_date", startDate)
        .order("id")
        .range(from, to) as never,
    ),
    supabase.from("finance_transactions").select("id", { count: "exact", head: true }).is("journal_entry_id", null),
  ])

  const accounts = (glAccounts as { id: string; code: string; name: string; type: string; account_key: string | null }[]) || []
  const typeById = new Map(accounts.map((a) => [a.id, a.type]))
  const accountByKey = new Map(accounts.filter((a) => a.account_key).map((a) => [a.account_key as string, a]))
  const journalEntries = (journalRaw as {
    id: string
    entry_number: string
    entry_date: string
    status: string
    source_type: string
    source_id: string | null
    journal_lines: { id: string; gl_account_id: string; debit: number; credit: number }[]
  }[]) || []
  const invoices = (invoicesRaw as unknown as {
    id: string
    invoice_number: string
    business_id: string
    status: string
    subtotal: number
    discount_amount: number
    tax_amount: number
    total_amount: number
    balance_due: number
    due_date: string
    journal_entry_id: string | null
    businesses: { business_name: string } | null
  }[]) || []
  const payments = (paymentsRaw as unknown as {
    id: string
    payment_reference: string
    invoice_id: string | null
    amount: number
    status: string
    paid_at: string | null
    created_at: string
    journal_entry_id: string | null
  }[]) || []

  // Posted-entry coverage: a doc is OK when it links to a POSTED, balanced entry.
  const balancedPostedIds = new Set(
    journalEntries
      .filter((e) => e.status === "POSTED")
      .filter((e) => {
        let d = 0
        let c = 0
        for (const l of e.journal_lines || []) {
          d += toKobo(l.debit)
          c += toKobo(l.credit)
        }
        return d === c && d > 0
      })
      .map((e) => e.id),
  )

  const invoiceInputs: InvoiceInput[] = invoices.map((i) => ({
    id: i.id,
    invoice_number: i.invoice_number,
    status: i.status,
    subtotal: i.subtotal,
    discount_amount: i.discount_amount,
    tax_amount: i.tax_amount,
    total_amount: i.total_amount,
    posted_ok: !!i.journal_entry_id && balancedPostedIds.has(i.journal_entry_id),
  }))
  const paymentInputs: PaymentInput[] = payments.map((p) => ({
    id: p.id,
    payment_reference: p.payment_reference,
    invoice_id: p.invoice_id,
    amount: p.amount,
    status: p.status,
    date: (p.paid_at || p.created_at).slice(0, 10),
    posted_ok: !!p.journal_entry_id && balancedPostedIds.has(p.journal_entry_id),
  }))
  const entryInputs: EntryInput[] = journalEntries.map((e) => ({
    id: e.id,
    entry_number: e.entry_number,
    status: e.status,
    lines: e.journal_lines || [],
  }))

  // Active VAT rate from the configured table, else the Nigerian standard.
  const { data: vatRateRow } = await supabase.from("tax_rates").select("rate").like("name", "VAT%").eq("is_active", true).limit(1)
  const vatRatePct = Number(vatRateRow?.[0]?.rate ?? 7.5)

  // Ledger balances for AR / tax payable.
  const glBalances = await getGlBalances()
  const arAccount = accountByKey.get("accounts_receivable")
  const taxAccount = accountByKey.get("tax_payable")
  const arBalance = arAccount ? glBalances[arAccount.id] || 0 : 0
  const taxBalance = taxAccount ? glBalances[taxAccount.id] || 0 : 0

  // Payment-account cash balances.
  const { data: paymentAccounts } = await supabase.from("payment_accounts").select("id, name, active").eq("active", true)
  const cashAccounts: { name: string; balance: number }[] = []
  for (const pa of (paymentAccounts as { id: string; name: string }[]) || []) {
    cashAccounts.push({ name: pa.name, balance: await getPaymentAccountBalance(pa.id) })
  }

  const findings: Finding[] = []
  const add = (f: Finding | null) => {
    if (f) findings.push(f)
  }
  add(checkUnbalancedEntries(entryInputs))
  add(checkUnpostedInvoices(invoiceInputs))
  add(checkUnpostedPayments(paymentInputs))
  add(checkVatAnomalies(invoiceInputs, vatRatePct))
  add(checkDuplicatePayments(paymentInputs))
  add(checkNegativeCash(cashAccounts))
  add(checkArReconciliation(invoices.map((i) => ({ balance_due: i.balance_due, status: i.status })), arBalance))

  const unlinkedTxns = txnCountRow?.count ?? 0
  if (unlinkedTxns > 0) {
    findings.push({
      code: "TXN_NOT_POSTED",
      severity: "info",
      title: "Finance transactions outside the ledger",
      detail: `${unlinkedTxns} income/expense transaction(s) predate or were missed by the ledger backfill. They do not affect the journal-based figures but should be posted or archived.`,
      count: unlinkedTxns,
    })
  }

  /* ── Metrics (all computed here, never by the AI) ── */

  const recognised = invoices.filter((i) => RECOGNISED_INVOICE_STATUSES.includes(i.status))
  const revenueInvoiced = fromKobo(recognised.reduce((s, i) => s + toKobo(i.total_amount), 0))
  const cashCollected = fromKobo(
    payments.filter((p) => p.status === "CONFIRMED").reduce((s, p) => s + toKobo(p.amount), 0),
  )
  const receivablesOwed = fromKobo(recognised.reduce((s, i) => s + toKobo(i.balance_due || 0), 0))

  // Monthly revenue / expense from the journal (the books' source of truth).
  const monthlyMap = new Map<string, MonthlyPoint>()
  let expenseTotalKobo = 0
  for (const e of journalEntries) {
    if (e.status !== "POSTED") continue
    const month = e.entry_date.slice(0, 7)
    const point = monthlyMap.get(month) || { month, revenue: 0, expenses: 0 }
    for (const l of e.journal_lines || []) {
      const type = typeById.get(l.gl_account_id)
      if (type === "INCOME") point.revenue += fromKobo(toKobo(l.credit) - toKobo(l.debit))
      else if (type === "EXPENSE") {
        const net = fromKobo(toKobo(l.debit) - toKobo(l.credit))
        point.expenses += net
        expenseTotalKobo += toKobo(l.debit) - toKobo(l.credit)
      }
    }
    monthlyMap.set(month, point)
  }
  const monthly = [...monthlyMap.values()].sort((a, b) => a.month.localeCompare(b.month))

  // Expenses by category from finance_transactions (categorised ledger view).
  const { data: txnRows } = await supabase
    .from("finance_transactions")
    .select("category, amount, type")
    .eq("type", "expense")
    .gte("date", startDate)
  const catMap = new Map<string, number>()
  for (const t of (txnRows as { category: string; amount: number }[]) || []) {
    catMap.set(t.category, (catMap.get(t.category) || 0) + Number(t.amount || 0))
  }
  const expenseByCategory = [...catMap.entries()]
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8)

  // Customer concentration on invoiced revenue.
  const byBusiness = new Map<string, number>()
  for (const i of recognised) {
    byBusiness.set(i.business_id, (byBusiness.get(i.business_id) || 0) + toKobo(i.total_amount))
  }
  const totalRevKobo = [...byBusiness.values()].reduce((s, v) => s + v, 0)
  const topCustomers = [...byBusiness.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([businessId, kobo]) => ({
      name: invoices.find((i) => i.business_id === businessId)?.businesses?.business_name || "Unknown business",
      amount: fromKobo(kobo),
      share: totalRevKobo > 0 ? Math.round((kobo / totalRevKobo) * 1000) / 10 : 0,
    }))

  const now = new Date()
  const overdue = recognised.filter((i) => isInvoiceOverdue({ status: i.status, due_date: i.due_date, balance_due: i.balance_due }, now))
  const overdueAmount = fromKobo(overdue.reduce((s, i) => s + toKobo(i.balance_due || 0), 0))

  const grossCash = cashAccounts.reduce((s, a) => s + a.balance, 0)
  const last3 = monthly.slice(-3)
  const avgMonthlyNet = last3.length > 0 ? last3.reduce((s, m) => s + m.revenue - m.expenses, 0) / last3.length : 0
  const runwayMonths = avgMonthlyNet < 0 && grossCash > 0 ? Math.round((grossCash / Math.abs(avgMonthlyNet)) * 10) / 10 : null

  const netResult = revenueInvoiced - fromKobo(expenseTotalKobo)
  const health = computeHealth(findings)

  const metrics: BooksMetrics = {
    period_months: months,
    period_start: startDate,
    generated_at: new Date().toISOString(),
    currency: "NGN",
    revenue_invoiced: revenueInvoiced,
    cash_collected: cashCollected,
    expenses_total: fromKobo(expenseTotalKobo),
    net_result: netResult,
    gross_cash: grossCash,
    receivables_owed: receivablesOwed,
    vat_payable_balance: taxBalance,
    monthly,
    expense_by_category: expenseByCategory,
    top_customers: topCustomers,
    avg_monthly_net: Math.round(avgMonthlyNet * 100) / 100,
    runway_months: runwayMonths,
    overdue_invoices: { count: overdue.length, amount: overdueAmount },
    volumes: {
      invoices: invoices.length,
      payments: payments.length,
      journal_entries: journalEntries.length,
    },
    ...health,
  }

  return { metrics, findings }
}
