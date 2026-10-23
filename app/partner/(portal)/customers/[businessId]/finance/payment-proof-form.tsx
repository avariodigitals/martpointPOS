"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Loader2, Upload } from "lucide-react"

export function PaymentProofForm({ businessId, invoiceId, balance, currency }: { businessId: string; invoiceId: string; balance: number; currency: string }) {
  const router = useRouter()
  const [amount, setAmount] = useState(String(balance || ""))
  const [reference, setReference] = useState("")
  const [notes, setNotes] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")

  async function submit() {
    if (!file || !amount) return
    setBusy(true)
    setMessage("")
    const form = new FormData()
    form.append("invoiceId", invoiceId)
    form.append("amount", amount)
    form.append("gatewayReference", reference)
    form.append("notes", notes)
    form.append("proof", file)
    try {
      const res = await fetch(`/api/partner/customers/${encodeURIComponent(businessId)}/payments`, { method: "POST", body: form })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) setMessage(data.error || "Submission failed")
      else { setMessage(`Submitted as ${data.payment?.reference || "pending payment"}. Finance will verify it.`); setFile(null); router.refresh() }
    } catch { setMessage("Submission failed") } finally { setBusy(false) }
  }

  return (
    <div className="mt-3 rounded-md border border-border bg-muted/20 p-3 space-y-2">
      <p className="text-xs font-semibold">Submit payment proof</p>
      <p className="text-xs text-muted-foreground">Upload a clear transfer receipt or payment confirmation. Add the bank/payment reference if one was provided by your bank.</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <input className="rounded-md border border-input bg-background px-2 py-1.5 text-sm" type="number" min="0.01" max={balance} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={`Amount (${currency})`} />
        <input className="rounded-md border border-input bg-background px-2 py-1.5 text-sm" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Bank/payment reference" />
        <input className="rounded-md border border-input bg-background px-2 py-1.5 text-sm" type="file" accept="application/pdf,image/png,image/jpeg,image/webp" onChange={(e) => setFile(e.target.files?.[0] || null)} />
      </div>
      <textarea className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional note" />
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={submit} disabled={busy || !file || !amount}>{busy ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Upload className="w-3.5 h-3.5 mr-1" />} Submit proof</Button>
        {message && <span className="text-xs text-muted-foreground">{message}</span>}
      </div>
    </div>
  )
}
