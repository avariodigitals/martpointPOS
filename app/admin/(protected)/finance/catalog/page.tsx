"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Plus, Search, X, Pencil, Trash2, ArrowLeft, CheckCircle2, Package, Layers, Wrench, Puzzle } from "lucide-react"
import { formatMoney } from "@/lib/money-format"

type Tab = "products" | "plans" | "services" | "addons"

interface Product {
  id: string
  code: string
  name: string
  description: string | null
  product_family: string
  status: "ACTIVE" | "INACTIVE"
  active: boolean
  default_price: number
  currency: string
}

interface Plan {
  id: string
  product_id: string
  code: string
  name: string
  description: string | null
  billing_type: "RECURRING" | "ONE_TIME"
  billing_interval: "MONTHLY" | "QUARTERLY" | "ANNUAL" | "NONE"
  currency: string
  base_price: number
  included_branches: number
  included_users: number
  online_store_included: boolean
  active: boolean
  effective_from: string
  commercial_products?: { id: string; name: string } | null
}

interface Service {
  id: string
  code: string
  name: string
  description: string | null
  default_price: number
  currency: string
  category?: string
  active: boolean
}

interface Addon {
  id: string
  code: string
  name: string
  description: string | null
  pricing_type: "FIXED" | "PER_UNIT" | "CUSTOM"
  unit_name: string | null
  default_price: number
  currency: string
  recurring: boolean
  billing_interval: "MONTHLY" | "QUARTERLY" | "ANNUAL" | "NONE" | null
  active: boolean
}

const CURRENCIES = ["NGN", "USD", "GBP", "GHS", "KES", "ZAR"]
const BILLING_TYPES = ["RECURRING", "ONE_TIME"]
const BILLING_INTERVALS = ["MONTHLY", "QUARTERLY", "ANNUAL", "NONE"]
const PRODUCT_FAMILIES = ["RETAIL", "ERP", "ECOMMERCE", "ANALYTICS", "FINANCE", "CUSTOMER", "MOBILE", "HARDWARE"]
const SERVICE_CATEGORIES = ["implementation", "training", "consulting", "support", "custom-development", "logistics", "other"]
const ADDON_PRICING_TYPES = ["FIXED", "PER_UNIT", "CUSTOM"]

function formatNgn(n: number | string | undefined | null) {
  return formatMoney(n)
}

function itemLabel(tab: Tab) {
  return tab === "products" ? "Product" : tab === "plans" ? "Plan" : tab === "addons" ? "Add-On" : "Service"
}

export default function CatalogPage() {
  const [tab, setTab] = useState<Tab>("products")
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState("")
  const [search, setSearch] = useState("")

  const [products, setProducts] = useState<Product[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [services, setServices] = useState<Service[]>([])
  const [addons, setAddons] = useState<Addon[]>([])

  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Product | Plan | Service | Addon | null>(null)

  const emptyProduct = { code: "", name: "", description: "", product_family: "RETAIL", default_price: "", currency: "NGN", active: true }
  const emptyPlan = { code: "", name: "", description: "", product_id: "", billing_type: "RECURRING", billing_interval: "MONTHLY", base_price: "", currency: "NGN", included_branches: "1", included_users: "1", online_store_included: false, active: true, effective_from: new Date().toISOString().split("T")[0] }
  const emptyService = { code: "", name: "", description: "", default_price: "", currency: "NGN", category: "other", active: true }
  const emptyAddon = { code: "", name: "", description: "", pricing_type: "FIXED", unit_name: "", default_price: "", currency: "NGN", recurring: false, billing_interval: "", active: true }

  const [form, setForm] = useState<Record<string, unknown>>(emptyProduct)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchCatalog()
  }, [])

  async function fetchCatalog() {
    setLoading(true)
    setMessage("")
    try {
      const res = await fetch("/api/admin/finance/catalog?type=all")
      const data = await res.json()
      if (data.success) {
        setProducts(data.data.products || [])
        setPlans(data.data.plans || [])
        setServices(data.data.services || [])
        setAddons(data.data.addons || [])
      } else {
        setMessage(data.error || "Failed to load catalog")
      }
    } catch {
      setMessage("Failed to load catalog")
    } finally {
      setLoading(false)
    }
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    let list: (Product | Plan | Service | Addon)[] = tab === "products" ? products : tab === "plans" ? plans : tab === "addons" ? addons : services
    if (q) {
      list = list.filter((it) =>
        ("code" in it && it.code.toLowerCase().includes(q)) ||
        ("name" in it && it.name.toLowerCase().includes(q)) ||
        (("description" in it && it.description) && String(it.description).toLowerCase().includes(q))
      )
    }
    return list.sort((a, b) => a.name.localeCompare(b.name))
  }, [tab, products, plans, services, addons, search])

  function openNew() {
    setEditing(null)
    if (tab === "products") setForm({ ...emptyProduct })
    else if (tab === "plans") setForm({ ...emptyPlan })
    else if (tab === "addons") setForm({ ...emptyAddon })
    else setForm({ ...emptyService })
    setShowForm(true)
  }

  function openEdit(item: Product | Plan | Service | Addon) {
    setEditing(item)
    if (tab === "products") {
      const p = item as Product
      setForm({ code: p.code, name: p.name, description: p.description || "", product_family: p.product_family, default_price: String(p.default_price), currency: p.currency, active: p.active })
    } else if (tab === "plans") {
      const p = item as Plan
      setForm({
        code: p.code, name: p.name, description: p.description || "", product_id: p.product_id,
        billing_type: p.billing_type, billing_interval: p.billing_interval, base_price: String(p.base_price),
        currency: p.currency, included_branches: String(p.included_branches), included_users: String(p.included_users),
        online_store_included: p.online_store_included, active: p.active, effective_from: p.effective_from,
      })
    } else if (tab === "addons") {
      const a = item as Addon
      setForm({
        code: a.code, name: a.name, description: a.description || "", pricing_type: a.pricing_type,
        unit_name: a.unit_name || "", default_price: String(a.default_price), currency: a.currency,
        recurring: a.recurring, billing_interval: a.billing_interval || "", active: a.active,
      })
    } else {
      const s = item as Service
      setForm({ code: s.code, name: s.name, description: s.description || "", default_price: String(s.default_price), currency: s.currency, category: s.category || "other", active: s.active })
    }
    setShowForm(true)
  }

  async function save() {
    setSaving(true)
    setMessage("")
    try {
      const payload = { ...form }
      if (tab === "products") {
        payload.default_price = Number(payload.default_price) || 0
      } else if (tab === "plans") {
        payload.base_price = Number(payload.base_price) || 0
        payload.included_branches = Number(payload.included_branches) || 0
        payload.included_users = Number(payload.included_users) || 0
      } else if (tab === "addons") {
        payload.default_price = Number(payload.default_price) || 0
        payload.billing_interval = payload.recurring && payload.billing_interval ? payload.billing_interval : null
      } else {
        payload.default_price = Number(payload.default_price) || 0
      }

      const res = await fetch("/api/admin/finance/catalog", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: tab, id: editing?.id, data: payload }),
      })
      const data = await res.json()
      if (data.success) {
        setMessage(`${tab.slice(0, -1)} saved`)
        setShowForm(false)
        fetchCatalog()
      } else {
        setMessage(data.error || "Save failed")
      }
    } catch {
      setMessage("Save failed")
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(item: Product | Plan | Service | Addon) {
    setMessage("")
    try {
      const active = !item.active
      const res = await fetch("/api/admin/finance/catalog", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: tab, id: item.id, data: { active } }),
      })
      const data = await res.json()
      if (data.success) {
        setMessage("Status updated")
        fetchCatalog()
      } else {
        setMessage(data.error || "Failed to update status")
      }
    } catch {
      setMessage("Failed to update status")
    }
  }

  async function remove(item: Product | Plan | Service | Addon) {
    if (!confirm(`Delete ${item.name}?`)) return
    setMessage("")
    try {
      const res = await fetch("/api/admin/finance/catalog", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: tab, id: item.id }),
      })
      const data = await res.json()
      if (data.success) {
        setMessage("Deleted")
        fetchCatalog()
      } else {
        setMessage(data.error || "Delete failed")
      }
    } catch {
      setMessage("Delete failed")
    }
  }

  const tabs = [
    { key: "products", label: "Products", icon: Package },
    { key: "plans", label: "Plans (Subscriptions)", icon: Layers },
    { key: "addons", label: "Add-Ons", icon: Puzzle },
    { key: "services", label: "Services", icon: Wrench },
  ] as const

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/admin/finance" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="mr-1 h-4 w-4" /> Back to Finance
          </Link>
          <h2 className="mt-1 text-2xl font-bold tracking-tight">Commercial Catalog</h2>
          <p className="text-sm text-muted-foreground">Manage products, plans, add-ons and services that can be added to invoices.</p>
        </div>
        <Button onClick={openNew}>
          <Plus className="mr-1 h-4 w-4" /> Add {itemLabel(tab)}
        </Button>
      </div>

      {message && (
        <p className={`text-sm ${message.includes("saved") || message.includes("updated") || message.includes("Deleted") ? "text-emerald-600" : "text-red-500"}`}>{message}</p>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
          {tabs.map((t) => {
            const Icon = t.icon
            return (
              <button
                key={t.key}
                onClick={() => { setTab(t.key); setSearch(""); setShowForm(false) }}
                className={`flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition ${tab === t.key ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                <Icon className="h-4 w-4" /> {t.label}
              </button>
            )
          })}
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder={`Search ${tab}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-md border border-input bg-background pl-9 pr-3 py-2 text-sm"
          />
        </div>
      </div>

      {tab === "plans" && (
        <p className="text-xs text-muted-foreground">
          The only sellable plans are the <Link href="/pricing" className="underline hover:text-foreground">tiers advertised on /pricing</Link> (Basic, Standard, Premium, Enterprise) plus Retail Offline — implementation, training and support are sold as Add-Ons or Services.
        </p>
      )}

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm font-medium capitalize">{tab === "addons" ? "Add-ons" : tab}</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No {tab} found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Code</th>
                    <th className="px-3 py-2 font-medium">Name</th>
                    {tab === "plans" && <th className="px-3 py-2 font-medium">Product</th>}
                    {tab === "services" && <th className="px-3 py-2 font-medium">Category</th>}
                    {tab === "addons" && <th className="px-3 py-2 font-medium">Pricing</th>}
                    <th className="px-3 py-2 font-medium text-right">Price</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item) => (
                    <tr key={item.id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="px-3 py-2 font-mono text-xs">{item.code}</td>
                      <td className="px-3 py-2">
                        <div className="font-medium">{item.name}</div>
                        {item.description && <div className="text-xs text-muted-foreground truncate max-w-[16rem]">{item.description}</div>}
                      </td>
                      {tab === "plans" && <td className="px-3 py-2">{(item as Plan).commercial_products?.name || "—"}</td>}
                      {tab === "services" && (
                        <td className="px-3 py-2">
                          <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium bg-blue-50 text-blue-700">
                            {(item as Service).category || "other"}
                          </span>
                        </td>
                      )}
                      {tab === "addons" && (
                        <td className="px-3 py-2 text-xs text-muted-foreground">
                          <div>{(item as Addon).pricing_type.replace("_", " ")}{(item as Addon).unit_name ? ` · per ${(item as Addon).unit_name}` : ""}</div>
                          {(item as Addon).recurring && (item as Addon).billing_interval && (item as Addon).billing_interval !== "NONE" && (
                            <div>{(item as Addon).billing_interval}</div>
                          )}
                        </td>
                      )}
                      <td className="px-3 py-2 text-right">
                        {formatNgn(tab === "products" ? (item as Product).default_price : tab === "plans" ? (item as Plan).base_price : (item as Service | Addon).default_price)}
                      </td>
                      <td className="px-3 py-2">
                        <button
                          onClick={() => toggleActive(item)}
                          className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium ${item.active ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}
                        >
                          {item.active ? "Active" : "Inactive"}
                        </button>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => openEdit(item)} className="p-1.5 rounded-md text-muted-foreground hover:text-blue-600 hover:bg-blue-50" title="Edit"><Pencil className="h-3.5 w-3.5" /></button>
                          <button onClick={() => remove(item)} className="p-1.5 rounded-md text-muted-foreground hover:text-red-600 hover:bg-red-50" title="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
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

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-10 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-xl border border-border bg-background shadow-lg p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">{editing ? "Edit" : "Add"} {itemLabel(tab)}</h3>
              <button onClick={() => setShowForm(false)} className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"><X className="h-5 w-5" /></button>
            </div>

            {tab === "products" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5"><label className="text-sm font-medium">Code *</label><input value={String(form.code ?? "")} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" /></div>
                <div className="space-y-1.5"><label className="text-sm font-medium">Name *</label><input value={String(form.name ?? "")} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" /></div>
                <div className="space-y-1.5 sm:col-span-2"><label className="text-sm font-medium">Description</label><input value={String(form.description ?? "")} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" /></div>
                <div className="space-y-1.5"><label className="text-sm font-medium">Family</label>
                  <select value={String(form.product_family ?? "RETAIL")} onChange={(e) => setForm((f) => ({ ...f, product_family: e.target.value }))} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    {PRODUCT_FAMILIES.map((f) => (<option key={f} value={f}>{f}</option>))}
                  </select>
                </div>
                <div className="space-y-1.5"><label className="text-sm font-medium">Default Price</label><input type="number" min="0" step="any" value={String(form.default_price ?? "")} onChange={(e) => setForm((f) => ({ ...f, default_price: e.target.value }))} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" /></div>
                <div className="space-y-1.5"><label className="text-sm font-medium">Currency</label>
                  <select value={String(form.currency ?? "NGN")} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    {CURRENCIES.map((c) => (<option key={c} value={c}>{c}</option>))}
                  </select>
                </div>
                <div className="space-y-1.5 flex items-center gap-2 pt-5">
                  <input id="p-active" type="checkbox" checked={!!form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} className="h-4 w-4 rounded border-input" />
                  <label htmlFor="p-active" className="text-sm font-medium">Active</label>
                </div>
              </div>
            )}

            {tab === "plans" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5"><label className="text-sm font-medium">Code *</label><input value={String(form.code ?? "")} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" /></div>
                <div className="space-y-1.5"><label className="text-sm font-medium">Name *</label><input value={String(form.name ?? "")} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" /></div>
                <div className="space-y-1.5 sm:col-span-2"><label className="text-sm font-medium">Product *</label>
                  <select value={String(form.product_id ?? "")} onChange={(e) => setForm((f) => ({ ...f, product_id: e.target.value }))} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    <option value="">Select a product</option>
                    {products.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
                  </select>
                </div>
                <div className="space-y-1.5 sm:col-span-2"><label className="text-sm font-medium">Description</label><input value={String(form.description ?? "")} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" /></div>
                <div className="space-y-1.5"><label className="text-sm font-medium">Billing Type</label>
                  <select value={String(form.billing_type ?? "RECURRING")} onChange={(e) => setForm((f) => ({ ...f, billing_type: e.target.value }))} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    {BILLING_TYPES.map((b) => (<option key={b} value={b}>{b}</option>))}
                  </select>
                </div>
                <div className="space-y-1.5"><label className="text-sm font-medium">Billing Interval</label>
                  <select value={String(form.billing_interval ?? "MONTHLY")} onChange={(e) => setForm((f) => ({ ...f, billing_interval: e.target.value }))} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    {BILLING_INTERVALS.map((b) => (<option key={b} value={b}>{b}</option>))}
                  </select>
                </div>
                <div className="space-y-1.5"><label className="text-sm font-medium">Base Price</label><input type="number" min="0" step="any" value={String(form.base_price ?? "")} onChange={(e) => setForm((f) => ({ ...f, base_price: e.target.value }))} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" /></div>
                <div className="space-y-1.5"><label className="text-sm font-medium">Currency</label>
                  <select value={String(form.currency ?? "NGN")} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    {CURRENCIES.map((c) => (<option key={c} value={c}>{c}</option>))}
                  </select>
                </div>
                <div className="space-y-1.5"><label className="text-sm font-medium">Included Branches</label><input type="number" min="0" value={String(form.included_branches ?? "1")} onChange={(e) => setForm((f) => ({ ...f, included_branches: e.target.value }))} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" /></div>
                <div className="space-y-1.5"><label className="text-sm font-medium">Included Users</label><input type="number" min="0" value={String(form.included_users ?? "1")} onChange={(e) => setForm((f) => ({ ...f, included_users: e.target.value }))} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" /></div>
                <div className="space-y-1.5"><label className="text-sm font-medium">Effective From</label><input type="date" value={String(form.effective_from ?? "")} onChange={(e) => setForm((f) => ({ ...f, effective_from: e.target.value }))} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" /></div>
                <div className="space-y-1.5 flex items-center gap-2 pt-5">
                  <input id="pl-store" type="checkbox" checked={!!form.online_store_included} onChange={(e) => setForm((f) => ({ ...f, online_store_included: e.target.checked }))} className="h-4 w-4 rounded border-input" />
                  <label htmlFor="pl-store" className="text-sm font-medium">Online Store</label>
                </div>
                <div className="space-y-1.5 flex items-center gap-2 pt-5">
                  <input id="pl-active" type="checkbox" checked={!!form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} className="h-4 w-4 rounded border-input" />
                  <label htmlFor="pl-active" className="text-sm font-medium">Active</label>
                </div>
              </div>
            )}

            {tab === "services" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5"><label className="text-sm font-medium">Code *</label><input value={String(form.code ?? "")} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" /></div>
                <div className="space-y-1.5"><label className="text-sm font-medium">Name *</label><input value={String(form.name ?? "")} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" /></div>
                <div className="space-y-1.5 sm:col-span-2"><label className="text-sm font-medium">Description</label><input value={String(form.description ?? "")} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" /></div>
                <div className="space-y-1.5"><label className="text-sm font-medium">Category</label>
                  <select value={String(form.category ?? "other")} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    {SERVICE_CATEGORIES.map((c) => (<option key={c} value={c}>{c}</option>))}
                  </select>
                </div>
                <div className="space-y-1.5"><label className="text-sm font-medium">Default Price</label><input type="number" min="0" step="any" value={String(form.default_price ?? "")} onChange={(e) => setForm((f) => ({ ...f, default_price: e.target.value }))} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" /></div>
                <div className="space-y-1.5"><label className="text-sm font-medium">Currency</label>
                  <select value={String(form.currency ?? "NGN")} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    {CURRENCIES.map((c) => (<option key={c} value={c}>{c}</option>))}
                  </select>
                </div>
                <div className="space-y-1.5 flex items-center gap-2 pt-5">
                  <input id="s-active" type="checkbox" checked={!!form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} className="h-4 w-4 rounded border-input" />
                  <label htmlFor="s-active" className="text-sm font-medium">Active</label>
                </div>
              </div>
            )}

            {tab === "addons" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5"><label className="text-sm font-medium">Code *</label><input value={String(form.code ?? "")} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" /></div>
                <div className="space-y-1.5"><label className="text-sm font-medium">Name *</label><input value={String(form.name ?? "")} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" /></div>
                <div className="space-y-1.5 sm:col-span-2"><label className="text-sm font-medium">Description</label><input value={String(form.description ?? "")} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" /></div>
                <div className="space-y-1.5"><label className="text-sm font-medium">Pricing Type</label>
                  <select value={String(form.pricing_type ?? "FIXED")} onChange={(e) => setForm((f) => ({ ...f, pricing_type: e.target.value }))} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    {ADDON_PRICING_TYPES.map((p) => (<option key={p} value={p}>{p.replace("_", " ")}</option>))}
                  </select>
                </div>
                <div className="space-y-1.5"><label className="text-sm font-medium">Unit Name</label><input value={String(form.unit_name ?? "")} onChange={(e) => setForm((f) => ({ ...f, unit_name: e.target.value }))} placeholder="e.g. pack of 5 users" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" /></div>
                <div className="space-y-1.5"><label className="text-sm font-medium">Default Price</label><input type="number" min="0" step="any" value={String(form.default_price ?? "")} onChange={(e) => setForm((f) => ({ ...f, default_price: e.target.value }))} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" /></div>
                <div className="space-y-1.5"><label className="text-sm font-medium">Currency</label>
                  <select value={String(form.currency ?? "NGN")} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
                    {CURRENCIES.map((c) => (<option key={c} value={c}>{c}</option>))}
                  </select>
                </div>
                <div className="space-y-1.5 flex items-center gap-2 pt-5">
                  <input id="a-recurring" type="checkbox" checked={!!form.recurring} onChange={(e) => setForm((f) => ({ ...f, recurring: e.target.checked }))} className="h-4 w-4 rounded border-input" />
                  <label htmlFor="a-recurring" className="text-sm font-medium">Recurring</label>
                </div>
                <div className="space-y-1.5"><label className="text-sm font-medium">Billing Interval</label>
                  <select value={String(form.billing_interval ?? "")} onChange={(e) => setForm((f) => ({ ...f, billing_interval: e.target.value }))} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" disabled={form.recurring !== true}>
                    <option value="">—</option>
                    {BILLING_INTERVALS.map((b) => (<option key={b} value={b}>{b}</option>))}
                  </select>
                </div>
                <div className="space-y-1.5 flex items-center gap-2 pt-5">
                  <input id="a-active" type="checkbox" checked={!!form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} className="h-4 w-4 rounded border-input" />
                  <label htmlFor="a-active" className="text-sm font-medium">Active</label>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setShowForm(false)} disabled={saving}>Cancel</Button>
              <Button onClick={save} disabled={saving || !form.code || !form.name || (tab === "plans" && !form.product_id)}>
                {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1 h-4 w-4" />}
                Save
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
