/* ───────────────────────────  Internal Quick Estimator  ──────────────────────
 * Sales-team estimator. Given a prospect's scale (branches, users, products,
 * variations, services, media), it picks the lowest-cost Retail Cloud plan +
 * capacity add-on combination and returns an itemised breakdown that can be
 * dropped straight into a quotation.
 *
 * This is the *internal* counterpart to the public /estimate calculator:
 *   • It uses the live pricing catalogue (admin overrides included).
 *   • It surfaces the recommended plan AND every add-on line with quantities.
 *   • It returns ready-to-use quotation line items.
 *
 * The commercial rule matches the public estimator: quote the lowest valid
 * plan/add-on combination; on a tie prefer the higher-capacity plan.
 */

import { ADDONS, resolveCloudPlans, type ResolvedCloudPlan } from "./pricing-plans"

export interface EstimatorRequirement {
  branches: number
  users: number
  products: number
  variations?: number
  services?: number
  mediaGb?: number
}

export interface EstimatorAddonLine {
  id: string
  label: string
  detail: string
  quantity: number
  unitPrice: number
  amount: number
}

export interface EstimatorQuoteItem {
  description: string
  quantity: number
  unitPrice: number
}

export interface EstimatorOutput {
  planId: string
  planName: string
  planAnnual: number
  planLimits: ResolvedCloudPlan["limits"]
  addons: EstimatorAddonLine[]
  planAmount: number
  addonsAmount: number
  total: number
  summary: string
  items: EstimatorQuoteItem[]
  /** Notes worth showing the sales person (e.g. requirement exceeds Enterprise). */
  warnings: string[]
}

/* ─── Add-on unit prices (from the annual add-on catalogue) ─── */
function addonUnitPrice(id: string): number {
  return ADDONS.find((a) => a.id === id)?.annualPrice ?? 0
}

const BRANCH_UNIT = addonUnitPrice("branch")
const USER_PACK_UNIT = addonUnitPrice("users") // per 5 users
const PRODUCT_PACK_UNIT = addonUnitPrice("products") // per 500 products
const VARIATION_PACK_UNIT = addonUnitPrice("variations") // per 10,000 variations
const SERVICE_PACK_UNIT = addonUnitPrice("services") // per 100 services
const MEDIA_PACK_UNIT = addonUnitPrice("media-5gb") // per 5 GB

/** Pack sizes for capacity add-ons. */
export const ESTIMATOR_PACKS = {
  users: 5,
  products: 500,
  variations: 10000,
  services: 100,
  mediaGb: 5,
} as const

function normalize(req: EstimatorRequirement): Required<EstimatorRequirement> {
  return {
    branches: Math.max(1, Math.floor(Number(req.branches) || 1)),
    users: Math.max(0, Math.floor(Number(req.users) || 0)),
    products: Math.max(0, Math.floor(Number(req.products) || 0)),
    variations: Math.max(0, Math.floor(Number(req.variations) || 0)),
    services: Math.max(0, Math.floor(Number(req.services) || 0)),
    mediaGb: Math.max(0, Math.floor(Number(req.mediaGb) || 0)),
  }
}

interface Candidate {
  plan: ResolvedCloudPlan
  addons: EstimatorAddonLine[]
  addonsAmount: number
  total: number
}

function priceCandidate(plan: ResolvedCloudPlan, req: Required<EstimatorRequirement>): Candidate {
  const l = plan.limits
  const addons: EstimatorAddonLine[] = []

  const push = (id: string, label: string, detail: string, quantity: number, unitPrice: number) => {
    if (quantity > 0) addons.push({ id, label, detail, quantity, unitPrice, amount: quantity * unitPrice })
  }

  push("branch", "Extra Cloud branch", "per branch, per year", Math.max(0, req.branches - l.branches), BRANCH_UNIT)
  push(
    "users",
    "Five users",
    "per 5 users, per year",
    Math.ceil(Math.max(0, req.users - l.namedUsers) / ESTIMATOR_PACKS.users),
    USER_PACK_UNIT
  )
  push(
    "products",
    "500 main products",
    "per 500 products, per year",
    Math.ceil(Math.max(0, req.products - l.mainProducts) / ESTIMATOR_PACKS.products),
    PRODUCT_PACK_UNIT
  )
  push(
    "variations",
    "10,000 product variations",
    "per 10,000 variations, per year",
    Math.ceil(Math.max(0, req.variations - l.productVariations) / ESTIMATOR_PACKS.variations),
    VARIATION_PACK_UNIT
  )
  push(
    "services",
    "100 services",
    "per 100 services, per year",
    Math.ceil(Math.max(0, req.services - l.services) / ESTIMATOR_PACKS.services),
    SERVICE_PACK_UNIT
  )
  push(
    "media-5gb",
    "Additional 5 GB media",
    "per 5 GB, per year",
    Math.ceil(Math.max(0, req.mediaGb - l.mediaGb) / ESTIMATOR_PACKS.mediaGb),
    MEDIA_PACK_UNIT
  )

  const addonsAmount = addons.reduce((sum, a) => sum + a.amount, 0)
  return { plan, addons, addonsAmount, total: plan.annualPrice + addonsAmount }
}

/** Pick the lowest-cost plan + add-on combination (tie → higher branch capacity). */
export function buildEstimatorOutput(
  requirement: EstimatorRequirement,
  plans: ResolvedCloudPlan[] = resolveCloudPlans(null)
): EstimatorOutput {
  const req = normalize(requirement)
  const candidates = plans.map((plan) => priceCandidate(plan, req))

  let best = candidates[0]
  for (const c of candidates) {
    if (c.total < best.total) best = c
    else if (c.total === best.total && c.plan.limits.branches > best.plan.limits.branches) best = c
  }

  const warnings: string[] = []
  if (req.branches > best.plan.limits.branches + 15) {
    warnings.push("Branch count is well beyond the add-on banding — consider a tailored multi-branch quote.")
  }
  if (best.addons.length > 0) {
    warnings.push(
      `${best.plan.displayName} plus capacity add-ons is the lowest-cost fit for this size.`
    )
  }

  const items: EstimatorQuoteItem[] = [
    {
      description: `MartPoint Retail Cloud — ${best.plan.displayName} (annual licence)`,
      quantity: 1,
      unitPrice: best.plan.annualPrice,
    },
    ...best.addons.map((a) => ({
      description: addonItemDescription(a),
      quantity: a.quantity,
      unitPrice: a.unitPrice,
    })),
  ]

  return {
    planId: best.plan.id,
    planName: best.plan.displayName,
    planAnnual: best.plan.annualPrice,
    planLimits: best.plan.limits,
    addons: best.addons,
    planAmount: best.plan.annualPrice,
    addonsAmount: best.addonsAmount,
    total: best.total,
    summary:
      best.addons.length === 0
        ? `${best.plan.displayName} covers this requirement within its included limits.`
        : `${best.plan.displayName} + ${best.addons.length} capacity add-on${best.addons.length > 1 ? "s" : ""}.`,
    items,
    warnings,
  }
}

/* ─── Catalogue entries (for the "pick from catalogue" dropdown) ─── */
export interface EstimatorCatalogItem {
  id: string
  name: string
  description: string
  price: number
  type: "Plan" | "Add-on"
}

export function estimatorCatalogItems(
  plans: ResolvedCloudPlan[] = resolveCloudPlans(null)
): EstimatorCatalogItem[] {
  const planItems: EstimatorCatalogItem[] = plans.map((p) => ({
    id: `cloud-plan-${p.id}`,
    name: `MartPoint Retail Cloud — ${p.displayName}`,
    description: `${p.description} Includes ${p.limits.branches} branch${p.limits.branches === 1 ? "" : "es"}, ${p.limits.namedUsers} users, ${p.limits.mainProducts.toLocaleString()} main products.`,
    price: p.annualPrice,
    type: "Plan",
  }))

  const addonItems: EstimatorCatalogItem[] = ADDONS.map((a) => ({
    id: `addon-${a.id}`,
    name: a.label,
    description: a.detail,
    price: a.annualPrice,
    type: "Add-on",
  }))

  return [...planItems, ...addonItems]
}

/** Line-item description for an add-on, matching the estimator output format. */
export function addonItemDescription(addon: EstimatorAddonLine): string {
  return `${addon.label} — ${addon.detail}`
}
