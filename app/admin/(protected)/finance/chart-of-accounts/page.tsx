"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Scale, Plus, X } from "lucide-react"
import { formatMoney } from "@/components/admin/gl-statement"

type GlAccount = {
  id: string
  code: string
  name: string
  type: "ASSET" | "LIABILITY" | "EQUITY" | "INCOME" | "EXPENSE"
  subtype?: string | null
  account_key?: string | null
  is_system: boolean
  active: boolean
  balance: number
}

const TYPE_ORDER: GlAccount["type"][] = ["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"]
const TYPE_LABELS: Record<GlAccount["type"], string> = {
  ASSET: "Assets",
  LIABILITY: "Liabilities",
  EQUITY: "Equity",
  INCOME: "Income",
  EXPENSE: "Expenses",
}

export default function ChartOfAccountsPage() {
  const [accounts, setAccounts] = useState<GlAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState("")
  const [working, setWorking] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState({ code: "", name: "", type: "EXPENSE", subtype: "", description: "" })

  const load = useCallback(() => {
    fetch("/api/admin/finance/ledger?resource=gl-accounts")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setAccounts(d.data || [])
        else setMessage(d.error || "Failed to load chart of accounts")
      })
      .catch(() => setMessage("Failed to load chart of accounts"))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const grouped = useMemo(() => {
    const map = new Map<GlAccount["type"], GlAccount[]>()
    for (const t of TYPE_ORDER) map.set(t, [])
    for (const a of accounts) map.get(a.type)?.push(a)
    return map
  }, [accounts])

  const createAccount = async () => {
    if (!addForm.code.trim() || !addForm.name.trim()) { setMessage("Code and name are required"); return }
    setWorking(true)
    try {
      const res = await fetch("/api/admin/finance/ledger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resource: "gl-accounts", action: "create", ...addForm }),
      })
      const data = await res.json()
      if (data.success) {
        setShowAdd(false)
        setAddForm({ code: "", name: "", type: "EXPENSE", subtype: "", description: "" })
        setMessage("Account created")
        setTimeout(() => setMessage(""), 3000)
        load()
      } else setMessage(data.error || "Create failed")
    } finally {
      setWorking(false)
    }
  }

  const toggleActive = async (a: GlAccount) => {
    await fetch("/api/admin/finance/ledger", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resource: "gl-accounts", action: a.active ? "set_inactive" : "set_active", id: a.id }),
    })
    load()
  }

  const input = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm"

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Scale className="h-5 w-5" /> Chart of Accounts
          </h2>
          <p className="text-muted-foreground">
            Double-entry ledger. Every invoice, payment, expense, transfer and payout posts balanced debits and credits.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/admin/finance/accounts">Payment Accounts</Link>
          </Button>
          <Button size="sm" onClick={() => setShowAdd(true)}>
            <Plus className="mr-1 h-4 w-4" /> New Account
          </Button>
        </div>
      </div>

      {message && (
        <div className={`rounded-lg border px-4 py-3 text-sm ${message.includes("created") ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-destructive/20 bg-destructive/10 text-destructive"}`}>
          {message}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        TYPE_ORDER.map((type) => {
          const list = grouped.get(type) || []
          if (!list.length) return null
          const total = list.reduce((s, a) => s + a.balance, 0)
          return (
            <Card key={type}>
              <CardContent className="p-0">
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <h3 className="text-sm font-semibold uppercase tracking-wider">{TYPE_LABELS[type]}</h3>
                  <span className="text-sm font-medium">{formatMoney(total)}</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <tbody>
                      {list.map((a) => (
                        <tr key={a.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                          <td className="w-24 px-4 py-2.5 font-mono text-xs text-muted-foreground">{a.code}</td>
                          <td className="px-4 py-2.5">
                            <Link href={`/admin/finance/chart-of-accounts/${a.id}`} className="font-medium hover:underline">
                              {a.name}
                            </Link>
                            {a.subtype && (
                              <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                {a.subtype.replace(/_/g, " ")}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2.5 text-right font-medium">{formatMoney(a.balance)}</td>
                          <td className="w-24 px-4 py-2.5 text-right">
                            {!a.is_system && (
                              <button
                                onClick={() => toggleActive(a)}
                                className={`text-xs ${a.active ? "text-muted-foreground hover:text-rose-600" : "text-rose-600 hover:text-emerald-600"}`}
                              >
                                {a.active ? "Deactivate" : "Activate"}
                              </button>
                            )}
                            {!a.active && <span className="ml-1 text-[10px] uppercase text-rose-600">off</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )
        })
      )}

      {/* Add GL account */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-background p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">New GL Account</h3>
              <button onClick={() => setShowAdd(false)} className="rounded-md p-1 text-muted-foreground hover:bg-muted"><X className="h-5 w-5" /></button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-xs font-medium">Code *</label>
                <input className={input} value={addForm.code} onChange={(e) => setAddForm({ ...addForm, code: e.target.value })} placeholder="e.g. 5600" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Type *</label>
                <select className={input} value={addForm.type} onChange={(e) => setAddForm({ ...addForm, type: e.target.value as GlAccount["type"] })}>
                  {TYPE_ORDER.map((t) => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="mb-1 block text-xs font-medium">Name *</label>
                <input className={input} value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })} placeholder="e.g. Delivery Costs" />
              </div>
              <div className="col-span-2">
                <label className="mb-1 block text-xs font-medium">Description</label>
                <input className={input} value={addForm.description} onChange={(e) => setAddForm({ ...addForm, description: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button size="sm" onClick={createAccount} disabled={working}>{working ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
