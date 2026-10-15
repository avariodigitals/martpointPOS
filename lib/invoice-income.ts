import { supabase, isSupabaseConfigured } from "./supabase"

/* ─────────────────────────────────────────────────────────────────────────────
   INVOICE INCOME CLASSIFICATION
   One place that decides which income category every invoice line posts to,
   so finance_transactions and the journal never disagree (and never lump a
   mixed licence + service + hardware invoice into one category).
   ───────────────────────────────────────────────────────────────────────────── */

const toK = (n: number | string | null | undefined): number => Math.round((Number(n) || 0) * 100)
const fromK = (k: number): number => k / 100

export type InvoiceIncomeLine = {
  item_type: string
  reference_id?: string | null
  description: string
  quantity: number
  unit_price: number
  discount: number
  tax: number
  line_total: number
}

export const SERVICE_INCOME_CATEGORY: Record<string, string> = {
  implementation: "Implementation Services",
  training: "Training Revenue",
  consulting: "Consulting Revenue",
  support: "Support Contracts",
  "custom-development": "Custom Development",
  logistics: "Logistics & Delivery",
  other: "Other Income",
}

/** Stable display/report order for income categories. */
export const INCOME_CATEGORY_ORDER = [
  "Subscription Revenue",
  "One-Time License",
  "Add-On Revenue",
  "Product Sales",
  "Implementation Services",
  "Training Revenue",
  "Consulting Revenue",
  "Support Contracts",
  "Custom Development",
  "Logistics & Delivery",
  "White-Label Revenue",
  "Other Income",
]

/** Pure classification: one line + its referenced catalogue context → category. */
export function incomeCategoryForLine(
  line: Pick<InvoiceIncomeLine, "item_type">,
  planBillingType?: string | null,
  serviceCategory?: string | null,
): string {
  switch (line.item_type) {
    case "PLAN":
      if (!planBillingType) return "Other Income"
      return planBillingType === "RECURRING" ? "Subscription Revenue" : "One-Time License"
    case "ADDON":
      return "Add-On Revenue"
    case "PRODUCT":
      return "Product Sales"
    case "SERVICE":
      return SERVICE_INCOME_CATEGORY[serviceCategory || "other"] || "Other Income"
    default:
      return "Other Income"
  }
}

export type InvoiceIncomeBucket = {
  category: string
  /** Gross line totals (tax included). */
  amount: number
  /** Sum of line tax. */
  tax: number
  /** True when a recurring PLAN line feeds this bucket. */
  recurring: boolean
  frequency: "one-time" | "monthly" | "quarterly" | "yearly"
  descriptions: string[]
}

function frequencyForInterval(interval?: string | null): InvoiceIncomeBucket["frequency"] {
  if (interval === "MONTHLY") return "monthly"
  if (interval === "QUARTERLY") return "quarterly"
  if (interval === "ANNUAL") return "yearly"
  return "one-time"
}

/**
 * Group invoice lines into per-category income buckets. Resolves PLAN
 * billing_type and SERVICE category from the catalogue (one query each).
 */
export async function buildInvoiceIncomeBuckets(lines: InvoiceIncomeLine[]): Promise<InvoiceIncomeBucket[]> {
  const planBilling = new Map<string, { billing_type: string; billing_interval: string }>()
  const serviceCategory = new Map<string, string>()

  if (isSupabaseConfigured()) {
    const planIds = [...new Set(lines.filter((l) => l.item_type === "PLAN" && l.reference_id).map((l) => l.reference_id as string))]
    const serviceIds = [...new Set(lines.filter((l) => l.item_type === "SERVICE" && l.reference_id).map((l) => l.reference_id as string))]

    if (planIds.length > 0) {
      const { data } = await supabase.from("plans").select("id, billing_type, billing_interval").in("id", planIds)
      for (const p of (data as { id: string; billing_type: string; billing_interval: string }[]) || []) {
        planBilling.set(p.id, { billing_type: p.billing_type, billing_interval: p.billing_interval })
      }
    }
    if (serviceIds.length > 0) {
      const { data } = await supabase.from("services").select("id, category").in("id", serviceIds)
      for (const s of (data as { id: string; category?: string | null }[]) || []) {
        serviceCategory.set(s.id, s.category || "other")
      }
    }
  }

  type Agg = { grossK: number; taxK: number; recurring: boolean; frequency: InvoiceIncomeBucket["frequency"]; descriptions: string[] }
  const byCategory = new Map<string, Agg>()

  for (const line of lines) {
    const plan = line.item_type === "PLAN" && line.reference_id ? planBilling.get(line.reference_id) : undefined
    const category = incomeCategoryForLine(line, plan?.billing_type, line.item_type === "SERVICE" && line.reference_id ? serviceCategory.get(line.reference_id) : undefined)

    const grossK = toK(line.line_total)
    const taxK = toK(line.tax || 0)
    const recurringLine = line.item_type === "PLAN" && plan?.billing_type === "RECURRING"

    const agg = byCategory.get(category) || { grossK: 0, taxK: 0, recurring: false, frequency: "one-time" as const, descriptions: [] }
    agg.grossK += grossK
    agg.taxK += taxK
    if (recurringLine) {
      agg.recurring = true
      agg.frequency = frequencyForInterval(plan?.billing_interval)
    }
    if (line.description) agg.descriptions.push(line.description)
    byCategory.set(category, agg)
  }

  const buckets: InvoiceIncomeBucket[] = []
  for (const [category, agg] of byCategory) {
    if (agg.grossK <= 0 && agg.taxK <= 0) continue
    buckets.push({
      category,
      amount: fromK(agg.grossK),
      tax: fromK(agg.taxK),
      recurring: agg.recurring,
      frequency: agg.frequency,
      descriptions: agg.descriptions,
    })
  }
  buckets.sort((a, b) => INCOME_CATEGORY_ORDER.indexOf(a.category) - INCOME_CATEGORY_ORDER.indexOf(b.category))
  return buckets
}
