"use client"

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { createPortal } from "react-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, ArrowLeft, Play, Plus, X } from "lucide-react"
import { formatMoney } from "@/lib/money-format"
import { enumLabel } from "@/lib/utils"

function formatNgn(n: number | string | undefined | null) {
  const v = typeof n === "string" ? Number.parseFloat(n) : Number(n)
  if (Number.isNaN(v)) return "—"
  return formatMoney(v)
}

function formatMoneyIn(n: number | string | undefined | null, currency?: string) {
  const v = typeof n === "string" ? Number.parseFloat(n) : Number(n)
  if (Number.isNaN(v)) return "—"
  return formatMoney(v, currency)
}

type SectionKey =
  | "products"
  | "plans"
  | "addons"
  | "quotes"
  | "invoices"
  | "payments"
  | "subscriptions"
  | "renewals"
  | "commission_plans"
  | "commissions"
  | "payouts"
  | "receipts"
  | "licences_sold"

const RESOURCES: SectionKey[] = [
  "products",
  "plans",
  "addons",
  "quotes",
  "invoices",
  "payments",
  "subscriptions",
  "renewals",
  "commission_plans",
  "commissions",
  "payouts",
  "receipts",
  "licences_sold",
]

const TITLES: Record<SectionKey, string> = {
  products: "Products",
  plans: "Plans",
  addons: "Add-ons",
  quotes: "Quotes",
  invoices: "Invoices",
  payments: "Payments",
  subscriptions: "Subscriptions",
  renewals: "Renewals",
  commission_plans: "Commission Plans",
  commissions: "Commissions",
  payouts: "Commission Payouts",
  receipts: "Receipts",
  licences_sold: "Licences Sold",
}

type FieldType = "text" | "number" | "select" | "textarea" | "date" | "boolean" | "derived"

// Which dynamic option list a select should be populated from. Static
// `options` remain supported for simple enums.
type OptionSource = "businesses" | "plans"

interface FieldConfig {
  name: string
  label: string
  type: FieldType
  options?: string[]
  optionSource?: OptionSource
  help?: string
  /** For `derived` fields: the field this value is computed from. */
  deriveFrom?: string
}

const CREATE_ACTION: Record<SectionKey, string | null> = {
  products: "create",
  plans: "create",
  addons: "create",
  quotes: "create",
  invoices: "create",
  payments: "record",
  subscriptions: "create",
  renewals: "create",
  commission_plans: "create",
  commissions: null,
  payouts: "create",
  receipts: "create",
  licences_sold: null,
}

const CREATE_FIELDS: Record<SectionKey, FieldConfig[]> = {
  products: [
    { name: "code", label: "Code", type: "text" },
    { name: "name", label: "Name", type: "text" },
    { name: "description", label: "Description", type: "textarea" },
    { name: "product_family", label: "Product Family", type: "text" },
    { name: "status", label: "Status", type: "select", options: ["ACTIVE", "INACTIVE"] },
  ],
  plans: [
    { name: "product_id", label: "Product ID", type: "text" },
    { name: "code", label: "Code", type: "text" },
    { name: "name", label: "Name", type: "text" },
    { name: "description", label: "Description", type: "textarea" },
    { name: "billing_type", label: "Billing Type", type: "select", options: ["RECURRING", "ONE_TIME"] },
    { name: "billing_interval", label: "Billing Interval", type: "select", options: ["MONTHLY", "QUARTERLY", "ANNUAL", "NONE"] },
    { name: "base_price", label: "Base Price", type: "number" },
    { name: "currency", label: "Currency", type: "text" },
    { name: "included_branches", label: "Included Branches", type: "number" },
    { name: "included_users", label: "Included Users", type: "number" },
    { name: "online_store_included", label: "Online Store Included", type: "boolean" },
    { name: "effective_from", label: "Effective From", type: "date" },
  ],
  addons: [
    { name: "code", label: "Code", type: "text" },
    { name: "name", label: "Name", type: "text" },
    { name: "description", label: "Description", type: "textarea" },
    { name: "pricing_type", label: "Pricing Type", type: "select", options: ["FIXED", "PER_UNIT", "CUSTOM"] },
    { name: "unit_name", label: "Unit Name", type: "text" },
    { name: "default_price", label: "Default Price", type: "number" },
    { name: "currency", label: "Currency", type: "text" },
    { name: "recurring", label: "Recurring", type: "boolean" },
    { name: "billing_interval", label: "Billing Interval", type: "select", options: ["MONTHLY", "QUARTERLY", "ANNUAL", "NONE"] },
    { name: "active", label: "Active", type: "boolean" },
  ],
  quotes: [
    { name: "business_id", label: "Business ID", type: "text" },
    { name: "partner_id", label: "Partner ID", type: "text" },
    { name: "partner_lead_id", label: "Partner Lead ID", type: "text" },
    { name: "currency", label: "Currency", type: "text" },
    { name: "notes_public", label: "Public Notes", type: "textarea" },
    { name: "valid_until", label: "Valid Until", type: "date" },
  ],
  invoices: [
    { name: "business_id", label: "Business ID", type: "text" },
    { name: "due_date", label: "Due Date", type: "date" },
    { name: "notes_public", label: "Public Notes", type: "textarea" },
  ],
  payments: [
    { name: "business_id", label: "Business ID", type: "text" },
    { name: "invoice_id", label: "Invoice ID", type: "text" },
    { name: "amount", label: "Amount", type: "number" },
    { name: "payment_method", label: "Payment Method", type: "select", options: ["BANK_TRANSFER", "PAYSTACK", "FLUTTERWAVE", "CASH", "POS", "OTHER"] },
    { name: "gateway_reference", label: "Gateway Reference", type: "text" },
    { name: "paid_at", label: "Paid At", type: "date" },
    { name: "notes", label: "Notes", type: "textarea" },
  ],
  subscriptions: [
    { name: "business_id", label: "Business", type: "select", optionSource: "businesses", help: "Only active businesses that can hold a licence are listed." },
    { name: "plan_id", label: "Plan", type: "select", optionSource: "plans", help: "The licence is derived from the plan you select — never from a service." },
    { name: "licence_preview", label: "Licence (from plan)", type: "derived", deriveFrom: "plan_id", help: "Auto-filled from the selected plan. Override it on the subscription after creation if needed." },
    { name: "billing_interval", label: "Billing Interval", type: "select", options: ["MONTHLY", "QUARTERLY", "ANNUAL", "NONE"] },
    { name: "quantity", label: "Quantity (licences)", type: "number", help: "Number of licences/seats. Used by the licences-sold report." },
    { name: "start_date", label: "Start Date", type: "date" },
    { name: "current_period_end", label: "Current Period End", type: "date" },
    { name: "renewal_date", label: "Renewal Date", type: "date" },
    { name: "auto_renew", label: "Auto Renew", type: "boolean" },
  ],
  renewals: [
    { name: "subscription_id", label: "Subscription ID", type: "text" },
    { name: "renewal_due_date", label: "Renewal Due Date", type: "date" },
    { name: "status", label: "Status", type: "select", options: ["UPCOMING", "DUE", "OVERDUE", "RENEWED", "SKIPPED"] },
  ],
  commission_plans: [
    { name: "name", label: "Name", type: "text" },
    { name: "description", label: "Description", type: "textarea" },
    { name: "partner_type", label: "Partner Type", type: "text" },
    { name: "commission_basis", label: "Commission Basis", type: "select", options: ["PERCENTAGE", "FIXED"] },
    { name: "percentage", label: "Percentage", type: "number" },
    { name: "fixed_amount", label: "Fixed Amount", type: "number" },
    { name: "applies_to", label: "Applies To", type: "select", options: ["INITIAL_LICENSE", "RENEWAL", "ADDON", "IMPLEMENTATION", "CUSTOM"] },
    { name: "product_id", label: "Product ID", type: "text" },
    { name: "plan_id", label: "Plan ID", type: "text" },
    { name: "addon_id", label: "Add-on ID", type: "text" },
    { name: "effective_from", label: "Effective From", type: "date" },
    { name: "active", label: "Active", type: "boolean" },
    { name: "commission_trigger", label: "Commission Trigger", type: "select", options: ["PAYMENT_CONFIRMED", "SUBSCRIPTION_ACTIVATED", "CUSTOMER_GO_LIVE"] },
    { name: "clawback_days", label: "Clawback Days", type: "number" },
  ],
  commissions: [],
  payouts: [
    { name: "partner_id", label: "Partner ID", type: "text" },
    { name: "commission_ids", label: "Commission IDs (comma-separated)", type: "textarea" },
  ],
  receipts: [
    { name: "payment_id", label: "Payment ID", type: "text" },
  ],
  licences_sold: [],
}

const ACTIONS: Record<SectionKey, { name: string; label: string }[]> = {
  products: [
    { name: "update", label: "Update" },
    { name: "set_active", label: "Set Active" },
    { name: "set_inactive", label: "Set Inactive" },
  ],
  plans: [
    { name: "update", label: "Update" },
    { name: "set_active", label: "Set Active" },
    { name: "set_inactive", label: "Set Inactive" },
  ],
  addons: [
    { name: "update", label: "Update" },
    { name: "set_active", label: "Set Active" },
    { name: "set_inactive", label: "Set Inactive" },
  ],
  quotes: [
    { name: "add_item", label: "Add Item" },
    { name: "remove_item", label: "Remove Item" },
    { name: "send", label: "Send" },
    { name: "accept", label: "Accept" },
    { name: "decline", label: "Decline" },
    { name: "expire", label: "Expire" },
    { name: "convert", label: "Convert to Invoice" },
  ],
  invoices: [
    { name: "add_item", label: "Add Item" },
    { name: "remove_item", label: "Remove Item" },
    { name: "issue", label: "Issue" },
    { name: "void", label: "Void" },
    { name: "cancel", label: "Cancel" },
  ],
  payments: [
    { name: "confirm", label: "Confirm" },
    { name: "reverse", label: "Reverse" },
    { name: "allocate", label: "Allocate" },
    { name: "receipt", label: "Issue Receipt" },
    { name: "send_receipt", label: "Email Receipt / Resend Confirmation" },
  ],
  subscriptions: [
    { name: "activate", label: "Activate" },
    { name: "waive", label: "Waive (no invoice)" },
    { name: "suspend", label: "Suspend" },
    { name: "cancel_subscription", label: "Cancel" },
    { name: "renew", label: "Renew" },
    { name: "add_addon", label: "Add Add-on" },
    { name: "remove_addon", label: "Remove Add-on" },
  ],
  renewals: [
    { name: "update", label: "Update Status" },
    { name: "link_invoice", label: "Link Invoice" },
    { name: "refresh", label: "Refresh" },
  ],
  commission_plans: [
    { name: "update", label: "Update" },
    { name: "set_active", label: "Set Active" },
    { name: "set_inactive", label: "Set Inactive" },
  ],
  commissions: [
    { name: "approve", label: "Approve" },
    { name: "cancel", label: "Cancel" },
    { name: "reverse", label: "Reverse" },
    { name: "evaluate", label: "Evaluate" },
  ],
  payouts: [
    { name: "approve", label: "Approve" },
    { name: "mark_paid", label: "Mark Paid" },
  ],
  receipts: [],
  licences_sold: [],
}

type Row = Record<string, unknown>

type ApiResponse = { success?: boolean; data?: Row | Row[]; error?: string }

interface Option {
  value: string
  label: string
}

interface BusinessOption {
  id: string
  businessName: string
  status?: string
}

interface PlanOption {
  id: string
  name: string
  code: string
  billing_type: "RECURRING" | "ONE_TIME"
  billing_interval?: string
  base_price: number
  currency: string
  active: boolean
}

interface LicenceSoldRow {
  licence_id: string
  business_id: string
  business_name: string | null
  licence_type: string
  licence_status: string
  plan_id: string | null
  plan_code: string | null
  waived: boolean
  max_users: number
  max_branches: number
  online_store_enabled: boolean
  effective_from: string | null
  expires_at: string | null
  issued_at: string | null
  subscription_id: string | null
  subscription_status: string | null
  quantity: number
}

interface LicencesSoldReport {
  generated_at: string
  distinct_businesses: number
  total_quantity: number
  waived_count: number
  billed_count: number
  by_type: { licence_type: string; count: number; quantity: number }[]
  by_plan: { plan_code: string | null; plan_name: string | null; count: number; quantity: number }[]
  rows: LicenceSoldRow[]
}

/**
 * Derive the licence shown on the subscription form from the selected PLAN.
 *
 * Mirrors `resolveLicenceFromPlan` in lib/finance-commercial.ts. Only the plan
 * matters — services never influence the licence. This is a pure display helper
 * so the admin sees what licence will be issued before creating the record.
 */
function licencePreviewFromPlan(plan: PlanOption | undefined): string {
  if (!plan) return "—"
  const code = (plan.code || "").toUpperCase()
  if (code.includes("ERP")) return "ERP Licence"
  if (plan.billing_type === "ONE_TIME") return "Perpetual / Offline Licence"
  return "Cloud Licence"
}

function Dialog({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}) {
  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-20">
      <div className="w-full max-w-2xl rounded-xl border border-border bg-background p-6 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">{title}</h3>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}

function defaultFormValues(fields: FieldConfig[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const f of fields) {
    if (f.type === "boolean") {
      out[f.name] = f.name === "recurring" ? "false" : "true"
    } else if (f.type === "select" && f.options?.length) {
      out[f.name] = f.options[0]
    } else {
      out[f.name] = ""
    }
  }
  return out
}

function buildCreatePayload(section: SectionKey, values: Record<string, string>): unknown {
  const fields = CREATE_FIELDS[section]
  const payload: Record<string, unknown> = {}
  for (const f of fields) {
    if (f.type === "derived") continue // display-only, never sent
    const v = values[f.name]
    if (v === undefined || v === "") continue
    if (f.type === "number") payload[f.name] = Number(v)
    else if (f.type === "boolean") payload[f.name] = v === "true"
    else if (f.type === "select") payload[f.name] = v
    else payload[f.name] = v
  }
  if (section === "payouts" && typeof payload.commission_ids === "string") {
    payload.commission_ids = payload.commission_ids
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  }
  return payload
}

export default function CommercialSectionPage() {
  const { section } = useParams() as { section: string }
  const resource = RESOURCES.includes(section as SectionKey) ? (section as SectionKey) : null

  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState("")
  const [formValues, setFormValues] = useState<Record<string, string>>({})

  // Dynamic pickers for the subscription form.
  const [businesses, setBusinesses] = useState<BusinessOption[]>([])
  const [plans, setPlans] = useState<PlanOption[]>([])

  // Licences-sold report (read-only section).
  const [report, setReport] = useState<LicencesSoldReport | null>(null)
  const [reportLoading, setReportLoading] = useState(false)

  const [actionOpen, setActionOpen] = useState(false)
  const [selectedRow, setSelectedRow] = useState<Row | null>(null)
  const [selectedAction, setSelectedAction] = useState("")
  const [actionData, setActionData] = useState("")
  const [waiveReason, setWaiveReason] = useState("")
  const [working, setWorking] = useState(false)

  const fields = resource ? CREATE_FIELDS[resource] : []
  const createAction = resource ? CREATE_ACTION[resource] : null
  const actions = resource ? ACTIONS[resource] : []

  const needsBusinesses = fields.some((f) => f.optionSource === "businesses")
  const needsPlans = fields.some((f) => f.optionSource === "plans")

  const selectedPlan = useMemo(
    () => plans.find((p) => p.id === formValues.plan_id),
    [plans, formValues.plan_id],
  )

  useEffect(() => {
    if (!resource) return
    setFormValues(defaultFormValues(fields))
  }, [resource, fields])

  // Load businesses for pickers (only businesses that can hold a licence).
  useEffect(() => {
    if (!needsBusinesses) return
    let cancelled = false
    fetch("/api/admin/businesses")
      .then((res) => res.json())
      .then((data: { businesses?: BusinessOption[] }) => {
        if (cancelled) return
        const list = (data.businesses || []).filter(
          (b) => !["CHURNED", "INACTIVE"].includes(String(b.status || "").toUpperCase()),
        )
        setBusinesses(list.sort((a, b) => a.businessName.localeCompare(b.businessName)))
      })
      .catch(() => setMessage("Failed to load businesses"))
    return () => {
      cancelled = true
    }
  }, [needsBusinesses])

  // Load plans (only active/available plans) for the plan picker.
  useEffect(() => {
    if (!needsPlans) return
    let cancelled = false
    fetch("/api/admin/finance/catalog?type=plans&activeOnly=true")
      .then((res) => res.json())
      .then((raw: { success?: boolean; data?: PlanOption[] }) => {
        if (cancelled) return
        setPlans((raw.data || []).filter((p) => p.active !== false))
      })
      .catch(() => setMessage("Failed to load plans"))
    return () => {
      cancelled = true
    }
  }, [needsPlans])

  useEffect(() => {
    if (!resource) return
    setLoading(true)
    fetch(`/api/admin/finance/commercial/${resource}`)
      .then((res) => res.json())
      .then((raw: unknown) => {
        const data = raw as ApiResponse
        if (data.success && data.data) {
          const items = Array.isArray(data.data) ? data.data : [data.data]
          setRows(items)
        } else {
          setRows([])
          if (data.success === false) {
            setMessage(data.error || "Failed to load")
          }
        }
      })
      .catch(() => setMessage("Failed to load data"))
      .finally(() => setLoading(false))
  }, [resource])

  useEffect(() => {
    if (resource !== "licences_sold") return
    let cancelled = false
    // Schedule so the first setState happens outside the synchronous effect body.
    const run = async () => {
      setReportLoading(true)
      try {
        const res = await fetch("/api/admin/finance/commercial/licences_sold")
        const data = (await res.json()) as ApiResponse
        if (!cancelled && data.success && data.data && !Array.isArray(data.data)) {
          setReport(data.data as unknown as LicencesSoldReport)
        }
      } catch {
        if (!cancelled) setMessage("Failed to load licences-sold report")
      } finally {
        if (!cancelled) setReportLoading(false)
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [resource])

  const columns = useMemo(() => {
    if (!rows.length) return []
    const first = rows[0]
    return Object.keys(first).filter((k) => {
      const v = first[k]
      return v === null || (typeof v !== "object" && !Array.isArray(v))
    })
  }, [rows])

  async function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!resource || !createAction) return
    setWorking(true)
    setMessage("")
    try {
      const res = await fetch(`/api/admin/finance/commercial/${resource}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: createAction, data: buildCreatePayload(resource, formValues) }),
      })
      const data = (await res.json()) as ApiResponse
      if (data.success) {
        setMessage("Created successfully")
        setFormValues(defaultFormValues(fields))
        refreshList()
      } else {
        setMessage(data.error || "Create failed")
      }
    } catch {
      setMessage("Create failed")
    } finally {
      setWorking(false)
    }
  }

  async function runAction() {
    if (!resource || !selectedAction || !actionData.trim()) return
    setWorking(true)
    setMessage("")
    try {
      let payload: unknown
      try {
        payload = JSON.parse(actionData)
      } catch {
        setMessage("Action data is not valid JSON")
        setWorking(false)
        return
      }
      // For a waiver, merge the friendly reason field into the payload.
      if (selectedAction === "waive" && payload && typeof payload === "object") {
        payload = { ...(payload as Record<string, unknown>), reason: waiveReason.trim() || undefined }
      }
      const res = await fetch(`/api/admin/finance/commercial/${resource}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: selectedAction, data: payload }),
      })
      const data = (await res.json()) as ApiResponse
      if (data.success) {
        setMessage("Action successful")
        setActionOpen(false)
        setWaiveReason("")
        refreshList()
      } else {
        setMessage(data.error || "Action failed")
      }
    } catch {
      setMessage("Action failed")
    } finally {
      setWorking(false)
    }
  }

  async function refreshList() {
    if (!resource) return
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/finance/commercial/${resource}`)
      const data = (await res.json()) as ApiResponse
      if (data.success && data.data) {
        const items = Array.isArray(data.data) ? data.data : [data.data]
        setRows(items)
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }

  function openAction(row: Row) {
    setSelectedRow(row)
    setSelectedAction(actions.length ? actions[0].name : "")
    setActionData(JSON.stringify({ id: row.id }, null, 2))
    setActionOpen(true)
  }

  function renderCell(row: Row, key: string) {
    const v = row[key]
    if (v === null || v === undefined) return <span className="text-muted-foreground">—</span>
    if (key === "id") return <span className="font-mono text-xs">{String(v)}</span>
    if (typeof v === "boolean") return v ? "Yes" : "No"
    if (["amount", "total_amount", "subtotal", "discount_amount", "tax_amount", "balance_due", "base_price", "default_price", "commission_amount", "basis_amount"].includes(key)) {
      return formatNgn(Number(v))
    }
    return String(v)
  }

  /** Resolve the {value,label} options for a field, dynamic or static. */
  function optionsFor(f: FieldConfig): Option[] {
    if (f.optionSource === "businesses") {
      return businesses.map((b) => ({ value: b.id, label: b.businessName }))
    }
    if (f.optionSource === "plans") {
      return plans.map((p) => ({
        value: p.id,
        label: `${p.name}${p.code ? ` (${p.code})` : ""} · ${formatMoneyIn(p.base_price, p.currency)}`,
      }))
    }
    return (f.options || []).map((o) => ({ value: o, label: o }))
  }

  function renderInput(f: FieldConfig) {
    const value = formValues[f.name] ?? ""
    const base = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
    if (f.type === "textarea") {
      return (
        <textarea
          id={f.name}
          value={value}
          onChange={(e) => setFormValues((prev) => ({ ...prev, [f.name]: e.target.value }))}
          className={base}
          rows={3}
        />
      )
    }
    if (f.type === "derived") {
      const derived = f.deriveFrom === "plan_id" ? licencePreviewFromPlan(selectedPlan) : "—"
      return (
        <input
          id={f.name}
          type="text"
          value={derived}
          readOnly
          disabled
          className={`${base} bg-muted text-muted-foreground`}
        />
      )
    }
    if (f.type === "select") {
      const opts = optionsFor(f)
      return (
        <select
          id={f.name}
          value={value}
          onChange={(e) => setFormValues((prev) => ({ ...prev, [f.name]: e.target.value }))}
          className={base}
        >
          <option value="">{f.optionSource ? "Select…" : ""}</option>
          {opts.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )
    }
    if (f.type === "boolean") {
      return (
        <input
          id={f.name}
          type="checkbox"
          checked={value === "true"}
          onChange={(e) => setFormValues((prev) => ({ ...prev, [f.name]: String(e.target.checked) }))}
          className="h-4 w-4 rounded border-input"
        />
      )
    }
    return (
      <input
        id={f.name}
        type={f.type === "number" ? "number" : f.type === "date" ? "date" : "text"}
        value={value}
        onChange={(e) => setFormValues((prev) => ({ ...prev, [f.name]: e.target.value }))}
        className={base}
      />
    )
  }

  if (!resource) {
    return (
      <div className="space-y-4">
        <Link href="/admin/finance/commercial" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-1 h-4 w-4" /> Back
        </Link>
        <p className="text-muted-foreground">Unknown section: {section}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/admin/finance/commercial" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="mr-1 h-4 w-4" /> Back
          </Link>
          <h2 className="mt-1 text-2xl font-bold tracking-tight">{TITLES[resource]}</h2>
          <p className="text-sm text-muted-foreground">Manage {TITLES[resource].toLowerCase()} via the unified commercial finance API.</p>
        </div>
        {loading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
      </div>

      {message && (
        <p className={`text-sm ${message.includes("success") ? "text-emerald-600" : "text-red-500"}`}>{message}</p>
      )}

      {resource === "licences_sold" ? (
        reportLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : !report ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Failed to load report.</p>
        ) : (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Licences Sold (businesses)</CardTitle>
                </CardHeader>
                <CardContent><p className="text-2xl font-bold">{report.distinct_businesses}</p></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total Quantity</CardTitle>
                </CardHeader>
                <CardContent><p className="text-2xl font-bold">{report.total_quantity}</p></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Billed</CardTitle>
                </CardHeader>
                <CardContent><p className="text-2xl font-bold text-emerald-600">{report.billed_count}</p></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Waived</CardTitle>
                </CardHeader>
                <CardContent><p className="text-2xl font-bold text-purple-600">{report.waived_count}</p></CardContent>
              </Card>
            </div>

            {report.by_plan.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">By Plan</CardTitle>
                </CardHeader>
                <CardContent>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="px-3 py-2 font-medium">Plan</th>
                        <th className="px-3 py-2 font-medium">Code</th>
                        <th className="px-3 py-2 font-medium text-right">Licences</th>
                        <th className="px-3 py-2 font-medium text-right">Quantity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {report.by_plan.map((p) => (
                        <tr key={p.plan_code || "unknown"} className="border-b last:border-0">
                          <td className="px-3 py-2">{p.plan_name || "—"}</td>
                          <td className="px-3 py-2 font-mono text-xs">{p.plan_code || "—"}</td>
                          <td className="px-3 py-2 text-right">{p.count}</td>
                          <td className="px-3 py-2 text-right">{p.quantity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">All Granted Licences</CardTitle>
              </CardHeader>
              <CardContent>
                {report.rows.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">No licences granted yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="px-3 py-2 font-medium">Business</th>
                          <th className="px-3 py-2 font-medium">Licence</th>
                          <th className="px-3 py-2 font-medium">Plan</th>
                          <th className="px-3 py-2 font-medium text-right">Qty</th>
                          <th className="px-3 py-2 font-medium">Status</th>
                          <th className="px-3 py-2 font-medium">Expires</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.rows.map((r) => (
                          <tr key={r.licence_id} className="border-b last:border-0 hover:bg-muted/50">
                            <td className="px-3 py-2">{r.business_name || "—"}</td>
                            <td className="px-3 py-2">{enumLabel(r.licence_type)}</td>
                            <td className="px-3 py-2 font-mono text-xs">{r.plan_code || "—"}</td>
                            <td className="px-3 py-2 text-right">{r.quantity}</td>
                            <td className="px-3 py-2">
                              <span className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-medium ${r.waived ? "bg-purple-50 text-purple-700" : "bg-green-50 text-green-700"}`}>
                                {r.waived ? "Waived" : "Billed"}
                              </span>
                            </td>
                            <td className="px-3 py-2">{r.expires_at || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )
      ) : (
        <>
      {createAction && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Plus className="h-4 w-4" /> Create {TITLES[resource]}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {fields.map((f) => (
                <div key={f.name} className="space-y-1.5">
                  <label htmlFor={f.name} className="text-sm font-medium">
                    {f.label}
                  </label>
                  {renderInput(f)}
                  {f.help && <p className="text-xs text-muted-foreground">{f.help}</p>}
                </div>
              ))}
              <div className="flex items-end sm:col-span-2 lg:col-span-3">
                <Button type="submit" disabled={working}>
                  {working ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Plus className="mr-1 h-4 w-4" />}
                  Create
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">{TITLES[resource]} List</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 && !loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No records found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    {columns.slice(0, 8).map((c) => (
                      <th key={c} className="whitespace-nowrap px-3 py-2 font-medium capitalize">
                        {enumLabel(c)}
                      </th>
                    ))}
                    {actions.length > 0 && <th className="px-3 py-2 font-medium">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={String(row.id ?? Math.random())} className="border-b last:border-0 hover:bg-muted/50">
                      {columns.slice(0, 8).map((c) => (
                        <td key={c} className="whitespace-nowrap px-3 py-2">
                          {renderCell(row, c)}
                        </td>
                      ))}
                      {actions.length > 0 && (
                        <td className="px-3 py-2">
                          <Button variant="outline" size="sm" onClick={() => openAction(row)}>
                            <Play className="mr-1 h-3.5 w-3.5" /> Run action
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
        </>
      )}

      <Dialog open={actionOpen} onClose={() => setActionOpen(false)} title={`Run action on ${TITLES[resource]}`}>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Action</label>
            <select
              value={selectedAction}
              onChange={(e) => {
                setSelectedAction(e.target.value)
                if (e.target.value === "waive") {
                  setActionData(JSON.stringify({ id: selectedRow?.id, reason: "" }, null, 2))
                }
              }}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {actions.map((a) => (
                <option key={a.name} value={a.name}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>

          {selectedAction === "waive" ? (
            <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50/60 p-3">
              <p className="text-sm text-amber-800">
                Waiving grants the licence without billing. A zero-amount <strong>WAIVED</strong> invoice is created and
                linked, and the licence is issued from the subscription&apos;s plan. The business still counts in the
                licences-sold report.
              </p>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Reason</label>
                <textarea
                  value={waiveReason}
                  onChange={(e) => setWaiveReason(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  rows={3}
                  placeholder="e.g. Founding customer — bundled free for 12 months"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Action Data (JSON)</label>
              <textarea
                value={actionData}
                onChange={(e) => setActionData(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                rows={8}
              />
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setActionOpen(false)}>
              Cancel
            </Button>
            <Button onClick={runAction} disabled={working}>
              {working ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Play className="mr-1 h-4 w-4" />}
              Run
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
