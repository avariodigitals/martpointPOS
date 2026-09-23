"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Wallet, X } from "lucide-react"

interface PayoutRequest {
  id: string
  amount: number
  currency: string
  status: string
  notes: string | null
  review_notes: string | null
  created_at: string
  reviewed_at: string | null
}

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  APPROVED: "bg-blue-100 text-blue-700",
  PAID: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
  CANCELLED: "bg-gray-100 text-gray-600",
}

function fmtMoney(amount: number, currency = "NGN") {
  try {
    return new Intl.NumberFormat("en-NG", { style: "currency", currency }).format(amount || 0)
  } catch {
    return `${currency} ${amount}`
  }
}

export function PayoutRequestPanel({
  available,
  requests,
}: {
  available: number
  requests: PayoutRequest[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState("")
  const [notes, setNotes] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState("")

  const hasPending = requests.some((r) => r.status === "PENDING")

  async function submit() {
    const amt = Number(amount)
    if (!amt || amt <= 0) { setError("Enter a valid amount"); return }
    if (amt > available) { setError("Amount exceeds your available balance"); return }
    setSubmitting(true)
    setError("")
    try {
      const res = await fetch("/api/partner/payout-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amt, notes: notes || null }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Failed to submit request")
        return
      }
      setOpen(false)
      setAmount("")
      setNotes("")
      router.refresh()
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Wallet className="w-4 h-4" /> Payout Requests
          </CardTitle>
          <Button
            size="sm"
            onClick={() => { setAmount(String(available || "")); setOpen(true) }}
            disabled={available <= 0 || hasPending}
            title={available <= 0 ? "No approved commissions available" : hasPending ? "A request is already pending" : "Request a withdrawal"}
          >
            Request Withdrawal
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground mb-3">
          Available for withdrawal: <span className="font-semibold text-foreground">{fmtMoney(available)}</span>
        </p>
        {requests.length === 0 ? (
          <p className="text-sm text-muted-foreground">No payout requests yet.</p>
        ) : (
          <div className="overflow-x-auto -mx-6">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left">
                <tr>
                  <th className="px-4 py-2">Requested</th>
                  <th className="px-4 py-2">Amount</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Review notes</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="px-4 py-2">{new Date(r.created_at).toLocaleDateString()}</td>
                    <td className="px-4 py-2 font-medium">{fmtMoney(r.amount, r.currency)}</td>
                    <td className="px-4 py-2">
                      <span className={`text-xs uppercase px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[r.status] || "bg-gray-100 text-gray-700"}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{r.review_notes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {open && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md rounded-xl border border-border bg-background shadow-lg p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">Request Withdrawal</h3>
                <button onClick={() => setOpen(false)} className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm text-muted-foreground">
                Available balance: <span className="font-semibold text-foreground">{fmtMoney(available)}</span>
              </p>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <div>
                <label className="block text-sm font-medium mb-1">Amount (NGN) *</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  max={available}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Notes</label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional note for the finance team"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => setOpen(false)} disabled={submitting}>Cancel</Button>
                <Button size="sm" onClick={submit} disabled={submitting}>
                  {submitting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
                  Submit Request
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
