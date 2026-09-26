"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Loader2,
  Landmark,
  Plus,
  X,
  ArrowLeftRight,
  ArrowDownToLine,
  DatabaseZap,
} from "lucide-react"
import { formatMoney } from "@/components/admin/gl-statement"

type PaymentAccount = {
  id: string
  name: string
  gl_account_id: string
  payment_method?: string | null
  bank_name?: string | null
  account_number_last4?: string | null
  currency: string
  opening_balance: number
  is_default: boolean
  active: boolean
  balance: number
  gl_accounts?: { code: string; name: string; type: string } | null
}

const METHODS = ["BANK_TRANSFER", "PAYSTACK", "FLUTTERWAVE", "CASH", "POS", "OTHER"]

export default function PaymentAccountsPage() {
  const [accounts, setAccounts] = useState<PaymentAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState("")
  const [working, setWorking] = useState(false)

  const [showAdd, setShowAdd] = useState(false)
  const [showTransfer, setShowTransfer] = useState(false)
  const [showDeposit, setShowDeposit] = useState(false)

  const [addForm, setAddForm] = useState({
    name: "",
    payment_method: "",
    bank_name: "",
    account_number_last4: "",
    opening_balance: "",
    is_default: false,
  })
  const [transferForm, setTransferForm] = useState({ from_account_id: "", to_account_id: "", amount: "", memo: "" })
  const [depositForm, setDepositForm] = useState({ payment_account_id: "", amount: "", income_category: "", memo: "" })

  const load = useCallback(() => {
    fetch("/api/admin/finance/ledger?resource=payment-accounts")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setAccounts(d.data || [])
        else setMessage(d.error || "Failed to load accounts")
      })
      .catch(() => setMessage("Failed to load accounts"))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const flash = (msg: string) => { setMessage(msg); setTimeout(() => setMessage(""), 4000) }

  async function post(body: Record<string, unknown>, successMsg: string) {
    setWorking(true)
    setMessage("")
    try {
      const res = await fetch("/api/admin/finance/ledger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.success) {
        flash(successMsg)
        load()
        return true
      }
      setMessage(data.error || "Operation failed")
      return false
    } catch {
      setMessage("Operation failed")
      return false
    } finally {
      setWorking(false)
    }
  }

  const createAccount = async () => {
    if (!addForm.name.trim()) { setMessage("Name is required"); return }
    const done = await post(
      {
        resource: "payment-accounts",
        action: "create",
        ...addForm,
        payment_method: addForm.payment_method || undefined,
        opening_balance: addForm.opening_balance ? Number(addForm.opening_balance) : 0,
      },
      "Account created",
    )
    if (done) {
      setShowAdd(false)
      setAddForm({ name: "", payment_method: "", bank_name: "", account_number_last4: "", opening_balance: "", is_default: false })
    }
  }

  const doTransfer = async () => {
    const done = await post(
      { resource: "transfer", ...transferForm, amount: Number(transferForm.amount) },
      "Transfer posted",
    )
    if (done) { setShowTransfer(false); setTransferForm({ from_account_id: "", to_account_id: "", amount: "", memo: "" }) }
  }

  const doDeposit = async () => {
    const done = await post(
      { resource: "deposit", ...depositForm, amount: Number(depositForm.amount) },
      "Deposit posted",
    )
    if (done) { setShowDeposit(false); setDepositForm({ payment_account_id: "", amount: "", income_category: "", memo: "" }) }
  }

  const backfill = async () => {
    if (!confirm("Post journal entries for all existing invoices, payments, transactions and payouts?")) return
    setWorking(true)
    try {
      const res = await fetch("/api/admin/finance/ledger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resource: "backfill" }),
      })
      const data = await res.json()
      if (data.success) {
        const c = data.data
        flash(`Ledger synced — ${c.invoices} invoices, ${c.payments} payments, ${c.transactions} transactions, ${c.payouts} payouts`)
        load()
      } else setMessage(data.error || "Backfill failed")
    } finally {
      setWorking(false)
    }
  }

  const input = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm"

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Landmark className="h-5 w-5" /> Payment Accounts
          </h2>
          <p className="text-muted-foreground">
            Bank, cash and settlement accounts. Payments are mapped to accounts by method and posted to the ledger.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={backfill} disabled={working}>
            <DatabaseZap className="mr-1 h-4 w-4" /> Sync Ledger
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowDeposit(true)}>
            <ArrowDownToLine className="mr-1 h-4 w-4" /> Deposit
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowTransfer(true)}>
            <ArrowLeftRight className="mr-1 h-4 w-4" /> Transfer
          </Button>
          <Button size="sm" onClick={() => setShowAdd(true)}>
            <Plus className="mr-1 h-4 w-4" /> New Account
          </Button>
        </div>
      </div>

      {message && (
        <div className={`rounded-lg border px-4 py-3 text-sm ${/success|posted|created|synced/i.test(message) ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-destructive/20 bg-destructive/10 text-destructive"}`}>
          {message}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((a) => (
            <Link key={a.id} href={`/admin/finance/accounts/${a.id}`} className="group">
              <Card className="h-full transition-colors group-hover:border-foreground/30">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold">{a.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {a.gl_accounts?.code} · {a.gl_accounts?.name}
                        {a.bank_name ? ` · ${a.bank_name}` : ""}
                        {a.account_number_last4 ? ` ····${a.account_number_last4}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {a.is_default && (
                        <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-blue-700">Default</span>
                      )}
                      {a.payment_method && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                          {a.payment_method.replace(/_/g, " ")}
                        </span>
                      )}
                      {!a.active && (
                        <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-rose-600">Inactive</span>
                      )}
                    </div>
                  </div>
                  <p className="text-2xl font-bold tracking-tight">{formatMoney(a.balance)}</p>
                  <p className="text-xs text-muted-foreground">View statement →</p>
                </CardContent>
              </Card>
            </Link>
          ))}
          {accounts.length === 0 && (
            <Card className="sm:col-span-2 lg:col-span-3">
              <CardContent className="p-12 text-center text-muted-foreground">
                No payment accounts yet. Create one, or run “Sync Ledger” after applying the migration.
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* New account */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl border border-border bg-background p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">New Payment Account</h3>
              <button onClick={() => setShowAdd(false)} className="rounded-md p-1 text-muted-foreground hover:bg-muted"><X className="h-5 w-5" /></button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="mb-1 block text-xs font-medium">Account Name *</label>
                <input className={input} value={addForm.name} onChange={(e) => setAddForm({ ...addForm, name: e.target.value })} placeholder="e.g. GTBank Current" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Default for Method</label>
                <select className={input} value={addForm.payment_method} onChange={(e) => setAddForm({ ...addForm, payment_method: e.target.value })}>
                  <option value="">— none —</option>
                  {METHODS.map((m) => <option key={m} value={m}>{m.replace(/_/g, " ")}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Bank Name</label>
                <input className={input} value={addForm.bank_name} onChange={(e) => setAddForm({ ...addForm, bank_name: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Account No. (last 4)</label>
                <input className={input} value={addForm.account_number_last4} onChange={(e) => setAddForm({ ...addForm, account_number_last4: e.target.value })} maxLength={4} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Opening Balance (₦)</label>
                <input type="number" min="0" className={input} value={addForm.opening_balance} onChange={(e) => setAddForm({ ...addForm, opening_balance: e.target.value })} />
              </div>
              <label className="col-span-2 flex items-center gap-2 text-sm">
                <input type="checkbox" checked={addForm.is_default} onChange={(e) => setAddForm({ ...addForm, is_default: e.target.checked })} className="h-4 w-4 rounded border-input" />
                Make this the default settlement account
              </label>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button size="sm" onClick={createAccount} disabled={working}>{working ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}</Button>
            </div>
          </div>
        </div>
      )}

      {/* Transfer */}
      {showTransfer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-background p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Transfer Between Accounts</h3>
              <button onClick={() => setShowTransfer(false)} className="rounded-md p-1 text-muted-foreground hover:bg-muted"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium">From *</label>
                <select className={input} value={transferForm.from_account_id} onChange={(e) => setTransferForm({ ...transferForm, from_account_id: e.target.value })}>
                  <option value="">Select account…</option>
                  {accounts.filter((a) => a.active).map((a) => <option key={a.id} value={a.id}>{a.name} ({formatMoney(a.balance)})</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">To *</label>
                <select className={input} value={transferForm.to_account_id} onChange={(e) => setTransferForm({ ...transferForm, to_account_id: e.target.value })}>
                  <option value="">Select account…</option>
                  {accounts.filter((a) => a.active && a.id !== transferForm.from_account_id).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Amount (₦) *</label>
                <input type="number" min="0" className={input} value={transferForm.amount} onChange={(e) => setTransferForm({ ...transferForm, amount: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Memo</label>
                <input className={input} value={transferForm.memo} onChange={(e) => setTransferForm({ ...transferForm, memo: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowTransfer(false)}>Cancel</Button>
              <Button size="sm" onClick={doTransfer} disabled={working}>{working ? <Loader2 className="h-4 w-4 animate-spin" /> : "Post Transfer"}</Button>
            </div>
          </div>
        </div>
      )}

      {/* Deposit */}
      {showDeposit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-background p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Record Deposit</h3>
              <button onClick={() => setShowDeposit(false)} className="rounded-md p-1 text-muted-foreground hover:bg-muted"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-medium">Account *</label>
                <select className={input} value={depositForm.payment_account_id} onChange={(e) => setDepositForm({ ...depositForm, payment_account_id: e.target.value })}>
                  <option value="">Select account…</option>
                  {accounts.filter((a) => a.active).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Amount (₦) *</label>
                <input type="number" min="0" className={input} value={depositForm.amount} onChange={(e) => setDepositForm({ ...depositForm, amount: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Income Category</label>
                <input className={input} value={depositForm.income_category} onChange={(e) => setDepositForm({ ...depositForm, income_category: e.target.value })} placeholder="Other Income" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Memo</label>
                <input className={input} value={depositForm.memo} onChange={(e) => setDepositForm({ ...depositForm, memo: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowDeposit(false)}>Cancel</Button>
              <Button size="sm" onClick={doDeposit} disabled={working}>{working ? <Loader2 className="h-4 w-4 animate-spin" /> : "Post Deposit"}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
