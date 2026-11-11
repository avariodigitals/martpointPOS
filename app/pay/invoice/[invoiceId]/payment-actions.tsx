"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"

export function InvoicePaymentActions({ invoiceId, balanceDue, reference, bankDetails }: { invoiceId: string; balanceDue: number; reference?: string; bankDetails: string }) {
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState("")
  const router = useRouter()

  async function pay() {
    setBusy(true); setMessage("")
    try {
      const response = await fetch(`/api/public/invoices/${encodeURIComponent(invoiceId)}/checkout`, { method: "POST" })
      const data = await response.json()
      if (!response.ok || !data.authorization_url) throw new Error(data.error || "Could not start payment")
      window.location.assign(data.authorization_url)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not start payment")
      setBusy(false)
    }
  }

  const confirm = useCallback(async () => {
    if (!reference) return
    setBusy(true); setMessage("Checking your MartPoint Pay transaction…")
    try {
      const response = await fetch(`/api/public/invoices/${encodeURIComponent(invoiceId)}/verify`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reference }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Payment is not confirmed yet")
      setMessage("Payment confirmed. This invoice is up to date.")
      router.refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Payment confirmation is still pending")
    } finally { setBusy(false) }
  }, [invoiceId, reference, router])

  useEffect(() => { if (reference) void confirm() }, [confirm, reference])

  return <div className="space-y-4">
    {bankDetails && <section className="rounded-xl border bg-white p-4"><h2 className="font-semibold">Bank transfer details</h2><p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{bankDetails}</p><p className="mt-2 text-xs text-slate-500">Use the invoice number as your transfer reference, then contact MartPoint with proof of payment.</p></section>}
    {balanceDue > 0 && <button onClick={reference ? confirm : pay} disabled={busy} className="w-full rounded-xl bg-blue-700 px-5 py-3 font-semibold text-white disabled:opacity-60">{busy ? "Please wait…" : reference ? "Confirm my payment" : `Pay ₦${balanceDue.toLocaleString("en-NG", { minimumFractionDigits: 2 })} with MartPoint Pay`}</button>}
    {balanceDue > 0 && !reference && <p className="text-center text-xs text-slate-500">Secure checkout provided by Paystack.</p>}
    {message && <p role="status" className="text-sm text-slate-700">{message}</p>}
  </div>
}
