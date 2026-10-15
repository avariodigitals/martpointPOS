"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
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
  Eye,
  EyeOff,
  Pencil,
  Search,
} from "lucide-react"
import { formatMoney } from "@/components/admin/gl-statement"
import { enumLabel } from "@/lib/utils"

type PaymentAccount = {
  id: string
  name: string
  gl_account_id: string
  payment_method?: string | null
  bank_name?: string | null
  account_number_last4?: string | null
  account_number?: string | null
  currency: string
  opening_balance: number
  is_default: boolean
  active: boolean
  balance: number
  gl_accounts?: { code: string; name: string; type: string } | null
}

const METHODS = ["BANK_TRANSFER", "PAYSTACK", "FLUTTERWAVE", "CASH", "POS", "OTHER"]
const CURRENCIES = ["NGN", "USD", "GBP", "EUR"]

const emptyForm = {
  name: "",
  payment_method: "",
  bank_name: "",
  account_number: "",
  account_number_last4: "",
  currency: "NGN",
  opening_balance: "",
  is_default: false,
}

/** Mask a stored account number, keeping the last 4 visible. Falls back to the last4 column. */
function maskAccountNumber(a: PaymentAccount): { display: string; canReveal: boolean } {
  const raw = a.account_number ? String(a.account_number).trim() : ""
  const last4 = a.account_number_last4 || (raw ? raw.slice(-4) : "")
  if (!raw) return { display: last4 ? `····${last4}` : "—", canReveal: false }
  return { display: `••••••••${last4}`, canReveal: true }
}

export default function PaymentAccountsPage() {
  const [accounts, setAccounts] = useState<PaymentAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState("")
  const [msgKind, setMsgKind] = useState<"success" | "error">("error")
  const [working, setWorking] = useState(false)

  const [showAdd, setShowAdd] = useState(false)
  const [showTransfer, setShowTransfer] = useState(false)
  const [showDeposit, setShowDeposit] = useState(false)

  // The add/edit modal is shared: editingId === null → create mode, otherwise update mode.
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)

  const [transferForm, setTransferForm] = useState({ from_account_id: "", to_account_id: "", amount: "", memo: "" })
  const [depositForm, setDepositForm] = useState({ payment_account_id: "", amount: "", income_category: "", memo: "" })

  // Account-number reveal state (per-row ids; the global toggle bulk-sets/clears these).
  const [revealed, setRevealed] = useState<Set<string>>(new Set())

  // "All accounts" table filters (client-side).
  const [query, setQuery] = useState("")
  const [methodFilter, setMethodFilter] = useState("")
  const [statusFilter, setStatusFilter] = useState("")

  const load = useCallback(() => {
    fetch("/api/admin/finance/ledger?resource=payment-accounts")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setAccounts(d.data || [])
        else { setMessage(d.error || "Failed to load accounts"); setMsgKind("error") }
      })
      .catch(() => { setMessage("Failed to load accounts"); setMsgKind("error") })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const flash = (msg: string) => { setMessage(msg); setMsgKind("success"); setTimeout(() => setMessage(""), 4000) }
  const warn = (msg: string) => { setMessage(msg); setMsgKind("error") }

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
      setMsgKind("error")
      return false
    } catch {
      setMessage("Operation failed")
      setMsgKind("error")
      return false
    } finally {
      setWorking(false)
    }
  }

  const openCreate = () => {
    setEditingId(null)
    setForm(emptyForm)
    setShowAdd(true)
  }

  const openEdit = (a: PaymentAccount) => {
    setEditingId(a.id)
    setForm({
      name: a.name || "",
      payment_method: a.payment_method || "",
      bank_name: a.bank_name || "",
      account_number: a.account_number || "",
      account_number_last4: a.account_number_last4 || "",
      currency: a.currency || "NGN",
      opening_balance: a.opening_balance != null ? String(a.opening_balance) : "",
      is_default: Boolean(a.is_default),
    })
    setShowAdd(true)
  }

  const saveAccount = async () => {
    if (!form.name.trim()) { warn("Name is required"); return }
    const derivedLast4 = form.account_number_last4 || (form.account_number ? String(form.account_number).slice(-4) : null)
    const fields: Record<string, unknown> = {
      name: form.name.trim(),
      payment_method: form.payment_method || null,
      bank_name: form.bank_name || null,
      account_number: form.account_number || null,
      account_number_last4: derivedLast4,
      currency: form.currency || "NGN",
    }

    if (editingId) {
      // Update: don't touch is_default here (managed via the dedicated row action) and don't
      // resend opening_balance (reposting it is a side effect we don't want from the edit form).
      const done = await post({ resource: "payment-accounts", action: "update", id: editingId, ...fields }, "Account updated")
      if (done) setShowAdd(false)
      return
    }

    const done = await post(
      {
        resource: "payment-accounts",
        action: "create",
        ...fields,
        is_default: form.is_default,
        opening_balance: form.opening_balance ? Number(form.opening_balance) : 0,
      },
      "Account created",
    )
    if (done) {
      setShowAdd(false)
      setForm(emptyForm)
    }
  }

  const setDefault = async (a: PaymentAccount) => {
    if (a.is_default) { warn("That account is already the default"); return }
    if (!confirm(`Set "${a.name}" as the default receiving account? Other accounts will stop being the default.`)) return
    await post({ resource: "payment-accounts", action: "update", id: a.id, is_default: true }, `"${a.name}" is now the default`)
  }

  const toggleActive = async (a: PaymentAccount) => {
    if (a.active && a.is_default) {
      warn("Deactivate another account or set a new default first — the default receiving account should stay active.")
      return
    }
    const action = a.active ? "set_inactive" : "set_active"
    await post({ resource: "payment-accounts", action, id: a.id }, a.active ? "Account deactivated" : "Account activated")
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
      } else { setMessage(data.error || "Backfill failed"); setMsgKind("error") }
    } finally {
      setWorking(false)
    }
  }

  // ── Reveal helpers ──
  const revealAll = accounts.length > 0 && accounts.every((a) => revealed.has(a.id))
  const toggleRevealAll = () => {
    if (revealAll) setRevealed(new Set())
    else setRevealed(new Set(accounts.map((a) => a.id)))
  }
  const toggleRowReveal = (id: string) => {
    setRevealed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // ── "All accounts" filtering (client-side) ──
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return accounts.filter((a) => {
      if (methodFilter && (a.payment_method || "") !== methodFilter) return false
      if (statusFilter === "active" && !a.active) return false
      if (statusFilter === "inactive" && a.active) return false
      if (q) {
        const hay = [a.name, a.bank_name || "", a.account_number || "", a.account_number_last4 || ""]
          .join(" ")
          .toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [accounts, query, methodFilter, statusFilter])

  // ── Clarity banner derived from live rows ──
  const defaultAccount = accounts.find((a) => a.is_default)
  const methodMap = accounts.filter((a) => a.payment_method)

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
          <Button size="sm" onClick={openCreate}>
            <Plus className="mr-1 h-4 w-4" /> New Account
          </Button>
        </div>
      </div>

      {message && (
        <div className={`rounded-lg border px-4 py-3 text-sm ${msgKind === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-destructive/20 bg-destructive/10 text-destructive"}`}>
          {message}
        </div>
      )}

      {/* Routing clarity banner — derived from the live rows, no hardcoded names. */}
      {!loading && accounts.length > 0 && (
        <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          <p>
            The default account receives payments that aren&apos;t routed to a specific account. Online payments route by method.
          </p>
          <p className="mt-1 font-medium text-foreground">
            {defaultAccount ? <>Default: {defaultAccount.name}</> : <>Default: <span className="italic text-muted-foreground">not set</span></>}
            {methodMap.length > 0 && (
              <>
                {" — "}
                {methodMap.map((a) => `${enumLabel(a.payment_method)} → ${a.name}`).join(" · ")}
              </>
            )}
          </p>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Cards → statement */}
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
                            {enumLabel(a.payment_method)}
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

          {/* All accounts — filter-driven configuration table */}
          {accounts.length > 0 && (
            <Card>
              <CardContent className="p-0">
                <div className="flex flex-col gap-3 border-b border-border px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
                  <h3 className="text-sm font-semibold uppercase tracking-wider">All accounts</h3>
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <input
                        className={`${input} pl-8 lg:w-56`}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search name, bank, account no."
                      />
                    </div>
                    <select className={`${input} w-auto`} value={methodFilter} onChange={(e) => setMethodFilter(e.target.value)}>
                      <option value="">All methods</option>
                      {METHODS.map((m) => <option key={m} value={m}>{enumLabel(m)}</option>)}
                    </select>
                    <select className={`${input} w-auto`} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                      <option value="">All status</option>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                    <Button variant="outline" size="sm" onClick={toggleRevealAll}>
                      {revealAll ? <EyeOff className="mr-1 h-4 w-4" /> : <Eye className="mr-1 h-4 w-4" />}
                      {revealAll ? "Hide all numbers" : "Show all account numbers"}
                    </Button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                        <th className="px-4 py-2.5 font-medium">GL Code</th>
                        <th className="px-4 py-2.5 font-medium">Name</th>
                        <th className="px-4 py-2.5 font-medium">Bank</th>
                        <th className="px-4 py-2.5 font-medium">Account number</th>
                        <th className="px-4 py-2.5 font-medium">Method</th>
                        <th className="px-4 py-2.5 font-medium">Currency</th>
                        <th className="px-4 py-2.5 text-right font-medium">Balance</th>
                        <th className="px-4 py-2.5 font-medium">Default</th>
                        <th className="px-4 py-2.5 font-medium">Status</th>
                        <th className="px-4 py-2.5 text-right font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((a) => {
                        const isRevealed = revealed.has(a.id)
                        const masked = maskAccountNumber(a)
                        const acctDisplay = isRevealed && masked.canReveal ? String(a.account_number) : masked.display
                        return (
                          <tr key={a.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                            <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{a.gl_accounts?.code || "—"}</td>
                            <td className="px-4 py-2.5 font-medium">
                              <Link href={`/admin/finance/accounts/${a.id}`} className="hover:underline">{a.name}</Link>
                            </td>
                            <td className="px-4 py-2.5 text-muted-foreground">{a.bank_name || "—"}</td>
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-1">
                                <span className={isRevealed && masked.canReveal ? "font-mono text-xs" : "text-muted-foreground"}>{acctDisplay}</span>
                                {masked.canReveal && (
                                  <button
                                    onClick={() => toggleRowReveal(a.id)}
                                    className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                                    aria-label={isRevealed ? "Hide account number" : "Show account number"}
                                    title={isRevealed ? "Hide account number" : "Show account number"}
                                  >
                                    {isRevealed ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                  </button>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-2.5 text-muted-foreground">{a.payment_method ? enumLabel(a.payment_method) : "—"}</td>
                            <td className="px-4 py-2.5 text-muted-foreground">{a.currency || "—"}</td>
                            <td className="px-4 py-2.5 text-right font-medium">{formatMoney(a.balance)}</td>
                            <td className="px-4 py-2.5">
                              {a.is_default ? (
                                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-blue-700">Default</span>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5">
                              {a.active ? (
                                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-700">Active</span>
                              ) : (
                                <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-rose-600">Inactive</span>
                              )}
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
                                <button onClick={() => openEdit(a)} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground" title="Edit">
                                  <Pencil className="h-3.5 w-3.5" /> Edit
                                </button>
                                {!a.is_default && (
                                  <button onClick={() => setDefault(a)} className="text-xs text-muted-foreground hover:text-blue-700">Set default</button>
                                )}
                                <button
                                  onClick={() => toggleActive(a)}
                                  className={`text-xs ${a.active ? (a.is_default ? "cursor-not-allowed text-muted-foreground/50" : "text-muted-foreground hover:text-rose-600") : "text-rose-600 hover:text-emerald-600"}`}
                                  title={a.active && a.is_default ? "The default receiving account can't be deactivated — set a new default first" : undefined}
                                >
                                  {a.active ? "Deactivate" : "Activate"}
                                </button>
                                <Link href={`/admin/finance/accounts/${a.id}`} className="text-xs text-muted-foreground hover:text-foreground">Statement</Link>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                      {filtered.length === 0 && (
                        <tr>
                          <td colSpan={10} className="px-4 py-10 text-center text-muted-foreground">
                            No accounts match your filters.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* New / edit account */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl border border-border bg-background p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">{editingId ? "Edit Payment Account" : "New Payment Account"}</h3>
              <button onClick={() => setShowAdd(false)} className="rounded-md p-1 text-muted-foreground hover:bg-muted"><X className="h-5 w-5" /></button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="mb-1 block text-xs font-medium">Account Name *</label>
                <input className={input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. GTBank Current" />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Default for Method</label>
                <select className={input} value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })}>
                  <option value="">— none —</option>
                  {METHODS.map((m) => <option key={m} value={m}>{enumLabel(m)}</option>)}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Bank Name</label>
                <input className={input} value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Account No. (last 4)</label>
                <input className={input} value={form.account_number_last4} onChange={(e) => setForm({ ...form, account_number_last4: e.target.value })} maxLength={4} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium">Currency</label>
                <select className={input} value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })}>
                  {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="mb-1 block text-xs font-medium">Full Account Number</label>
                <input className={input} value={form.account_number} onChange={(e) => setForm({ ...form, account_number: e.target.value })} placeholder="used for payment instructions / reconciliation" />
              </div>
              {!editingId && (
                <div className="col-span-2">
                  <label className="mb-1 block text-xs font-medium">Opening Balance (₦)</label>
                  <input type="number" min="0" className={input} value={form.opening_balance} onChange={(e) => setForm({ ...form, opening_balance: e.target.value })} />
                </div>
              )}
              {!editingId && (
                <label className="col-span-2 flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.is_default} onChange={(e) => setForm({ ...form, is_default: e.target.checked })} className="h-4 w-4 rounded border-input" />
                  Make this the default settlement account
                </label>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowAdd(false)}>Cancel</Button>
              <Button size="sm" onClick={saveAccount} disabled={working}>{working ? <Loader2 className="h-4 w-4 animate-spin" /> : (editingId ? "Save" : "Create")}</Button>
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
