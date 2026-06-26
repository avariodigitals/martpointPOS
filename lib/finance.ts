import { supabase, isSupabaseConfigured } from "./supabase"

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
  "Payroll & Salaries",
  "Rent & Facilities",
  "Marketing & Advertising",
  "Software & Tools",
  "Hosting & Infrastructure",
  "Legal & Compliance",
  "Insurance",
  "Taxes",
  "Travel & Entertainment",
  "Equipment & Hardware",
  "Professional Services",
  "Utilities",
  "Training & Development",
  "Office Supplies",
  "Customer Support",
  "Miscellaneous",
]

export const INCOME_CATEGORIES = [
  "Subscription Revenue",
  "One-Time Sales",
  "Setup & Implementation",
  "Support Contracts",
  "Training Revenue",
  "Consulting",
  "Other Revenue",
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
  totalExpenses: number
  netProfit: number
  grossMargin: number
  mrr: number
  arr: number
  burnRate: number
  runwayMonths: number
  customerCount: number
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

export async function calculateSummary(): Promise<FinanceSummary> {
  const finance = await readFinanceData()
  const leads = await readLeads()
  const transactions = finance.transactions

  // Converted leads = customers
  const convertedLeads = leads.leads.filter((l) => l.status === "Won" || l.status === "Proposal")
  const customerCount = convertedLeads.length

  // Filter to current year transactions
  const now = new Date()
  const currentYear = now.getFullYear()
  const yearTxns = transactions.filter((t) => new Date(t.date).getFullYear() === currentYear)

  const incomeTxns = yearTxns.filter((t) => t.type === "income")
  const expenseTxns = yearTxns.filter((t) => t.type === "expense")

  const totalRevenue = incomeTxns.reduce((sum, t) => sum + t.amount, 0)
  const totalExpenses = expenseTxns.reduce((sum, t) => sum + t.amount, 0)
  const netProfit = totalRevenue - totalExpenses
  const grossMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0

  // MRR = recurring monthly income
  const recurringMonthly = incomeTxns
    .filter((t) => t.recurring && t.frequency === "monthly")
    .reduce((sum, t) => sum + t.amount, 0)
  // Add one-time income averaged to monthly
  const oneTimeIncome = incomeTxns
    .filter((t) => !t.recurring || t.frequency === "one-time")
    .reduce((sum, t) => sum + t.amount, 0)
  const avgMonthlyOneTime = oneTimeIncome / Math.max(1, new Date().getMonth() + 1)
  const mrr = recurringMonthly + avgMonthlyOneTime
  const arr = mrr * 12

  // Burn rate = avg monthly expenses
  const monthsActive = Math.max(1, new Date().getMonth() + 1)
  const burnRate = totalExpenses / monthsActive

  // Runway = net profit / burn rate (simplified: if profitable, infinite)
  const runwayMonths = netProfit > 0 ? 999 : totalRevenue / Math.max(burnRate, 1)

  // CAC = total marketing spend / new customers acquired
  const marketingSpend = expenseTxns
    .filter((t) => t.category === "Marketing & Advertising")
    .reduce((sum, t) => sum + t.amount, 0)
  const cac = customerCount > 0 ? marketingSpend / customerCount : 0

  // LTV = ARPU * gross margin * avg customer lifespan (simplified: 24 months)
  const revenuePerCustomer = customerCount > 0 ? totalRevenue / customerCount : 0
  const ltv = revenuePerCustomer * (grossMargin / 100) * 24
  const ltvCacRatio = cac > 0 ? ltv / cac : 0

  // Category breakdowns
  const expenseByCategory: Record<string, number> = {}
  const revenueByCategory: Record<string, number> = {}

  for (const t of expenseTxns) {
    expenseByCategory[t.category] = (expenseByCategory[t.category] || 0) + t.amount
  }
  for (const t of incomeTxns) {
    revenueByCategory[t.category] = (revenueByCategory[t.category] || 0) + t.amount
  }

  // Monthly trend
  const monthlyMap = new Map<string, { revenue: number; expenses: number }>()
  for (const t of incomeTxns) {
    const m = getMonthKey(t.date)
    const curr = monthlyMap.get(m) || { revenue: 0, expenses: 0 }
    curr.revenue += t.amount
    monthlyMap.set(m, curr)
  }
  for (const t of expenseTxns) {
    const m = getMonthKey(t.date)
    const curr = monthlyMap.get(m) || { revenue: 0, expenses: 0 }
    curr.expenses += t.amount
    monthlyMap.set(m, curr)
  }

  const monthlyTrend = Array.from(monthlyMap.entries())
    .map(([month, vals]) => ({
      month,
      revenue: vals.revenue,
      expenses: vals.expenses,
      profit: vals.revenue - vals.expenses,
    }))
    .sort((a, b) => a.month.localeCompare(b.month))

  return {
    totalRevenue,
    totalExpenses,
    netProfit,
    grossMargin,
    mrr,
    arr,
    burnRate,
    runwayMonths,
    customerCount,
    revenuePerCustomer,
    cac,
    ltv,
    ltvCacRatio,
    expenseByCategory,
    revenueByCategory,
    monthlyTrend,
  }
}
