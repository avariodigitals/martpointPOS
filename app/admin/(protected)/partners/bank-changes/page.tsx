"use client"

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Landmark, ShieldCheck } from "lucide-react"
import { useToast } from "@/components/admin/admin-toast"

type Change = {
  id: string
  partnerName: string
  status: string
  oldBank: string
  oldLast4: string
  newBank: string
  newLast4: string
  newAccountName: string
  reason: string
  requestedByName: string
  reverifiedAt: string | null
  firstApprovalAt: string | null
  secondApprovalAt: string | null
  createdAt: string
}

const inputCls = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm"

function date(value: string | null) {
  if (!value) return "—"
  try {
    return new Date(value).toLocaleDateString("en-NG")
  } catch {
    return value
  }
}

export default function BankChangesPage() {
  const { toast } = useToast()
  const [rows, setRows] = useState<Change[]>([])
  const [tab, setTab] = useState("PENDING")
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState<string | null>(null)
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState("")
  const [can, setCan] = useState({ approve: false, manage: false })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/partner-bank-changes?status=${encodeURIComponent(tab)}`)
      const json = await res.json()
      if (!res.ok) {
        toast({ title: "Could not load bank changes", description: json.error, variant: "error" })
        return
      }
      setRows(json.changes || [])
      setCan(json.can || { approve: false, manage: false })
    } finally {
      setLoading(false)
    }
  }, [tab, toast])

  useEffect(() => {
    void load()
  }, [load])

  async function act(id: string, action: "reverify" | "approve" | "reject") {
    if (action === "reverify" && note.trim().length < 3) {
      toast({ title: "Record how you verified the account", description: "A call to the bank or a fresh statement — the note is kept on the request.", variant: "warning" })
      return
    }
    if (action === "reject" && note.trim().length < 3) {
      toast({ title: "A rejection needs a reason", variant: "warning" })
      return
    }
    setBusy(id + action)
    try {
      const res = await fetch("/api/admin/partner-bank-changes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action, ...(note.trim() ? { note: note.trim(), reason: note.trim() } : {}) }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast({ title: "Refused", description: json.error || "The server would not action this change", variant: "error", duration: 0 })
        return
      }
      toast({
        title: json.awaitingSecondApproval ? "First approval recorded" : "Change decided",
        description: json.awaitingSecondApproval
          ? "A second, different approver is still needed before the account moves."
          : undefined,
        variant: "success",
      })
      setNote("")
      setOpenId(null)
      await load()
    } finally {
      setBusy("")
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Landmark className="w-5 h-5" /> Payout account changes
        </h2>
        <p className="text-sm text-muted-foreground">
          A verified payout account cannot be edited in place. Every move to a new account needs reverification and two
          different approvers, and the audit trail keeps both.
        </p>
      </div>

      <div className="flex gap-2">
        {["PENDING", "APPROVED", "REJECTED"].map((status) => (
          <Button key={status} size="sm" variant={tab === status ? "default" : "outline"} onClick={() => setTab(status)}>
            {status === "PENDING" ? "Awaiting action" : status === "APPROVED" ? "Approved" : "Declined"}
          </Button>
        ))}
      </div>

      {loading ? (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
          </CardContent>
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">Nothing waiting here.</CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {rows.map((r) => (
            <Card key={r.id}>
              <CardHeader>
                <CardTitle className="text-sm font-medium flex flex-wrap items-center gap-2">
                  {r.partnerName}
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">{r.status}</span>
                  <span className="text-xs text-muted-foreground font-normal">requested by {r.requestedByName || "partner"}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                  <div className="rounded-md bg-muted p-3">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Currently on file</p>
                    <p className="font-medium">{r.oldBank || "—"}</p>
                    <p className="text-xs text-muted-foreground">{r.oldLast4 ? `ending ${r.oldLast4}` : "no account"}</p>
                  </div>
                  <div className="rounded-md border border-amber-300 bg-amber-50 p-3">
                    <p className="text-[11px] uppercase tracking-wider text-amber-700">Requested</p>
                    <p className="font-medium">{r.newBank}</p>
                    <p className="text-xs text-amber-800">ending {r.newLast4} · {r.newAccountName}</p>
                  </div>
                  <div className="rounded-md border border-border p-3">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Controls</p>
                    <p className="text-xs">Reverified: {date(r.reverifiedAt)}</p>
                    <p className="text-xs">First approval: {date(r.firstApprovalAt)}</p>
                    <p className="text-xs">Second approval: {date(r.secondApprovalAt)}</p>
                  </div>
                </div>
                <p className="text-sm">
                  <span className="text-muted-foreground">Reason given:</span> {r.reason}
                </p>

                {can.approve && r.status === "PENDING" && (
                  <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
                    {!r.reverifiedAt ? (
                      <>
                        <label className="block text-xs">
                          <span className="font-medium">How was the new account reverified? (required before any approval)</span>
                          <textarea rows={2} className={`${inputCls} mt-1`} value={openId === r.id ? note : ""} onChange={(e) => { setOpenId(r.id); setNote(e.target.value) }} placeholder="e.g. Called the bank on the number in their statement, NUBAN confirmed" />
                        </label>
                        <Button size="sm" disabled={busy === r.id + "reverify"} onClick={() => void act(r.id, "reverify")}>
                          {busy === r.id + "reverify" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                          Record reverification
                        </Button>
                      </>
                    ) : (
                      <>
                        <p className="text-xs text-emerald-700">
                          Reverified {date(r.reverifiedAt)}. {r.firstApprovalAt ? "First approval is in — a second, different approver is required." : "First approval still outstanding."}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" disabled={busy === r.id + "approve"} onClick={() => void act(r.id, "approve")}>
                            {busy === r.id + "approve" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                            {r.firstApprovalAt ? "Approve as second approver" : "Approve (first)"}
                          </Button>
                          <label className="flex-1 min-w-[220px]">
                            <input
                              className={inputCls}
                              placeholder="Reason (required to decline)"
                              value={openId === r.id ? note : ""}
                              onChange={(e) => { setOpenId(r.id); setNote(e.target.value) }}
                            />
                          </label>
                          <Button size="sm" variant="outline" disabled={busy === r.id + "reject"} onClick={() => void act(r.id, "reject")}>
                            Decline
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
