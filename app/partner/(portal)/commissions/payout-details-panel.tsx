"use client"

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Landmark, Loader2 } from "lucide-react"

type Account = {
  bankName: string
  accountLast4: string
  accountName: string
  verificationStatus: string
  taxReference: string
} | null

type ChangeRequest = {
  id: string
  status: string
  bankName: string
  accountLast4: string
  reason: string
  createdAt: string
  rejectionReason: string | null
}

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Waiting for MartPoint to verify and approve",
  REVERIFICATION_REQUIRED: "Being reverified",
  APPROVED: "Approved — new account is now on file",
  REJECTED: "Declined",
  CANCELLED: "Cancelled",
}

const inputCls = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm"

export function PayoutDetailsPanel() {
  const [account, setAccount] = useState<Account>(null)
  const [requests, setRequests] = useState<ChangeRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [openForm, setOpenForm] = useState(false)
  const [form, setForm] = useState({ newBankName: "", newAccountNumber: "", newAccountName: "", reason: "" })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ tone: "error" | "ok"; text: string } | null>(null)

  const load = useCallback(async () => {
    const res = await fetch("/api/partner/payout-details")
    if (res.ok) {
      const json = await res.json()
      setAccount(json.account ?? null)
      setRequests(json.requests ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function submit() {
    setBusy(true)
    setMessage(null)
    try {
      const res = await fetch("/api/partner/payout-details", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setMessage({ tone: "error", text: json.error || "That request could not be sent" })
        return
      }
      setOpenForm(false)
      setForm({ newBankName: "", newAccountNumber: "", newAccountName: "", reason: "" })
      setMessage({ tone: "ok", text: "Sent. MartPoint Finance will verify the new account with you before any payout uses it." })
      await load()
    } finally {
      setBusy(false)
    }
  }

  const canRequest = Boolean(account) && !requests.some((r) => r.status === "PENDING")

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Landmark className="w-4 h-4" /> Payout account
        </CardTitle>
        {canRequest && (
          <Button size="sm" variant="outline" onClick={() => setOpenForm((v) => !v)}>
            {openForm ? "Close" : "Change account"}
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading your payout details…
          </p>
        ) : !account ? (
          <p className="text-sm text-muted-foreground">
            No payout account is on file yet. MartPoint will ask for your bank and tax details before the first approved
            commission is paid.
          </p>
        ) : (
          <div className="text-sm space-y-1">
            <p className="font-medium">
              {account.bankName || "—"} · ending {account.accountLast4 || "----"}
            </p>
            <p className="text-muted-foreground">{account.accountName}</p>
            <p className="text-xs">
              Verification:{" "}
              <span className={account.verificationStatus === "VERIFIED" ? "text-emerald-700" : "text-amber-700"}>
                {account.verificationStatus === "VERIFIED" ? "verified" : "not verified yet"}
              </span>
              {account.taxReference ? ` · Tax reference ${account.taxReference}` : ""}
            </p>
          </div>
        )}

        {requests.length > 0 && (
          <ul className="space-y-2">
            {requests.map((r) => (
              <li key={r.id} className="text-xs border border-border rounded-md p-2">
                <p>
                  <span className="font-medium">{r.bankName}</span> ending {r.accountLast4} ·{" "}
                  {new Date(r.createdAt).toLocaleDateString("en-NG")}
                </p>
                <p className="text-muted-foreground">{STATUS_LABELS[r.status] || r.status}</p>
                {r.rejectionReason && <p className="text-amber-700">{r.rejectionReason}</p>}
              </li>
            ))}
          </ul>
        )}

        {account && requests.length === 0 && !canRequest && (
          <p className="text-xs text-muted-foreground">
            A change request is already with MartPoint Finance.
          </p>
        )}

        {openForm && (
          <div className="space-y-3 rounded-md border border-border p-3">
            <p className="text-xs text-muted-foreground">
              MartPoint verifies a new account with you directly and needs two internal approvals before payouts move. Your
              current account stays in force until then.
            </p>
            <label className="block text-xs">
              New bank name
              <input className={`${inputCls} mt-1`} value={form.newBankName} onChange={(e) => setForm({ ...form, newBankName: e.target.value })} />
            </label>
            <label className="block text-xs">
              New account number
              <input className={`${inputCls} mt-1`} inputMode="numeric" value={form.newAccountNumber} onChange={(e) => setForm({ ...form, newAccountNumber: e.target.value })} />
            </label>
            <label className="block text-xs">
              Account holder name (as it appears on the statement)
              <input className={`${inputCls} mt-1`} value={form.newAccountName} onChange={(e) => setForm({ ...form, newAccountName: e.target.value })} />
            </label>
            <label className="block text-xs">
              Why is the account changing?
              <textarea rows={2} className={`${inputCls} mt-1`} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
            </label>
            {message && (
              <p className={`text-xs ${message.tone === "error" ? "text-red-700" : "text-emerald-700"}`}>{message.text}</p>
            )}
            <Button
              size="sm"
              disabled={
                busy ||
                !form.newBankName.trim() ||
                !form.newAccountName.trim() ||
                form.newAccountNumber.replace(/\D/g, "").length < 9 ||
                form.reason.trim().length < 5
              }
              onClick={() => void submit()}
            >
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Send request
            </Button>
          </div>
        )}

        {!openForm && message && (
          <p className={`text-xs ${message.tone === "error" ? "text-red-700" : "text-emerald-700"}`}>{message.text}</p>
        )}
      </CardContent>
    </Card>
  )
}
