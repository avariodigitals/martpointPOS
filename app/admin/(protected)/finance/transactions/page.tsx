"use client"

import { useState, useEffect, useMemo } from "react"
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
} from "lucide-react"
import Link from "next/link"

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
  "One-Time Sales",
  "Setup & Implementation",
  "Support Contracts",
  "Training Revenue",
  "Consulting",
  "Other Revenue",
]

function formatNgn(n: number) {
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `₦${(n / 1_000).toFixed(0)}K`
  return `₦${n.toFixed(0)}`
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
    account: "",
    description: "",
    date: new Date().toISOString().split("T")[0],
    recurring: false,
    frequency: "one-time" as string,
  })
  const [adding, setAdding] = useState(false)

  const [filterType, setFilterType] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    fetch("/api/admin/finance")
      .then((res) => res.json())
      .then((data) => {
        if (data.transactions) setTransactions(data.transactions)
      })
      .catch(() => setMessage("Failed to load transactions"))
      .finally(() => setLoading(false))
  }, [])

  const categories = addForm.type === "expense" ? EXPENSE_CATEGORIES : INCOME_CATEGORIES

  const filteredTransactions = useMemo(() => {
    let list = transactions
    if (filterType !== "all") list = list.filter((t) => t.type === filterType)
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      list = list.filter((t) =>
        t.description.toLowerCase().includes(q) || t.category.toLowerCase().includes(q)
      )
    }
    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [transactions, filterType, searchQuery])

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
          account: "",
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
      <div className="flex flex-col sm:flex-row gap-3">
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
                  <td className="px-4 py-3">{t.category}</td>
                  <td className="px-4 py-3 max-w-xs truncate">{t.description}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{t.account || "—"}</td>
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
                    <button
                      onClick={() => deleteTransaction(t.id)}
                      className="p-1.5 rounded-md text-muted-foreground hover:text-rose-600 hover:bg-rose-50 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
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
                <label className="block text-xs font-medium mb-1">Tax (₦)</label>
                <input
                  type="number"
                  min="0"
                  value={addForm.tax}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, tax: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Account / Bank</label>
                <input
                  type="text"
                  value={addForm.account}
                  onChange={(e) => setAddForm((prev) => ({ ...prev, account: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="e.g. GTBank Business"
                />
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
              <Button size="sm" onClick={addTransaction} disabled={adding || !addForm.category || !addForm.amount || !addForm.description}>
                {adding ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
                Add Transaction
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
