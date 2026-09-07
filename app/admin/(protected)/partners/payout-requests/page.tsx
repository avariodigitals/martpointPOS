"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Wallet, Check, X } from "lucide-react"

interface PayoutRequest {
  id: string
  amount: number
  currency: string
  status: string
  notes: string | null
  review_notes: string | null
  created_at: string
  reviewed_at: string | null
  partners?: { business_name?: string; display_name?: string; partner_id?: string } | null
  partner_users?: { full_name?: string; email?: string } | null
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

export default function AdminPayoutRequestsPage() {
  const [requests, setRequests] = useState<PayoutRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState("")
  const [acting, setActing] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState("PENDING")

  useEffect(() => {
    fetch("/api/admin/partner-payout-requests")
      .then((r) => r.json())
      .then((data) => setRequests(data.requests || []))
      .catch(() => setMessage("Failed to load requests"))
      .finally(() => setLoading(false))
  }, [])

  async function decide(id: string, action: "approve" | "reject") {
    if (action === "approve" && !confirm("Approve this request and create a payout batch for all approved commissions?")) return
    const notes = action === "reject" ? prompt("Reason for rejection (optional):") : null
    if (action === "reject" && notes === null) return

    setActing(id)
    setMessage("")
    try {
      const res = await fetch("/api/admin/partner-payout-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action, notes: notes || null }),
      })
      const data = await res.json()
      if (res.ok) {
        setRequests((prev) =>
          prev.map((r) =>
            r.id === id ? { ...r, status: action === "approve" ? "APPROVED" : "REJECTED", review_notes: notes } : r
          )
        )
        setMessage(action === "approve" ? `Payout ${data.payout?.payout_reference || ""} created` : "Request rejected")
      } else {
        setMessage(data.error || "Action failed")
      }
    } catch {
      setMessage("Action failed")
    } finally {
      setActing(null)
    }
  }

  const filtered = statusFilter === "all" ? requests : requests.filter((r) => r.status === statusFilter)

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Wallet className="w-5 h-5" /> Payout Requests
          </h2>
          <p className="text-muted-foreground">Partner withdrawal requests. Approving creates a payout batch of the partner's approved commissions.</p>
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-md border border-input bg-background px-3 py-2 text-sm w-40">
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
          <option value="PAID">Paid</option>
          <option value="all">All</option>
        </select>
      </div>

      {message && (
        <p className={`text-sm ${message.includes("fail") || message.includes("error") || message.includes("no approved") ? "text-red-500" : "text-green-600"}`}>
          {message}
        </p>
      )}

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Requests</CardTitle></CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No payout requests.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-muted-foreground border-b border-border">
                    <th className="py-2 pr-3">Partner</th>
                    <th className="py-2 pr-3">Requested By</th>
                    <th className="py-2 pr-3">Amount</th>
                    <th className="py-2 pr-3">Date</th>
                    <th className="py-2 pr-3">Notes</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.id} className="border-b border-border last:border-0">
                      <td className="py-2 pr-3 font-medium">
                        {r.partners?.display_name || r.partners?.business_name || "—"}
                        <span className="block text-xs text-muted-foreground font-mono">{r.partners?.partner_id}</span>
                      </td>
                      <td className="py-2 pr-3">{r.partner_users?.full_name || r.partner_users?.email || "—"}</td>
                      <td className="py-2 pr-3 font-semibold">{fmtMoney(r.amount, r.currency)}</td>
                      <td className="py-2 pr-3 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</td>
                      <td className="py-2 pr-3 text-xs text-muted-foreground max-w-40 truncate">{r.notes || "—"}</td>
                      <td className="py-2 pr-3">
                        <span className={`text-[10px] uppercase px-1.5 py-0.5 rounded font-medium ${STATUS_COLORS[r.status] || "bg-gray-100 text-gray-700"}`}>{r.status}</span>
                      </td>
                      <td className="py-2 pr-3">
                        {r.status === "PENDING" ? (
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => decide(r.id, "approve")} disabled={acting === r.id}>
                              {acting === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5 mr-1" />}
                              Approve
                            </Button>
                            <Button size="sm" variant="outline" className="text-red-600" onClick={() => decide(r.id, "reject")} disabled={acting === r.id}>
                              <X className="w-3.5 h-3.5 mr-1" /> Reject
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">{r.review_notes || "—"}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
