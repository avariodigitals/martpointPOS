"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, ShieldAlert } from "lucide-react"
import { useToast } from "@/components/admin/admin-toast"

const inputCls = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm"

const STATUS_LABELS: Record<string, string> = {
  PENDING_ACTIVATION: "Pending activation",
  ACTIVE: "Active",
  SUSPENDED: "Suspended",
  TERMINATED: "Terminated",
  INACTIVE: "Inactive",
}

export function PartnerStandingPanel({
  partnerId,
  status,
  partnerType,
  canDecide,
  onChanged,
}: {
  partnerId: string
  status: string
  partnerType: string
  canDecide: boolean
  onChanged: () => void
}) {
  const { toast } = useToast()
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState<string | null>(null)

  const closed = status === "SUSPENDED" || status === "TERMINATED" || status === "INACTIVE"

  async function decide(next: string) {
    if (!reason.trim()) {
      toast({
        title: "A written reason is required",
        description: "It is stored in the audit trail and printed on the notice the partner receives.",
        variant: "warning",
      })
      return
    }
    setBusy(next)
    try {
      const res = await fetch(`/api/admin/partners/${partnerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next, reason: reason.trim() }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast({ title: "Decision rejected", description: json.error || "The server refused this decision", variant: "error", duration: 0 })
        return
      }
      toast({
        title: `${STATUS_LABELS[next] || next} recorded`,
        description:
          next === "ACTIVE"
            ? "Referral submission is open again for this partner."
            : "A formal notice document has been issued to the partner.",
        variant: "success",
      })
      setReason("")
      onChanged()
    } finally {
      setBusy(null)
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-sm font-medium flex items-center gap-2"><ShieldAlert className="w-4 h-4" /> Account standing</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm">
          Current status: <span className="font-medium">{STATUS_LABELS[status] || status}</span>
          {partnerType === "REFERRAL" && (
            <span className="text-muted-foreground"> · suspending or closing a Referral Partner also stops new referral submissions; existing earnings keep their signed terms.</span>
          )}
        </p>

        {canDecide ? (
          <>
            <label className="block">
              <span className="text-xs text-muted-foreground">Reason for the decision (required)</span>
              <textarea
                className={`${inputCls} min-h-[64px]`}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="What MartPoint decided and why — the partner sees this on their notice."
              />
            </label>
            <div className="flex flex-wrap gap-2">
              {status !== "SUSPENDED" && (
                <Button size="sm" variant="outline" disabled={!!busy} onClick={() => decide("SUSPENDED")}>
                  {busy === "SUSPENDED" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Suspend"}
                </Button>
              )}
              {status !== "TERMINATED" && (
                <Button size="sm" variant="outline" className="text-red-600" disabled={!!busy} onClick={() => decide("TERMINATED")}>
                  {busy === "TERMINATED" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Terminate"}
                </Button>
              )}
              {closed && (
                <Button size="sm" variant="outline" className="text-green-700" disabled={!!busy} onClick={() => decide("ACTIVE")}>
                  {busy === "ACTIVE" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Restore to Active"}
                </Button>
              )}
            </div>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">Only Management can suspend, terminate or restore a partner account.</p>
        )}
      </CardContent>
    </Card>
  )
}
