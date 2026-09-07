"use client"

import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Loader2,
  Plus,
  FileText,
  Send,
  Download,
  Trash2,
  X,
  Mail,
  MessageCircle,
  Search,
  CheckCircle2,
  ArrowRightLeft,
} from "lucide-react"
import { formatNgnFull, recalculateQuote, buildWhatsAppLink, buildQuoteWhatsAppMessage, buildQuotePublicUrl } from "@/lib/quotations"
import { generateQuotationPdf } from "@/lib/quotation-pdf"
import type { Quotation, QuotationItemInput } from "@/lib/quotations"

interface Lead {
  id: string
  fullName: string
  businessName: string
  email: string
  phone: string
  productInterest: string
}

interface QuoteForm {
  leadId: string
  title: string
  validUntil: string
  notesPublic: string
  notesInternal: string
  paymentTerms: string
  items: QuotationItemInput[]
  sendEmail: boolean
}

const initialItem: QuotationItemInput = { description: "", quantity: 1, unitPrice: 0, discount: 0, tax: 0 }

export default function QuotationsPage() {
  const searchParams = useSearchParams()
  const preselectedLeadId = searchParams.get("leadId") || ""

  const [quotations, setQuotations] = useState<Quotation[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState("")
  const [search, setSearch] = useState("")
  const [accountNumber, setAccountNumber] = useState("")

  const [showCreate, setShowCreate] = useState(Boolean(preselectedLeadId))
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState<QuoteForm>({
    leadId: preselectedLeadId,
    title: "",
    validUntil: "",
    notesPublic: "",
    notesInternal: "",
    paymentTerms: "",
    items: [{ ...initialItem }],
    sendEmail: false,
  })

  const [showShare, setShowShare] = useState<Quotation | null>(null)
  const [sendingId, setSendingId] = useState<string | null>(null)
  const [showConvert, setShowConvert] = useState<Quotation | null>(null)
  const [convertDueDate, setConvertDueDate] = useState("")
  const [convertPaymentTerms, setConvertPaymentTerms] = useState("")
  const [convertingId, setConvertingId] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const [qRes, lRes, sRes] = await Promise.all([
          fetch("/api/admin/quotations"),
          fetch("/api/admin/leads"),
          fetch("/api/admin/settings"),
        ])
        const qData = await qRes.json()
        const lData = await lRes.json()
        const sData = await sRes.json()
        if (qData.quotations) setQuotations(qData.quotations)
        if (lData.leads) setLeads(lData.leads)
        if (sData.general?.accountNumber) setAccountNumber(sData.general.accountNumber)
      } catch (e) {
        console.error(e)
        setMessage("Failed to load data")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const totals = useMemo(() => recalculateQuote(form.items), [form.items])

  const filtered = useMemo(() => {
    if (!search.trim()) return quotations
    const q = search.toLowerCase()
    return quotations.filter((qt) =>
      qt.quote_number.toLowerCase().includes(q) ||
      (qt.title || "").toLowerCase().includes(q) ||
      (qt.lead?.fullName || "").toLowerCase().includes(q) ||
      (qt.lead?.businessName || "").toLowerCase().includes(q)
    )
  }, [quotations, search])

  const addItem = () => setForm((prev) => ({ ...prev, items: [...prev.items, { ...initialItem }] }))

  const updateItem = (index: number, patch: Partial<QuotationItemInput>) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((it, i) => (i === index ? { ...it, ...patch } : it)),
    }))
  }

  const removeItem = (index: number) => {
    setForm((prev) => ({ ...prev, items: prev.items.filter((_, i) => i !== index) }))
  }

  const create = async () => {
    if (!form.leadId) {
      setMessage("Select a lead")
      return
    }
    if (form.items.some((it) => !it.description.trim())) {
      setMessage("Each item needs a description")
      return
    }

    setCreating(true)
    setMessage("")
    try {
      const res = await fetch("/api/admin/quotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId: form.leadId,
          title: form.title,
          validUntil: form.validUntil || undefined,
          notesPublic: form.notesPublic,
          notesInternal: form.notesInternal,
          paymentTerms: form.paymentTerms,
          items: form.items,
          sendEmail: form.sendEmail,
        }),
      })
      const data = await res.json()
      if (data.success && data.quotation) {
        setQuotations((prev) => [data.quotation, ...prev])
        setShowCreate(false)
        setForm({
          leadId: "",
          title: "",
          validUntil: "",
          notesPublic: "",
          notesInternal: "",
          paymentTerms: "",
          items: [{ ...initialItem }],
          sendEmail: false,
        })
        setMessage("Quotation created.")
      } else {
        setMessage(data.error || "Failed to create quotation")
      }
    } catch {
      setMessage("Failed to create quotation")
    } finally {
      setCreating(false)
    }
  }

  const sendEmail = async (qt: Quotation) => {
    setSendingId(qt.id)
    try {
      const res = await fetch(`/api/admin/quotations/${qt.id}/send`, { method: "POST" })
      const data = await res.json()
      if (data.success) {
        setMessage("Quotation sent by email.")
        setShowShare(null)
        setQuotations((prev) =>
          prev.map((q) => (q.id === qt.id ? { ...q, status: "SENT", sent_at: new Date().toISOString() } : q))
        )
      } else {
        setMessage(data.message || "Failed to send")
      }
    } catch {
      setMessage("Failed to send quotation")
    } finally {
      setSendingId(null)
    }
  }

  const downloadPdf = (qt: Quotation) => {
    if (!qt.lead) return
    generateQuotationPdf(qt, qt.lead, accountNumber)
  }

  const convertQuote = async (qt: Quotation) => {
    setConvertingId(qt.id)
    try {
      const res = await fetch(`/api/admin/quotations/${qt.id}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dueDate: convertDueDate || undefined,
          paymentTerms: convertPaymentTerms || qt.payment_terms || undefined,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setMessage(`Converted to invoice ${data.invoice.invoice_number}.`)
        setShowConvert(null)
        setQuotations((prev) => prev.map((q) => (q.id === qt.id ? { ...q, status: "CONVERTED" } : q)))
      } else {
        setMessage(data.error || "Failed to convert")
      }
    } catch {
      setMessage("Failed to convert quotation")
    } finally {
      setConvertingId(null)
    }
  }

  const deleteQuote = async (id: string) => {
    if (!confirm("Delete this quotation permanently?")) return
    try {
      const res = await fetch(`/api/admin/quotations/${id}`, { method: "DELETE" })
      const data = await res.json()
      if (data.success) {
        setQuotations((prev) => prev.filter((q) => q.id !== id))
      } else {
        setMessage(data.error || "Failed to delete")
      }
    } catch {
      setMessage("Failed to delete quotation")
    }
  }

  const selectedLead = leads.find((l) => l.id === form.leadId)

  const statusClass = (status: string) => {
    switch (status) {
      case "SENT":
        return "bg-blue-50 text-blue-700"
      case "ACCEPTED":
        return "bg-green-50 text-green-700"
      case "DECLINED":
        return "bg-red-50 text-red-700"
      case "EXPIRED":
        return "bg-gray-100 text-gray-700"
      case "CONVERTED":
        return "bg-blue-50 text-blue-700"
      default:
        return "bg-amber-50 text-amber-700"
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Quotations
          </h2>
          <p className="text-muted-foreground">Create and share quotations with leads.</p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4 mr-1" />
          New Quotation
        </Button>
      </div>

      {message && (
        <div className={`text-sm p-3 rounded-md ${message.includes(".") && !message.includes("Failed") ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
          {message}
        </div>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Search className="w-4 h-4 text-muted-foreground" />
            Search
          </CardTitle>
        </CardHeader>
        <CardContent>
          <input
            type="text"
            placeholder="Search quotes, leads or businesses..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-72 rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">No quotations found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium">Quote #</th>
                    <th className="text-left px-4 py-2 font-medium">Lead</th>
                    <th className="text-left px-4 py-2 font-medium">Title</th>
                    <th className="text-left px-4 py-2 font-medium">Total</th>
                    <th className="text-left px-4 py-2 font-medium">Status</th>
                    <th className="text-left px-4 py-2 font-medium">Sent</th>
                    <th className="text-left px-4 py-2 font-medium w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filtered.map((qt) => (
                    <tr key={qt.id} className="hover:bg-muted/30">
                      <td className="px-4 py-3 font-medium whitespace-nowrap">{qt.quote_number}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{qt.lead?.fullName}</div>
                        <div className="text-xs text-muted-foreground">{qt.lead?.businessName}</div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{qt.title || "—"}</td>
                      <td className="px-4 py-3 font-medium whitespace-nowrap">{formatNgnFull(qt.total_amount)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusClass(qt.status)}`}>
                          {qt.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {qt.sent_at ? new Date(qt.sent_at).toLocaleDateString() : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setShowShare(qt)}
                            className="p-1 rounded-md text-muted-foreground hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            title="Share / send"
                          >
                            <Send className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => downloadPdf(qt)}
                            className="p-1 rounded-md text-muted-foreground hover:text-green-600 hover:bg-green-50 transition-colors"
                            title="Download PDF"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                          {qt.status !== "CONVERTED" && qt.status !== "EXPIRED" && (
                            <button
                              onClick={() => {
                                setConvertDueDate(qt.valid_until ? new Date(qt.valid_until).toISOString().split("T")[0] : "")
                                setConvertPaymentTerms(qt.payment_terms || "")
                                setShowConvert(qt)
                              }}
                              className="p-1 rounded-md text-muted-foreground hover:text-blue-600 hover:bg-blue-50 transition-colors"
                              title="Convert to Invoice"
                            >
                              <ArrowRightLeft className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => deleteQuote(qt.id)}
                            className="p-1 rounded-md text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl border border-border bg-background shadow-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">New Quotation</h3>
              <button onClick={() => setShowCreate(false)} className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Lead</label>
                <select
                  value={form.leadId}
                  onChange={(e) => setForm((prev) => ({ ...prev, leadId: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Select a lead</option>
                  {leads.map((lead) => (
                    <option key={lead.id} value={lead.id}>
                      {lead.fullName} — {lead.businessName}
                    </option>
                  ))}
                </select>
                {selectedLead && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {selectedLead.email} · {selectedLead.phone}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Title</label>
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder="e.g. MartPoint Retail Cloud — Year 1"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Valid Until</label>
                  <input
                    type="date"
                    value={form.validUntil}
                    onChange={(e) => setForm((prev) => ({ ...prev, validUntil: e.target.value }))}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium">Line Items</label>
                  <Button size="sm" variant="outline" onClick={addItem}>
                    <Plus className="w-3.5 h-3.5 mr-1" /> Add Item
                  </Button>
                </div>

                <div className="hidden sm:grid grid-cols-12 gap-2 px-3 py-1 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                  <div className="col-span-5">Description</div>
                  <div className="col-span-2 text-center">Qty</div>
                  <div className="col-span-2 text-center">Unit Price</div>
                  <div className="col-span-1 text-center">Disc</div>
                  <div className="col-span-1 text-center">Tax</div>
                  <div className="col-span-1"></div>
                </div>

                <div className="space-y-2">
                  {form.items.map((item, idx) => (
                    <div key={idx} className="grid grid-cols-12 gap-2 items-start p-3 rounded-lg border border-border bg-muted/20">
                      <div className="col-span-12 sm:col-span-5">
                        <input
                          type="text"
                          placeholder="Description"
                          value={item.description}
                          onChange={(e) => updateItem(idx, { description: e.target.value })}
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        />
                      </div>
                      <div className="col-span-4 sm:col-span-2">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          placeholder="Qty"
                          value={item.quantity}
                          onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) })}
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        />
                      </div>
                      <div className="col-span-4 sm:col-span-2">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          placeholder="Unit price"
                          value={item.unitPrice}
                          onChange={(e) => updateItem(idx, { unitPrice: Number(e.target.value) })}
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        />
                      </div>
                      <div className="col-span-2 sm:col-span-1">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          placeholder="Disc"
                          value={item.discount}
                          onChange={(e) => updateItem(idx, { discount: Number(e.target.value) })}
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        />
                      </div>
                      <div className="col-span-2 sm:col-span-1">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          placeholder="Tax"
                          value={item.tax}
                          onChange={(e) => updateItem(idx, { tax: Number(e.target.value) })}
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        />
                      </div>
                      <div className="col-span-12 sm:col-span-1 flex justify-end">
                        <button onClick={() => removeItem(idx)} className="p-1 text-muted-foreground hover:text-red-600">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Payment Terms / Plan</label>
                <input
                  type="text"
                  value={form.paymentTerms}
                  onChange={(e) => setForm((prev) => ({ ...prev, paymentTerms: e.target.value }))}
                  placeholder="e.g. 50% upfront, 50% before go-live"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Public Notes</label>
                  <textarea
                    value={form.notesPublic}
                    onChange={(e) => setForm((prev) => ({ ...prev, notesPublic: e.target.value }))}
                    rows={3}
                    placeholder="Shown to lead on the quote page"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Internal Notes</label>
                  <textarea
                    value={form.notesInternal}
                    onChange={(e) => setForm((prev) => ({ ...prev, notesInternal: e.target.value }))}
                    rows={3}
                    placeholder="Internal team notes"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  id="sendEmail"
                  type="checkbox"
                  checked={form.sendEmail}
                  onChange={(e) => setForm((prev) => ({ ...prev, sendEmail: e.target.checked }))}
                  className="rounded border-input"
                />
                <label htmlFor="sendEmail" className="text-sm font-medium">Send quotation by email immediately</label>
              </div>

              <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium">{formatNgnFull(totals.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Discount</span>
                  <span className="font-medium">{formatNgnFull(totals.discountAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tax</span>
                  <span className="font-medium">{formatNgnFull(totals.taxAmount)}</span>
                </div>
                <div className="flex justify-between text-base font-semibold border-t border-border pt-2">
                  <span>Total</span>
                  <span>{formatNgnFull(totals.total)}</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowCreate(false)} disabled={creating}>
                Cancel
              </Button>
              <Button onClick={create} disabled={creating}>
                {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                Create Quotation
              </Button>
            </div>
          </div>
        </div>
      )}

      {showShare && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-background shadow-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Share Quotation</h3>
              <button onClick={() => setShowShare(null)} className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Public link</p>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={buildQuotePublicUrl(showShare.public_token)}
                    className="flex-1 rounded-md border border-input bg-muted px-3 py-2 text-sm"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      navigator.clipboard.writeText(buildQuotePublicUrl(showShare.public_token))
                      setMessage("Link copied")
                    }}
                  >
                    Copy
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Button
                  variant="outline"
                  onClick={() => sendEmail(showShare)}
                  disabled={sendingId === showShare.id}
                >
                  {sendingId === showShare.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Mail className="w-4 h-4 mr-2" />}
                  Resend Email
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    if (!showShare.lead) return
                    const msg = buildQuoteWhatsAppMessage(showShare, buildQuotePublicUrl(showShare.public_token))
                    window.open(buildWhatsAppLink(showShare.lead.phone, msg), "_blank")
                  }}
                >
                  <MessageCircle className="w-4 h-4 mr-2" />
                  WhatsApp
                </Button>
              </div>

              <Button variant="outline" className="w-full" onClick={() => downloadPdf(showShare)}>
                <Download className="w-4 h-4 mr-2" />
                Download PDF
              </Button>
            </div>
          </div>
        </div>
      )}

      {showConvert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-background shadow-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Convert to Invoice</h3>
              <button onClick={() => setShowConvert(null)} className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-sm text-muted-foreground">
              This will create a business (if the lead is not yet converted) and generate an invoice from quotation{" "}
              <span className="font-medium text-foreground">{showConvert.quote_number}</span>.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Invoice Due Date</label>
                <input
                  type="date"
                  value={convertDueDate}
                  onChange={(e) => setConvertDueDate(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Payment Terms / Plan</label>
                <textarea
                  value={convertPaymentTerms}
                  onChange={(e) => setConvertPaymentTerms(e.target.value)}
                  rows={3}
                  placeholder="e.g. 50% upfront, 50% before go-live"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowConvert(null)} disabled={convertingId === showConvert.id}>
                Cancel
              </Button>
              <Button onClick={() => convertQuote(showConvert)} disabled={convertingId === showConvert.id}>
                {convertingId === showConvert.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                Convert to Invoice
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
