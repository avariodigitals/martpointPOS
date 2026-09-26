import { supabase, isSupabaseConfigured } from "./supabase"
import { toKobo, fromKobo, money, type Payment, type Invoice, type PaymentMethod, type CommissionPayout } from "./finance-commercial"

/* ─────────────────────────────────────────────────────────────────────────────
   DOUBLE-ENTRY LEDGER — chart of accounts, payment accounts, journal
   Perfex-style: every money movement posts a balanced journal entry.
   ───────────────────────────────────────────────────────────────────────────── */

export type GlAccountType = "ASSET" | "LIABILITY" | "EQUITY" | "INCOME" | "EXPENSE"

export type GlAccount = {
  id: string
  code: string
  name: string
  type: GlAccountType
  subtype?: string | null
  account_key?: string | null
  is_system: boolean
  active: boolean
  description?: string | null
}

export type PaymentAccount = {
  id: string
  name: string
  gl_account_id: string
  payment_method?: PaymentMethod | null
  bank_name?: string | null
  account_number_last4?: string | null
  currency: string
  opening_balance: number
  opening_balance_date?: string | null
  is_default: boolean
  active: boolean
}

export type JournalSourceType =
  | "INVOICE" | "PAYMENT" | "PAYMENT_REVERSAL" | "INCOME" | "EXPENSE"
  | "TRANSFER" | "DEPOSIT" | "PAYOUT" | "OPENING" | "MANUAL"

export type JournalEntry = {
  id: string
  entry_number: string
  entry_date: string
  memo?: string | null
  source_type: JournalSourceType
  source_id?: string | null
  status: "POSTED" | "VOID"
  created_by?: string | null
  created_at: string
}

export type JournalLine = {
  id: string
  journal_entry_id: string
  gl_account_id: string
  business_id?: string | null
  description?: string | null
  debit: number
  credit: number
}

export type JournalLineInput = {
  gl_account_id: string
  debit?: number
  credit?: number
  description?: string
  business_id?: string | null
}

/* ───────────────────────────  PURE HELPERS (testable)  ─────────────────────────── */

/** Accounts that increase on debit. */
export function isDebitNature(type: GlAccountType): boolean {
  return type === "ASSET" || type === "EXPENSE"
}

/** Signed effect of a line on an account's natural balance. */
export function lineEffect(type: GlAccountType, debit: number, credit: number): number {
  const d = toKobo(debit)
  const c = toKobo(credit)
  return isDebitNature(type) ? d - c : c - d
}

/** Validate a set of journal lines: ≥2 lines, each line one-sided, balanced totals. */
export function validateJournalLines(lines: JournalLineInput[]): string | null {
  if (!lines || lines.length < 2) return "A journal entry needs at least two lines"
  let debitKobo = 0
  let creditKobo = 0
  for (const line of lines) {
    const d = toKobo(line.debit || 0)
    const c = toKobo(line.credit || 0)
    if (d < 0 || c < 0) return "Amounts cannot be negative"
    if (d === 0 && c === 0) return "Each line needs a debit or credit amount"
    if (d > 0 && c > 0) return "A line cannot be both debit and credit"
    if (!line.gl_account_id) return "Every line needs a GL account"
    debitKobo += d
    creditKobo += c
  }
  if (debitKobo !== creditKobo) {
    return `Entry is not balanced: debits ${fromKobo(debitKobo)} ≠ credits ${fromKobo(creditKobo)}`
  }
  return null
}

/** Running balance rows for a statement (debit-nature accounts like bank/cash). */
export function computeRunningBalance<T extends { debit: number; credit: number }>(
  openingBalance: number,
  rows: T[],
): Array<T & { running_balance: number }> {
  let balance = toKobo(openingBalance)
  return rows.map((row) => {
    balance += toKobo(row.debit) - toKobo(row.credit)
    return { ...row, running_balance: fromKobo(balance) }
  })
}

/* ───────────────────────────  LOOKUPS  ─────────────────────────── */

export async function getGlAccountByKey(key: string): Promise<GlAccount | null> {
  if (!isSupabaseConfigured()) return null
  const { data } = await supabase.from("gl_accounts").select("*").eq("account_key", key).single()
  return (data as GlAccount) || null
}

async function nextGlCode(min: number, max: number): Promise<string> {
  const { data } = await supabase
    .from("gl_accounts")
    .select("code")
    .gte("code", String(min))
    .lte("code", String(max))
    .order("code", { ascending: false })
    .limit(1)
  const top = data?.[0]?.code ? Number.parseInt(data[0].code, 10) : min - 10
  const next = Math.min(top + 10, max)
  return String(next)
}

/**
 * Resolve the GL account for a finance category, creating it lazily so new
 * categories added in the UI always land on the chart of accounts.
 */
export async function resolveCategoryAccount(type: "income" | "expense", category: string): Promise<GlAccount | null> {
  if (!isSupabaseConfigured()) return null
  const key = `${type}:${category}`
  const { data: existing } = await supabase.from("gl_accounts").select("*").eq("account_key", key).single()
  if (existing) return existing as GlAccount

  // Lazily create the account for categories that predate or bypass seeding.
  const code = await nextGlCode(type === "income" ? 4000 : 5000, type === "income" ? 4999 : 5999)
  const { data: created } = await supabase.from("gl_accounts").insert({
    code,
    name: category,
    type: type === "income" ? "INCOME" : "EXPENSE",
    subtype: type === "income" ? "REVENUE" : "EXPENSE",
    account_key: key,
    is_system: true,
    active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).select().single()

  if (created) return created as GlAccount

  // Race / conflict → re-read, then final fallback to the "Other" bucket.
  const { data: retry } = await supabase.from("gl_accounts").select("*").eq("account_key", key).single()
  if (retry) return retry as GlAccount
  return getGlAccountByKey(type === "income" ? "income:Other Income" : "expense:Other Expenses")
}

export async function resolvePaymentAccount(
  method?: string | null,
  explicitId?: string | null,
): Promise<(PaymentAccount & { gl_account_id: string }) | null> {
  if (!isSupabaseConfigured()) return null

  if (explicitId) {
    const { data } = await supabase.from("payment_accounts").select("*").eq("id", explicitId).single()
    if (data) return data as PaymentAccount
  }
  if (method) {
    const { data } = await supabase
      .from("payment_accounts")
      .select("*")
      .eq("payment_method", method)
      .eq("active", true)
      .single()
    if (data) return data as PaymentAccount
  }
  const { data: fallback } = await supabase
    .from("payment_accounts")
    .select("*")
    .eq("is_default", true)
    .eq("active", true)
    .limit(1)
  if (fallback?.[0]) return fallback[0] as PaymentAccount
  const { data: any } = await supabase.from("payment_accounts").select("*").eq("active", true).limit(1)
  return (any?.[0] as PaymentAccount) || null
}

/* ───────────────────────────  POSTING ENGINE  ─────────────────────────── */

async function nextJournalEntryNumber(): Promise<string> {
  const year = new Date().getFullYear()
  const { data, error } = await supabase.rpc("next_journal_entry_number", { p_year: year })
  if (error || !data) throw new Error(`Journal entry number generation failed: ${error?.message || "unknown"}`)
  return data as string
}

export async function postJournalEntry(input: {
  entry_date?: string
  memo?: string
  source_type: JournalSourceType
  source_id?: string | null
  lines: JournalLineInput[]
  created_by?: string | null
  metadata?: Record<string, unknown>
}): Promise<JournalEntry> {
  if (!isSupabaseConfigured()) throw new Error("Supabase not configured")
  const invalid = validateJournalLines(input.lines)
  if (invalid) throw new Error(invalid)

  const entryNumber = await nextJournalEntryNumber()
  const { data: entry, error } = await supabase.from("journal_entries").insert({
    entry_number: entryNumber,
    entry_date: input.entry_date || new Date().toISOString().split("T")[0],
    memo: input.memo || null,
    source_type: input.source_type,
    source_id: input.source_id || null,
    status: "POSTED",
    metadata: input.metadata || null,
    created_by: input.created_by || null,
    created_at: new Date().toISOString(),
  }).select().single()

  if (error || !entry) throw new Error(`Journal entry failed: ${error?.message || "unknown"}`)
  const entryId = (entry as JournalEntry).id

  const { error: linesError } = await supabase.from("journal_lines").insert(
    input.lines.map((line) => ({
      journal_entry_id: entryId,
      gl_account_id: line.gl_account_id,
      business_id: line.business_id || null,
      description: line.description || null,
      debit: money(line.debit || 0),
      credit: money(line.credit || 0),
      created_at: new Date().toISOString(),
    })),
  )
  if (linesError) {
    await supabase.from("journal_entries").delete().eq("id", entryId)
    throw new Error(`Journal lines failed: ${linesError.message}`)
  }
  return entry as JournalEntry
}

/** Void all posted entries for a source document. */
export async function voidEntriesForSource(sourceType: JournalSourceType, sourceId: string) {
  if (!isSupabaseConfigured()) return
  await supabase
    .from("journal_entries")
    .update({ status: "VOID" })
    .eq("source_type", sourceType)
    .eq("source_id", sourceId)
    .eq("status", "POSTED")
}

async function hasPostedEntry(sourceType: JournalSourceType, sourceId: string): Promise<boolean> {
  const { data } = await supabase
    .from("journal_entries")
    .select("id")
    .eq("source_type", sourceType)
    .eq("source_id", sourceId)
    .eq("status", "POSTED")
    .limit(1)
  return (data?.length || 0) > 0
}

const INCOME_CATEGORY_BY_ITEM: Record<string, string> = {
  PRODUCT: "Product Sales",
  PLAN: "Software Subscription",
  ADDON: "Support Contracts",
  SERVICE: "Implementation Services",
  CUSTOM: "Other Income",
}

const RECOGNISED_INCOME_STATUSES = ["ISSUED", "PARTIALLY_PAID", "PAID", "OVERDUE"]

/**
 * Invoice recognised → DR Accounts Receivable / CR income + tax payable.
 * Voided/cancelled/draft → void the entry. Reposts when totals change.
 */
export async function postInvoiceJournal(invoiceId: string) {
  if (!isSupabaseConfigured()) return
  const { data } = await supabase
    .from("invoices")
    .select("*, invoice_items(item_type, description)")
    .eq("id", invoiceId)
    .single()
  if (!data) return
  const invoice = data as unknown as Invoice & { invoice_items: { item_type: string; description: string }[] }

  if (!RECOGNISED_INCOME_STATUSES.includes(invoice.status)) {
    await voidEntriesForSource("INVOICE", invoiceId)
    return
  }

  const totalKobo = toKobo(invoice.total_amount)
  const taxKobo = toKobo(invoice.tax_amount || 0)
  if (totalKobo <= 0) return

  // Skip a repost when an identical posted entry already exists —
  // recalculateInvoice runs on every allocation, so unchanged totals must not churn entries.
  const { data: posted } = await supabase
    .from("journal_entries")
    .select("id, journal_lines(debit)")
    .eq("source_type", "INVOICE")
    .eq("source_id", invoiceId)
    .eq("status", "POSTED")
    .limit(1)
  const existing = (posted as { id: string; journal_lines: { debit: number }[] }[] | null)?.[0]
  if (existing) {
    const postedKobo = (existing.journal_lines || []).reduce((s, l) => s + toKobo(l.debit), 0)
    if (postedKobo === totalKobo) return
    await voidEntriesForSource("INVOICE", invoiceId)
  }

  const ar = await getGlAccountByKey("accounts_receivable")
  const taxPayable = await getGlAccountByKey("tax_payable")
  const primary = invoice.invoice_items?.[0]?.item_type || "CUSTOM"
  const incomeAccount = await resolveCategoryAccount("income", INCOME_CATEGORY_BY_ITEM[primary] || "Other Income")
  if (!ar || !incomeAccount) return

  const lines: JournalLineInput[] = [
    {
      gl_account_id: ar.id,
      debit: fromKobo(totalKobo),
      business_id: invoice.business_id,
      description: `Invoice ${invoice.invoice_number} receivable`,
    },
    {
      gl_account_id: incomeAccount.id,
      credit: fromKobo(totalKobo - taxKobo),
      business_id: invoice.business_id,
      description: `Invoice ${invoice.invoice_number} income`,
    },
  ]
  if (taxKobo > 0 && taxPayable) {
    lines.push({
      gl_account_id: taxPayable.id,
      credit: fromKobo(taxKobo),
      business_id: invoice.business_id,
      description: `Invoice ${invoice.invoice_number} tax`,
    })
  }

  const entry = await postJournalEntry({
    entry_date: invoice.issue_date,
    memo: `Invoice ${invoice.invoice_number} issued`,
    source_type: "INVOICE",
    source_id: invoiceId,
    lines,
  })
  await supabase.from("invoices").update({ journal_entry_id: entry.id }).eq("id", invoiceId)
}

/**
 * Confirmed payment → DR deposit account / CR AR (allocated part) /
 * CR unearned revenue (unallocated excess) or CR income (no invoice).
 */
export async function postPaymentJournal(paymentId: string) {
  if (!isSupabaseConfigured()) return
  const { data } = await supabase.from("payments").select("*").eq("id", paymentId).single()
  if (!data) return
  const payment = data as Payment & { payment_account_id?: string | null }
  if (payment.status !== "CONFIRMED") return
  if (await hasPostedEntry("PAYMENT", paymentId)) return

  const account = await resolvePaymentAccount(payment.payment_method, payment.payment_account_id)
  if (!account) return

  const amountKobo = toKobo(payment.amount)
  if (amountKobo <= 0) return

  const { data: allocs } = await supabase
    .from("payment_allocations")
    .select("amount_allocated")
    .eq("payment_id", paymentId)
  const allocatedKobo = ((allocs as { amount_allocated: number }[]) || []).reduce(
    (s, a) => s + toKobo(a.amount_allocated),
    0,
  )

  const lines: JournalLineInput[] = [
    {
      gl_account_id: account.gl_account_id,
      debit: fromKobo(amountKobo),
      business_id: payment.business_id,
      description: `Payment ${payment.payment_reference}`,
    },
  ]

  if (payment.invoice_id && allocatedKobo > 0) {
    const ar = await getGlAccountByKey("accounts_receivable")
    if (ar) {
      lines.push({
        gl_account_id: ar.id,
        credit: fromKobo(Math.min(allocatedKobo, amountKobo)),
        business_id: payment.business_id,
        description: `Settlement of invoice`,
      })
    }
  }

  const remainderKobo = amountKobo - Math.min(allocatedKobo, amountKobo)
  if (remainderKobo > 0) {
    if (payment.invoice_id) {
      const unearned = await getGlAccountByKey("unearned_revenue")
      if (unearned) {
        lines.push({
          gl_account_id: unearned.id,
          credit: fromKobo(remainderKobo),
          business_id: payment.business_id,
          description: `Unallocated customer deposit`,
        })
      }
    } else {
      const { data: txn } = await supabase
        .from("finance_transactions")
        .select("category")
        .eq("payment_id", paymentId)
        .eq("type", "income")
        .single()
      const incomeAccount = await resolveCategoryAccount("income", (txn as { category?: string } | null)?.category || "Other Income")
      if (incomeAccount) {
        lines.push({
          gl_account_id: incomeAccount.id,
          credit: fromKobo(remainderKobo),
          business_id: payment.business_id,
          description: `Payment ${payment.payment_reference}`,
        })
      }
    }
  }

  const entry = await postJournalEntry({
    entry_date: payment.paid_at ? payment.paid_at.split("T")[0] : undefined,
    memo: `Payment ${payment.payment_reference} via ${payment.payment_method} → ${account.name}`,
    source_type: "PAYMENT",
    source_id: paymentId,
    lines,
  })
  await supabase.from("payments").update({
    journal_entry_id: entry.id,
    payment_account_id: account.id,
  }).eq("id", paymentId)
}

/** Reverse a posted payment journal (status REVERSED/REFUNDED). */
export async function postPaymentReversal(paymentId: string) {
  if (!isSupabaseConfigured()) return
  const { data: payment } = await supabase.from("payments").select("*").eq("id", paymentId).single()
  if (!payment) return
  if (await hasPostedEntry("PAYMENT_REVERSAL", paymentId)) return

  const { data: originals } = await supabase
    .from("journal_entries")
    .select("id, journal_lines(gl_account_id, debit, credit, business_id, description)")
    .eq("source_type", "PAYMENT")
    .eq("source_id", paymentId)
    .eq("status", "POSTED")
    .limit(1)

  const original = (originals as { id: string; journal_lines: JournalLine[] }[] | null)?.[0]
  if (!original) return

  const p = payment as Payment
  await postJournalEntry({
    memo: `Reversal of payment ${p.payment_reference}`,
    source_type: "PAYMENT_REVERSAL",
    source_id: paymentId,
    lines: original.journal_lines.map((line) => ({
      gl_account_id: line.gl_account_id,
      business_id: line.business_id,
      description: `Reversal — ${line.description || p.payment_reference}`,
      debit: line.credit,
      credit: line.debit,
    })),
  })
}

/**
 * Manual finance transaction → expense: DR expense acct / CR payment account.
 * income: DR payment account / CR income acct. Rows linked to an invoice or
 * payment are skipped — those post through their own source events.
 */
export async function postFinanceTransactionJournal(txnId: string) {
  if (!isSupabaseConfigured()) return
  const { data } = await supabase.from("finance_transactions").select("*").eq("id", txnId).single()
  if (!data) return
  const txn = data as {
    id: string; type: string; category: string; amount: number; description: string
    date: string; business_id?: string | null; invoice_id?: string | null
    payment_id?: string | null; payment_account_id?: string | null
  }
  if (txn.invoice_id || txn.payment_id) return

  const amountKobo = toKobo(txn.amount)
  if (amountKobo <= 0) return

  // Repost cleanly on edit.
  await voidEntriesForSource(txn.type === "expense" ? "EXPENSE" : "INCOME", txnId)

  const categoryAccount = await resolveCategoryAccount(
    txn.type === "expense" ? "expense" : "income",
    txn.category,
  )
  const account = await resolvePaymentAccount(null, txn.payment_account_id)
  if (!categoryAccount || !account) return

  const isExpense = txn.type === "expense"
  const entry = await postJournalEntry({
    entry_date: txn.date,
    memo: txn.description,
    source_type: isExpense ? "EXPENSE" : "INCOME",
    source_id: txnId,
    lines: [
      {
        gl_account_id: isExpense ? categoryAccount.id : account.gl_account_id,
        debit: fromKobo(amountKobo),
        business_id: txn.business_id,
        description: txn.description,
      },
      {
        gl_account_id: isExpense ? account.gl_account_id : categoryAccount.id,
        credit: fromKobo(amountKobo),
        business_id: txn.business_id,
        description: txn.description,
      },
    ],
  })
  await supabase.from("finance_transactions").update({ journal_entry_id: entry.id }).eq("id", txnId)
}

/** Paid commission payout → DR Commissions Payable / CR payment account. */
export async function postPayoutJournal(payoutId: string) {
  if (!isSupabaseConfigured()) return
  const { data } = await supabase.from("commission_payouts").select("*").eq("id", payoutId).single()
  if (!data) return
  const payout = data as CommissionPayout & { payment_account_id?: string | null }
  if (payout.status !== "PAID") return
  if (await hasPostedEntry("PAYOUT", payoutId)) return

  const amountKobo = toKobo(payout.amount)
  if (amountKobo <= 0) return
  const account = await resolvePaymentAccount(payout.payment_method, payout.payment_account_id)
  const payable = await getGlAccountByKey("commissions_payable")
  if (!account || !payable) return

  const entry = await postJournalEntry({
    memo: `Commission payout ${payout.payout_reference}`,
    source_type: "PAYOUT",
    source_id: payoutId,
    lines: [
      { gl_account_id: payable.id, debit: fromKobo(amountKobo), description: payout.payout_reference },
      { gl_account_id: account.gl_account_id, credit: fromKobo(amountKobo), description: payout.payout_reference },
    ],
  })
  await supabase.from("commission_payouts").update({
    journal_entry_id: entry.id,
    payment_account_id: account.id,
  }).eq("id", payoutId)
}

/** Transfer between payment accounts → DR destination / CR source. */
export async function postTransferJournal(input: {
  from_account_id: string
  to_account_id: string
  amount: number
  memo?: string
  entry_date?: string
  created_by?: string | null
}) {
  if (!isSupabaseConfigured()) throw new Error("Supabase not configured")
  const { data: accounts } = await supabase
    .from("payment_accounts")
    .select("*")
    .in("id", [input.from_account_id, input.to_account_id])
  const rows = (accounts as PaymentAccount[]) || []
  const from = rows.find((a) => a.id === input.from_account_id)
  const to = rows.find((a) => a.id === input.to_account_id)
  if (!from || !to) throw new Error("Payment account not found")
  const amountKobo = toKobo(input.amount)
  if (amountKobo <= 0) throw new Error("Transfer amount must be positive")

  return postJournalEntry({
    entry_date: input.entry_date,
    memo: input.memo || `Transfer ${from.name} → ${to.name}`,
    source_type: "TRANSFER",
    created_by: input.created_by,
    metadata: { from_account_id: from.id, to_account_id: to.id },
    lines: [
      { gl_account_id: to.gl_account_id, debit: fromKobo(amountKobo), description: `From ${from.name}` },
      { gl_account_id: from.gl_account_id, credit: fromKobo(amountKobo), description: `To ${to.name}` },
    ],
  })
}

/** Direct deposit into a payment account → DR account / CR income. */
export async function postDepositJournal(input: {
  payment_account_id: string
  amount: number
  income_category?: string
  memo?: string
  entry_date?: string
  created_by?: string | null
}) {
  if (!isSupabaseConfigured()) throw new Error("Supabase not configured")
  const { data } = await supabase.from("payment_accounts").select("*").eq("id", input.payment_account_id).single()
  if (!data) throw new Error("Payment account not found")
  const account = data as PaymentAccount
  const amountKobo = toKobo(input.amount)
  if (amountKobo <= 0) throw new Error("Deposit amount must be positive")
  const incomeAccount = await resolveCategoryAccount("income", input.income_category || "Other Income")
  if (!incomeAccount) throw new Error("Income account not found")

  return postJournalEntry({
    entry_date: input.entry_date,
    memo: input.memo || `Deposit → ${account.name}`,
    source_type: "DEPOSIT",
    created_by: input.created_by,
    metadata: { payment_account_id: account.id },
    lines: [
      { gl_account_id: account.gl_account_id, debit: fromKobo(amountKobo), description: input.memo || account.name },
      { gl_account_id: incomeAccount.id, credit: fromKobo(amountKobo), description: input.income_category || "Other Income" },
    ],
  })
}

/** Opening balance → DR payment account / CR Opening Balance Equity. */
export async function postOpeningBalance(paymentAccountId: string, createdBy?: string | null) {
  if (!isSupabaseConfigured()) return
  const { data } = await supabase.from("payment_accounts").select("*").eq("id", paymentAccountId).single()
  if (!data) return
  const account = data as PaymentAccount
  const amountKobo = toKobo(account.opening_balance)
  if (amountKobo <= 0) return
  if (await hasPostedEntry("OPENING", paymentAccountId)) return
  const equity = await getGlAccountByKey("opening_balance_equity")
  if (!equity) return

  await postJournalEntry({
    entry_date: account.opening_balance_date || undefined,
    memo: `Opening balance — ${account.name}`,
    source_type: "OPENING",
    source_id: paymentAccountId,
    created_by: createdBy,
    lines: [
      { gl_account_id: account.gl_account_id, debit: fromKobo(amountKobo), description: "Opening balance" },
      { gl_account_id: equity.id, credit: fromKobo(amountKobo), description: `Opening balance — ${account.name}` },
    ],
  })
}

/* ───────────────────────────  STATEMENTS & BALANCES  ─────────────────────────── */

export type StatementRow = {
  entry_id: string
  entry_number: string
  entry_date: string
  memo?: string | null
  source_type: JournalSourceType
  source_id?: string | null
  description?: string | null
  debit: number
  credit: number
  running_balance: number
}

/**
 * Statement for a GL account (payment accounts resolve to theirs).
 * Balance = opening_balance + Σ(debit − credit) over posted entries.
 */
export async function getAccountStatement(input: {
  gl_account_id?: string
  payment_account_id?: string
  from?: string
  to?: string
}): Promise<{ opening: number; rows: StatementRow[]; closing: number }> {
  if (!isSupabaseConfigured()) return { opening: 0, rows: [], closing: 0 }

  let glAccountId = input.gl_account_id || null
  if (input.payment_account_id) {
    const { data } = await supabase.from("payment_accounts").select("*").eq("id", input.payment_account_id).single()
    if (!data) return { opening: 0, rows: [], closing: 0 }
    glAccountId = (data as PaymentAccount).gl_account_id
  }
  if (!glAccountId) return { opening: 0, rows: [], closing: 0 }

  const { data: lines } = await supabase
    .from("journal_lines")
    .select("*, journal_entries!inner(id, entry_number, entry_date, memo, source_type, source_id, status)")
    .eq("gl_account_id", glAccountId)
    .eq("journal_entries.status", "POSTED")

  const all = ((lines as unknown as Array<JournalLine & { journal_entries: JournalEntry }>) || [])
    .map((l) => ({
      entry_id: l.journal_entries.id,
      entry_number: l.journal_entries.entry_number,
      entry_date: l.journal_entries.entry_date,
      memo: l.journal_entries.memo,
      source_type: l.journal_entries.source_type,
      source_id: l.journal_entries.source_id,
      description: l.description,
      debit: Number(l.debit),
      credit: Number(l.credit),
    }))
    .sort((a, b) => a.entry_date.localeCompare(b.entry_date) || a.entry_number.localeCompare(b.entry_number))

  // Opening = net movement before `from` (the OPENING entry line already
  // carries the configured opening balance, so it is not added twice).
  let openingKobo = 0
  const inRange = all.filter((r) => {
    if (input.from && r.entry_date < input.from) {
      openingKobo += toKobo(r.debit) - toKobo(r.credit)
      return false
    }
    if (input.to && r.entry_date > input.to) return false
    return true
  })

  const rows = computeRunningBalance(fromKobo(openingKobo), inRange)
  const closing = rows.length ? rows[rows.length - 1].running_balance : fromKobo(openingKobo)
  return { opening: fromKobo(openingKobo), rows, closing }
}

/** Net balance per GL account (natural-sign adjusted). */
export async function getGlBalances(): Promise<Record<string, number>> {
  if (!isSupabaseConfigured()) return {}
  const { data: accounts } = await supabase.from("gl_accounts").select("id, type")
  const { data: lines } = await supabase
    .from("journal_lines")
    .select("gl_account_id, debit, credit, journal_entries!inner(status)")
    .eq("journal_entries.status", "POSTED")

  const typeById = new Map(((accounts as Pick<GlAccount, "id" | "type">[]) || []).map((a) => [a.id, a.type]))
  const kobo: Record<string, number> = {}
  for (const l of (lines as { gl_account_id: string; debit: number; credit: number }[]) || []) {
    const type = typeById.get(l.gl_account_id)
    if (!type) continue
    kobo[l.gl_account_id] = (kobo[l.gl_account_id] || 0) + lineEffect(type, l.debit, l.credit)
  }
  const balances: Record<string, number> = {}
  for (const k of Object.keys(kobo)) balances[k] = fromKobo(kobo[k])
  return balances
}

/** Convenience: current balance of a payment account including opening balance. */
export async function getPaymentAccountBalance(paymentAccountId: string): Promise<number> {
  const { closing } = await getAccountStatement({ payment_account_id: paymentAccountId })
  return closing
}

/* ───────────────────────────  BACKFILL  ─────────────────────────── */

/** Post journals for anything that predates the ledger. Idempotent. */
export async function backfillLedger(createdBy?: string | null) {
  if (!isSupabaseConfigured()) return { invoices: 0, payments: 0, transactions: 0, payouts: 0, openings: 0 }
  const counts = { invoices: 0, payments: 0, transactions: 0, payouts: 0, openings: 0 }

  const { data: invoices } = await supabase
    .from("invoices")
    .select("id")
    .in("status", RECOGNISED_INCOME_STATUSES)
    .is("journal_entry_id", null)
  for (const inv of (invoices as { id: string }[]) || []) {
    try { await postInvoiceJournal(inv.id); counts.invoices++ } catch (e) { console.error("[backfill] invoice", inv.id, e) }
  }

  const { data: payments } = await supabase
    .from("payments")
    .select("id")
    .eq("status", "CONFIRMED")
    .is("journal_entry_id", null)
  for (const p of (payments as { id: string }[]) || []) {
    try { await postPaymentJournal(p.id); counts.payments++ } catch (e) { console.error("[backfill] payment", p.id, e) }
  }

  const { data: txns } = await supabase
    .from("finance_transactions")
    .select("id")
    .is("journal_entry_id", null)
    .is("invoice_id", null)
    .is("payment_id", null)
  for (const t of (txns as { id: string }[]) || []) {
    try { await postFinanceTransactionJournal(t.id); counts.transactions++ } catch (e) { console.error("[backfill] txn", t.id, e) }
  }

  const { data: payouts } = await supabase
    .from("commission_payouts")
    .select("id")
    .eq("status", "PAID")
    .is("journal_entry_id", null)
  for (const p of (payouts as { id: string }[]) || []) {
    try { await postPayoutJournal(p.id); counts.payouts++ } catch (e) { console.error("[backfill] payout", p.id, e) }
  }

  const { data: accounts } = await supabase.from("payment_accounts").select("id, opening_balance").gt("opening_balance", 0)
  for (const a of (accounts as { id: string }[]) || []) {
    try {
      if (!(await hasPostedEntry("OPENING", a.id))) {
        await postOpeningBalance(a.id, createdBy); counts.openings++
      }
    } catch (e) { console.error("[backfill] opening", a.id, e) }
  }

  return counts
}
