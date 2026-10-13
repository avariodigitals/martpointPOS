"use client"

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CalendarRange, Loader2 } from "lucide-react"
import { useToast } from "@/components/admin/admin-toast"

type CloseRow = {
  period_key?: string
  status?: string
  closed_at?: string | null
  closed_by?: string | null
}

type Payload = {
  periodKey: string
  current: { status: string }
  counts: { eligible: number; approved: number; paid: number; held: number; disputed: number }
  periods: CloseRow[]
  canClose: boolean
}

function thisMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
}

export default function CommissionClosePage() {
  const { toast } = useToast()
  const [period, setPeriod] = useState(thisMonth())
  const [data, setData] = useState<Payload | null>(null)
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/finance/commission-close?period=${encodeURIComponent(period)}`)
      const json = await res.json()
      if (!res.ok) {
        toast({ title: "Could not load the period", description: json.error, variant: "error" })
        return
      }
      setData(json)
    } finally {
      setLoading(false)
    }
  }, [period, toast])

  useEffect(() => {
    void load()
  }, [load])

  async function close() {
    setBusy(true)
    try {
      const res = await fetch("/api/admin/finance/commission-close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ periodKey: period }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast({ title: "Close refused", description: json.error || "The server would not close this period", variant: "error", duration: 0 })
        return
      }
      toast({
        title: `${period} closed`,
        description: `${json.stamped} approved earning(s) stamped. A commission statement was issued to each partner with earnings in the period.`,
        variant: "success",
        duration: 0,
      })
      setConfirming(false)
      await load()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <CalendarRange className="w-5 h-5" /> Commission month-end close
        </h2>
        <p className="text-sm text-muted-foreground">
          Finance closes each month once refunds, chargebacks and disputes are settled. Payouts from a closed period are due
          inside the payout window written on each partner&apos;s signed Commission Schedule.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs">
          <span className="font-medium">Period</span>
          <input
            type="month"
            className="mt-1 block rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          />
        </label>
        {data?.canClose && (
          <Button size="sm" onClick={() => setConfirming(true)}>
            Close {period}
          </Button>
        )}
        {data && data.current.status === "CLOSED" && (
          <span className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2">
            This period is already closed.
          </span>
        )}
      </div>

      {confirming && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Confirm the close for {period}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Closing stamps every approved earning in the period and issues the controlled commission statement to each
              partner. Approved earnings stay approved — a later refund creates a linked adjustment rather than rewriting the
              period.
            </p>
            <div className="flex gap-2">
              <Button size="sm" disabled={busy} onClick={() => void close()}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Close the period
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
          </CardContent>
        </Card>
      ) : data ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Tile label="Awaiting Finance approval" value={data.counts.eligible} />
            <Tile label="Approved, not yet paid" value={data.counts.approved} />
            <Tile label="Paid in the period" value={data.counts.paid} />
            <Tile label="Held" value={data.counts.held} tone={data.counts.held ? "amber" : undefined} />
            <Tile label="In dispute" value={data.counts.disputed} tone={data.counts.disputed ? "amber" : undefined} />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Period history</CardTitle>
            </CardHeader>
            <CardContent>
              {data.periods.length === 0 ? (
                <p className="text-sm text-muted-foreground">No periods have been closed yet.</p>
              ) : (
                <div className="overflow-x-auto -mx-6">
                  <table className="w-full text-sm">
                    <thead className="bg-muted text-left">
                      <tr>
                        <th className="px-4 py-2">Period</th>
                        <th className="px-4 py-2">Status</th>
                        <th className="px-4 py-2">Closed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.periods.map((p) => (
                        <tr key={p.period_key} className="border-t border-border">
                          <td className="px-4 py-2 font-medium">{p.period_key}</td>
                          <td className="px-4 py-2">{p.status}</td>
                          <td className="px-4 py-2">{p.closed_at ? new Date(p.closed_at).toLocaleString("en-NG") : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  )
}

function Tile({ label, value, tone }: { label: string; value: number; tone?: "amber" }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className={`text-2xl font-bold ${tone === "amber" ? "text-amber-700" : ""}`}>{value}</p>
        <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
      </CardContent>
    </Card>
  )
}
