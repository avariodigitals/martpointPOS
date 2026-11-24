"use client"

import { useState, useEffect, useMemo } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Loader2,
  Receipt,
  Trash2,
  Plus,
  X,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  Pencil,
} from "lucide-react"
import Link from "next/link"
import { formatMoney } from "@/lib/money-format"
import { enumLabel } from "@/lib/utils"

interface FinanceTransaction {
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
  frequency?: string
  createdAt: string
}

const EXPENSE_CATEGORIES = [
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

const INCOME_CATEGORIES = [
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
  "Other Income",
]

function formatNgn(n: number) {
  return formatMoney(n)
}

type TransactionDatePeriod = "all" | "day" | "week" | "month" | "year"

function getLocalDateInputValue(date = new Date()) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

function getISOWeekInputValue(date = new Date()) {
  const weekDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayOfWeek = weekDate.getUTCDay() || 7
  weekDate.setUTCDate(weekDate.getUTCDate() + 4 - dayOfWeek)
  const weekYear = weekDate.getUTCFullYear()
  const yearStart = new Date(Date.UTC(weekYear, 0, 1))
  const week = Math.ceil(((weekDate.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${weekYear}-W${String(week).padStart(2, "0")}`
}

function getISOWeekBounds(value: string) {
  const match = /^(\d{4})-W(\d{2})$/.exec(value)
  if (!match) return null
  const year = Number(match[1])
  const week = Number(match[2])
  if (week < 1 || week > 53) return null
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const dayOfWeek = jan4.getUTCDay() || 7
  const start = new Date(jan4)
  start.setUTCDate(jan4.getUTCDate() - dayOfWeek + 1 + (week - 1) * 7)
  const end = new Date(start)
  end.setUTCDate(start.getUTCDate() + 6)
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  }
}

export default function FinanceTransactionsPage() {
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState("")

  const [showAddModal, setShowAddModal] = useState(false)
  const [addForm, setAddForm] = useState({
    type: "expense" as "income" | "expense",
    category: "",
    amount: "",
    tax: "",
    taxEnabled: false,
    account: "",
    paymentAccountId: "",
    description: "",
    date: new Date().toISOString().split("T")[0],
    recurring: false,
    frequency: "one-time" as string,
  })
  const [adding, setAdding] = useState(false)

  // Edit Transaction modal
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState({
    type: "expense" as "income" | "expense",
    category: "",
    amount: "",
    tax: "",
    taxEnabled: false,
    account: "",
    paymentAccountId: "",
    description: "",
    date: new Date().toISOString().split("T")[0],
    recurring: false,
    frequency: "one-time" as string,
  })

  const searchParams = useSearchParams()
  const initialType = searchParams.get("type") || "all"
  const validType = initialType === "income" || initialType === "expense" ? initialType : "all"

  const [filterType, setFilterType] = useState<string>(validType)
  const [searchQuery, setSearchQuery] = useState("")
  const [datePeriod, setDatePeriod] = useState<TransactionDatePeriod>("all")
  const [filterDay, setFilterDay] = useState(() => getLocalDateInputValue())
  const [filterWeek, setFilterWeek] = useState(() => getISOWeekInputValue())
  const [filterMonth, setFilterMonth] = useState(() => getLocalDateInputValue().slice(0, 7))
  const [filterYear, setFilterYear] = useState(() => String(new Date().getFullYear()))
  const [categoryList, setCategoryList] = useState<Array<{ id: string; type: string; name: string; active: boolean }>>([])
  const [paymentAccounts, setPaymentAccounts] = useState<Array<{ id: string; name: string; active: boolean }>>([])

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/finance").then((res) => res.json()),
      fetch("/api/admin/finance/categories").then((res) => res.json()),
      fetch("/api/admin/finance/ledger?resource=payment-accounts").then((res) => res.json()),
    ])
      .then(([financeData, catData, acctData]) => {
        if (financeData.transactions) setTransactions(financeData.transactions)
        if (catData.categories) setCategoryList(catData.categories)
        if (acctData.success && acctData.data) setPaymentAccounts(acctData.data)
      })
      .catch(() => setMessage("Failed to load data"))
      .finally(() => setLoading(false))
  }, [])

  const accountName = (t: FinanceTransaction) => {
    const pa = paymentAccounts.find((a) => a.id === (t as { paymentAccountId?: string }).paymentAccountId)
    return pa?.name || t.account || "—"
  }

  const activeCategories = useMemo(() => {
    const fromDb = categoryList.filter((c) => c.type === addForm.type && c.active).map((c) => c.name)
    return fromDb.length > 0 ? fromDb : (addForm.type === "expense" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES)
  }, [categoryList, addForm.type])

  const editActiveCategories = useMemo(() => {
    const fromDb = categoryList.filter((c) => c.type === editForm.type && c.active).map((c) => c.name)
    return fromDb.length > 0 ? fromDb : (editForm.type === "expense" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES)
  }, [categoryList, editForm.type])

  const categories = activeCategories
  const editCategories = editActiveCategories

  const filteredTransactions = useMemo(() => {
    let list = transactions
    if (filterType !== "all") list = list.filter((t) => t.type === filterType)
    if (datePeriod === "day") {
      list = list.filter((t) => t.date.slice(0, 10) === filterDay)
    } else if (datePeriod === "week") {
      const bounds = getISOWeekBounds(filterWeek)
      if (bounds) list = list.filter((t) => t.date.slice(0, 10) >= bounds.start && t.date.slice(0, 10) <= bounds.end)
      else list = []
    } else if (datePeriod === "month") {
      list = filterMonth ? list.filter((t) => t.date.startsWith(filterMonth)) : []
    } else if (datePeriod === "year") {
      list = filterYear ? list.filter((t) => t.date.startsWith(filterYear)) : []
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      list = list.filter((t) =>
        t.description.toLowerCase().includes(q) || t.category.toLowerCase().includes(q)
      )
    }
    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [transactions, filterType, searchQuery, datePeriod, filterDay, filterWeek, filterMonth, filterYear])

  const addTransaction = async () => {
    setAdding(true)
    setMessage("")
    try {
      const res = await fetch("/api/admin/finance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...addForm,
          amount: Number(addForm.amount),
          tax: addForm.taxEnabled ? Number(addForm.tax) : 0,
        }),
      })
      const data = await res.json()
      if (data.success && data.transaction) {
        setTransactions((prev) => [data.transaction, ...prev])
        setShowAddModal(false)
        setAddForm({
          type: "expense",
          category: "",
          amount: "",
          tax: "",
          taxEnabled: false,
          account: "",
          paymentAccountId: "",
          description: "",
          date: new Date().toISOString().split("T")[0],
          recurring: false,
          frequency: "one-time",
        })
        setMessage("Transaction added successfully.")
        setTimeout(() => setMessage(""), 3000)
      } else {
        setMessage(data.error || "Failed to add transaction")
      }
    } catch {
      setMessage("Failed to add transaction")
    } finally {
      setAdding(false)
    }
  }

  const openEdit = (t: FinanceTransaction) => {
    setEditingId(t.id)
    setEditForm({
      type: t.type,
      category: t.category,
      amount: String(t.amount),
      tax: t.tax !== undefined ? String(t.tax) : "",
      taxEnabled: Number(t.tax) > 0,
      account: t.account || "",
      paymentAccountId: (t as { paymentAccountId?: string }).paymentAccountId || "",
      description: t.description,
      date: t.date,
      recurring: t.recurring,
      frequency: t.frequency || "one-time",
    })
    setShowEditModal(true)
  }

  const updateTransaction = async () => {
    if (!editingId) return
    setEditing(true)
    setMessage("")
    try {
      const res = await fetch("/api/admin/finance", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingId,
          ...editForm,
          amount: Number(editForm.amount),
          tax: editForm.taxEnabled ? Number(editForm.tax) : 0,
        }),
      })
      const data = await res.json()
      if (data.success && data.transaction) {
        setTransactions((prev) => prev.map((t) => (t.id === editingId ? data.transaction : t)))
        setShowEditModal(false)
        setEditingId(null)
        setMessage("Transaction updated.")
        setTimeout(() => setMessage(""), 3000)
      } else {
        setMessage(data.error || "Failed to update transaction")
      }
    } catch {
      setMessage("Failed to update transaction")
    } finally {
      setEditing(false)
    }
  }

  const deleteTransaction = async (id: string) => {
    if (!confirm("Delete this transaction?")) return
    try {
      const res = await fetch(`/api/admin/finance?id=${id}`, { method: "DELETE" })
      const data = await res.json()
      if (data.success) {
        setTransactions((prev) => prev.filter((t) => t.id !== id))
      }
    } catch {
      setMessage("Failed to delete transaction")
    }
  }

  const totalIncome = transactions.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0)
  const totalExpense = transactions.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Receipt className="w-5 h-5" />
            Transactions
          </h2>
          <p className="text-muted-foreground">Record every income and expense. Every kobo must be accounted for.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/finance">Dashboard</Link>
          </Button>
          <Button size="sm" onClick={() => setShowAddModal(true)}>
            <Plus className="w-4 h-4 mr-1" />
            Add Transaction
          </Button>
        </div>
      </div>

      {message && (
        <div className={`rounded-lg px-4 py-3 text-sm ${message.includes("success") ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-destructive/10 text-destructive border border-destructive/20"}`}>
          {message}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-50">
              <ArrowUpRight className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Income</p>
              <p className="text-lg font-bold">{formatNgn(totalIncome)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-rose-50">
              <ArrowDownRight className="w-5 h-5 text-rose-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Expenses</p>
              <p className="text-lg font-bold">{formatNgn(totalExpense)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-50">
              <Receipt className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Net Position</p>
              <p className={`text-lg font-bold ${totalIncome - totalExpense >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                {formatNgn(totalIncome - totalExpense)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search transactions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="transaction-date-period" className="text-sm text-muted-foreground">Period</label>
          <select
            id="transaction-date-period"
            value={datePeriod}
            onChange={(e) => setDatePeriod(e.target.value as TransactionDatePeriod)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="all">All time</option>
            <option value="day">Day</option>
            <option value="week">Week</option>
            <option value="month">Month</option>
            <option value="year">Year</option>
          </select>
          {datePeriod === "day" && (
            <input
              type="date"
              aria-label="Filter transactions by day"
              value={filterDay}
              onChange={(e) => setFilterDay(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          )}
          {datePeriod === "week" && (
            <input
              type="week"
              aria-label="Filter transactions by week"
              value={filterWeek}
              onChange={(e) => setFilterWeek(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          )}
          {datePeriod === "month" && (
            <input
              type="month"
              aria-label="Filter transactions by month"
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          )}
          {datePeriod === "year" && (
            <input
              type="number"
              aria-label="Filter transactions by year"
              min="1900"
              max="9999"
              step="1"
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
              className="w-28 rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          )}
        </div>
        <div className="flex gap-2">
          <Button variant={filterType === "all" ? "default" : "outline"} size="sm" onClick={() => setFilterType("all")}>All</Button>
          <Button variant={filterType === "income" ? "default" : "outline"} size="sm" onClick={() => setFilterType("income")}>Income</Button>
          <Button variant={filterType === "expense" ? "default" : "outline"} size="sm" onClick={() => setFilterType("expense")}>Expenses</Button>
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Type</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Category</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Description</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Account</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Amount</th>
                <th className="text-center px-4 py-3 font-medium text-muted-foreground">Recurring</th>
                <th className="text-right px-4 py-3 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTransactions.map((t) => (
                <tr key={t.id} className="border-b border-border hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap">{t.date}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${t.type === "income" ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                      {t.type === "income" ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                      {t.type === "income" ? "Income" : "Expense"}
                    </span>
                  </td>
                  <td className="px-4 py-3">{enumLabel(t.category)}</td>
                  <td className="px-4 py-3 max-w-xs truncate">{t.description}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{accountName(t)}</td>
                  <td className={`px-4 py-3 text-right font-medium ${t.type === "income" ? "text-emerald-600" : "text-rose-600"}`}>
                    {t.type === "income" ? "+" : "-"}{formatNgn(t.amount)}
                    {t.tax ? <span className="block text-xs text-muted-foreground">Tax: {formatNgn(t.tax)}</span> : null}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {t.recurring ? (
                      <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">{t.frequency}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEdit(t)}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-blue-600 hover:bg-blue-50 transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteTransaction(t.id)}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredTransactions.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                    No transactions found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Add Transaction Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl border border-border bg-background shadow-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Add Transaction</h3>
              <button onClick={() => setShowAddModal(false)} className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1">Type *</label>
                <select
                  value={addForm.type}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, type: e.target.value as "income" | "expense", category: "" }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Date *</label>
                <input
                  type="date"
                  value={addForm.date}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, date: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium mb-1">Category *</label>
                <select
                  value={addForm.category}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, category: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Select category...</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium mb-1">Amount (₦) *</label>
                <input
                  type="number"
                  min="0"
                  value={addForm.amount}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, amount: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="0.00"
                />
              </div>
              <div>
                {addForm.type === "expense" ? (
                  <>
                    <label className="block text-xs font-medium mb-1">Tax</label>
                    <select
                      value={addForm.taxEnabled ? "tax" : "no-tax"}
                      onChange={(e) => setAddForm((prev) => ({
                        ...prev,
                        taxEnabled: e.target.value === "tax",
                        tax: e.target.value === "tax" ? prev.tax : "",
                      }))}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="no-tax">No tax</option>
                      <option value="tax">Tax</option>
                    </select>
                    {addForm.taxEnabled && (
                      <input
                        type="number"
                        min="0"
                        value={addForm.tax}
                        onChange={(e) => setAddForm((prev) => ({ ...prev, tax: e.target.value }))}
                        className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        placeholder="Tax amount (₦)"
                        aria-label="Tax amount in Naira"
                      />
                    )}
                  </>
                ) : (
                  <>
                    <label className="block text-xs font-medium mb-1">Tax (₦)</label>
                    <input
                      type="number"
                      min="0"
                      value={addForm.tax}
                      onChange={(e) => setAddForm((prev) => ({ ...prev, tax: e.target.value }))}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      placeholder="0.00"
                    />
                  </>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">{addForm.type === "expense" ? "Paid From" : "Paid Into"}</label>
                <select
                  value={addForm.paymentAccountId}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, paymentAccountId: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Default account</option>
                  {paymentAccounts.filter((a) => a.active).map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium mb-1">Description *</label>
                <input
                  type="text"
                  value={addForm.description}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, description: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="What is this transaction for?"
                />
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={addForm.recurring}
                    onChange={(e) => setAddForm((prev) => ({ ...prev, recurring: e.target.checked }))}
                    className="rounded border-input"
                  />
                  Recurring
                </label>
              </div>
              {addForm.recurring && (
                <div>
                  <label className="block text-xs font-medium mb-1">Frequency</label>
                  <select
                    value={addForm.frequency}
                    onChange={(e) => setAddForm((prev) => ({ ...prev, frequency: e.target.value }))}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" size="sm" onClick={() => setShowAddModal(false)} disabled={adding}>Cancel</Button>
              <Button size="sm" onClick={addTransaction} disabled={adding || !addForm.category || !addForm.amount || !addForm.description || (addForm.type === "expense" && addForm.taxEnabled && !addForm.tax)}>
                {adding ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                Add Transaction
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Transaction Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl border border-border bg-background shadow-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Edit Transaction</h3>
              <button onClick={() => setShowEditModal(false)} className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1">Type *</label>
                <select
                  value={editForm.type}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, type: e.target.value as "income" | "expense", category: "" }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Date *</label>
                <input
                  type="date"
                  value={editForm.date}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, date: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium mb-1">Category *</label>
                <select
                  value={editForm.category}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, category: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Select category...</option>
                  {editCategories.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium mb-1">Amount (₦) *</label>
                <input
                  type="number"
                  min="0"
                  value={editForm.amount}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, amount: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                {editForm.type === "expense" ? (
                  <>
                    <label className="block text-xs font-medium mb-1">Tax</label>
                    <select
                      value={editForm.taxEnabled ? "tax" : "no-tax"}
                      onChange={(e) => setEditForm((prev) => ({
                        ...prev,
                        taxEnabled: e.target.value === "tax",
                        tax: e.target.value === "tax" ? prev.tax : "",
                      }))}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      <option value="no-tax">No tax</option>
                      <option value="tax">Tax</option>
                    </select>
                    {editForm.taxEnabled && (
                      <input
                        type="number"
                        min="0"
                        value={editForm.tax}
                        onChange={(e) => setEditForm((prev) => ({ ...prev, tax: e.target.value }))}
                        className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        placeholder="Tax amount (₦)"
                        aria-label="Tax amount in Naira"
                      />
                    )}
                  </>
                ) : (
                  <>
                    <label className="block text-xs font-medium mb-1">Tax (₦)</label>
                    <input
                      type="number"
                      min="0"
                      value={editForm.tax}
                      onChange={(e) => setEditForm((prev) => ({ ...prev, tax: e.target.value }))}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </>
                )}
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">{editForm.type === "expense" ? "Paid From" : "Paid Into"}</label>
                <select
                  value={editForm.paymentAccountId}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, paymentAccountId: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Default account</option>
                  {paymentAccounts.filter((a) => a.active).map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium mb-1">Description *</label>
                <input
                  type="text"
                  value={editForm.description}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, description: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={editForm.recurring}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, recurring: e.target.checked }))}
                    className="rounded border-input"
                  />
                  Recurring
                </label>
              </div>
              {editForm.recurring && (
                <div>
                  <label className="block text-xs font-medium mb-1">Frequency</label>
                  <select
                    value={editForm.frequency}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, frequency: e.target.value }))}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" size="sm" onClick={() => setShowEditModal(false)} disabled={editing}>Cancel</Button>
              <Button size="sm" onClick={updateTransaction} disabled={editing || !editForm.category || !editForm.amount || !editForm.description || (editForm.type === "expense" && editForm.taxEnabled && !editForm.tax)}>
                {editing ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                Save Changes
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
