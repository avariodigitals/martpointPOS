/* ───────────────────────────  Estimate Calculator  ───────────────────────────
 * Public cost estimator for MartPoint Retail. A short questionnaire captures
 * the core facts about a business, then a recommendation engine maps those
 * facts onto the Retail Cloud plan catalogue and returns an estimated cost
 * range.
 *
 * Plan tiers (Basic / Standard / Premium / Enterprise Retail) and prices mirror
 * the approved Retail licence matrix in lib/pricing-plans.ts (baseline: Pricing
 * & Quotation Playbook v2.1). Admin-configured settings can override display
 * prices so the estimator never drifts from the /pricing page.
 *
 * Plan selection follows the commercial rule: quote the lowest valid
 * plan/add-on combination; when that reaches or exceeds the next suitable
 * plan's price, recommend the higher plan.
 *
 * The internal tier label is computed for the sales team (used in the
 * lead/email) but is NOT surfaced to the visitor — the public UI only shows the
 * plan name, an estimated range, and a few high-level inclusions.
 */

import {
  BRANCH_ADDON_ANNUAL,
  CLOUD_PLANS,
  PRODUCT_PACK_ADDON_ANNUAL,
  USER_PACK_ADDON_ANNUAL,
  formatNairaAmount,
  resolveCloudPlans,
} from "./pricing-plans"

/* ─── Public plan tiers (licence limits from the retail catalogue) ─── */
export interface PlanTierLimits {
  tier: "Basic" | "Standard" | "Premium" | "Enterprise"
  branchLimit: number
  userLimit: number
  productLimit: number
  onlineProductLimit: number
  serviceLimit: number
  mediaStorageMb: number
  storefrontLimit: number
  customDomainLimit: number
}

export const PLAN_TIERS: PlanTierLimits[] = [
  { tier: "Basic", branchLimit: 1, userLimit: 5, productLimit: 500, onlineProductLimit: 500, serviceLimit: 100, mediaStorageMb: 2048, storefrontLimit: 1, customDomainLimit: 1 },
  { tier: "Standard", branchLimit: 3, userLimit: 10, productLimit: 2000, onlineProductLimit: 2000, serviceLimit: 300, mediaStorageMb: 5120, storefrontLimit: 1, customDomainLimit: 1 },
  { tier: "Premium", branchLimit: 5, userLimit: 25, productLimit: 5000, onlineProductLimit: 5000, serviceLimit: 500, mediaStorageMb: 10240, storefrontLimit: 1, customDomainLimit: 1 },
  { tier: "Enterprise", branchLimit: 10, userLimit: 50, productLimit: 10000, onlineProductLimit: 20000, serviceLimit: 1000, mediaStorageMb: 20480, storefrontLimit: 1, customDomainLimit: 1 },
]

/* ─── Normalised numeric pricing (built from admin settings on the server) ─── */
export interface CloudPlanPriceInput {
  tier: PlanTierLimits["tier"]
  planId: string
  name: string
  annual: number
  limits: PlanTierLimits
}

export interface EstimatePricing {
  cloudPlans: CloudPlanPriceInput[]
  branchAddonAnnual: number
  userPackAnnual: number
  productPackAnnual: number
}

/* ─── Questionnaire answers ─── */
export interface EstimateAnswers {
  businessName: string
  businessType: string
  country: string
  branches: string
  staffSize: string
  productCount: string
  productOrService: string
  onlineStore: string
  hardwareAvailable: string
  receiptHardware: string
  dataMigration: string
  offlineOperation: string
  /** Whether the visitor also needs ERP functions (finance, HR/payroll,
   *  manufacturing). ERP is always scoped and quoted — no public ERP
   *  pricing is ever shown. */
  erpInterest: string
  /** Legacy field — retained for stored leads captured before the estimator
   *  became Retail-only. No longer asked in the questionnaire. */
  erpModules?: string
  trainingPreference: string
}

export interface EstimateContact {
  fullName: string
  email: string
  phone: string
  notes?: string
}

export interface EstimateSubmission extends EstimateAnswers, EstimateContact {
  partnerCode?: string
}

/* ─── Recommendation output ─── */
export interface Recommendation {
  line: "retail" | "erp"
  planName: string
  /** Internal licence tier — for the sales team only, not shown to the visitor. */
  internalTier: PlanTierLimits["tier"]
  rangeLow: number | null
  rangeHigh: number | null
  period: string
  inclusions: string[]
  rationale: string
}

export interface EstimateResult {
  retail: Recommendation
  /** Present when the visitor indicated ERP interest. Always quote-only —
   *  ERP pricing is not published. */
  erp?: Recommendation
}

/* ─── Stored estimate (persisted on the lead record for admin review) ─── */
export interface StoredEstimateLeg {
  planName: string
  range: string
  tier: PlanTierLimits["tier"]
  inclusions: string[]
  rationale: string
}

export interface StoredEstimate {
  retail: StoredEstimateLeg
  /** Present when the visitor indicated ERP interest — quote-only. */
  erp?: StoredEstimateLeg
}

export function toStoredEstimate(result: EstimateResult): StoredEstimate {
  const stored: StoredEstimate = {
    retail: {
      planName: result.retail.planName,
      range: formatRange(result.retail),
      tier: result.retail.internalTier,
      inclusions: result.retail.inclusions,
      rationale: result.retail.rationale,
    },
  }
  if (result.erp) {
    stored.erp = {
      planName: result.erp.planName,
      range: formatRange(result.erp),
      tier: result.erp.internalTier,
      inclusions: result.erp.inclusions,
      rationale: result.erp.rationale,
    }
  }
  return stored
}

/* ─── Option metadata (labels + values) shared by the UI ─── */
export const BRANCH_OPTIONS = [
  { value: "1", label: "1 branch" },
  { value: "2-3", label: "2–3 branches" },
  { value: "4-6", label: "4–6 branches" },
  { value: "7-10", label: "7–10 branches" },
  { value: "10+", label: "10+ branches" },
]

export const STAFF_OPTIONS = [
  { value: "1-5", label: "1–5 staff" },
  { value: "6-15", label: "6–15 staff" },
  { value: "16-30", label: "16–30 staff" },
  { value: "31-50", label: "31–50 staff" },
  { value: "50+", label: "50+ staff" },
]

export const PRODUCT_COUNT_OPTIONS = [
  { value: "up-to-500", label: "Up to 500" },
  { value: "500-2000", label: "500–2,000" },
  { value: "2000-5000", label: "2,000–5,000" },
  { value: "5000+", label: "5,000+" },
]

export const PRODUCT_SERVICE_OPTIONS = [
  { value: "product", label: "Products" },
  { value: "service", label: "Services" },
  { value: "both", label: "Both" },
]

export const YES_NO_MAYBE = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "maybe", label: "Maybe" },
]

export const HARDWARE_OPTIONS = [
  { value: "yes", label: "Yes — fully equipped" },
  { value: "partially", label: "Partially" },
  { value: "no", label: "No — need hardware" },
]

export const TRAINING_OPTIONS = [
  { value: "remote", label: "Remote" },
  { value: "onsite", label: "Onsite" },
  { value: "both", label: "Both" },
]

/* ─── Helpers ─── */

/** Extra branches (beyond the included 1) for each branch band, as [min, max]. */
const BRANCH_EXTRA: Record<string, [number, number]> = {
  "1": [0, 0],
  "2-3": [1, 2],
  "4-6": [3, 5],
  "7-10": [6, 9],
  "10+": [9, 15],
}

/** Parse a Naira price string like "₦99,999 / Year" or "₦100,000" into a number. */
export function parseNaira(value: string | number | undefined | null): number | null {
  if (typeof value === "number") return value
  if (!value) return null
  const match = String(value).match(/[\d,]+/)
  if (!match) return null
  const n = Number(match[0].replace(/,/g, ""))
  return Number.isFinite(n) ? n : null
}

/** Format a number as Naira, e.g. 149998 -> "₦149,998". */
export function formatNaira(n: number): string {
  return formatNairaAmount(n)
}

/** Resolve the highest licence tier that satisfies branches, users and products. */
export function resolveTier(branches: number, users: number, products: number): PlanTierLimits["tier"] {
  for (const t of PLAN_TIERS) {
    if (branches <= t.branchLimit && users <= t.userLimit && products <= t.productLimit) {
      return t.tier
    }
  }
  // Nothing fits cleanly → Enterprise
  return "Enterprise"
}

function branchCountBounds(value: string): [number, number] {
  return BRANCH_EXTRA[value] ?? [0, 0]
}

function staffBounds(value: string): [number, number] {
  switch (value) {
    case "1-5": return [1, 5]
    case "6-15": return [6, 15]
    case "16-30": return [16, 30]
    case "31-50": return [31, 50]
    case "50+": return [51, 200]
    default: return [1, 5]
  }
}

function productBounds(value: string): [number, number] {
  switch (value) {
    case "up-to-500": return [1, 500]
    case "500-2000": return [501, 2000]
    case "2000-5000": return [2001, 5000]
    case "5000+": return [5001, 20000]
    default: return [1, 500]
  }
}

/* ─── Lowest valid plan/add-on combination ───
 * For each plan, the mid-year add-on cost of any requirement that exceeds its
 * included limits is added to the annual licence. The cheapest total wins;
 * on a tie the higher-capacity plan is recommended.
 */
interface Requirements {
  branches: number
  users: number
  products: number
}

interface PlanQuote {
  plan: CloudPlanPriceInput
  total: number
  addonCost: number
}

function quotePlan(plan: CloudPlanPriceInput, reqs: Requirements, pricing: EstimatePricing): PlanQuote {
  const extraBranches = Math.max(0, reqs.branches - plan.limits.branchLimit)
  const extraUserPacks = Math.ceil(Math.max(0, reqs.users - plan.limits.userLimit) / 5)
  const extraProductPacks = Math.ceil(Math.max(0, reqs.products - plan.limits.productLimit) / 500)
  const addonCost =
    extraBranches * pricing.branchAddonAnnual +
    extraUserPacks * pricing.userPackAnnual +
    extraProductPacks * pricing.productPackAnnual
  return { plan, total: plan.annual + addonCost, addonCost }
}

function lowestCostPlan(reqs: Requirements, pricing: EstimatePricing): PlanQuote {
  const quotes = pricing.cloudPlans.map((p) => quotePlan(p, reqs, pricing))
  let best = quotes[0]
  for (const q of quotes) {
    if (q.total < best.total) best = q
    else if (q.total === best.total && q.plan.limits.branchLimit > best.plan.limits.branchLimit) best = q
  }
  return best
}

/* ─── Recommendation engine ─── */

export function recommendRetail(answers: EstimateAnswers, pricing: EstimatePricing): Recommendation {
  const [minExtra, maxExtra] = branchCountBounds(answers.branches)
  const wantsOffline = answers.offlineOperation === "yes"

  const [, staffHigh] = staffBounds(answers.staffSize)
  const [, productsHigh] = productBounds(answers.productCount)

  const internalTier = resolveTier(Math.max(1, 1 + maxExtra), staffHigh, productsHigh)

  const [staffLow] = staffBounds(answers.staffSize)
  const [productsLow] = productBounds(answers.productCount)
  const lowQuote = lowestCostPlan({ branches: 1 + minExtra, users: staffLow, products: productsLow }, pricing)
  const highQuote = lowestCostPlan({ branches: 1 + maxExtra, users: staffHigh, products: productsHigh }, pricing)

  return {
    line: "retail",
    planName: `MartPoint Retail Cloud — ${highQuote.plan.name}`,
    internalTier,
    rangeLow: lowQuote.total,
    rangeHigh: highQuote.total,
    period: "/ year",
    inclusions: [
      `${highQuote.plan.limits.branchLimit} branch${highQuote.plan.limits.branchLimit !== 1 ? "es" : ""} · ${highQuote.plan.limits.userLimit} users included`,
      "POS, inventory & online store",
      "WhatsApp ordering & invoices",
      "Loyalty, payments & reports",
    ],
    rationale:
      (highQuote.addonCost > 0
        ? `${highQuote.plan.name} plus capacity add-ons is the lowest-cost fit for your size.`
        : `${highQuote.plan.name} covers your branches, staff and catalogue within its included limits.`) +
      (wantsOffline
        ? " You flagged a need to work without internet — we'll confirm the best setup for that during your consultation."
        : ""),
  }
}

export function buildEstimate(answers: EstimateAnswers, pricing: EstimatePricing): EstimateResult {
  const retail = recommendRetail(answers, pricing)

  if (answers.erpInterest === "yes" || answers.erpInterest === "maybe") {
    return {
      retail,
      erp: {
        line: "erp",
        planName: "MartPoint ERP",
        internalTier: retail.internalTier,
        rangeLow: null,
        rangeHigh: null,
        period: "",
        inclusions: [
          "Finance, HR & operational modules",
          "Scoped to your workflows and branches",
          "Works alongside MartPoint Retail",
          "Quoted after a consultation",
        ],
        rationale:
          "You flagged ERP needs. ERP deployments are scoped and quoted individually after a consultation — pricing is provided on request, never published.",
      },
    }
  }

  return { retail }
}

/* ─── Range formatting for the UI ─── */
export function formatRange(rec: Recommendation): string {
  if (rec.rangeLow == null && rec.rangeHigh == null) return "Custom quote"
  if (rec.rangeLow == null) return `from ${formatNaira(rec.rangeHigh as number)}${rec.period ? " " + rec.period : ""}`
  if (rec.rangeHigh == null) return `from ${formatNaira(rec.rangeLow)}${rec.period ? " " + rec.period : ""}`
  if (rec.rangeLow === rec.rangeHigh) return `${formatNaira(rec.rangeLow)}${rec.period ? " " + rec.period : ""}`
  return `${formatNaira(rec.rangeLow)} – ${formatNaira(rec.rangeHigh)}${rec.period ? " " + rec.period : ""}`
}

/* ─── Build normalised pricing from the admin settings object ─── */
const TIER_ORDER: PlanTierLimits["tier"][] = ["Basic", "Standard", "Premium", "Enterprise"]
const PLAN_ID_TO_TIER: Record<string, PlanTierLimits["tier"]> = {
  basic: "Basic",
  standard: "Standard",
  premium: "Premium",
  "enterprise-retail": "Enterprise",
}

export function buildPricingFromSettings(raw: Record<string, unknown> | undefined | null): EstimatePricing {
  const pricing = (raw as Record<string, unknown> | undefined) || {}

  const resolved = resolveCloudPlans({ pricing })

  const cloudPlans: CloudPlanPriceInput[] = TIER_ORDER.map((tier) => {
    const limits = PLAN_TIERS.find((t) => t.tier === tier) as PlanTierLimits
    const plan = resolved.find((p) => PLAN_ID_TO_TIER[p.id] === tier)
    return {
      tier,
      planId: plan?.id ?? tier.toLowerCase(),
      name: plan?.displayName ?? tier,
      annual: plan?.annualPrice ?? (CLOUD_PLANS.find((c) => PLAN_ID_TO_TIER[c.id] === tier)?.annualPrice ?? 0),
      limits,
    }
  })

  return {
    cloudPlans,
    branchAddonAnnual: BRANCH_ADDON_ANNUAL,
    userPackAnnual: USER_PACK_ADDON_ANNUAL,
    productPackAnnual: PRODUCT_PACK_ADDON_ANNUAL,
  }
}

/* ─── WhatsApp share message ─── */
export function buildEstimateWhatsAppMessage(answers: EstimateAnswers, contact: EstimateContact, result: EstimateResult): string {
  const lines = [
    "Hi MartPoint, I just used the Cost Estimator on your website. Here's my requirement:",
    "",
    `Name: ${contact.fullName}`,
    `Business: ${answers.businessName || "—"}`,
    `Type: ${answers.businessType || "—"}`,
    `Country: ${answers.country || "—"}`,
    `Branches: ${BRANCH_OPTIONS.find((o) => o.value === answers.branches)?.label || answers.branches}`,
    `Staff: ${STAFF_OPTIONS.find((o) => o.value === answers.staffSize)?.label || answers.staffSize}`,
    `Products: ${PRODUCT_COUNT_OPTIONS.find((o) => o.value === answers.productCount)?.label || answers.productCount}`,
    `Online store: ${answers.onlineStore}`,
    `Offline operation: ${answers.offlineOperation}`,
    `ERP interest: ${answers.erpInterest || "—"}`,
    `Hardware: ${answers.hardwareAvailable}`,
    `Training: ${answers.trainingPreference}`,
    "",
    `Recommended: ${result.retail.planName} — ${formatRange(result.retail)}`,
    ...(result.erp ? [`ERP: ${result.erp.planName} — ${formatRange(result.erp)}`] : []),
  ]
  if (contact.notes) lines.push("", `Notes: ${contact.notes}`)
  lines.push("", "Can we take this forward?")
  return lines.join("\n")
}
