import { supabase, isSupabaseConfigured } from "./supabase"
import { investorReport, type ReportPeriod } from "./reports"

export interface FinanceTransaction {
  id: string
  type: "income" | "expense"
  category: string
  subcategory?: string
  amount: number
  tax?: number
  description: string
  date: string
  leadId?: string
  account?: string
  paymentAccountId?: string
  recurring: boolean
  frequency?: "monthly" | "quarterly" | "yearly" | "one-time"
  createdAt: string
  updatedAt: string
}

export interface FinanceSettings {
  currency: string
  currencySymbol: string
  fiscalYearStart: string
  targetMrr: number
}

export interface FinanceData {
  transactions: FinanceTransaction[]
  settings: FinanceSettings
}

export const EXPENSE_CATEGORIES = [
  "Advertising & Marketing",
  "Bank Charges & Fees",
  "Business Registration & Compliance",
  "Client Entertainment",
  "Consulting & Professional Services",
  "Customer Support",
  "Depreciation",
  "Equipment & Hardware",
  "Fuel & Transportation",
  "Hosting & Infrastructure",
  "Insurance",
  "Interest & Loan Repayments",
  "Legal & Compliance",
  "Marketing & Advertising",
  "Office Rent",
  "Office Supplies",
  "Payroll & Salaries",
  "Printing & Stationery",
  "Professional Services",
  "Repairs & Maintenance",
  "Salaries & Wages",
  "Security",
  "Software & Tools",
  "Staff Benefits",
  "Taxes",
  "Telephone & Internet",
  "Training & Development",
  "Travel & Accommodation",
  "Utilities",
  "Other Expenses",
]

export const INCOME_CATEGORIES = [
  "Subscription Revenue",
  "One-Time License",
  "Add-On Revenue",
  "Product Sales",
  "Implementation Services",
  "Training Revenue",
  "Consulting Revenue",
  "Support Contracts",
  "Custom Development",
  "Logistics & Delivery",
  "White-Label Revenue",
  "Interest Income",
  "Partner Commissions",
  "Other Income",
]

export async function readFinanceData(): Promise<FinanceData> {
  if (!isSupabaseConfigured()) {
    return { transactions: [], settings: { currency: "NGN", currencySymbol: "₦", fiscalYearStart: "2026-01-01", targetMrr: 1000000 } }
  }
  try {
    const { data: txnData, error: txnError } = await supabase
      .from("finance_transactions")
      .select("*")
      .order("date", { ascending: false })

    const { data: settingsData, error: settingsError } = await supabase
      .from("finance_settings")
      .select("*")
      .eq("id", 1)
      .single()

    if (txnError || settingsError) {
      return { transactions: [], settings: { currency: "NGN", currencySymbol: "₦", fiscalYearStart: "2026-01-01", targetMrr: 1000000 } }
    }

    const transactions = (txnData || []).map((row) => ({
      id: row.id,
      type: row.type,
      category: row.category,
      subcategory: row.subcategory,
      amount: row.amount,
      tax: row.tax,
      description: row.description,
      date: row.date,
      leadId: row.lead_id,
      account: row.account,
      paymentAccountId: row.payment_account_id,
      recurring: row.recurring,
      frequency: row.frequency,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    })) as FinanceTransaction[]

    const settings = settingsData
      ? {
          currency: settingsData.currency,
          currencySymbol: settingsData.currency_symbol,
          fiscalYearStart: settingsData.fiscal_year_start,
          targetMrr: settingsData.target_mrr,
        }
      : { currency: "NGN", currencySymbol: "₦", fiscalYearStart: "2026-01-01", targetMrr: 1000000 }

    return { transactions, settings }
  } catch {
    return { transactions: [], settings: { currency: "NGN", currencySymbol: "₦", fiscalYearStart: "2026-01-01", targetMrr: 1000000 } }
  }
}

export async function writeFinanceData(data: FinanceData) {
  if (!isSupabaseConfigured()) return
  // Upsert settings
  await supabase.from("finance_settings").upsert({
    id: 1,
    currency: data.settings.currency,
    currency_symbol: data.settings.currencySymbol,
    fiscal_year_start: data.settings.fiscalYearStart,
    target_mrr: data.settings.targetMrr,
    updated_at: new Date().toISOString(),
  })
}

/* ─── LEADS ─── */
export async function readLeads() {
  if (!isSupabaseConfigured()) return { leads: [] }
  try {
    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .order("submitted_at", { ascending: false })
    if (error || !data) return { leads: [] }
    return { leads: data }
  } catch {
    return { leads: [] }
  }
}

/* ─── SUMMARY CALCULATIONS ─── */
export interface FinanceSummary {
  totalRevenue: number
  cashCollected: number
  totalExpenses: number
  netProfit: number
  grossMargin: number
  mrr: number
  arr: number
  burnRate: number
  runwayMonths: number
  customerCount: number
  paidBusinessCount: number
  activationPendingCount: number
  entitledBusinessCount: number
  revenuePerCustomer: number
  cac: number
  ltv: number
  ltvCacRatio: number
  expenseByCategory: Record<string, number>
  revenueByCategory: Record<string, number>
  monthlyTrend: Array<{ month: string; revenue: number; expenses: number; profit: number }>
}

export function getMonthKey(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

export function getWeekKey(dateStr: string): string {
  const d = new Date(dateStr)
  const year = d.getFullYear()
  // Get ISO week number
  const temp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = temp.getUTCDay() || 7
  temp.setUTCDate(temp.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(temp.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil((((temp.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return `${year}-W${String(weekNo).padStart(2, "0")}`
}

export function getStartOfWeek(dateStr: string): string {
  const d = new Date(dateStr)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) // Monday start
  const monday = new Date(d.setDate(diff))
  return monday.toISOString().split("T")[0]
}

export function getEndOfWeek(dateStr: string): string {
  const d = new Date(dateStr)
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(d.setDate(diff))
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return sunday.toISOString().split("T")[0]
}

export function getStartOfMonth(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`
}

export function getEndOfMonth(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()).padStart(2, "0")}`
}

export async function calculateSummary(period: ReportPeriod = "year"): Promise<FinanceSummary> {
  const [finance, investor] = await Promise.all([readFinanceData(), investorReport(period)])
  const transactions = finance.transactions
  const now = new Date()
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  if (period === "7d") start.setDate(start.getDate() - 7)
  else if (period === "30d") start.setDate(start.getDate() - 30)
  else if (period === "this_month") start.setDate(1)
  else if (period === "quarter") start.setMonth(Math.floor(start.getMonth() / 3) * 3, 1)
  else if (period === "year") start.setMonth(0, 1)

  const periodTxns = transactions.filter((t) => {
    const timestamp = new Date(`${t.date}T23:59:59`).getTime()
    return timestamp >= start.getTime() && timestamp <= now.getTime()
  })
  const incomeTxns = periodTxns.filter((t) => t.type === "income")
  const expenseTxns = periodTxns.filter((t) => t.type === "expense")
  const ledgerRevenue = incomeTxns.reduce((sum, t) => sum + t.amount, 0)
  const totalRevenue = ledgerRevenue || investor.revenue_collected
  const totalExpenses = expenseTxns.reduce((sum, t) => sum + t.amount, 0)
  const netProfit = totalRevenue - totalExpenses
  const grossMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0
  const customerCount = investor.active_businesses
  const mrr = investor.mrr
  const arr = investor.arr
  const monthsActive = ["today", "7d", "30d"].includes(period) ? 1 : Math.max(1, now.getMonth() + 1)
  const burnRate = totalExpenses / monthsActive
  const runwayMonths = netProfit > 0 ? 999 : totalRevenue / Math.max(burnRate, 1)
  const marketingSpend = expenseTxns
    .filter((t) => ["Marketing & Advertising", "Advertising & Marketing"].includes(t.category))
    .reduce((sum, t) => sum + t.amount, 0)
  const cac = investor.new_businesses > 0 ? marketingSpend / investor.new_businesses : 0
  const revenuePerCustomer = investor.arpu || (customerCount > 0 ? totalRevenue / customerCount : 0)
  const ltv = revenuePerCustomer * (grossMargin / 100) * 24
  const ltvCacRatio = cac > 0 ? ltv / cac : 0

  const expenseByCategory: Record<string, number> = {}
  const revenueByCategory: Record<string, number> = {}
  for (const t of expenseTxns) expenseByCategory[t.category] = (expenseByCategory[t.category] || 0) + t.amount
  for (const t of incomeTxns) revenueByCategory[t.category] = (revenueByCategory[t.category] || 0) + t.amount
  if (Object.keys(revenueByCategory).length === 0 && investor.revenue_collected > 0) revenueByCategory["Collected commercial revenue"] = investor.revenue_collected

  const monthlyMap = new Map<string, { revenue: number; expenses: number }>()
  for (const t of incomeTxns) {
    const m = getMonthKey(t.date)
    const current = monthlyMap.get(m) || { revenue: 0, expenses: 0 }
    current.revenue += t.amount
    monthlyMap.set(m, current)
  }
  for (const t of expenseTxns) {
    const m = getMonthKey(t.date)
    const current = monthlyMap.get(m) || { revenue: 0, expenses: 0 }
    current.expenses += t.amount
    monthlyMap.set(m, current)
  }
  for (const point of investor.monthly) {
    const current = monthlyMap.get(point.month) || { revenue: 0, expenses: 0 }
    if (current.revenue === 0) current.revenue = point.collected
    monthlyMap.set(point.month, current)
  }
  const monthlyTrend = Array.from(monthlyMap.entries())
    .map(([month, vals]) => ({ month, revenue: vals.revenue, expenses: vals.expenses, profit: vals.revenue - vals.expenses }))
    .sort((a, b) => a.month.localeCompare(b.month))

  return {
    totalRevenue,
    cashCollected: investor.revenue_collected,
    totalExpenses,
    netProfit,
    grossMargin,
    mrr,
    arr,
    burnRate,
    runwayMonths,
    customerCount,
    paidBusinessCount: investor.paid_businesses,
    activationPendingCount: investor.activation_pending_businesses,
    entitledBusinessCount: investor.entitled_businesses,
    revenuePerCustomer,
    cac,
    ltv,
    ltvCacRatio,
    expenseByCategory,
    revenueByCategory,
    monthlyTrend,
  }
}
