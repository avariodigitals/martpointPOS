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
  MessageSquare,
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
  allowChanges: boolean
  allowCounterOffer: boolean
}

const initialItem: QuotationItemInput = { description: "", quantity: 1, unitPrice: 0, discount: 0, tax: 0 }

interface CatalogItem {
  id: string
  name: string
  description: string | null
  defaultPrice: number
  currency: string
  type: "Product" | "Service"
}

export default function QuotationsPage() {
  const searchParams = useSearchParams()
  const preselectedLeadId = searchParams.get("leadId") || ""

  const [quotations, setQuotations] = useState<Quotation[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([])
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
    allowChanges: false,
    allowCounterOffer: false,
  })

  const [showShare, setShowShare] = useState<Quotation | null>(null)
  const [sendingId, setSendingId] = useState<string | null>(null)
  const [showConvert, setShowConvert] = useState<Quotation | null>(null)
  const [convertDueDate, setConvertDueDate] = useState("")
  const [convertPaymentTerms, setConvertPaymentTerms] = useState("")
  const [convertingId, setConvertingId] = useState<string | null>(null)

  const [showReview, setShowReview] = useState<Quotation | null>(null)
  const [reviewLoading, setReviewLoading] = useState(false)
  const [reviewChangeReq, setReviewChangeReq] = useState<{
    id: string
    request_type: "scope" | "counter_offer"
    payload: Record<string, unknown>
    client_note: string | null
  } | null>(null)
  const [revisedItems, setRevisedItems] = useState<QuotationItemInput[]>([])
  const [revisedNotes, setRevisedNotes] = useState("")
  const [revisedValidUntil, setRevisedValidUntil] = useState("")
  const [reviewAdminNote, setReviewAdminNote] = useState("")
  const [resolvingId, setResolvingId] = useState<string | null>(null)

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

        const products = (qData.products || []) as Record<string, unknown>[]
        const services = (qData.services || []) as Record<string, unknown>[]
        const catalog: CatalogItem[] = [
          ...products.map((p) => ({
            id: p.id as string,
            name: p.name as string,
            description: (p.description as string) || null,
            defaultPrice: Number(p.default_price) || 0,
            currency: (p.currency as string) || "NGN",
            type: "Product" as const,
          })),
          ...services.map((s) => ({
            id: s.id as string,
            name: s.name as string,
            description: (s.description as string) || null,
            defaultPrice: Number(s.default_price) || 0,
            currency: (s.currency as string) || "NGN",
            type: "Service" as const,
          })),
        ].sort((a, b) => a.name.localeCompare(b.name))
        setCatalogItems(catalog)
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
          allowChanges: form.allowChanges,
          allowCounterOffer: form.allowCounterOffer,
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
          allowChanges: false,
          allowCounterOffer: false,
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

  const openReview = async (qt: Quotation) => {
    setShowReview(qt)
    setReviewLoading(true)
    setReviewChangeReq(null)
    setRevisedItems([])
    setRevisedNotes(qt.notes_public || "")
    setRevisedValidUntil(qt.valid_until ? new Date(qt.valid_until).toISOString().split("T")[0] : "")
    setReviewAdminNote("")
    try {
      const res = await fetch(`/api/admin/quotations/${qt.id}/change-requests`)
      const data = await res.json()
      const pending = (data.changeRequests || []).find((r: { status: string }) => r.status === "pending")
      if (pending) {
        setReviewChangeReq({
          id: pending.id,
          request_type: pending.request_type,
          payload: pending.payload,
          client_note: pending.client_note,
        })
        // Pre-fill revised items from the original quote items (admin sets final prices).
        const baseItems: QuotationItemInput[] = (qt.items || []).map((it) => ({
          id: it.id,
          description: it.description,
          quantity: it.quantity,
          unitPrice: it.unit_price,
          discount: it.discount,
          tax: it.tax,
        }))
        // If scope request, apply the client's requested quantities/descriptions.
        if (pending.request_type === "scope" && Array.isArray(pending.payload?.items)) {
          const requested = pending.payload.items as Array<{ item_id: string | null; description: string; quantity: number }>
          const byId = new Map<string | null, { item_id: string | null; description: string; quantity: number }>(requested.map((r) => [r.item_id, r]))
          const kept: QuotationItemInput[] = []
          for (const it of baseItems) {
            const key = it.id || null
            const match = byId.get(key) || byId.get(null)
            if (match) {
              kept.push({ ...it, description: match.description || it.description, quantity: match.quantity })
              byId.delete(key)
              byId.delete(null)
            }
          }
          setRevisedItems(kept.length > 0 ? kept : baseItems)
        } else {
          setRevisedItems(baseItems)
        }
      } else {
        setMessage("No pending change request found for this quotation.")
      }
    } catch {
      setMessage("Failed to load change request")
    } finally {
      setReviewLoading(false)
    }
  }

  const addRevisedItem = () => setRevisedItems((prev) => [...prev, { ...initialItem }])

  const updateRevisedItem = (index: number, patch: Partial<QuotationItemInput>) => {
    setRevisedItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)))
  }

  const removeRevisedItem = (index: number) => {
    setRevisedItems((prev) => prev.filter((_, i) => i !== index))
  }

  const resolveReview = async (action: "approve" | "decline") => {
    if (!showReview || !reviewChangeReq) return
    if (action === "approve" && revisedItems.some((it) => !it.description.trim())) {
      setMessage("Each revised item needs a description")
      return
    }
    setResolvingId(showReview.id)
    setMessage("")
    try {
      const res = await fetch(`/api/admin/quotations/${showReview.id}/change-requests/${reviewChangeReq.id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          adminNote: reviewAdminNote || undefined,
          items: action === "approve" ? revisedItems : undefined,
          notesPublic: action === "approve" ? revisedNotes : undefined,
          validUntil: action === "approve" ? revisedValidUntil || undefined : undefined,
        }),
      })
      const data = await res.json()
      if (data.success) {
        setMessage(action === "approve" ? "Revised quote issued and emailed to client." : "Change request declined. Quote restored to SENT.")
        setShowReview(null)
        // Reload quotations to reflect new totals/status.
        const qRes = await fetch("/api/admin/quotations")
        const qData = await qRes.json()
        if (qData.quotations) setQuotations(qData.quotations)
      } else {
        setMessage(data.error || "Failed to resolve")
      }
    } catch {
      setMessage("Failed to resolve change request")
    } finally {
      setResolvingId(null)
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
      case "CHANGE_REQUESTED":
      case "COUNTER_OFFERED":
        return "bg-amber-50 text-amber-700"
      case "REVISED":
        return "bg-purple-50 text-purple-700"
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
                          {(qt.status === "CHANGE_REQUESTED" || qt.status === "COUNTER_OFFERED") && (
                            <button
                              onClick={() => openReview(qt)}
                              className="p-1 rounded-md text-amber-600 hover:bg-amber-50 transition-colors"
                              title="Review change request"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
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
                        {catalogItems.length > 0 && (
                          <select
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm mb-2"
                            value={catalogItems.find((c) => c.name === item.description)?.id || ""}
                            onChange={(e) => {
                              const picked = catalogItems.find((c) => c.id === e.target.value)
                              if (picked) updateItem(idx, { description: picked.name, unitPrice: picked.defaultPrice })
                            }}
                          >
                            <option value="">Pick from catalog...</option>
                            {catalogItems.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name} ({c.type})
                              </option>
                            ))}
                          </select>
                        )}
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

              <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-3 text-sm">
                <div className="flex items-center gap-2">
                  <input
                    id="allowChanges"
                    type="checkbox"
                    checked={form.allowChanges}
                    onChange={(e) => setForm((prev) => ({ ...prev, allowChanges: e.target.checked, allowCounterOffer: e.target.checked ? prev.allowCounterOffer : false }))}
                    className="rounded border-input"
                  />
                  <label htmlFor="allowChanges" className="text-sm font-medium">Allow client to request changes</label>
                </div>
                {form.allowChanges && (
                  <p className="text-xs text-muted-foreground pl-6">
                    Client can adjust quantities, remove items, and add a budget + note. You review and reissue a revised quote.
                  </p>
                )}
                <div className={`flex items-center gap-2 pl-6 ${form.allowChanges ? "" : "opacity-50"}`}>
                  <input
                    id="allowCounterOffer"
                    type="checkbox"
                    checked={form.allowCounterOffer}
                    disabled={!form.allowChanges}
                    onChange={(e) => setForm((prev) => ({ ...prev, allowCounterOffer: e.target.checked }))}
                    className="rounded border-input"
                  />
                  <label htmlFor="allowCounterOffer" className="text-sm font-medium">Also allow counter-offer (client proposes a total)</label>
                </div>
                {form.allowChanges && form.allowCounterOffer && (
                  <p className="text-xs text-muted-foreground pl-6">
                    Client can propose their own total amount. You decide whether to meet it. Use only where negotiation is welcome.
                  </p>
                )}
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

      {showReview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl border border-border bg-background shadow-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Review Change Request — {showReview.quote_number}</h3>
              <button onClick={() => setShowReview(null)} className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {reviewLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : !reviewChangeReq ? (
              <p className="text-sm text-muted-foreground">No pending change request found for this quotation.</p>
            ) : (
              <>
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800">
                      {reviewChangeReq.request_type === "counter_offer" ? "Counter-offer" : "Scope change"}
                    </span>
                    <span className="text-muted-foreground">from {showReview.lead?.fullName} — {showReview.lead?.businessName}</span>
                  </div>

                  {reviewChangeReq.request_type === "scope" && Array.isArray(reviewChangeReq.payload?.items) && (
                    <div className="mt-2">
                      <p className="text-xs font-medium text-amber-800 mb-1">Client requested items:</p>
                      <ul className="text-xs text-amber-900 space-y-0.5 list-disc list-inside">
                        {(reviewChangeReq.payload.items as Array<{ description: string; quantity: number }>).map((it, i) => (
                          <li key={i}>{it.description} — qty {it.quantity}</li>
                        ))}
                      </ul>
                      {reviewChangeReq.payload.proposed_budget != null && (
                        <p className="text-xs text-amber-900 mt-1">Proposed budget: {formatNgnFull(Number(reviewChangeReq.payload.proposed_budget))}</p>
                      )}
                    </div>
                  )}

                  {reviewChangeReq.request_type === "counter_offer" && reviewChangeReq.payload?.proposed_total != null && (
                    <p className="text-sm">
                      <span className="text-muted-foreground">Client proposed total:</span>{" "}
                      <span className="font-semibold">{formatNgnFull(Number(reviewChangeReq.payload.proposed_total))}</span>
                      <span className="text-muted-foreground ml-2">(original: {formatNgnFull(showReview.total_amount)})</span>
                    </p>
                  )}

                  {reviewChangeReq.client_note && (
                    <div className="mt-2">
                      <p className="text-xs font-medium text-amber-800 mb-1">Client note:</p>
                      <p className="text-sm text-amber-900 whitespace-pre-line">{reviewChangeReq.client_note}</p>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-medium">Revised line items (you set the final prices)</label>
                    <Button size="sm" variant="outline" onClick={addRevisedItem}>
                      <Plus className="w-3.5 h-3.5 mr-1" /> Add Item
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {revisedItems.map((item, idx) => (
                      <div key={idx} className="grid grid-cols-12 gap-2 items-start p-3 rounded-lg border border-border bg-muted/20">
                        <div className="col-span-12 sm:col-span-5">
                          <input
                            type="text"
                            placeholder="Description"
                            value={item.description}
                            onChange={(e) => updateRevisedItem(idx, { description: e.target.value })}
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
                            onChange={(e) => updateRevisedItem(idx, { quantity: Number(e.target.value) })}
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
                            onChange={(e) => updateRevisedItem(idx, { unitPrice: Number(e.target.value) })}
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          />
                        </div>
                        <div className="col-span-2 sm:col-span-2">
                          <input
                            type="number"
                            min="0"
                            step="any"
                            placeholder="Disc"
                            value={item.discount}
                            onChange={(e) => updateRevisedItem(idx, { discount: Number(e.target.value) })}
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          />
                        </div>
                        <div className="col-span-2 sm:col-span-1 flex justify-end">
                          <button onClick={() => removeRevisedItem(idx)} className="p-1 text-muted-foreground hover:text-red-600">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-lg border border-border bg-muted/20 p-3 text-sm">
                    <div className="flex justify-between font-semibold border-t border-border pt-2">
                      <span>Revised Total</span>
                      <span>{formatNgnFull(recalculateQuote(revisedItems).total)}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Revised Valid Until</label>
                    <input
                      type="date"
                      value={revisedValidUntil}
                      onChange={(e) => setRevisedValidUntil(e.target.value)}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Revised Public Notes</label>
                    <input
                      type="text"
                      value={revisedNotes}
                      onChange={(e) => setRevisedNotes(e.target.value)}
                      placeholder="Shown to client on the revised quote"
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Admin note (internal, not shown to client)</label>
                  <textarea
                    value={reviewAdminNote}
                    onChange={(e) => setReviewAdminNote(e.target.value)}
                    rows={2}
                    placeholder="Why you approved/declined"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-border">
                  <Button
                    variant="outline"
                    onClick={() => resolveReview("decline")}
                    disabled={resolvingId === showReview.id}
                  >
                    {resolvingId === showReview.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <X className="w-4 h-4 mr-2" />}
                    Decline Request
                  </Button>
                  <Button
                    onClick={() => resolveReview("approve")}
                    disabled={resolvingId === showReview.id}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {resolvingId === showReview.id ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                    Issue Revised Quote
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
