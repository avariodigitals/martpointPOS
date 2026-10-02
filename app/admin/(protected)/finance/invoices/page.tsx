"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Plus, Search, X, Receipt, ArrowLeft, Trash2, Pencil, CheckCircle2, Ban, CreditCard, Send, FileX, Eye, Mail, BellRing, PauseCircle, PlayCircle, Download } from "lucide-react"
import { formatMoney } from "@/lib/money-format"
import { enumLabel } from "@/lib/utils"

interface BusinessMini {
  id: string
  businessName: string
  primaryEmail: string
  primaryPhone: string
}

interface InvoiceItem {
  id?: string
  description: string
  quantity: number
  unit_price: number
  discount: number
  tax: number
  line_total: number
  item_type?: "PRODUCT" | "PLAN" | "ADDON" | "SERVICE" | "CUSTOM"
  reference_id?: string | null
}

interface Invoice {
  id: string
  invoice_number: string
  business_id: string
  businesses?: { business_name: string } | null
  quote_id?: string | null
  currency: string
  issue_date: string
  due_date: string
  subtotal: number
  discount_amount: number
  tax_amount: number
  total_amount: number
  amount_paid: number
  balance_due: number
  status: string
  notes_public?: string | null
  notes_internal?: string | null
  invoice_items?: InvoiceItem[]
  reminders_paused?: boolean
  reminder_count?: number
  last_reminder_at?: string | null
  invoice_email_sent_at?: string | null
  created_at?: string
}

interface InvoicePayment {
  id: string
  payment_reference: string
  amount: number
  currency: string
  payment_method: string
  status: string
  paid_at?: string | null
  created_at?: string
  notes?: string | null
  payment_allocations?: { invoice_id: string; amount_allocated: number }[]
}

const CURRENCIES = ["NGN", "USD", "GBP", "GHS", "KES", "ZAR"]
const STATUSES = ["DRAFT", "ISSUED", "PARTIALLY_PAID", "PAID", "OVERDUE", "VOID", "CANCELLED"]
const PAYMENT_METHODS = ["BANK_TRANSFER", "PAYSTACK", "FLUTTERWAVE", "CASH", "POS", "OTHER"]

const CATALOG_TYPES = [
  { key: "PRODUCT", label: "Product" },
  { key: "PLAN", label: "Plan" },
  { key: "SERVICE", label: "Service" },
  { key: "CUSTOM", label: "Custom" },
] as const

interface CatalogItem {
  id: string
  name: string
  code?: string
  default_price?: number
  base_price?: number
  active?: boolean
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700",
  ISSUED: "bg-blue-50 text-blue-700",
  PARTIALLY_PAID: "bg-amber-50 text-amber-700",
  PAID: "bg-green-50 text-green-700",
  OVERDUE: "bg-red-50 text-red-700",
  VOID: "bg-gray-100 text-gray-500 line-through",
  CANCELLED: "bg-gray-100 text-gray-500",
}

function formatNgn(n: number | string | undefined | null, currency = "NGN") {
  return formatMoney(n, currency)
}

function computeItemTotal(item: InvoiceItem) {
  return Math.max(0, (Number(item.quantity) || 0) * (Number(item.unit_price) || 0) - (Number(item.discount) || 0) + (Number(item.tax) || 0))
}

function computeInvoiceTotals(items: InvoiceItem[]) {
  return items.reduce(
    (acc, it) => {
      const qty = Number(it.quantity) || 0
      const unit = Number(it.unit_price) || 0
      const disc = Number(it.discount) || 0
      const tax = Number(it.tax) || 0
      const lineSub = qty * unit
      const lineTotal = Math.max(0, lineSub - disc + tax)
      return {
        subtotal: acc.subtotal + lineSub,
        discount: acc.discount + disc,
        tax: acc.tax + tax,
        total: acc.total + lineTotal,
      }
    },
    { subtotal: 0, discount: 0, tax: 0, total: 0 }
  )
}

function catalogPriceOf(item: CatalogItem) {
  return item.default_price ?? item.base_price ?? 0
}

type Catalog = { products: CatalogItem[]; plans: CatalogItem[]; services: CatalogItem[] }

function catalogOptionsFor(catalog: Catalog, type?: string): CatalogItem[] {
  if (type === "PRODUCT") return catalog.products
  if (type === "PLAN") return catalog.plans
  if (type === "SERVICE") return catalog.services
  return []
}

function defaultNewItemFor(catalog: Catalog): InvoiceItem {
  const firstProduct = catalog.products[0]
  if (firstProduct) {
    return {
      description: firstProduct.name,
      quantity: 1,
      unit_price: catalogPriceOf(firstProduct),
      discount: 0,
      tax: 0,
      line_total: catalogPriceOf(firstProduct),
      item_type: "PRODUCT",
      reference_id: firstProduct.id,
    }
  }
  return { description: "", quantity: 1, unit_price: 0, discount: 0, tax: 0, line_total: 0, item_type: "CUSTOM", reference_id: null }
}

type CatalogTab = "PRODUCT" | "PLAN" | "SERVICE"

const CATALOG_TAB_LABELS: Record<CatalogTab, string> = {
  PRODUCT: "Products",
  PLAN: "Plans",
  SERVICE: "Services",
}

/** Visual catalog picker: tabs + search + card grid so items are easy to see and select. */
function CatalogPicker({
  catalog,
  onPick,
  onCustom,
}: {
  catalog: { products: CatalogItem[]; plans: CatalogItem[]; services: CatalogItem[] }
  onPick: (type: CatalogTab, item: CatalogItem) => void
  onCustom: () => void
}) {
  const [tab, setTab] = useState<CatalogTab>("PRODUCT")
  const [q, setQ] = useState("")

  const items = tab === "PRODUCT" ? catalog.products : tab === "PLAN" ? catalog.plans : catalog.services
  const filtered = items.filter(
    (i) =>
      i.name.toLowerCase().includes(q.toLowerCase()) ||
      (i.code || "").toLowerCase().includes(q.toLowerCase())
  )

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="text-sm font-medium">Add Items — pick from catalog</CardTitle>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search items..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm"
            />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {(Object.keys(CATALOG_TAB_LABELS) as CatalogTab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded-md px-3 py-2.5 text-sm font-medium ${
                tab === t ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"
              }`}
            >
              {CATALOG_TAB_LABELS[t]}
            </button>
          ))}
          <button
            type="button"
            onClick={onCustom}
            className="rounded-md border border-dashed border-input px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted/50"
          >
            + Custom item
          </button>
        </div>

        {filtered.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No {CATALOG_TAB_LABELS[tab].toLowerCase()} found.
          </p>
        ) : (
          <div className="grid max-h-64 grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => onPick(tab, opt)}
                className="group rounded-lg border border-border bg-background p-3 text-left transition-colors hover:border-retail hover:bg-retail/5"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium leading-snug">{opt.name}</p>
                  <Plus className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-retail" />
                </div>
                <div className="mt-1 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{opt.code || CATALOG_TAB_LABELS[tab].slice(0, -1)}</span>
                  <span className="text-sm font-semibold">{formatNgn(catalogPriceOf(opt))}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

/** Editable invoice line-items table (type, item, description, qty, price, discount, tax). */
function ItemsEditor({
  items,
  onChange,
  catalog,
  currency = "NGN",
}: {
  items: InvoiceItem[]
  onChange: (items: InvoiceItem[]) => void
  catalog: Catalog
  currency?: string
}) {
  function updateItem(idx: number, field: keyof InvoiceItem, value: unknown) {
    onChange(
      items.map((it, i) => {
        if (i !== idx) return it
        let next = { ...it, [field]: value } as InvoiceItem

        if (field === "item_type") {
          const options = catalogOptionsFor(catalog, String(value))
          if (String(value) !== "CUSTOM" && options.length > 0) {
            const selected = options[0]
            next = {
              ...next,
              description: selected.name,
              unit_price: catalogPriceOf(selected),
              reference_id: selected.id,
            }
          } else {
            next = { ...next, description: "", unit_price: 0, reference_id: null }
          }
        }

        if (field === "reference_id" && it.item_type && it.item_type !== "CUSTOM") {
          const selected = catalogOptionsFor(catalog, it.item_type).find((c) => c.id === value)
          if (selected) {
            next = { ...next, description: selected.name, unit_price: catalogPriceOf(selected) }
          }
        }

        next.line_total = computeItemTotal(next)
        return next
      })
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Line Items</CardTitle></CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No line items. Add one below.</p>
        ) : (
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-sm min-w-[60rem]">
              <thead>
                <tr className="text-left text-muted-foreground text-[10px] uppercase tracking-wider">
                  <th className="px-3 py-2.5 font-medium w-28">Type</th>
                  <th className="px-3 py-2.5 font-medium min-w-[14rem]">Item</th>
                  <th className="px-3 py-2.5 font-medium min-w-[14rem]">Description</th>
                  <th className="px-3 py-2.5 font-medium w-16 text-center">Qty</th>
                  <th className="px-3 py-2.5 font-medium w-28 text-right">Unit Price</th>
                  <th className="px-3 py-2.5 font-medium w-20 text-right">Disc</th>
                  <th className="px-3 py-2.5 font-medium w-20 text-right">Tax</th>
                  <th className="px-3 py-2.5 font-medium w-28 text-right">Total</th>
                  <th className="px-3 py-2.5 font-medium w-12"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => {
                  const options = item.item_type ? catalogOptionsFor(catalog, item.item_type) : []
                  const isCustom = !item.item_type || item.item_type === "CUSTOM"
                  return (
                    <tr key={item.id || idx} className="border-t last:border-b">
                      <td className="px-3 py-2.5 align-top w-28">
                        <select
                          value={item.item_type || "CUSTOM"}
                          onChange={(e) => updateItem(idx, "item_type", e.target.value)}
                          className="w-full rounded-md border border-input bg-background px-2 py-2 text-sm"
                        >
                          {CATALOG_TYPES.map((t) => (<option key={t.key} value={t.key}>{t.label}</option>))}
                        </select>
                      </td>
                      <td className="px-3 py-2.5 align-top min-w-[14rem]">
                        {!isCustom && (
                          <select
                            value={item.reference_id || ""}
                            onChange={(e) => updateItem(idx, "reference_id", e.target.value)}
                            className="w-full rounded-md border border-input bg-background px-2 py-2 text-sm"
                          >
                            {options.map((opt) => (<option key={opt.id} value={opt.id}>{opt.name}</option>))}
                          </select>
                        )}
                      </td>
                      <td className="px-3 py-2.5 align-top min-w-[14rem]">
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => updateItem(idx, "description", e.target.value)}
                          placeholder={isCustom ? "Item description" : "Description"}
                          className="w-full min-w-[14rem] rounded-md border border-input bg-background px-3 py-2 text-sm"
                        />
                      </td>
                      <td className="px-3 py-2.5 align-top w-16">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={item.quantity}
                          onChange={(e) => updateItem(idx, "quantity", Number(e.target.value))}
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-center"
                        />
                      </td>
                      <td className="px-3 py-2.5 align-top w-28">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={item.unit_price}
                          onChange={(e) => updateItem(idx, "unit_price", Number(e.target.value))}
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-right"
                        />
                      </td>
                      <td className="px-3 py-2.5 align-top w-20">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={item.discount}
                          onChange={(e) => updateItem(idx, "discount", Number(e.target.value))}
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-right"
                        />
                      </td>
                      <td className="px-3 py-2.5 align-top w-20">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={item.tax}
                          onChange={(e) => updateItem(idx, "tax", Number(e.target.value))}
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-right"
                        />
                      </td>
                      <td className="px-3 py-2.5 align-middle w-28 text-sm font-medium text-right">
                        {formatNgn(item.line_total, currency)}
                      </td>
                      <td className="px-3 py-2.5 align-top w-12">
                        <button onClick={() => onChange(items.filter((_, i) => i !== idx))} className="p-1 text-muted-foreground hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
        <Button variant="outline" size="sm" onClick={() => onChange([...items, defaultNewItemFor(catalog)])} className="mt-3">
          <Plus className="mr-1 h-3.5 w-3.5" /> Add Line Item
        </Button>
      </CardContent>
    </Card>
  )
}

function today() {
  return new Date().toISOString().split("T")[0]
}

function defaultDueDate() {
  const d = new Date()
  d.setDate(d.getDate() + 7)
  return d.toISOString().split("T")[0]
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [businesses, setBusinesses] = useState<BusinessMini[]>([])
  const [catalog, setCatalog] = useState<{ products: CatalogItem[]; plans: CatalogItem[]; services: CatalogItem[] }>({ products: [], plans: [], services: [] })
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState("")

  const [filterBusiness, setFilterBusiness] = useState<string>("all")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")

  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createForm, setCreateForm] = useState({
    businessId: "",
    dueDate: defaultDueDate(),
    currency: "NGN",
    notesPublic: "",
    notesInternal: "",
    items: [] as InvoiceItem[],
  })

  const [editing, setEditing] = useState<Invoice | null>(null)
  const [editLoading, setEditLoading] = useState(false)
  const [modalMode, setModalMode] = useState<"view" | "edit">("view")
  const [invoicePayments, setInvoicePayments] = useState<InvoicePayment[]>([])
  const [paymentsLoading, setPaymentsLoading] = useState(false)

  const [showPayment, setShowPayment] = useState(false)
  const [paymentInvoice, setPaymentInvoice] = useState<Invoice | null>(null)
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    paymentMethod: "BANK_TRANSFER",
    paidAt: today(),
    notes: "",
  })
  const [recordingPayment, setRecordingPayment] = useState(false)

  useEffect(() => {
    fetchBusinesses()
    fetchCatalog()
    fetchInvoices()
  }, [])

  async function fetchBusinesses() {
    try {
      const res = await fetch("/api/admin/businesses")
      const data = await res.json()
      if (data.businesses) setBusinesses(data.businesses)
    } catch {
      setMessage("Failed to load businesses")
    }
  }

  async function fetchCatalog() {
    try {
      const res = await fetch("/api/admin/finance/catalog?type=all&activeOnly=true")
      const data = await res.json()
      if (data.success && data.data) {
        setCatalog({
          products: data.data.products || [],
          plans: data.data.plans || [],
          services: data.data.services || [],
        })
      }
    } catch {
      setMessage("Failed to load catalog")
    }
  }

  async function fetchInvoices() {
    setLoading(true)
    try {
      const res = await fetch("/api/admin/finance/commercial/invoices")
      const data = await res.json()
      if (data.success && data.data) setInvoices(data.data as Invoice[])
    } catch {
      setMessage("Failed to load invoices")
    } finally {
      setLoading(false)
    }
  }

  const filteredInvoices = useMemo(() => {
    let list = invoices
    if (filterBusiness !== "all") list = list.filter((i) => i.business_id === filterBusiness)
    if (filterStatus !== "all") list = list.filter((i) => i.status === filterStatus)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter(
        (i) =>
          i.invoice_number.toLowerCase().includes(q) ||
          i.businesses?.business_name?.toLowerCase().includes(q) ||
          String(i.total_amount).includes(q)
      )
    }
    return list.sort((a, b) => new Date(b.created_at || b.issue_date).getTime() - new Date(a.created_at || a.issue_date).getTime())
  }, [invoices, filterBusiness, filterStatus, searchQuery])

  const createTotals = useMemo(() => computeInvoiceTotals(createForm.items), [createForm.items])
  const editingTotals = useMemo(() => computeInvoiceTotals(editing?.invoice_items || []), [editing?.invoice_items])

  async function createInvoice() {
    if (!createForm.businessId) {
      setMessage("Business is required for every invoice")
      return
    }
    if (createForm.items.length === 0) {
      setMessage("Add at least one line item")
      return
    }
    setCreating(true)
    setMessage("")
    try {
      const res = await fetch("/api/admin/finance/commercial/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          data: {
            business_id: createForm.businessId,
            due_date: createForm.dueDate,
            currency: createForm.currency,
            notes_public: createForm.notesPublic,
            notes_internal: createForm.notesInternal,
            items: createForm.items.map((it) => ({
              ...it,
              item_type: it.item_type || "CUSTOM",
              line_total: computeItemTotal(it),
            })),
          },
        }),
      })
      const data = await res.json()
      if (data.success) {
        setMessage("Invoice created")
        setShowCreate(false)
        setCreateForm({
          businessId: "",
          dueDate: defaultDueDate(),
          currency: "NGN",
          notesPublic: "",
          notesInternal: "",
          items: [],
        })
        fetchInvoices()
      } else {
        setMessage(data.error || "Failed to create invoice")
      }
    } catch {
      setMessage("Failed to create invoice")
    } finally {
      setCreating(false)
    }
  }

  function buildCatalogItem(type: CatalogTab, c: CatalogItem): InvoiceItem {
    const price = catalogPriceOf(c)
    return {
      description: c.name,
      quantity: 1,
      unit_price: price,
      discount: 0,
      tax: 0,
      line_total: price,
      item_type: type,
      reference_id: c.id,
    }
  }

  function addCatalogItemToCreate(type: CatalogTab, c: CatalogItem) {
    setCreateForm((prev) => ({ ...prev, items: [...prev.items, buildCatalogItem(type, c)] }))
  }

  function addCatalogItemToEdit(type: CatalogTab, c: CatalogItem) {
    setEditing((prev) =>
      prev ? { ...prev, invoice_items: [...(prev.invoice_items || []), buildCatalogItem(type, c)] } : prev
    )
  }

  async function fetchInvoicePayments(invoiceId: string) {
    setPaymentsLoading(true)
    try {
      const res = await fetch(`/api/admin/finance/commercial/payments?invoiceId=${encodeURIComponent(invoiceId)}`)
      const data = await res.json()
      setInvoicePayments(data.success && Array.isArray(data.data) ? (data.data as InvoicePayment[]) : [])
    } catch {
      setInvoicePayments([])
    } finally {
      setPaymentsLoading(false)
    }
  }

  async function openInvoice(invoice: Invoice, mode: "view" | "edit" = "view") {
    setEditLoading(true)
    setEditing(null)
    setInvoicePayments([])
    setModalMode(mode)
    try {
      const res = await fetch(`/api/admin/finance/commercial/invoices?id=${encodeURIComponent(invoice.id)}`)
      const data = await res.json()
      if (data.success && data.data) {
        setEditing(data.data as Invoice)
        fetchInvoicePayments(invoice.id)
      } else {
        setMessage(data.error || "Failed to load invoice")
      }
    } catch {
      setMessage("Failed to load invoice")
    } finally {
      setEditLoading(false)
    }
  }

  async function saveInvoice() {
    if (!editing) return
    setEditLoading(true)
    setMessage("")
    try {
      const res = await fetch("/api/admin/finance/commercial/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
          data: {
            id: editing.id,
            issue_date: editing.issue_date,
            due_date: editing.due_date,
            notes_public: editing.notes_public,
            notes_internal: editing.notes_internal,
            items: (editing.invoice_items || []).map((it) => ({
              id: it.id,
              item_type: it.item_type || "CUSTOM",
              reference_id: it.reference_id || null,
              description: it.description,
              quantity: Number(it.quantity) || 0,
              unit_price: Number(it.unit_price) || 0,
              discount: Number(it.discount) || 0,
              tax: Number(it.tax) || 0,
            })),
          },
        }),
      })
      const data = await res.json()
      if (data.success) {
        setMessage("Invoice saved")
        fetchInvoices()
        openInvoice(editing, modalMode)
      } else {
        setMessage(data.error || "Failed to save invoice")
      }
    } catch {
      setMessage("Failed to save invoice")
    } finally {
      setEditLoading(false)
    }
  }

  async function runInvoiceAction(action: string, id: string) {
    setMessage("")
    try {
      const res = await fetch("/api/admin/finance/commercial/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, data: { id } }),
      })
      const data = await res.json()
      if (data.success) {
        const labels: Record<string, string> = {
          issue: "Invoice issued",
          send: `Invoice email sent to ${data.data?.sentTo || "the business"}`,
          send_reminder: `Reminder sent to ${data.data?.sentTo || "the business"}`,
          pause_reminders: "Reminders paused",
          resume_reminders: "Reminders resumed",
          void: "Invoice voided",
          cancel: "Invoice cancelled",
        }
        let msg = labels[action] || `Invoice ${action.replace("_", " ")}`
        if (action === "issue") {
          msg += data.data?.emailSentTo ? ` — emailed ${data.data.emailSentTo}` : data.data?.emailError ? ` — email not sent: ${data.data.emailError}` : ""
        }
        setMessage(msg)
        fetchInvoices()
        if (editing?.id === id) openInvoice({ ...editing, id }, modalMode)
      } else {
        setMessage(data.error || `Failed to ${action}`)
      }
    } catch {
      setMessage(`Failed to ${action}`)
    }
  }

  async function deleteInvoice(id: string) {
    if (!confirm("Delete this invoice permanently?")) return
    try {
      const res = await fetch("/api/admin/finance/commercial/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", data: { id } }),
      })
      const data = await res.json()
      if (data.success) {
        setMessage("Invoice deleted")
        fetchInvoices()
      } else {
        setMessage(data.error || "Failed to delete invoice")
      }
    } catch {
      setMessage("Failed to delete invoice")
    }
  }

  async function recordPayment() {
    if (!paymentInvoice) return
    if (!paymentForm.amount || Number(paymentForm.amount) <= 0) {
      setMessage("Enter a valid payment amount")
      return
    }
    setRecordingPayment(true)
    setMessage("")
    try {
      const recordRes = await fetch("/api/admin/finance/commercial/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "record",
          data: {
            business_id: paymentInvoice.business_id,
            invoice_id: paymentInvoice.id,
            amount: Number(paymentForm.amount),
            payment_method: paymentForm.paymentMethod,
            paid_at: paymentForm.paidAt ? new Date(paymentForm.paidAt).toISOString() : new Date().toISOString(),
            notes: paymentForm.notes,
          },
        }),
      })
      const recordData = await recordRes.json()
      if (recordData.success && recordData.data?.id) {
        const confirmRes = await fetch("/api/admin/finance/commercial/payments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "confirm", data: { id: recordData.data.id } }),
        })
        const confirmData = await confirmRes.json()
        if (confirmData.success) {
          setMessage("Payment recorded and applied")
          setShowPayment(false)
          setPaymentInvoice(null)
          setPaymentForm({ amount: "", paymentMethod: "BANK_TRANSFER", paidAt: today(), notes: "" })
          fetchInvoices()
          if (editing?.id === paymentInvoice.id) openInvoice(paymentInvoice, modalMode)
        } else {
          setMessage(confirmData.error || "Payment recorded but not confirmed")
        }
      } else {
        setMessage(recordData.error || "Failed to record payment")
      }
    } catch {
      setMessage("Failed to record payment")
    } finally {
      setRecordingPayment(false)
    }
  }

  function openPayment(invoice: Invoice) {
    setPaymentInvoice(invoice)
    setPaymentForm({
      amount: String(invoice.balance_due > 0 ? invoice.balance_due : ""),
      paymentMethod: "BANK_TRANSFER",
      paidAt: today(),
      notes: "",
    })
    setShowPayment(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/admin/finance" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="mr-1 h-4 w-4" /> Back to Finance
          </Link>
          <h2 className="mt-1 text-2xl font-bold tracking-tight flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Invoices
          </h2>
          <p className="text-sm text-muted-foreground">Create, issue and collect invoice payments. Business selection is required.</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="mr-1 h-4 w-4" /> Create Invoice
        </Button>
      </div>

      {message && (
        <p className={`text-sm ${message.includes("created") || message.includes("updated") || message.includes("deleted") || message.includes("recorded") || message.includes("Invoice ") ? "text-emerald-600" : "text-red-500"}`}>{message}</p>
      )}

      <div className="flex flex-col gap-3 lg:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search invoices..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm"
          />
        </div>
        <select
          value={filterBusiness}
          onChange={(e) => setFilterBusiness(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="all">All Businesses</option>
          {businesses.map((b) => (
            <option key={b.id} value={b.id}>{b.businessName}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="all">All Statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{enumLabel(s)}</option>
          ))}
        </select>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Invoice List</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : filteredInvoices.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              <Receipt className="h-10 w-10 mx-auto mb-3" />
              <p>No invoices found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Invoice #</th>
                    <th className="px-3 py-2 font-medium">Business</th>
                    <th className="px-3 py-2 font-medium">Issue Date</th>
                    <th className="px-3 py-2 font-medium">Due Date</th>
                    <th className="px-3 py-2 font-medium text-right">Total</th>
                    <th className="px-3 py-2 font-medium text-right">Paid</th>
                    <th className="px-3 py-2 font-medium text-right">Balance</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices.map((inv) => (
                    <tr key={inv.id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="px-3 py-2 font-mono text-xs">{inv.invoice_number}</td>
                      <td className="px-3 py-2">{inv.businesses?.business_name || "—"}</td>
                      <td className="px-3 py-2">{inv.issue_date}</td>
                      <td className="px-3 py-2">{inv.due_date}</td>
                      <td className="px-3 py-2 text-right">{formatMoney(inv.total_amount, inv.currency)}</td>
                      <td className="px-3 py-2 text-right">{formatMoney(inv.amount_paid, inv.currency)}</td>
                      <td className="px-3 py-2 text-right">{formatMoney(inv.balance_due, inv.currency)}</td>
                      <td className="px-3 py-2">
                        <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium ${STATUS_COLORS[inv.status] || "bg-gray-100 text-gray-700"}`}>
                          {enumLabel(inv.status)}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1">
                          <button onClick={() => openInvoice(inv, "view")} className="p-1.5 rounded-md text-muted-foreground hover:text-blue-600 hover:bg-blue-50" title="View">
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          {inv.status !== "VOID" && inv.status !== "CANCELLED" && (
                            <button onClick={() => openInvoice(inv, "edit")} className="p-1.5 rounded-md text-muted-foreground hover:text-blue-600 hover:bg-blue-50" title="Edit">
                              <Pencil className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {inv.status === "DRAFT" && (
                            <button onClick={() => runInvoiceAction("issue", inv.id)} className="p-1.5 rounded-md text-muted-foreground hover:text-blue-600 hover:bg-blue-50" title="Issue">
                              <Send className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {(inv.status === "ISSUED" || inv.status === "PARTIALLY_PAID" || inv.status === "OVERDUE") && (
                            <button onClick={() => openPayment(inv)} className="p-1.5 rounded-md text-muted-foreground hover:text-green-600 hover:bg-green-50" title="Record Payment">
                              <CreditCard className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {inv.status !== "VOID" && inv.status !== "CANCELLED" && (
                            <>
                              <button onClick={() => runInvoiceAction("void", inv.id)} className="p-1.5 rounded-md text-muted-foreground hover:text-amber-600 hover:bg-amber-50" title="Void">
                                <FileX className="h-3.5 w-3.5" />
                              </button>
                              <button onClick={() => runInvoiceAction("cancel", inv.id)} className="p-1.5 rounded-md text-muted-foreground hover:text-red-600 hover:bg-red-50" title="Cancel">
                                <Ban className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
                          <button onClick={() => deleteInvoice(inv.id)} className="p-1.5 rounded-md text-muted-foreground hover:text-red-700 hover:bg-red-50" title="Delete">
                            <Trash2 className="h-3.5 w-3.5" />
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
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-2 sm:p-4 overflow-y-auto">
          <div className="my-2 w-full max-w-7xl max-h-[94vh] overflow-y-auto rounded-xl border border-border bg-background shadow-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Create Invoice</h3>
              <button onClick={() => setShowCreate(false)} className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"><X className="h-5 w-5" /></button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Business *</label>
                <select
                  value={createForm.businessId}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, businessId: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Select a business</option>
                  {businesses.map((b) => (
                    <option key={b.id} value={b.id}>{b.businessName}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Due Date *</label>
                <input
                  type="date"
                  value={createForm.dueDate}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, dueDate: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Currency</label>
                <select
                  value={createForm.currency}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, currency: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {CURRENCIES.map((c) => (<option key={c} value={c}>{c}</option>))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Notes</label>
                <input
                  type="text"
                  value={createForm.notesPublic}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, notesPublic: e.target.value }))}
                  placeholder="Public notes"
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>

            <CatalogPicker
              catalog={catalog}
              onPick={addCatalogItemToCreate}
              onCustom={() =>
                setCreateForm((prev) => ({
                  ...prev,
                  items: [...prev.items, { description: "", quantity: 1, unit_price: 0, discount: 0, tax: 0, line_total: 0, item_type: "CUSTOM", reference_id: null }],
                }))
              }
            />

            <ItemsEditor
              items={createForm.items}
              onChange={(items) => setCreateForm((prev) => ({ ...prev, items }))}
              catalog={catalog}
              currency={createForm.currency}
            />

            <div className="flex items-center justify-between">
              <div className="text-sm space-y-1">
                <p className="text-muted-foreground">Subtotal: <span className="font-medium text-foreground">{formatNgn(createTotals.subtotal, createForm.currency)}</span></p>
                <p className="text-muted-foreground">Discount: <span className="font-medium text-foreground">{formatNgn(createTotals.discount, createForm.currency)}</span></p>
                <p className="text-muted-foreground">Tax: <span className="font-medium text-foreground">{formatNgn(createTotals.tax, createForm.currency)}</span></p>
                <p className="font-semibold">Total: {formatNgn(createTotals.total, createForm.currency)}</p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => setShowCreate(false)} disabled={creating}>Cancel</Button>
                <Button onClick={createInvoice} disabled={creating || !createForm.businessId || createForm.items.length === 0}>
                  {creating ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Plus className="mr-1 h-4 w-4" />}
                  Create Invoice
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-2 sm:p-4 overflow-y-auto">
          <div className="my-2 w-full max-w-6xl max-h-[94vh] overflow-y-auto rounded-xl border border-border bg-background shadow-lg p-6 space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold">Invoice {editing.invoice_number}</h3>
                  <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium ${STATUS_COLORS[editing.status] || "bg-gray-100 text-gray-700"}`}>
                    {enumLabel(editing.status)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{editing.businesses?.business_name || "—"} · {editing.currency}</p>
                {(editing.status === "ISSUED" || editing.status === "PARTIALLY_PAID" || editing.status === "OVERDUE") && (
                  <p className={`text-xs ${editing.reminders_paused ? "text-amber-600" : "text-muted-foreground"}`}>
                    {editing.reminders_paused ? "Auto-reminders paused" : "Auto-reminders on"}
                    {(editing.reminder_count ?? 0) > 0 && ` · ${editing.reminder_count} sent${editing.last_reminder_at ? ` (last ${new Date(editing.last_reminder_at).toLocaleDateString()})` : ""}`}
                    {editing.invoice_email_sent_at && ` · invoice emailed ${new Date(editing.invoice_email_sent_at).toLocaleDateString()}`}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {modalMode === "view" && editing.status !== "VOID" && editing.status !== "CANCELLED" && (
                  <Button size="sm" variant="outline" onClick={() => setModalMode("edit")}>
                    <Pencil className="mr-1 h-3.5 w-3.5" /> Edit
                  </Button>
                )}
                <button onClick={() => setEditing(null)} className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"><X className="h-5 w-5" /></button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Business</label>
                <input
                  type="text"
                  value={editing.businesses?.business_name || ""}
                  disabled
                  className="w-full rounded-md border border-input bg-muted px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Issue Date</label>
                <input
                  type="date"
                  value={editing.issue_date}
                  disabled={modalMode === "view"}
                  onChange={(e) => setEditing((prev) => (prev ? { ...prev, issue_date: e.target.value } : prev))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:bg-muted disabled:text-muted-foreground"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Due Date</label>
                <input
                  type="date"
                  value={editing.due_date}
                  disabled={modalMode === "view"}
                  onChange={(e) => setEditing((prev) => (prev ? { ...prev, due_date: e.target.value } : prev))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:bg-muted disabled:text-muted-foreground"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Currency</label>
                <input
                  type="text"
                  value={editing.currency}
                  disabled
                  className="w-full rounded-md border border-input bg-muted px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-1.5 lg:col-span-2">
                <label className="text-sm font-medium">Notes (public)</label>
                <input
                  type="text"
                  value={editing.notes_public || ""}
                  disabled={modalMode === "view"}
                  onChange={(e) => setEditing((prev) => (prev ? { ...prev, notes_public: e.target.value } : prev))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:bg-muted disabled:text-muted-foreground"
                />
              </div>
              <div className="space-y-1.5 lg:col-span-2">
                <label className="text-sm font-medium">Notes (internal)</label>
                <input
                  type="text"
                  value={editing.notes_internal || ""}
                  disabled={modalMode === "view"}
                  onChange={(e) => setEditing((prev) => (prev ? { ...prev, notes_internal: e.target.value } : prev))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:bg-muted disabled:text-muted-foreground"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {modalMode === "edit" && (
                <Button size="sm" onClick={saveInvoice} disabled={editLoading}>
                  {editLoading ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="mr-1 h-3.5 w-3.5" />}
                  Save Changes
                </Button>
              )}
              {editing.status === "DRAFT" && (
                <Button size="sm" variant="outline" onClick={() => runInvoiceAction("issue", editing.id)}><Send className="mr-1 h-3.5 w-3.5" /> Issue</Button>
              )}
              {(editing.status === "ISSUED" || editing.status === "PARTIALLY_PAID" || editing.status === "OVERDUE") && (
                <>
                  <Button size="sm" variant="outline" onClick={() => openPayment(editing)}><CreditCard className="mr-1 h-3.5 w-3.5" /> Record Payment</Button>
                  <Button size="sm" variant="outline" onClick={() => runInvoiceAction("send", editing.id)}><Mail className="mr-1 h-3.5 w-3.5" /> Resend Email</Button>
                  <a href={`/api/admin/finance/invoice-pdf?id=${editing.id}`} target="_blank" rel="noopener noreferrer">
                    <Button size="sm" variant="outline"><Download className="mr-1 h-3.5 w-3.5" /> PDF</Button>
                  </a>
                  <Button size="sm" variant="outline" onClick={() => runInvoiceAction("send_reminder", editing.id)}><BellRing className="mr-1 h-3.5 w-3.5" /> Send Reminder</Button>
                  <Button size="sm" variant="outline" onClick={() => runInvoiceAction(editing.reminders_paused ? "resume_reminders" : "pause_reminders", editing.id)}>
                    {editing.reminders_paused ? <PlayCircle className="mr-1 h-3.5 w-3.5" /> : <PauseCircle className="mr-1 h-3.5 w-3.5" />}
                    {editing.reminders_paused ? "Resume Reminders" : "Pause Reminders"}
                  </Button>
                </>
              )}
              {editing.status !== "VOID" && editing.status !== "CANCELLED" && (
                <>
                  <Button size="sm" variant="outline" onClick={() => runInvoiceAction("void", editing.id)}><FileX className="mr-1 h-3.5 w-3.5" /> Void</Button>
                  <Button size="sm" variant="outline" onClick={() => runInvoiceAction("cancel", editing.id)}><Ban className="mr-1 h-3.5 w-3.5" /> Cancel</Button>
                </>
              )}
              <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => { deleteInvoice(editing.id); setEditing(null) }}><Trash2 className="mr-1 h-3.5 w-3.5" /> Delete</Button>
            </div>

            {modalMode === "edit" ? (
              <>
                <CatalogPicker
                  catalog={catalog}
                  onPick={addCatalogItemToEdit}
                  onCustom={() =>
                    setEditing((prev) =>
                      prev
                        ? { ...prev, invoice_items: [...(prev.invoice_items || []), { description: "", quantity: 1, unit_price: 0, discount: 0, tax: 0, line_total: 0, item_type: "CUSTOM" as const, reference_id: null }] }
                        : prev
                    )
                  }
                />
                <ItemsEditor
                  items={editing.invoice_items || []}
                  onChange={(items) => setEditing((prev) => (prev ? { ...prev, invoice_items: items } : prev))}
                  catalog={catalog}
                  currency={editing.currency}
                />
              </>
            ) : (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Line Items</CardTitle></CardHeader>
                <CardContent>
                  {(!editing.invoice_items || editing.invoice_items.length === 0) ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">No line items.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-left text-muted-foreground">
                            <th className="px-3 py-2 font-medium">Description</th>
                            <th className="px-3 py-2 font-medium text-right">Qty</th>
                            <th className="px-3 py-2 font-medium text-right">Unit</th>
                            <th className="px-3 py-2 font-medium text-right">Disc</th>
                            <th className="px-3 py-2 font-medium text-right">Tax</th>
                            <th className="px-3 py-2 font-medium text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {editing.invoice_items.map((it, idx) => (
                            <tr key={it.id || idx} className="border-b last:border-0">
                              <td className="px-3 py-2">{it.description}</td>
                              <td className="px-3 py-2 text-right">{it.quantity}</td>
                              <td className="px-3 py-2 text-right">{formatNgn(it.unit_price, editing.currency)}</td>
                              <td className="px-3 py-2 text-right">{formatNgn(it.discount, editing.currency)}</td>
                              <td className="px-3 py-2 text-right">{formatNgn(it.tax, editing.currency)}</td>
                              <td className="px-3 py-2 text-right">{formatNgn(it.line_total, editing.currency)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <CreditCard className="h-4 w-4" /> Payment History
                </CardTitle>
              </CardHeader>
              <CardContent>
                {paymentsLoading ? (
                  <div className="flex justify-center py-6"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
                ) : invoicePayments.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">No payments recorded for this invoice.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="px-3 py-2 font-medium">Date</th>
                          <th className="px-3 py-2 font-medium">Reference</th>
                          <th className="px-3 py-2 font-medium">Method</th>
                          <th className="px-3 py-2 font-medium">Status</th>
                          <th className="px-3 py-2 font-medium text-right">Applied</th>
                          <th className="px-3 py-2 font-medium text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invoicePayments.map((p) => {
                          const alloc = p.payment_allocations?.find((a) => a.invoice_id === editing.id)
                          return (
                            <tr key={p.id} className="border-b last:border-0">
                              <td className="px-3 py-2 whitespace-nowrap">{(p.paid_at || p.created_at || "").slice(0, 10)}</td>
                              <td className="px-3 py-2 font-mono text-xs">{p.payment_reference}</td>
                              <td className="px-3 py-2">{enumLabel(p.payment_method)}</td>
                              <td className="px-3 py-2">
                                <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium ${p.status === "CONFIRMED" ? "bg-green-50 text-green-700" : p.status === "PENDING" ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"}`}>
                                  {enumLabel(p.status)}
                                </span>
                              </td>
                              <td className="px-3 py-2 text-right font-medium">{formatMoney(alloc ? alloc.amount_allocated : p.amount, p.currency)}</td>
                              <td className="px-3 py-2 text-right text-muted-foreground">{alloc ? formatMoney(p.amount, p.currency) : "—"}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="space-y-1">
                <p className="text-muted-foreground">Subtotal: <span className="font-medium text-foreground">{formatNgn(modalMode === "edit" ? editingTotals.subtotal : editing.subtotal, editing.currency)}</span></p>
                <p className="text-muted-foreground">Discount: <span className="font-medium text-foreground">{formatNgn(modalMode === "edit" ? editingTotals.discount : editing.discount_amount, editing.currency)}</span></p>
                <p className="text-muted-foreground">Tax: <span className="font-medium text-foreground">{formatNgn(modalMode === "edit" ? editingTotals.tax : editing.tax_amount, editing.currency)}</span></p>
                <p className="font-semibold text-lg">Total: {formatNgn(modalMode === "edit" ? editingTotals.total : editing.total_amount, editing.currency)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground">Paid: <span className="font-medium text-foreground">{formatNgn(editing.amount_paid, editing.currency)}</span></p>
                <p className="text-muted-foreground">Balance: <span className="font-medium text-foreground">{formatNgn(editing.balance_due, editing.currency)}</span></p>
                <p className="text-muted-foreground">Status: <span className="font-medium text-foreground">{enumLabel(editing.status)}</span></p>
              </div>
            </div>
          </div>
        </div>
      )}

      {showPayment && paymentInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-border bg-background shadow-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Record Payment</h3>
              <button onClick={() => setShowPayment(false)} className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Invoice {paymentInvoice.invoice_number}</p>
              <p className="text-sm">Balance due: <span className="font-semibold">{formatNgn(paymentInvoice.balance_due)}</span></p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Amount *</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm((prev) => ({ ...prev, amount: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Method</label>
                <select
                  value={paymentForm.paymentMethod}
                  onChange={(e) => setPaymentForm((prev) => ({ ...prev, paymentMethod: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {PAYMENT_METHODS.map((m) => (<option key={m} value={m}>{enumLabel(m)}</option>))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Paid At</label>
                <input
                  type="date"
                  value={paymentForm.paidAt}
                  onChange={(e) => setPaymentForm((prev) => ({ ...prev, paidAt: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Notes</label>
                <input
                  type="text"
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm((prev) => ({ ...prev, notes: e.target.value }))}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowPayment(false)} disabled={recordingPayment}>Cancel</Button>
              <Button onClick={recordPayment} disabled={recordingPayment || !paymentForm.amount || Number(paymentForm.amount) <= 0}>
                {recordingPayment ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <CreditCard className="mr-1 h-4 w-4" />}
                Record Payment
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
