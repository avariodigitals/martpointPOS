"use client"

/* The page synchronizes its form/list state with route changes and remote API reads. */
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react"
import { useParams, useSearchParams } from "next/navigation"
import Link from "next/link"
import { createPortal } from "react-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, ArrowLeft, ChevronLeft, ChevronRight, Plus, Search, X } from "lucide-react"
import { formatMoney } from "@/lib/money-format"
import { enumLabel } from "@/lib/utils"
import { resolveIndustryName } from "@/lib/industries"
import { quoteTemplateOptions, resolveQuoteTemplate } from "@/lib/quote-templates"
import { recalculateQuote } from "@/lib/quotations"

const CURRENCY_OPTIONS = ["NGN", "USD", "GBP", "EUR"]

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
  licences_sold: "Licence Ledger",
}

type FieldType = "text" | "number" | "select" | "textarea" | "date" | "boolean" | "derived"

// Which dynamic option list a select should be populated from. Static
// `options` remain supported for simple enums.
type OptionSource = "businesses" | "plans" | "partner_leads" | "invoices" | "partners" | "subscriptions" | "products" | "addons" | "payments"

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
    { name: "currency", label: "Currency", type: "select", options: CURRENCY_OPTIONS },
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
    { name: "currency", label: "Currency", type: "select", options: CURRENCY_OPTIONS },
    { name: "recurring", label: "Recurring", type: "boolean" },
    { name: "billing_interval", label: "Billing Interval", type: "select", options: ["MONTHLY", "QUARTERLY", "ANNUAL", "NONE"] },
    { name: "active", label: "Active", type: "boolean" },
  ],
  quotes: [
    { name: "business_id", label: "Customer business (optional)", type: "select", optionSource: "businesses", help: "Leave blank when preparing a quote for a partner lead. You can attach the customer after acceptance." },
    { name: "partner_id", label: "Partner (optional)", type: "select", optionSource: "partners" },
    { name: "partner_lead_id", label: "Partner Lead", type: "select", optionSource: "partner_leads", help: "Select the lead. This creates a lead-backed quote without creating a customer." },
    { name: "plan_id", label: "Plan", type: "select", optionSource: "plans", help: "Select the active commercial plan for this quote." },
    { name: "currency", label: "Currency", type: "select", options: CURRENCY_OPTIONS },
    { name: "payment_terms", label: "Payment Terms", type: "textarea", help: "Shown on the partner quote and PDF." },
    { name: "notes_public", label: "Public Notes", type: "textarea" },
    { name: "valid_until", label: "Valid Until", type: "date" },
  ],
  invoices: [
    { name: "business_id", label: "Customer business", type: "select", optionSource: "businesses" },
    { name: "due_date", label: "Due Date", type: "date" },
    { name: "notes_public", label: "Public Notes", type: "textarea" },
  ],
  payments: [
    { name: "business_id", label: "Customer business", type: "select", optionSource: "businesses" },
    { name: "invoice_id", label: "Invoice", type: "select", optionSource: "invoices" },
    { name: "amount", label: "Amount", type: "number" },
    { name: "payment_method", label: "Payment Method", type: "select", options: ["BANK_TRANSFER", "PAYSTACK", "FLUTTERWAVE", "CASH", "POS", "OTHER"] },
    { name: "gateway_reference", label: "Gateway Reference", type: "text" },
    { name: "paid_at", label: "Paid At", type: "date" },
    { name: "notes", label: "Notes", type: "textarea" },
  ],
  subscriptions: [
    { name: "business_id", label: "Customer business", type: "select", optionSource: "businesses", help: "Only active businesses that can hold a subscription are listed." },
    { name: "plan_id", label: "Plan", type: "select", optionSource: "plans", help: "The customer access entitlement is derived from the plan you select — never from a service." },
    { name: "licence_preview", label: "Access entitlement (from plan)", type: "derived", deriveFrom: "plan_id", help: "A subscription is the billing agreement; the plan creates the customer access entitlement." },
    { name: "billing_interval", label: "Billing Interval", type: "select", options: ["MONTHLY", "QUARTERLY", "ANNUAL", "NONE"] },
    { name: "quantity", label: "Quantity (licences)", type: "number", help: "Number of licences/seats. Used by the licences-sold report." },
    { name: "start_date", label: "Start Date", type: "date" },
    { name: "current_period_end", label: "Current Period End", type: "date" },
    { name: "renewal_date", label: "Renewal Date", type: "date" },
    { name: "auto_renew", label: "Auto Renew", type: "boolean" },
  ],
  renewals: [
    { name: "subscription_id", label: "Subscription", type: "select", optionSource: "subscriptions" },
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
    { name: "product_id", label: "Product", type: "select", optionSource: "products" },
    { name: "plan_id", label: "Plan", type: "select", optionSource: "plans" },
    { name: "addon_id", label: "Add-on", type: "select", optionSource: "addons" },
    { name: "effective_from", label: "Effective From", type: "date" },
    { name: "active", label: "Active", type: "boolean" },
    { name: "commission_trigger", label: "Commission Trigger", type: "select", options: ["PAYMENT_CONFIRMED", "SUBSCRIPTION_ACTIVATED", "CUSTOMER_GO_LIVE", "CUSTOM"], help: "CUSTOM means the plan only categorises earnings — its rate comes from the signed Commission Schedule and nothing is booked automatically." },
    { name: "clawback_days", label: "Clawback Days", type: "number" },
  ],
  commissions: [],
  payouts: [
    { name: "partner_id", label: "Partner", type: "select", optionSource: "partners" },
    { name: "commission_ids", label: "Commission IDs (comma-separated)", type: "textarea" },
  ],
  receipts: [
    { name: "payment_id", label: "Payment", type: "select", optionSource: "payments" },
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
    { name: "attach_business", label: "Attach Customer" },
    { name: "create_business", label: "Create Customer Business" },
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
    { name: "reject", label: "Reject proof" },
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

const BULK_ACTIONS: Partial<Record<SectionKey, string[]>> = {
  products: ["set_active", "set_inactive"],
  plans: ["set_active", "set_inactive"],
  addons: ["set_active", "set_inactive"],
  invoices: ["issue", "cancel"],
  payments: ["confirm", "reverse"],
  subscriptions: ["activate", "suspend", "cancel_subscription", "renew"],
  renewals: ["refresh"],
  commissions: ["approve", "cancel", "reverse"],
  payouts: ["approve", "mark_paid"],
}

function quoteActionOptions(row: Row): { name: string; label: string }[] {
  const status = String(row.status || "DRAFT").toUpperCase()
  if (status === "DRAFT") return [{ name: "send", label: "Send to partner" }]
  if (status === "SENT") return [
    { name: "accept", label: "Mark accepted" },
    { name: "decline", label: "Decline" },
    { name: "expire", label: "Expire" },
  ]
  if (status === "ACCEPTED") {
    if (row.business_id) return [{ name: "convert", label: "Convert to invoice" }]
    if (row.partner_lead_id) return [
      { name: "convert", label: "Create business & convert to invoice" },
      { name: "create_business", label: "Create customer business" },
      { name: "attach_business", label: "Attach existing business" },
    ]
    return [{ name: "attach_business", label: "Attach customer business" }]
  }
  if (status === "DECLINED" || status === "EXPIRED") return [{ name: "send", label: "Send again" }]
  return []
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

interface PartnerLeadOption {
  id: string
  businessName: string
  contactName: string
  partnerName?: string | null
  partnerCode?: string | null
  status?: string
  protectionStatus?: string
  industry?: string
  businessType?: string
}

const DISPLAY_COLUMNS: Partial<Record<SectionKey, string[]>> = {
  products: ["name", "code", "product_family", "status"],
  plans: ["name", "code", "billing_type", "billing_interval", "base_price", "active"],
  addons: ["name", "code", "pricing_type", "default_price", "recurring", "active"],
  quotes: ["quote_number", "customer", "partner_lead", "status", "quote_origin", "currency", "total_amount", "valid_until"],
  invoices: ["invoice_number", "customer", "status", "currency", "total_amount", "balance_due", "due_date"],
  payments: ["payment_reference", "customer", "invoice", "status", "payment_method", "currency", "amount", "created_at"],
  subscriptions: ["customer", "plan", "status", "billing_interval", "quantity", "current_period_end", "renewal_date"],
  renewals: ["subscription", "customer", "status", "renewal_due_date"],
  commission_plans: ["name", "partner_type", "commission_basis", "percentage", "fixed_amount", "applies_to", "active"],
  commissions: ["partner", "customer", "status", "commission_amount", "created_at"],
  payouts: ["payout_reference", "partner", "status", "amount", "payment_method", "paid_at"],
  receipts: ["receipt_number", "customer", "issued_at"],
}

const COLUMN_LABELS: Record<string, string> = {
  customer: "Customer business",
  partner: "Partner",
  partner_lead: "Partner lead",
  invoice: "Invoice",
  subscription: "Subscription",
  quote_origin: "Origin",
  base_price: "Price",
  default_price: "Default price",
  commission_amount: "Commission",
  fixed_amount: "Fixed amount",
  current_period_end: "Period ends",
  renewal_date: "Renewal date",
  renewal_due_date: "Renewal due",
  created_at: "Created",
  issued_at: "Issued",
  paid_at: "Paid",
}

interface TaxRateOption {
  id: string
  name: string
  rate: number
}

type QuoteLineType = "PRODUCT" | "PLAN" | "SERVICE" | "ADDON" | "CUSTOM"

interface QuoteLine {
  item_type: QuoteLineType
  reference_id: string | null
  description: string
  quantity: number
  unit_price: number
  discount: number
  tax: number
  tax_rate: number | null
}

interface QuoteCatalogItem {
  id: string
  name: string
  description: string | null
  item_type: Exclude<QuoteLineType, "CUSTOM">
  price: number
  currency: string
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
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="flex max-h-[calc(100vh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-border bg-background p-6 shadow-lg"
      >
        <div className="mb-4 flex shrink-0 items-center justify-between">
          <h3 className="text-lg font-semibold">{title}</h3>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="min-h-0 overflow-y-auto pr-1">{children}</div>
      </div>
    </div>,
    document.body,
  )
}

function SearchableSelect({
  value,
  options,
  onChange,
  placeholder = "Search and select…",
}: {
  value: string
  options: Option[]
  onChange: (value: string) => void
  placeholder?: string
}) {
  const selected = options.find((option) => option.value === value)
  const [query, setQuery] = useState(selected?.label || "")
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) setQuery(selected?.label || "")
  }, [open, selected?.label])

  const normalizedQuery = query.trim().toLowerCase()
  const filtered = options
    .filter((option) => !normalizedQuery || `${option.label} ${option.value}`.toLowerCase().includes(normalizedQuery))
    .slice(0, 100)

  return (
    <div className="relative">
      <input
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(event) => {
          setQuery(event.target.value)
          setOpen(true)
          if (!event.target.value) onChange("")
        }}
        onBlur={() => window.setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        autoComplete="off"
      />
      {open && (
        <div className="absolute z-40 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-border bg-popover p-1 text-sm shadow-lg">
          {filtered.length === 0 ? (
            <p className="px-2 py-2 text-xs text-muted-foreground">No matching records.</p>
          ) : filtered.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`block w-full rounded px-2 py-2 text-left hover:bg-muted ${option.value === value ? "bg-muted font-medium" : ""}`}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onChange(option.value)
                setQuery(option.label)
                setOpen(false)
              }}
            >
              {option.label}
            </button>
          ))}
          {options.length > 100 && <p className="px-2 py-2 text-[11px] text-muted-foreground">Refine your search to see more than the first 100 matches.</p>}
        </div>
      )}
    </div>
  )
}

function defaultFormValues(fields: FieldConfig[]): Record<string, string> {
  const out: Record<string, string> = {}
  for (const f of fields) {
    if (f.type === "boolean") {
      out[f.name] = f.name === "recurring" ? "false" : "true"
    } else if (f.name === "currency") {
      // MartPoint's commercial catalogue is NGN-first. Never present a blank
      // currency in a quote/invoice-facing form.
      out[f.name] = "NGN"
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
  const searchParams = useSearchParams()
  const resource = RESOURCES.includes(section as SectionKey) ? (section as SectionKey) : null
  const partnerOnly = resource === "quotes" && searchParams.get("source") === "partner"

  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState("")
  const [formValues, setFormValues] = useState<Record<string, string>>({})

  // Dynamic pickers for the subscription form.
  const [businesses, setBusinesses] = useState<BusinessOption[]>([])
  const [plans, setPlans] = useState<PlanOption[]>([])
  const [partnerLeads, setPartnerLeads] = useState<PartnerLeadOption[]>([])
  const [referenceOptions, setReferenceOptions] = useState<Partial<Record<OptionSource, Option[]>>>({})
  const [quoteCatalog, setQuoteCatalog] = useState<QuoteCatalogItem[]>([])
  const [quoteItems, setQuoteItems] = useState<QuoteLine[]>([])
  const [quoteTemplateSelection, setQuoteTemplateSelection] = useState("")
  const [taxRates, setTaxRates] = useState<TaxRateOption[]>([])
  const [companyAccountNumber, setCompanyAccountNumber] = useState("")
  const [quotePreview, setQuotePreview] = useState<Row | null>(null)
  const [actionBusinessId, setActionBusinessId] = useState("")
  const [actionDueDate, setActionDueDate] = useState("")

  // Licences-sold report (read-only section).
  const [report, setReport] = useState<LicencesSoldReport | null>(null)
  const [reportLoading, setReportLoading] = useState(false)

  const [actionOpen, setActionOpen] = useState(false)
  const [selectedRow, setSelectedRow] = useState<Row | null>(null)
  const [selectedAction, setSelectedAction] = useState("")
  const [actionData, setActionData] = useState("")
  const [actionReason, setActionReason] = useState("")
  const [waiveReason, setWaiveReason] = useState("")
  const [working, setWorking] = useState(false)
  const [search, setSearch] = useState(() => searchParams.get("invoice_id") || searchParams.get("quote_id") || "")
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkAction, setBulkAction] = useState("")

  const fields = useMemo(() => resource ? CREATE_FIELDS[resource] : [], [resource])
  const createAction = resource ? CREATE_ACTION[resource] : null
  const actions = resource ? ACTIONS[resource] : []

  const optionSources = useMemo(
    () => Array.from(new Set(fields.map((field) => field.optionSource).filter((source): source is OptionSource => Boolean(source)))),
    [fields],
  )

  const needsBusinesses = fields.some((f) => f.optionSource === "businesses") || resource === "quotes"
  const needsPlans = fields.some((f) => f.optionSource === "plans")
  const needsPartnerLeads = fields.some((f) => f.optionSource === "partner_leads")

  const selectedPlan = useMemo(
    () => plans.find((p) => p.id === formValues.plan_id),
    [plans, formValues.plan_id],
  )

  useEffect(() => {
    if (!resource) return
    setFormValues(defaultFormValues(fields))
    if (resource === "quotes") {
      setQuoteItems([{ item_type: "CUSTOM", reference_id: null, description: "", quantity: 1, unit_price: 0, discount: 0, tax: 0, tax_rate: 0 }])
      setQuoteTemplateSelection("")
    }
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
      .then((raw: { success?: boolean; data?: PlanOption[] | { plans?: PlanOption[] } }) => {
        if (cancelled) return
        const catalogPlans = Array.isArray(raw.data) ? raw.data : raw.data?.plans || []
        setPlans(catalogPlans.filter((p) => p.active !== false))
      })
      .catch(() => setMessage("Failed to load plans"))
    return () => {
      cancelled = true
    }
  }, [needsPlans])

  useEffect(() => {
    if (!needsPartnerLeads) return
    let cancelled = false
    fetch("/api/admin/partner-leads")
      .then((res) => res.json())
      .then((data: { leads?: PartnerLeadOption[] }) => {
        if (cancelled) return
        const list = (data.leads || []).filter((lead) => !["LOST", "EXPIRED"].includes(String(lead.status || "").toUpperCase()))
        setPartnerLeads(list.sort((a, b) => a.businessName.localeCompare(b.businessName)))
      })
      .catch(() => setMessage("Failed to load partner leads"))
    return () => {
      cancelled = true
    }
  }, [needsPartnerLeads])

  // Load searchable database-backed references used by the create forms.
  // Labels are deliberately composed from names plus a short status/value so
  // a long list never forces an admin to identify a record from an ID alone.
  useEffect(() => {
    const sources = optionSources.filter((source) => !["businesses", "plans", "partner_leads"].includes(source))
    if (sources.length === 0) return
    let cancelled = false

    async function loadReferences() {
      const next: Partial<Record<OptionSource, Option[]>> = {}
      await Promise.all(sources.map(async (source) => {
        try {
          if (source === "partners") {
            const response = await fetch("/api/admin/partners")
            const payload = await response.json() as { partners?: Row[] }
            next[source] = (payload.partners || []).map((partner) => ({
              value: String(partner.id),
              label: `${String(partner.display_name || partner.business_name || "Unnamed partner")} · ${String(partner.partner_id || partner.id).slice(0, 14)}`,
            }))
            return
          }

          const response = await fetch(`/api/admin/finance/commercial/${source}`)
          const payload = await response.json() as ApiResponse
          const records = Array.isArray(payload.data) ? payload.data : []
          next[source] = records.map((row) => {
            const business = row.businesses && typeof row.businesses === "object" ? row.businesses as Row : null
            const plan = row.plans && typeof row.plans === "object" ? row.plans as Row : null
            const customer = String(business?.business_name || row.business_id || "Unnamed customer")
            if (source === "invoices") return { value: String(row.id), label: `${String(row.invoice_number || row.id)} · ${customer} · ${enumLabel(String(row.status || ""))}` }
            if (source === "subscriptions") return { value: String(row.id), label: `${customer} · ${String(plan?.name || row.plan_id || "No plan")} · ${enumLabel(String(row.status || ""))}` }
            if (source === "payments") return { value: String(row.id), label: `${String(row.payment_reference || row.id)} · ${customer} · ${formatMoneyIn(Number(row.amount), String(row.currency || "NGN"))}` }
            return { value: String(row.id), label: `${String(row.name || row.code || row.id)}${row.code ? ` · ${String(row.code)}` : ""}` }
          })
        } catch {
          // Keep the form usable; the field will show an empty searchable list.
        }
      }))
      if (!cancelled) setReferenceOptions((previous) => ({ ...previous, ...next }))
    }

    void loadReferences()
    return () => { cancelled = true }
  }, [optionSources])

  // Quotes use the same live commercial catalogue as the normal quotation
  // screen, so plans, products, services and add-ons can all become lines.
  useEffect(() => {
    if (resource !== "quotes") return
    let cancelled = false
    Promise.all([
      fetch("/api/admin/quotations").then((res) => res.json()),
      fetch("/api/admin/settings").then((res) => res.json()),
    ])
      .then(([quotationData, settingsData]) => {
        if (cancelled) return
        setTaxRates(((quotationData.taxRates || []) as Record<string, unknown>[]).map((t) => ({
          id: String(t.id), name: String(t.name), rate: Number(t.rate) || 0,
        })))
        setCompanyAccountNumber(String(settingsData.general?.accountNumber || ""))
      })
      .catch(() => {
        if (!cancelled) setMessage("Failed to load quote settings")
      })
    fetch("/api/admin/finance/catalog?type=all&activeOnly=true")
      .then((res) => res.json())
      .then((raw: { data?: { products?: Row[]; plans?: Row[]; services?: Row[]; addons?: Row[] } }) => {
        if (cancelled) return
        const data = raw.data || {}
        const products: QuoteCatalogItem[] = (data.products || []).map((p) => ({
          id: String(p.id), name: String(p.name), description: (p.description as string | null) || null,
          item_type: "PRODUCT", price: Number(p.default_price) || 0, currency: String(p.currency || "NGN"),
        }))
        const plansInCatalog: QuoteCatalogItem[] = (data.plans || []).map((p) => ({
          id: String(p.id), name: String(p.name), description: (p.description as string | null) || null,
          item_type: "PLAN", price: Number(p.base_price) || 0, currency: String(p.currency || "NGN"),
        }))
        const services: QuoteCatalogItem[] = (data.services || []).map((s) => ({
          id: String(s.id), name: String(s.name), description: (s.description as string | null) || null,
          item_type: "SERVICE", price: Number(s.default_price) || 0, currency: String(s.currency || "NGN"),
        }))
        const addons: QuoteCatalogItem[] = (data.addons || []).map((a) => ({
          id: String(a.id), name: String(a.name), description: (a.description as string | null) || null,
          item_type: "ADDON", price: Number(a.default_price) || 0, currency: String(a.currency || "NGN"),
        }))
        setQuoteCatalog([...products, ...plansInCatalog, ...services, ...addons].sort((a, b) => a.name.localeCompare(b.name)))
      })
      .catch(() => setMessage("Failed to load quote catalogue"))
    return () => { cancelled = true }
  }, [resource])

  const quoteTotals = useMemo(
    () => recalculateQuote(quoteItems.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unit_price,
      discount: item.discount,
      tax: item.tax,
      taxRate: item.tax_rate,
    }))),
    [quoteItems],
  )

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

  const visibleRows = useMemo(
    () => partnerOnly ? rows.filter((row) => row.quote_origin === "PARTNER_REQUEST" || Boolean(row.partner_lead_id)) : rows,
    [partnerOnly, rows],
  )

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return visibleRows
    return visibleRows.filter((row) => JSON.stringify(row).toLowerCase().includes(query))
  }, [search, visibleRows])

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / pageSize))
  const pagedRows = useMemo(
    () => filteredRows.slice((page - 1) * pageSize, page * pageSize),
    [filteredRows, page, pageSize],
  )
  const rowKey = (row: Row) => String(row.id || row.quote_number || row.invoice_number || row.payment_reference || "")
  const pageRowIds = pagedRows.map(rowKey).filter(Boolean)
  const allPageSelected = pageRowIds.length > 0 && pageRowIds.every((id) => selectedIds.has(id))
  const bulkOptions = (BULK_ACTIONS[resource || "products"] || []).filter((name) => actions.some((action) => action.name === name))

  useEffect(() => {
    setPage(1)
    setSelectedIds(new Set())
    setBulkAction("")
  }, [resource, partnerOnly, search, pageSize])

  useEffect(() => {
    if (page > pageCount) setPage(pageCount)
  }, [page, pageCount])

  const columns = useMemo(() => {
    const configured = resource ? DISPLAY_COLUMNS[resource] : undefined
    if (configured?.length) return configured
    if (!visibleRows.length) return []
    const first = visibleRows[0]
    return Object.keys(first).filter((k) => {
      const v = first[k]
      return v === null || (typeof v !== "object" && !Array.isArray(v))
    })
  }, [resource, visibleRows])

  async function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!resource || !createAction) return
    setWorking(true)
    setMessage("")
    try {
      const createData = buildCreatePayload(resource, formValues) as Record<string, unknown>
      if (resource === "quotes") {
        const validItems = quoteItems.filter((item) => item.description.trim())
        if (validItems.length === 0) {
          setMessage("Add at least one quote line from the catalogue")
          setWorking(false)
          return
        }
        createData.items = validItems
      }
      const res = await fetch(`/api/admin/finance/commercial/${resource}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: createAction, data: createData }),
      })
      const data = (await res.json()) as ApiResponse
      if (data.success) {
        setMessage("Created successfully")
        setFormValues(defaultFormValues(fields))
        if (resource === "quotes") setQuoteItems([{ item_type: "CUSTOM", reference_id: null, description: "", quantity: 1, unit_price: 0, discount: 0, tax: 0, tax_rate: 0 }])
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
      if (selectedAction === "attach_business") {
        if (!actionBusinessId) {
          setMessage("Select the customer business first")
          setWorking(false)
          return
        }
        payload = { id: selectedRow?.id, business_id: actionBusinessId }
      }
      if (selectedAction === "create_business") {
        payload = { id: selectedRow?.id }
      }
      if (selectedAction === "convert" && actionDueDate) {
        payload = { ...(payload as Record<string, unknown>), due_date: actionDueDate }
      }
      if (selectedAction === "convert" && !selectedRow?.business_id && selectedRow?.partner_lead_id) {
        payload = { ...(payload as Record<string, unknown>), create_business: true }
      }
      // For a waiver, merge the friendly reason field into the payload.
      if (selectedAction === "waive" && payload && typeof payload === "object") {
        payload = { ...(payload as Record<string, unknown>), reason: waiveReason.trim() || undefined }
      }
      if (selectedAction === "reject") {
        if (actionReason.trim().length < 5) {
          setMessage("Enter a rejection reason of at least 5 characters")
          setWorking(false)
          return
        }
        payload = { id: selectedRow?.id, reason: actionReason.trim() }
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
        setActionReason("")
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

  function toggleRowSelection(id: string) {
    setSelectedIds((previous) => {
      const next = new Set(previous)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function togglePageSelection() {
    setSelectedIds((previous) => {
      const next = new Set(previous)
      if (allPageSelected) pageRowIds.forEach((id) => next.delete(id))
      else pageRowIds.forEach((id) => next.add(id))
      return next
    })
  }

  async function runBulkAction() {
    if (!resource || !bulkAction || selectedIds.size === 0) return
    setWorking(true)
    setMessage("")
    const ids = Array.from(selectedIds)
    let failed = 0
    try {
      for (const id of ids) {
        const response = await fetch(`/api/admin/finance/commercial/${resource}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: bulkAction, data: { id } }),
        })
        if (!response.ok) failed += 1
      }
      setMessage(failed === 0 ? `${ids.length} record${ids.length === 1 ? "" : "s"} updated.` : `${ids.length - failed} updated; ${failed} failed.`)
      setSelectedIds(new Set())
      setBulkAction("")
      await refreshList()
    } catch {
      setMessage("Bulk action failed")
    } finally {
      setWorking(false)
    }
  }

  function openAction(row: Row, actionName?: string) {
    setSelectedRow(row)
    setSelectedAction(actionName || (actions.length ? actions[0].name : ""))
    setActionData(JSON.stringify({ id: row.id }, null, 2))
    setActionReason("")
    setActionBusinessId(String(row.business_id || ""))
    setActionDueDate("")
    setActionOpen(true)
  }

  async function applyQuoteAction(row: Row, action: string) {
    if (action === "attach_business" || action === "convert") {
      openAction(row, action)
      return
    }
    const id = String(row.id || "")
    if (!id || !action) return
    setWorking(true)
    setMessage("")
    try {
      const res = await fetch(`/api/admin/finance/commercial/${resource}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, data: { id } }),
      })
      const data = (await res.json()) as ApiResponse
      setMessage(data.success ? `Quote action completed.` : data.error || "Quote action failed")
      if (data.success) refreshList()
    } catch {
      setMessage("Quote action failed")
    } finally {
      setWorking(false)
    }
  }

  function renderCell(row: Row, key: string) {
    const relation = (name: string): Row | null => {
      const value = row[name]
      if (!value || typeof value !== "object") return null
      return (Array.isArray(value) ? value[0] : value) as Row
    }
    if (key === "customer") {
      const business = relation("businesses")
      return <span className="font-medium">{String(business?.business_name || row.business_name || row.business_id || "Unnamed customer")}</span>
    }
    if (key === "partner") {
      const partner = relation("partners")
      return <span className="font-medium">{String(partner?.display_name || partner?.business_name || row.partner_id || "Unassigned partner")}</span>
    }
    if (key === "partner_lead") {
      const lead = relation("partner_leads")
      return <span>{String(lead?.business_name || row.partner_lead_id || "—")}</span>
    }
    if (key === "invoice") {
      const invoice = relation("invoices")
      return <span>{String(invoice?.invoice_number || row.invoice_id || "Unallocated")}</span>
    }
    if (key === "plan") {
      const plan = relation("plans")
      return <span>{String(plan?.name || row.plan_id || "No plan")}</span>
    }
    if (key === "subscription") {
      const subscription = relation("subscriptions")
      const subscriptionBusinesses = subscription?.businesses
      const subscriptionBusiness = subscriptionBusinesses && typeof subscriptionBusinesses === "object"
        ? (Array.isArray(subscriptionBusinesses) ? subscriptionBusinesses[0] : subscriptionBusinesses) as Row
        : null
      return <span>{String(subscriptionBusiness?.business_name || subscription?.id || row.subscription_id || "—")}</span>
    }
    const v = row[key]
    if (v === null || v === undefined) return <span className="text-muted-foreground">—</span>
    if (key === "id") return <span className="font-mono text-xs">{String(v)}</span>
    if (key === "quote_origin") {
      const partnerRequest = String(v) === "PARTNER_REQUEST"
      return <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${partnerRequest ? "bg-violet-50 text-violet-700" : "bg-slate-100 text-slate-700"}`}>{partnerRequest ? "Partner request" : "Direct quote"}</span>
    }
    if (typeof v === "boolean") return v ? "Yes" : "No"
    if (["status", "billing_type", "billing_interval", "pricing_type", "commission_basis", "applies_to", "payment_method"].includes(key)) return enumLabel(String(v))
    if (["amount", "total_amount", "subtotal", "discount_amount", "tax_amount", "balance_due", "base_price", "default_price", "commission_amount", "basis_amount"].includes(key)) {
      return formatMoneyIn(Number(v), typeof row.currency === "string" ? row.currency : "NGN")
    }
    if (["created_at", "updated_at", "issued_at", "paid_at", "issue_date", "due_date", "current_period_end", "renewal_date", "renewal_due_date", "valid_until"].includes(key)) {
      const date = new Date(String(v))
      return Number.isNaN(date.getTime()) ? String(v) : date.toLocaleDateString()
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
    if (f.optionSource === "partner_leads") {
      return partnerLeads.map((lead) => ({
        value: lead.id,
        label: `${lead.businessName} · ${lead.contactName}${lead.partnerName ? ` · ${lead.partnerName}` : lead.partnerCode ? ` · ${lead.partnerCode}` : ""}`,
      }))
    }
    if (f.optionSource) return referenceOptions[f.optionSource] || []
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
      if (f.optionSource) {
        return (
          <SearchableSelect
            value={value}
            options={opts}
            onChange={(nextValue) => f.name === "plan_id" && resource === "quotes"
              ? selectQuotePlan(nextValue)
              : f.name === "partner_lead_id" && resource === "quotes"
              ? selectPartnerLead(nextValue)
              : setFormValues((prev) => ({ ...prev, [f.name]: nextValue }))}
            placeholder={f.optionSource === "businesses" ? "Search customer business…" : `Search ${f.label.toLowerCase()}…`}
          />
        )
      }
      return (
        <select
          id={f.name}
          value={value}
          onChange={(e) => f.name === "plan_id" && resource === "quotes"
            ? selectQuotePlan(e.target.value)
            : f.name === "partner_lead_id" && resource === "quotes"
            ? selectPartnerLead(e.target.value)
            : setFormValues((prev) => ({ ...prev, [f.name]: e.target.value }))}
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

  function updateQuoteItem(index: number, patch: Partial<QuoteLine>) {
    setQuoteItems((prev) => prev.map((item, i) => i === index ? { ...item, ...patch } : item))
  }

  function pickQuoteCatalogItem(index: number, id: string) {
    const picked = quoteCatalog.find((item) => item.id === id)
    if (!picked) {
      updateQuoteItem(index, { reference_id: null, item_type: "CUSTOM" })
      return
    }
    updateQuoteItem(index, {
      reference_id: picked.id,
      item_type: picked.item_type,
      description: picked.description ? `${picked.name}\n${picked.description}` : picked.name,
      unit_price: picked.price,
    })
    // Keep the quote and its catalogue lines in one currency where possible.
    if (picked.currency) setFormValues((prev) => ({ ...prev, currency: picked.currency }))
  }

  function selectQuotePlan(planId: string) {
    setFormValues((prev) => ({ ...prev, plan_id: planId }))
    const plan = plans.find((item) => item.id === planId)
    if (!plan) return
    const planLine: QuoteLine = {
      item_type: "PLAN",
      reference_id: plan.id,
      description: plan.name,
      quantity: 1,
      unit_price: Number(plan.base_price) || 0,
      discount: 0,
      tax: 0,
      tax_rate: 0,
    }
    setQuoteItems((prev) => {
      const existingPlan = prev.findIndex((item) => item.item_type === "PLAN" && item.reference_id)
      if (existingPlan >= 0) return prev.map((item, index) => index === existingPlan ? planLine : item)
      const blank = prev.findIndex((item) => !item.description.trim())
      if (blank >= 0) return prev.map((item, index) => index === blank ? planLine : item)
      return [...prev, planLine]
    })
    if (plan.currency) setFormValues((prev) => ({ ...prev, currency: plan.currency }))
  }

  function applyQuoteTemplate(industry: string) {
    const template = resolveQuoteTemplate(industry || null)
    setQuoteTemplateSelection(industry)
    setFormValues((prev) => ({ ...prev, payment_terms: template.paymentTerms, notes_public: template.publicNotes }))
  }

  function selectPartnerLead(leadId: string) {
    setFormValues((prev) => ({ ...prev, partner_lead_id: leadId }))
    const lead = partnerLeads.find((item) => item.id === leadId)
    const industry = resolveIndustryName(lead?.industry || lead?.businessType || "")
    if (industry) applyQuoteTemplate(industry)
  }

  const selectedPartnerLead = selectedRow?.partner_leads && typeof selectedRow.partner_leads === "object"
    ? (Array.isArray(selectedRow.partner_leads) ? selectedRow.partner_leads[0] : selectedRow.partner_leads) as Row | null
    : null
  const convertingNeedsCustomerSetup = selectedAction === "convert" && Boolean(selectedRow && !selectedRow.business_id)

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
          <h2 className="mt-1 text-2xl font-bold tracking-tight">{partnerOnly ? "Partner Quotes" : TITLES[resource]}</h2>
          <p className="text-sm text-muted-foreground">{partnerOnly ? "Partner requests are normal Finance quotes with partner identity, review, send and conversion in one workspace." : `Manage ${TITLES[resource].toLowerCase()} via the unified commercial finance API.`}</p>
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
            <div className="rounded-lg border border-blue-200 bg-blue-50/70 p-4 text-sm text-blue-950">
              <p className="font-semibold">How subscriptions and entitlements relate</p>
              <p className="mt-1 text-xs leading-5">A subscription is the customer&apos;s billing agreement. A licence is the access entitlement issued from that subscription&apos;s plan. This ledger reconciles the entitlements currently issued, including waived ones; it is not a second sales pipeline.</p>
            </div>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Entitled businesses</CardTitle>
                </CardHeader>
                <CardContent><p className="text-2xl font-bold">{report.distinct_businesses}</p></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Entitled quantity</CardTitle>
                </CardHeader>
                <CardContent><p className="text-2xl font-bold">{report.total_quantity}</p></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Subscription-backed</CardTitle>
                </CardHeader>
                <CardContent><p className="text-2xl font-bold text-emerald-600">{report.billed_count}</p></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Waived by Finance</CardTitle>
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
                <CardTitle className="text-sm font-medium">Issued access entitlements</CardTitle>
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
                          <th className="px-3 py-2 font-medium">Access entitlement</th>
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
              {resource === "quotes" && (
                <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
                  <label htmlFor="quote-industry-template" className="text-sm font-medium">Apply industry template</label>
                  <select
                    id="quote-industry-template"
                    value={quoteTemplateSelection}
                    onChange={(e) => applyQuoteTemplate(e.target.value)}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Choose a template for public notes and payment terms…</option>
                    {quoteTemplateOptions().map((option) => option.value ? (
                      <option key={`${option.group}:${option.value}`} value={option.value}>{option.group} — {option.label}</option>
                    ) : null)}
                  </select>
                  <p className="text-xs text-muted-foreground">Selecting a partner lead applies its detected industry template automatically. You can change it here.</p>
                </div>
              )}
              {resource === "quotes" && (
                <div className="space-y-3 sm:col-span-2 lg:col-span-3 rounded-lg border border-border bg-muted/20 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium">Quote lines</p>
                      <p className="text-xs text-muted-foreground">Pick the plan, then add products, services and add-ons from the live catalogue.</p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setQuoteItems((prev) => [...prev, { item_type: "CUSTOM", reference_id: null, description: "", quantity: 1, unit_price: 0, discount: 0, tax: 0, tax_rate: 0 }])}
                    >
                      <Plus className="mr-1 h-3.5 w-3.5" /> Add line
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {quoteItems.map((item, index) => (
                      <div key={index} className="grid grid-cols-1 gap-2 rounded-md border border-border bg-background p-3 md:grid-cols-12 md:items-start">
                        <div className="md:col-span-5 space-y-1">
                          <label className="text-xs font-medium">Catalogue item</label>
                          <SearchableSelect
                            value={item.reference_id || ""}
                            options={quoteCatalog.map((catalogItem) => ({
                              value: catalogItem.id,
                              label: `${catalogItem.name} · ${enumLabel(catalogItem.item_type)} · ${formatMoneyIn(catalogItem.price, catalogItem.currency)}`,
                            }))}
                            onChange={(value) => pickQuoteCatalogItem(index, value)}
                            placeholder="Search catalogue item…"
                          />
                          <textarea
                            rows={2}
                            value={item.description}
                            placeholder="Line description"
                            onChange={(e) => updateQuoteItem(index, { description: e.target.value })}
                            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                          />
                        </div>
                        <div className="md:col-span-2 space-y-1">
                          <label className="text-xs font-medium">Quantity</label>
                          <input type="number" min="0.01" step="any" value={item.quantity} onChange={(e) => updateQuoteItem(index, { quantity: Number(e.target.value) || 0 })} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
                        </div>
                        <div className="md:col-span-2 space-y-1">
                          <label className="text-xs font-medium">Unit price</label>
                          <input type="number" min="0" step="any" value={item.unit_price} onChange={(e) => updateQuoteItem(index, { unit_price: Number(e.target.value) || 0 })} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
                        </div>
                        <div className="md:col-span-2 space-y-1">
                          <label className="text-xs font-medium">Discount</label>
                          <input type="number" min="0" step="any" value={item.discount} onChange={(e) => updateQuoteItem(index, { discount: Number(e.target.value) || 0 })} placeholder="Discount" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
                          <label className="text-xs font-medium">Tax</label>
                          <select
                            value={item.tax_rate == null ? "fixed" : String(item.tax_rate)}
                            onChange={(e) => {
                              const value = e.target.value
                              updateQuoteItem(index, value === "fixed" ? { tax_rate: null } : { tax_rate: Number(value), tax: 0 })
                            }}
                            className="w-full rounded-md border border-input bg-background px-2 py-2 text-sm"
                          >
                            <option value={0}>No tax</option>
                            {taxRates.map((taxRate) => <option key={taxRate.id} value={taxRate.rate}>{taxRate.name} ({taxRate.rate}%)</option>)}
                            {item.tax_rate != null && item.tax_rate !== 0 && !taxRates.some((taxRate) => taxRate.rate === item.tax_rate) && (
                              <option value={item.tax_rate}>{item.tax_rate}% (saved)</option>
                            )}
                            <option value="fixed">Fixed amount</option>
                          </select>
                          {item.tax_rate == null ? (
                            <input type="number" min="0" step="any" value={item.tax} onChange={(e) => updateQuoteItem(index, { tax: Number(e.target.value) || 0 })} placeholder="Tax amount" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
                          ) : (
                            <p className="text-[10px] text-muted-foreground text-right">Tax: {formatMoneyIn(quoteTotals.items[index]?.tax || 0, formValues.currency || "NGN")}</p>
                          )}
                        </div>
                        <div className="md:col-span-1 flex justify-end">
                          <Button type="button" variant="ghost" size="sm" disabled={quoteItems.length === 1} onClick={() => setQuoteItems((prev) => prev.filter((_, i) => i !== index))}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="ml-auto max-w-xs space-y-1 border-t border-border pt-3 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatMoneyIn(quoteTotals.subtotal, formValues.currency || "NGN")}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span>{formatMoneyIn(quoteTotals.discountAmount, formValues.currency || "NGN")}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">Tax</span><span>{formatMoneyIn(quoteTotals.taxAmount, formValues.currency || "NGN")}</span></div>
                    <div className="flex justify-between border-t border-border pt-2 font-semibold"><span>Total</span><span>{formatMoneyIn(quoteTotals.total, formValues.currency || "NGN")}</span></div>
                  </div>
                </div>
              )}
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
          <CardTitle className="text-sm font-medium">{TITLES[resource]} records</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-col gap-3 rounded-lg border border-border bg-muted/20 p-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={`Search ${TITLES[resource].toLowerCase()} by name, status, reference or customer…`}
                className="w-full rounded-md border border-input bg-background py-2 pl-9 pr-3 text-sm"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>{filteredRows.length} matching · page {page} of {pageCount}</span>
              <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))} className="rounded-md border border-input bg-background px-2 py-2 text-xs text-foreground">
                {[25, 50, 100].map((size) => <option key={size} value={size}>{size} per page</option>)}
              </select>
            </div>
          </div>

          {selectedIds.size > 0 && (
            <div className="mb-4 flex flex-wrap items-center gap-2 rounded-md border border-blue-200 bg-blue-50/70 p-3 text-sm text-blue-950">
              <span className="font-medium">{selectedIds.size} selected</span>
              {bulkOptions.length > 0 ? (
                <>
                  <select value={bulkAction} onChange={(event) => setBulkAction(event.target.value)} className="rounded-md border border-blue-200 bg-background px-2 py-1.5 text-xs">
                    <option value="">Choose bulk action…</option>
                    {bulkOptions.map((action) => <option key={action} value={action}>{enumLabel(action)}</option>)}
                  </select>
                  <Button size="sm" disabled={!bulkAction || working} onClick={() => void runBulkAction()}>Apply</Button>
                </>
              ) : <span className="text-xs text-blue-800">Select a record action below to work on one record at a time.</span>}
              <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>Clear</Button>
            </div>
          )}

          {filteredRows.length === 0 && !loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{partnerOnly ? "No partner-backed quotes found." : search ? "No records match your search." : "No records found."}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="w-10 px-3 py-2">
                      <input type="checkbox" aria-label="Select all records on this page" checked={allPageSelected} onChange={togglePageSelection} className="h-4 w-4 rounded border-input" />
                    </th>
                    {columns.map((c) => (
                      <th key={c} className="whitespace-nowrap px-3 py-2 font-medium">
                        {COLUMN_LABELS[c] || enumLabel(c)}
                      </th>
                    ))}
                    {actions.length > 0 && <th className="px-3 py-2 font-medium">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {pagedRows.map((row) => (
                    <tr key={rowKey(row)} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="px-3 py-2"><input type="checkbox" aria-label={`Select ${String(row.quote_number || row.invoice_number || row.payment_reference || row.id || "record")}`} checked={selectedIds.has(rowKey(row))} onChange={() => toggleRowSelection(rowKey(row))} className="h-4 w-4 rounded border-input" /></td>
                      {columns.map((c) => (
                        <td key={c} className="max-w-[260px] whitespace-nowrap px-3 py-2">
                          {renderCell(row, c)}
                        </td>
                      ))}
                      {actions.length > 0 && (
                        <td className="px-3 py-2">
                          {resource === "quotes" ? (
                            <div className="flex flex-wrap items-center gap-2">
                              <select
                                aria-label={`Action for quote ${String(row.quote_number || row.id)}`}
                                defaultValue=""
                                disabled={working || quoteActionOptions(row).length === 0}
                                onChange={(e) => {
                                  const action = e.target.value
                                  e.currentTarget.value = ""
                                  if (action) void applyQuoteAction(row, action)
                                }}
                                className="rounded-md border border-input bg-background px-2 py-1.5 text-xs"
                              >
                                <option value="">Choose action…</option>
                                {quoteActionOptions(row).map((option) => <option key={option.name} value={option.name}>{option.label}</option>)}
                              </select>
                              <Button variant="outline" size="sm" onClick={() => setQuotePreview(row)}>Open quote</Button>
                              <Button variant="ghost" size="sm" onClick={() => setQuotePreview(row)}>Preview</Button>
                            </div>
                          ) : (
                            <select
                              aria-label={`Actions for ${TITLES[resource]}`}
                              defaultValue=""
                              onChange={(e) => {
                                const action = e.target.value
                                e.currentTarget.value = ""
                                if (action) openAction(row, action)
                              }}
                              className="rounded-md border border-input bg-background px-2 py-1.5 text-xs"
                            >
                              <option value="">Actions…</option>
                              {actions.map((action) => <option key={action.name} value={action.name}>{action.label}</option>)}
                            </select>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {filteredRows.length > 0 && (
            <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
              <span>Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filteredRows.length)} of {filteredRows.length}</span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}><ChevronLeft className="h-4 w-4" /> Previous</Button>
                <Button variant="outline" size="sm" disabled={page >= pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))}>Next <ChevronRight className="h-4 w-4" /></Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
        </>
      )}

      {resource === "quotes" && (
        <Dialog open={Boolean(quotePreview)} onClose={() => setQuotePreview(null)} title={quotePreview ? `Preview ${String(quotePreview.quote_number || "quote")}` : "Quote preview"}>
          {quotePreview && (() => {
            const currency = String(quotePreview.currency || "NGN")
            const items = Array.isArray(quotePreview.quote_items) ? quotePreview.quote_items as Row[] : []
            const partnerLead = quotePreview.partner_leads as Row | null
            return (
              <div className="space-y-4 text-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold">{String(quotePreview.quote_number || "Quote")}</p>
                    <p className="text-muted-foreground">{String(quotePreview.title || partnerLead?.business_name || quotePreview.business_id || "Commercial quote")}</p>
                  </div>
                  <span className="rounded-full bg-blue-50 px-2 py-1 text-xs text-blue-700">{String(quotePreview.status || "DRAFT")}</span>
                </div>
                {String(quotePreview.status || "").toUpperCase() === "ACCEPTED" && (
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    {quotePreview.business_id
                      ? "Next step: convert this accepted quote to an invoice from the quote actions menu."
                      : quotePreview.partner_lead_id
                      ? "Next step: choose Create business & convert to invoice. The end-customer business will be created from the partner lead first."
                      : "Next step: attach the customer business from the quote actions menu before converting it to an invoice."}
                  </div>
                )}
                <div className="overflow-x-auto rounded-md border border-border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50"><tr><th className="px-3 py-2 text-left">Description</th><th className="px-3 py-2 text-right">Qty</th><th className="px-3 py-2 text-right">Unit</th><th className="px-3 py-2 text-right">Tax</th><th className="px-3 py-2 text-right">Total</th></tr></thead>
                    <tbody className="divide-y">
                      {items.map((item) => <tr key={String(item.id)}><td className="whitespace-pre-line px-3 py-2">{String(item.description || "—")}</td><td className="px-3 py-2 text-right">{String(item.quantity ?? 0)}</td><td className="px-3 py-2 text-right">{formatMoneyIn(Number(item.unit_price), currency)}</td><td className="px-3 py-2 text-right">{formatMoneyIn(Number(item.tax), currency)}</td><td className="px-3 py-2 text-right font-medium">{formatMoneyIn(Number(item.line_total), currency)}</td></tr>)}
                    </tbody>
                  </table>
                </div>
                <div className="ml-auto max-w-xs space-y-1">
                  <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{formatMoneyIn(Number(quotePreview.subtotal), currency)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Discount</span><span>{formatMoneyIn(Number(quotePreview.discount_amount), currency)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Tax</span><span>{formatMoneyIn(Number(quotePreview.tax_amount), currency)}</span></div>
                  <div className="flex justify-between border-t border-border pt-2 text-base font-semibold"><span>Total</span><span>{formatMoneyIn(Number(quotePreview.total_amount), currency)}</span></div>
                </div>
                {companyAccountNumber && <div className="rounded-md bg-muted/40 p-3"><p className="mb-1 text-xs uppercase tracking-wider text-muted-foreground">Bank details</p><p className="whitespace-pre-line font-medium">{companyAccountNumber}</p></div>}
                {!!quotePreview.payment_terms && <div className="rounded-md bg-muted/40 p-3 whitespace-pre-line"><p className="mb-1 font-medium">Payment terms</p>{String(quotePreview.payment_terms)}</div>}
                {!!quotePreview.notes_public && <div className="rounded-md bg-muted/40 p-3 whitespace-pre-line"><p className="mb-1 font-medium">Notes</p>{String(quotePreview.notes_public)}</div>}
              </div>
            )
          })()}
        </Dialog>
      )}

      <Dialog open={actionOpen} onClose={() => setActionOpen(false)} title={`Action on ${TITLES[resource]}`}>
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

          {selectedAction === "attach_business" ? (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Customer business</label>
              <SearchableSelect
                value={actionBusinessId}
                options={businesses.map((business) => ({ value: business.id, label: `${business.businessName} · ${business.status || "ACTIVE"}` }))}
                onChange={setActionBusinessId}
                placeholder="Search customer business…"
              />
              <p className="text-xs text-muted-foreground">This links the accepted partner quote to the customer record so it can be converted into an invoice.</p>
            </div>
          ) : selectedAction === "create_business" ? (
            <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50/60 p-3">
              <p className="text-sm font-medium text-blue-950">Create the end-customer business</p>
              <p className="text-xs text-blue-900">This uses the partner lead details below. The partner stays attached for attribution and commission tracking; the partner organisation is not created as the customer.</p>
              <div className="grid gap-2 text-sm sm:grid-cols-2">
                <div><span className="text-muted-foreground">Business</span><p className="font-medium">{String(selectedPartnerLead?.business_name || "—")}</p></div>
                <div><span className="text-muted-foreground">Contact</span><p className="font-medium">{String(selectedPartnerLead?.contact_name || "—")}</p></div>
                <div><span className="text-muted-foreground">Email</span><p className="font-medium">{String(selectedPartnerLead?.email || "—")}</p></div>
                <div><span className="text-muted-foreground">Phone</span><p className="font-medium">{String(selectedPartnerLead?.phone || "—")}</p></div>
                <div><span className="text-muted-foreground">Industry</span><p className="font-medium">{String(selectedPartnerLead?.industry || selectedPartnerLead?.business_type || "—")}</p></div>
                <div><span className="text-muted-foreground">Location</span><p className="font-medium">{[selectedPartnerLead?.city, selectedPartnerLead?.state, selectedPartnerLead?.country].filter(Boolean).join(", ") || "—"}</p></div>
              </div>
            </div>
          ) : selectedAction === "convert" ? (
            <div className="space-y-3">
              {convertingNeedsCustomerSetup && (
                <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-3 text-sm text-blue-950">
                  <p className="font-medium">Customer setup is part of this conversion</p>
                  {selectedPartnerLead ? (
                    <p className="mt-1">A business will be created for <strong>{String(selectedPartnerLead.business_name || "this partner lead")}</strong> from the submitted lead details, then this quote will immediately become the next normal system invoice.</p>
                  ) : (
                    <p className="mt-1">This quote has no partner lead. Attach an existing customer business first.</p>
                  )}
                </div>
              )}
              <label className="text-sm font-medium">Invoice due date</label>
              <input type="date" value={actionDueDate} onChange={(e) => setActionDueDate(e.target.value)} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
              <p className="text-xs text-muted-foreground">The accepted quote will become a draft invoice using its existing lines, tax, payment terms and total. Invoice numbering uses the same system-wide counter as every other invoice.</p>
            </div>
          ) : selectedAction === "reject" ? (
            <div className="space-y-3 rounded-lg border border-red-200 bg-red-50/60 p-3">
              <p className="text-sm text-red-900">Rejecting marks this pending proof as failed. The invoice remains unpaid and the proof remains in the audit trail.</p>
              <div className="space-y-1.5">
                <label className="text-sm font-medium" htmlFor="payment-rejection-reason">Reason *</label>
                <textarea
                  id="payment-rejection-reason"
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  rows={3}
                  placeholder="e.g. Funds not found in the receiving account"
                />
              </div>
            </div>
          ) : selectedAction === "waive" ? (
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
              {working && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              {selectedAction === "convert" && convertingNeedsCustomerSetup
                ? "Create business & convert"
                : selectedAction === "create_business" ? "Create customer business" : "Confirm action"}
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
