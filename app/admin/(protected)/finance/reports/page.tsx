"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, FileText, Download, ArrowUpRight, ArrowDownRight, ChevronLeft, ChevronRight } from "lucide-react"
import Link from "next/link"
import { jsPDF } from "jspdf"
import autoTable from "jspdf-autotable"

interface FinanceTransaction {
  id: string
  type: "income" | "expense"
  category: string
  amount: number
  tax?: number
  description: string
  date: string
  recurring: boolean
  frequency?: string
}

type PeriodType = "year" | "month" | "week"

function getISOWeek(date: Date): number {
  const temp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = temp.getUTCDay() || 7
  temp.setUTCDate(temp.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(temp.getUTCFullYear(), 0, 1))
  return Math.ceil((((temp.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

function getMonthLabel(yearMonth: string): string {
  const [y, m] = yearMonth.split("-").map(Number)
  const date = new Date(y, m - 1)
  return date.toLocaleString("en-US", { month: "long", year: "numeric" })
}

function getWeekRange(year: number, week: number): { start: string; end: string } {
  const jan4 = new Date(year, 0, 4)
  const jan4Day = jan4.getDay() || 7
  const firstMon = new Date(year, 0, 4 - jan4Day + 1)
  const start = new Date(firstMon)
  start.setDate(firstMon.getDate() + (week - 1) * 7)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  return {
    start: start.toISOString().split("T")[0],
    end: end.toISOString().split("T")[0],
  }
}

function formatNgn(n: number) {
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `₦${(n / 1_000).toFixed(0)}K`
  return `₦${n.toFixed(0)}`
}

function formatNgnFull(n: number) {
  return `₦${n.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const PnL_SECTIONS = [
  {
    title: "Revenue",
    type: "income" as const,
    items: [
      "Subscription Revenue",
      "One-Time Sales",
      "Setup & Implementation",
      "Support Contracts",
      "Training Revenue",
      "Consulting",
      "Other Revenue",
    ],
  },
  {
    title: "Cost of Revenue",
    type: "expense" as const,
    items: [
      "Hosting & Infrastructure",
      "Software & Tools",
      "Customer Support",
    ],
  },
  {
    title: "Operating Expenses",
    type: "expense" as const,
    items: [
      "Payroll & Salaries",
      "Rent & Facilities",
      "Marketing & Advertising",
      "Legal & Compliance",
      "Insurance",
      "Travel & Entertainment",
      "Equipment & Hardware",
      "Professional Services",
      "Utilities",
      "Training & Development",
      "Office Supplies",
      "Taxes",
      "Miscellaneous",
    ],
  },
]

export default function FinanceReportsPage() {
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([])
  const [loading, setLoading] = useState(true)

  const now = new Date()
  const [periodType, setPeriodType] = useState<PeriodType>("year")
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`)
  const [week, setWeek] = useState(`${now.getFullYear()}-W${String(getISOWeek(now)).padStart(2, "0")}`)

  useEffect(() => {
    fetch("/api/admin/finance")
      .then((res) => res.json())
      .then((data) => {
        if (data.transactions) setTransactions(data.transactions)
      })
      .finally(() => setLoading(false))
  }, [])

  const filteredTransactions = useMemo(() => {
    if (periodType === "year") {
      return transactions.filter((t) => new Date(t.date).getFullYear() === year)
    }
    if (periodType === "month") {
      const [y, m] = month.split("-")
      return transactions.filter((t) => {
        const d = new Date(t.date)
        return d.getFullYear() === Number(y) && String(d.getMonth() + 1).padStart(2, "0") === m
      })
    }
    if (periodType === "week") {
      const [wy, wStr] = week.split("-W")
      const { start, end } = getWeekRange(Number(wy), Number(wStr))
      return transactions.filter((t) => t.date >= start && t.date <= end)
    }
    return transactions
  }, [transactions, periodType, year, month, week])

  const incomeTxns = filteredTransactions.filter((t) => t.type === "income")
  const expenseTxns = filteredTransactions.filter((t) => t.type === "expense")

  const totalRevenue = incomeTxns.reduce((s, t) => s + t.amount, 0)
  const totalExpenses = expenseTxns.reduce((s, t) => s + t.amount, 0)
  const netProfit = totalRevenue - totalExpenses

  function categoryTotal(cats: string[]) {
    return filteredTransactions
      .filter((t) => cats.includes(t.category))
      .reduce((s, t) => s + t.amount, 0)
  }

  const costOfRevenue = categoryTotal(PnL_SECTIONS[1].items)
  const grossProfit = totalRevenue - costOfRevenue
  const operatingExpenses = categoryTotal(PnL_SECTIONS[2].items)
  const ebitda = grossProfit - operatingExpenses

  const taxTotal = filteredTransactions
    .filter((t) => t.type === "expense" && t.category === "Taxes")
    .reduce((s, t) => s + t.amount, 0)

  function exportCsv() {
    const rows = [
      ["Date", "Type", "Category", "Description", "Amount", "Tax", "Recurring", "Frequency"],
      ...filteredTransactions.map((t) => [
        t.date,
        t.type,
        t.category,
        t.description,
        String(t.amount),
        String(t.tax || 0),
        t.recurring ? "Yes" : "No",
        t.frequency || "one-time",
      ]),
    ]
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    const label = periodType === "year" ? String(year) : periodType === "month" ? month : week
    a.href = url
    a.download = `martpoint-finance-${label}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function exportPdf() {
    const doc = new jsPDF({ unit: "pt", format: "a4" })
    const margin = 40
    let y = 60

    doc.setFontSize(18)
    doc.setTextColor(0, 87, 255)
    doc.text("MartPoint — Profit & Loss Statement", margin, y)
    y += 28

    doc.setFontSize(10)
    doc.setTextColor(100, 100, 100)
    doc.text(`Period: ${periodLabel}`, margin, y)
    y += 18
    doc.text(`Generated: ${new Date().toLocaleString("en-NG")}`, margin, y)
    y += 30

    const tableData: Array<[string, string, string]> = []

    // Revenue
    PnL_SECTIONS[0].items.forEach((cat) => {
      const val = categoryTotal([cat])
      if (val > 0) tableData.push([cat, "", formatNgnFull(val)])
    })
    tableData.push(["Total Revenue", "", formatNgnFull(totalRevenue)])

    // Cost of Revenue
    PnL_SECTIONS[1].items.forEach((cat) => {
      const val = categoryTotal([cat])
      if (val > 0) tableData.push([cat, "", formatNgnFull(val)])
    })
    tableData.push(["Total Cost of Revenue", "", formatNgnFull(costOfRevenue)])
    tableData.push(["Gross Profit", "", formatNgnFull(grossProfit)])

    // Operating Expenses
    PnL_SECTIONS[2].items.forEach((cat) => {
      const val = categoryTotal([cat])
      if (val > 0) tableData.push([cat, "", formatNgnFull(val)])
    })
    tableData.push(["Total Operating Expenses", "", formatNgnFull(operatingExpenses)])
    tableData.push(["EBITDA", "", formatNgnFull(ebitda)])
    if (taxTotal > 0) tableData.push(["Taxes", "", formatNgnFull(taxTotal)])
    tableData.push(["Net Profit / Loss", "", formatNgnFull(netProfit)])

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["Item", "", "Amount (NGN)"]],
      body: tableData,
      styles: { fontSize: 9, cellPadding: 6 },
      headStyles: { fillColor: [0, 87, 255], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 249, 250] },
      columnStyles: {
        0: { cellWidth: "auto" },
        1: { cellWidth: 20 },
        2: { cellWidth: "auto", halign: "right", fontStyle: "bold" },
      },
      didParseCell: (data) => {
        const label = (data.row.raw as unknown as Array<string>)?.[0]
        const boldItems = [
          "Total Revenue",
          "Total Cost of Revenue",
          "Gross Profit",
          "Total Operating Expenses",
          "EBITDA",
          "Net Profit / Loss",
          "Taxes",
        ]
        if (boldItems.includes(label)) {
          data.cell.styles.fontStyle = "bold"
          data.cell.styles.fillColor = [240, 240, 240]
        }
        if (label === "Net Profit / Loss") {
          data.cell.styles.fillColor = [0, 0, 0]
          data.cell.styles.textColor = [255, 255, 255]
        }
      },
    })

    const label = periodType === "year" ? String(year) : periodType === "month" ? month : week
    doc.save(`martpoint-pnl-${label}.pdf`)
  }

  const periodLabel = (() => {
    if (periodType === "year") return String(year)
    if (periodType === "month") return getMonthLabel(month)
    if (periodType === "week") {
      const [wy, wStr] = week.split("-W")
      const { start, end } = getWeekRange(Number(wy), Number(wStr))
      return `Week ${wStr} (${start} – ${end})`
    }
    return ""
  })()

  const shiftMonth = (dir: number) => {
    const [y, m] = month.split("-").map(Number)
    const d = new Date(y, m - 1 + dir, 1)
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`)
  }

  const shiftWeek = (dir: number) => {
    const [wy, wStr] = week.split("-W")
    let y = Number(wy)
    let w = Number(wStr) + dir
    const maxWeek = getISOWeek(new Date(y, 11, 31))
    if (w < 1) { y -= 1; w = getISOWeek(new Date(y, 11, 31)) }
    if (w > maxWeek) { y += 1; w = 1 }
    setWeek(`${y}-W${String(w).padStart(2, "0")}`)
  }

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
            <FileText className="w-5 h-5" />
            Financial Reports
          </h2>
          <p className="text-muted-foreground">Profit & Loss, cash flow, and detailed breakdowns.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/finance">Dashboard</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/finance/transactions">Transactions</Link>
          </Button>
          <Button variant="outline" size="sm" onClick={exportPdf}>
            <FileText className="w-4 h-4 mr-1" />
            Export PDF
          </Button>
          <Button size="sm" onClick={exportCsv}>
            <Download className="w-4 h-4 mr-1" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Period selector */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="flex gap-1 bg-muted rounded-lg p-1">
          {(["year", "month", "week"] as PeriodType[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriodType(p)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                periodType === p ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {p === "year" ? "Yearly" : p === "month" ? "Monthly" : "Weekly"}
            </button>
          ))}
        </div>

        {periodType === "year" && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Year:</span>
            {[year - 1, year, year + 1].map((y) => (
              <Button key={y} variant={y === year ? "default" : "outline"} size="sm" onClick={() => setYear(y)}>
                {y}
              </Button>
            ))}
          </div>
        )}

        {periodType === "month" && (
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => shiftMonth(-1)}><ChevronLeft className="w-4 h-4" /></Button>
            <span className="text-sm font-medium min-w-[140px] text-center">{getMonthLabel(month)}</span>
            <Button variant="ghost" size="sm" onClick={() => shiftMonth(1)}><ChevronRight className="w-4 h-4" /></Button>
          </div>
        )}

        {periodType === "week" && (
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => shiftWeek(-1)}><ChevronLeft className="w-4 h-4" /></Button>
            <span className="text-sm font-medium min-w-[200px] text-center">{periodLabel}</span>
            <Button variant="ghost" size="sm" onClick={() => shiftWeek(1)}><ChevronRight className="w-4 h-4" /></Button>
          </div>
        )}
      </div>

      {/* P&L Statement */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Profit & Loss Statement — {periodLabel}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Revenue */}
          <div>
            <h4 className="text-xs font-semibold text-emerald-600 uppercase tracking-wider mb-2">Revenue</h4>
            <div className="space-y-1">
              {PnL_SECTIONS[0].items.map((cat) => {
                const val = categoryTotal([cat])
                if (val === 0) return null
                return (
                  <div key={cat} className="flex justify-between text-sm py-1 border-b border-dashed border-border">
                    <span className="text-muted-foreground pl-3">{cat}</span>
                    <span className="font-medium">{formatNgnFull(val)}</span>
                  </div>
                )
              })}
              <div className="flex justify-between text-sm font-semibold pt-2">
                <span>Total Revenue</span>
                <span className="text-emerald-600">{formatNgnFull(totalRevenue)}</span>
              </div>
            </div>
          </div>

          {/* Cost of Revenue */}
          <div>
            <h4 className="text-xs font-semibold text-rose-600 uppercase tracking-wider mb-2">Cost of Revenue</h4>
            <div className="space-y-1">
              {PnL_SECTIONS[1].items.map((cat) => {
                const val = categoryTotal([cat])
                if (val === 0) return null
                return (
                  <div key={cat} className="flex justify-between text-sm py-1 border-b border-dashed border-border">
                    <span className="text-muted-foreground pl-3">{cat}</span>
                    <span className="font-medium">{formatNgnFull(val)}</span>
                  </div>
                )
              })}
              <div className="flex justify-between text-sm font-semibold pt-2">
                <span>Total Cost of Revenue</span>
                <span className="text-rose-600">{formatNgnFull(costOfRevenue)}</span>
              </div>
            </div>
          </div>

          {/* Gross Profit */}
          <div className="flex justify-between text-sm font-bold py-3 bg-muted/40 rounded-lg px-4">
            <span>Gross Profit</span>
            <span className={grossProfit >= 0 ? "text-emerald-600" : "text-rose-600"}>{formatNgnFull(grossProfit)}</span>
          </div>

          {/* Operating Expenses */}
          <div>
            <h4 className="text-xs font-semibold text-rose-600 uppercase tracking-wider mb-2">Operating Expenses</h4>
            <div className="space-y-1">
              {PnL_SECTIONS[2].items.map((cat) => {
                const val = categoryTotal([cat])
                if (val === 0) return null
                return (
                  <div key={cat} className="flex justify-between text-sm py-1 border-b border-dashed border-border">
                    <span className="text-muted-foreground pl-3">{cat}</span>
                    <span className="font-medium">{formatNgnFull(val)}</span>
                  </div>
                )
              })}
              <div className="flex justify-between text-sm font-semibold pt-2">
                <span>Total Operating Expenses</span>
                <span className="text-rose-600">{formatNgnFull(operatingExpenses)}</span>
              </div>
            </div>
          </div>

          {/* EBITDA */}
          <div className="flex justify-between text-sm font-bold py-3 bg-muted/40 rounded-lg px-4">
            <span>EBITDA</span>
            <span className={ebitda >= 0 ? "text-emerald-600" : "text-rose-600"}>{formatNgnFull(ebitda)}</span>
          </div>

          {/* Tax */}
          {taxTotal > 0 && (
            <div className="flex justify-between text-sm py-2 border-b border-dashed border-border px-4">
              <span className="text-muted-foreground">Taxes</span>
              <span className="font-medium text-rose-600">{formatNgnFull(taxTotal)}</span>
            </div>
          )}

          {/* Net Profit */}
          <div className="flex justify-between text-base font-bold py-4 bg-foreground text-background rounded-lg px-4">
            <span>Net Profit / Loss</span>
            <span>{formatNgnFull(netProfit)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-50">
              <ArrowUpRight className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Revenue</p>
              <p className="text-lg font-bold">{formatNgn(totalRevenue)}</p>
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
              <p className="text-lg font-bold">{formatNgn(totalExpenses)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-50">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Gross Profit</p>
              <p className={`text-lg font-bold ${grossProfit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                {formatNgn(grossProfit)}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-50">
              <FileText className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">EBITDA</p>
              <p className={`text-lg font-bold ${ebitda >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                {formatNgn(ebitda)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
