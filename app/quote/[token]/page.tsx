"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Loader2, AlertCircle, Check, X, Download, MessageCircle, FileText, Clock } from "lucide-react"
import { formatNgnFull, buildWhatsAppLink, buildQuoteWhatsAppMessage } from "@/lib/quotations"
import { generateQuotationPdf } from "@/lib/quotation-pdf"
import type { Quotation, LeadSummary } from "@/lib/quotations"

export default function PublicQuotePage() {
  const params = useParams()
  const token = params.token as string

  const [quote, setQuote] = useState<Quotation | null>(null)
  const [lead, setLead] = useState<LeadSummary | null>(null)
  const [accountNumber, setAccountNumber] = useState("")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [response, setResponse] = useState<"" | "accepted" | "declined" | "change_requested">("")

  const [changeRequest, setChangeRequest] = useState<{
    status: "pending" | "approved" | "declined"
    request_type: "scope" | "counter_offer"
  } | null>(null)

  const [showChangeForm, setShowChangeForm] = useState(false)
  const [changeMode, setChangeMode] = useState<"scope" | "counter_offer">("scope")
  const [scopeItems, setScopeItems] = useState<Array<{ item_id: string; description: string; quantity: number; unit_price: number }>>([])
  const [proposedBudget, setProposedBudget] = useState("")
  const [proposedTotal, setProposedTotal] = useState("")
  const [changeNote, setChangeNote] = useState("")

  useEffect(() => {
    if (!token) return
    fetch(`/api/quotations?token=${encodeURIComponent(token)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.quotation) {
          setQuote(data.quotation)
          setAccountNumber(data.settings?.accountNumber || "")
          const leadRaw = data.quotation.lead || {}
          setLead({
            id: data.quotation.lead_id,
            fullName: leadRaw.full_name || "",
            businessName: leadRaw.business_name || "",
            email: leadRaw.email || "",
            phone: leadRaw.phone || "",
            productInterest: leadRaw.product_interest || "",
          })
          if (data.changeRequest) {
            setChangeRequest({
              status: data.changeRequest.status,
              request_type: data.changeRequest.request_type,
            })
          }
          // Pre-fill scope form with the original items.
          setScopeItems(
            (data.quotation.items || []).map((it: { id: string; description: string; quantity: number; unit_price: number }) => ({
              item_id: it.id,
              description: it.description,
              quantity: it.quantity,
              unit_price: it.unit_price,
            }))
          )
        } else {
          setError(data.error || "Quotation not found")
        }
      })
      .catch(() => setError("Failed to load quotation"))
      .finally(() => setLoading(false))
  }, [token])

  const respond = async (action: "accept" | "decline") => {
    setSubmitting(true)
    try {
      const res = await fetch(`/api/quotations?token=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      })
      const data = await res.json()
      if (data.success) {
        setResponse(action === "accept" ? "accepted" : "declined")
        setQuote((prev) => (prev ? { ...prev, status: data.status } : prev))
      } else {
        setError(data.error || "Failed to respond")
      }
    } catch {
      setError("Failed to respond")
    } finally {
      setSubmitting(false)
    }
  }

  const submitChange = async () => {
    if (!quote) return
    setSubmitting(true)
    setError("")
    try {
      const body: Record<string, unknown> = {
        action: changeMode === "counter_offer" ? "counter_offer" : "request_changes",
        note: changeNote,
      }
      if (changeMode === "scope") {
        body.items = scopeItems
          .filter((it) => it.quantity > 0)
          .map((it) => ({ item_id: it.item_id, description: it.description, quantity: it.quantity }))
        if (proposedBudget) body.proposedBudget = Number(proposedBudget)
      } else {
        body.proposedTotal = Number(proposedTotal)
      }
      const res = await fetch(`/api/quotations?token=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (data.success) {
        setResponse("change_requested")
        setQuote((prev) => (prev ? { ...prev, status: data.status } : prev))
        setChangeRequest({ status: "pending", request_type: changeMode })
        setShowChangeForm(false)
      } else {
        setError(data.error || "Failed to submit")
      }
    } catch {
      setError("Failed to submit change request")
    } finally {
      setSubmitting(false)
    }
  }

  const downloadPdf = async () => {
    if (!quote || !lead) return
    await generateQuotationPdf(quote, lead, accountNumber)
  }

  const shareWhatsApp = () => {
    if (!quote || !lead) return
    const publicUrl = typeof window !== "undefined" ? window.location.href : buildQuotePublicUrl(quote.public_token)
    const msg = buildQuoteWhatsAppMessage(quote, publicUrl)
    window.open(buildWhatsAppLink(lead.phone, msg), "_blank")
  }

  const buildQuotePublicUrl = (t: string) => {
    const base = process.env.NEXT_PUBLIC_BASE_URL || "https://martpoint.com.ng"
    return `${base}/quote/${t}`
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error && !quote) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted p-4">
        <div className="max-w-md w-full rounded-xl border border-border bg-card p-8 text-center">
          <AlertCircle className="w-10 h-10 text-destructive mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-2">Quotation unavailable</h2>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    )
  }

  if (!quote || !lead) return null

  const isExpired = quote.status === "EXPIRED" || (quote.valid_until && new Date(quote.valid_until) < new Date())
  const alreadyResponded = response === "accepted" || response === "declined" || ["ACCEPTED", "DECLINED", "CONVERTED"].includes(quote.status)
  const changeSubmitted = response === "change_requested" || changeRequest?.status === "pending" || ["CHANGE_REQUESTED", "COUNTER_OFFERED"].includes(quote.status)
  const canRequestChanges = quote.allow_changes && !alreadyResponded && !changeSubmitted && !isExpired
  const allowCounterOffer = quote.allow_counter_offer && canRequestChanges

  return (
    <div className="min-h-screen bg-muted py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="text-center">
          <div className="w-12 h-12 rounded-xl bg-retail-soft flex items-center justify-center mx-auto mb-4">
            <FileText className="w-6 h-6 text-retail" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold">Quotation {quote.quote_number}</h1>
          <p className="mt-2 text-muted-foreground">Prepared for {lead.fullName} — {lead.businessName}</p>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {quote.status === "CONVERTED" ? (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-6 text-center">
            <FileText className="w-8 h-8 text-blue-600 mx-auto mb-2" />
            <h3 className="font-semibold text-blue-800">Converted to Invoice</h3>
            <p className="text-sm text-blue-700 mt-1">This quotation has been converted to an invoice. Our team will share payment details.</p>
          </div>
        ) : response === "accepted" || quote.status === "ACCEPTED" ? (
          <div className="rounded-xl border border-green-200 bg-green-50 p-6 text-center">
            <Check className="w-8 h-8 text-green-600 mx-auto mb-2" />
            <h3 className="font-semibold text-green-800">Quotation Accepted</h3>
            <p className="text-sm text-green-700 mt-1">Thank you. Our team will be in touch shortly.</p>
          </div>
        ) : response === "declined" || quote.status === "DECLINED" ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
            <X className="w-8 h-8 text-red-600 mx-auto mb-2" />
            <h3 className="font-semibold text-red-800">Quotation Declined</h3>
            <p className="text-sm text-red-700 mt-1">We are sorry this was not a fit. Our team may follow up.</p>
          </div>
        ) : changeSubmitted ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
            <Clock className="w-8 h-8 text-amber-600 mx-auto mb-2" />
            <h3 className="font-semibold text-amber-800">
              {changeRequest?.request_type === "counter_offer" ? "Counter-offer Submitted" : "Change Request Submitted"}
            </h3>
            <p className="text-sm text-amber-700 mt-1">
              Thank you. Our team is reviewing your request and will revert with a revised quotation shortly. You will receive an email when it is ready.
            </p>
          </div>
        ) : null}

        <div className="rounded-xl border border-border bg-card p-6 md:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Status</p>
              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium mt-1 ${
                quote.status === "ACCEPTED" ? "bg-green-50 text-green-700" :
                quote.status === "DECLINED" ? "bg-red-50 text-red-700" :
                quote.status === "CONVERTED" ? "bg-blue-50 text-blue-700" :
                quote.status === "SENT" ? "bg-blue-50 text-blue-700" :
                quote.status === "REVISED" ? "bg-purple-50 text-purple-700" :
                quote.status === "CHANGE_REQUESTED" || quote.status === "COUNTER_OFFERED" ? "bg-amber-50 text-amber-700" :
                isExpired ? "bg-gray-100 text-gray-700" : "bg-amber-50 text-amber-700"
              }`}>
                {isExpired && quote.status !== "ACCEPTED" && quote.status !== "DECLINED" && quote.status !== "CONVERTED" && quote.status !== "CHANGE_REQUESTED" && quote.status !== "COUNTER_OFFERED" && quote.status !== "REVISED" ? "Expired" : quote.status}
              </span>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Valid Until</p>
              <p className="font-medium">{quote.valid_until ? new Date(quote.valid_until).toLocaleDateString("en-NG") : "Not specified"}</p>
            </div>
          </div>

          {quote.title && (
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Title</p>
              <p className="font-medium text-lg">{quote.title}</p>
            </div>
          )}

          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Description</th>
                  <th className="text-right px-4 py-3 font-medium">Qty</th>
                  <th className="text-right px-4 py-3 font-medium">Unit</th>
                  <th className="text-right px-4 py-3 font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {(quote.items || []).map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3">{item.description}</td>
                    <td className="px-4 py-3 text-right">{item.quantity}</td>
                    <td className="px-4 py-3 text-right">{formatNgnFull(item.unit_price)}</td>
                    <td className="px-4 py-3 text-right font-medium">{formatNgnFull(item.line_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-2 text-sm sm:w-64 sm:ml-auto">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatNgnFull(quote.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Discount</span>
              <span>{formatNgnFull(quote.discount_amount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tax</span>
              <span>{formatNgnFull(quote.tax_amount)}</span>
            </div>
            <div className="flex justify-between text-lg font-semibold border-t border-border pt-2">
              <span>Total</span>
              <span className="text-retail">{formatNgnFull(quote.total_amount)}</span>
            </div>
          </div>

          {quote.payment_terms && (
            <div className="rounded-md bg-muted/30 p-4 text-sm whitespace-pre-line">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Payment Terms</p>
              {quote.payment_terms}
            </div>
          )}

          {accountNumber && (
            <div className="rounded-md bg-retail-soft/30 p-4 text-sm">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Wire / Bank Account Number</p>
              <p className="font-medium text-retail">{accountNumber}</p>
            </div>
          )}

          {quote.notes_public && (
            <div className="rounded-md bg-muted/30 p-4 text-sm whitespace-pre-line">
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Notes</p>
              {quote.notes_public}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button variant="outline" onClick={downloadPdf} className="flex-1">
              <Download className="w-4 h-4 mr-2" />
              Download PDF
            </Button>
            <Button variant="outline" onClick={shareWhatsApp} className="flex-1">
              <MessageCircle className="w-4 h-4 mr-2" />
              Share on WhatsApp
            </Button>
          </div>

          {!alreadyResponded && !isExpired && !changeSubmitted && (
            <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-border">
              <Button
                variant="default"
                onClick={() => respond("accept")}
                disabled={submitting}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Check className="w-4 h-4 mr-2" />}
                Accept Quotation
              </Button>
              <Button
                variant="outline"
                onClick={() => respond("decline")}
                disabled={submitting}
                className="flex-1"
              >
                <X className="w-4 h-4 mr-2" />
                Decline
              </Button>
            </div>
          )}

          {canRequestChanges && !showChangeForm && (
            <div className="pt-2 border-t border-border">
              <button
                onClick={() => setShowChangeForm(true)}
                className="text-sm text-muted-foreground hover:text-foreground underline underline-offset-4"
              >
                Request changes to this quotation
              </button>
            </div>
          )}

          {showChangeForm && canRequestChanges && (
            <div className="pt-4 border-t border-border space-y-4">
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-semibold">Request Changes</h4>
                {allowCounterOffer && (
                  <div className="flex rounded-md border border-border overflow-hidden text-xs">
                    <button
                      onClick={() => setChangeMode("scope")}
                      className={`px-3 py-1 ${changeMode === "scope" ? "bg-retail text-white" : "bg-background"}`}
                    >
                      Adjust scope
                    </button>
                    <button
                      onClick={() => setChangeMode("counter_offer")}
                      className={`px-3 py-1 ${changeMode === "counter_offer" ? "bg-retail text-white" : "bg-background"}`}
                    >
                      Counter-offer
                    </button>
                  </div>
                )}
                <button
                  onClick={() => setShowChangeForm(false)}
                  className="ml-auto p-1 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {changeMode === "scope" ? (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Adjust quantities or remove items you don't need. We will review and send a revised quotation with final pricing.
                  </p>
                  <div className="space-y-2">
                    {scopeItems.map((it, idx) => (
                      <div key={it.item_id} className="flex items-center gap-2 text-sm">
                        <span className="flex-1">{it.description}</span>
                        <span className="text-muted-foreground text-xs w-24 text-right">{formatNgnFull(it.unit_price)}</span>
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={it.quantity}
                          onChange={(e) => setScopeItems((prev) => prev.map((x, i) => (i === idx ? { ...x, quantity: Number(e.target.value) } : x)))}
                          className="w-20 rounded-md border border-input bg-background px-2 py-1 text-sm text-right"
                          placeholder="Qty"
                        />
                        {it.quantity > 0 ? (
                          <span className="text-xs text-muted-foreground w-24 text-right">{formatNgnFull(it.unit_price * it.quantity)}</span>
                        ) : (
                          <span className="text-xs text-red-600 w-24 text-right">Removed</span>
                        )}
                      </div>
                    ))}
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Your budget (optional)</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={proposedBudget}
                      onChange={(e) => setProposedBudget(e.target.value)}
                      placeholder="e.g. 250000"
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Propose a total you are willing to pay. We will decide whether we can meet it.
                  </p>
                  <div>
                    <label className="block text-xs font-medium mb-1">Proposed total (₦)</label>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={proposedTotal}
                      onChange={(e) => setProposedTotal(e.target.value)}
                      placeholder="e.g. 250000"
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Current total: {formatNgnFull(quote.total_amount)}</p>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium mb-1">Note to MartPoint (optional)</label>
                <textarea
                  value={changeNote}
                  onChange={(e) => setChangeNote(e.target.value)}
                  rows={3}
                  placeholder="Tell us what you'd like changed"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
                />
              </div>

              <Button onClick={submitChange} disabled={submitting} className="w-full">
                {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Submit Request
              </Button>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-muted-foreground">
          MartPoint · {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}
