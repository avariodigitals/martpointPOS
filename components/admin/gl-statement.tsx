"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Loader2 } from "lucide-react"

type StatementRow = {
  entry_id: string
  entry_number: string
  entry_date: string
  memo?: string | null
  source_type: string
  description?: string | null
  debit: number
  credit: number
  running_balance: number
}

export function formatMoney(n: number | null | undefined) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—"
  return `₦${Number(n).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function GlStatement({
  glAccountId,
  paymentAccountId,
  refreshKey = 0,
}: {
  glAccountId?: string
  paymentAccountId?: string
  refreshKey?: number
}) {
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [result, setResult] = useState<{
    key: string
    rows: StatementRow[]
    opening: number
    closing: number
  } | null>(null)

  const requestKey = `${glAccountId}|${paymentAccountId}|${from}|${to}|${refreshKey}`
  const loading = result?.key !== requestKey
  const rows = result?.rows ?? []
  const opening = result?.opening ?? 0
  const closing = result?.closing ?? 0

  useEffect(() => {
    const params = new URLSearchParams({ resource: "statement" })
    if (glAccountId) params.set("gl", glAccountId)
    if (paymentAccountId) params.set("account", paymentAccountId)
    if (from) params.set("from", from)
    if (to) params.set("to", to)
    let cancelled = false
    fetch(`/api/admin/finance/ledger?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return
        if (data.success && data.data) {
          setResult({
            key: requestKey,
            rows: data.data.rows || [],
            opening: data.data.opening || 0,
            closing: data.data.closing || 0,
          })
        } else {
          setResult({ key: requestKey, rows: [], opening: 0, closing: 0 })
        }
      })
      .catch(() => {
        if (!cancelled) setResult({ key: requestKey, rows: [], opening: 0, closing: 0 })
      })
    return () => { cancelled = true }
  }, [glAccountId, paymentAccountId, from, to, refreshKey, requestKey])

  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3">
          <span className="text-sm font-medium">Statement</span>
          <div className="flex items-center gap-2 text-xs">
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-md border border-input bg-background px-2 py-1.5 text-xs"
            />
            <span className="text-muted-foreground">to</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="rounded-md border border-input bg-background px-2 py-1.5 text-xs"
            />
            {(from || to) && (
              <button onClick={() => { setFrom(""); setTo("") }} className="text-blue-600 hover:underline">
                Clear
              </button>
            )}
          </div>
          <span className="ml-auto text-xs text-muted-foreground">
            Opening <span className="font-medium text-foreground">{formatMoney(opening)}</span>
            {" · "}Closing <span className="font-medium text-foreground">{formatMoney(closing)}</span>
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Entry</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Description</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Money In</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Money Out</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Balance</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={`${r.entry_id}-${r.description || ""}`} className="border-b border-border hover:bg-muted/30">
                    <td className="whitespace-nowrap px-4 py-3">{r.entry_date}</td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs">{r.entry_number}</span>
                      <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        {r.source_type}
                      </span>
                    </td>
                    <td className="max-w-xs truncate px-4 py-3 text-muted-foreground">{r.description || r.memo || "—"}</td>
                    <td className="px-4 py-3 text-right font-medium text-emerald-600">
                      {r.debit > 0 ? formatMoney(r.debit) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-rose-600">
                      {r.credit > 0 ? formatMoney(r.credit) : "—"}
                    </td>
                    <td className="px-4 py-3 text-right font-medium">{formatMoney(r.running_balance)}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                      No ledger entries yet for this account.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
