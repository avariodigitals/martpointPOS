/* ───────────────────────────  Estimate Calculator  ───────────────────────────
 * Public cost estimator for MartPoint. A short questionnaire captures the core
 * facts about a business, then a recommendation engine maps those facts onto the
 * MartPoint plan catalogue and returns an estimated cost range.
 *
 * Plan tiers (Basic / Standard / Premium / Enterprise) mirror the license limits
 * in the MartPoint Retail source catalogue (db_subscription_plans). Public-facing
 * plan names (Retail Cloud / Retail Offline / ERP Growth / Scale / Corporate) and
 * prices come from the admin-configured pricing settings so the estimator never
 * drifts from the /pricing page.
 *
 * The internal tier label is computed for the sales team (used in the lead/email)
 * but is NOT surfaced to the visitor — the public UI only shows the plan name, an
 * estimated range, and a few high-level inclusions.
 */

/* ─── Public plan tiers (license limits from the retail source catalogue) ─── */
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
  { tier: "Premium", branchLimit: 5, userLimit: 25, productLimit: 5000, onlineProductLimit: 5000, serviceLimit: 500, mediaStorageMb: 10240, storefrontLimit: 2, customDomainLimit: 2 },
  { tier: "Enterprise", branchLimit: 10, userLimit: 50, productLimit: 10000, onlineProductLimit: 20000, serviceLimit: 1000, mediaStorageMb: 20480, storefrontLimit: 3, customDomainLimit: 3 },
]

/* ─── Normalised numeric pricing (built from admin settings on the server) ─── */
export interface RetailPricingInput {
  baseAnnual: number
  branchAddonAnnual: number
  branchesIncluded: number
  usersIncluded: number
}

export interface OfflinePricingInput {
  baseOneTime: number
  branchAddonOneTime: number
  branchesIncluded: number
  supportRenewalAnnual: number
}

export interface ErpPricingTierInput {
  name: string
  baseMonthly: number | null // null => "Custom"
  usersIncluded: number
  branchesIncluded: number
}

export interface EstimatePricing {
  retailCloud: RetailPricingInput
  retailOffline: OfflinePricingInput
  erp: ErpPricingTierInput[]
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
  erpModules: string
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
  /** Internal license tier — for the sales team only, not shown to the visitor. */
  internalTier: PlanTierLimits["tier"]
  rangeLow: number | null
  rangeHigh: number | null
  period: string
  inclusions: string[]
  rationale: string
}

export interface EstimateResult {
  retail: Recommendation
  erp: Recommendation
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
  return "₦" + n.toLocaleString("en-NG")
}

/** Resolve the highest license tier that satisfies branches, users and products. */
export function resolveTier(branches: number, users: number, products: number): PlanTierLimits["tier"] {
  let chosen: PlanTierLimits["tier"] = "Basic"
  for (const t of PLAN_TIERS) {
    const fitsBranches = branches <= t.branchLimit
    const fitsUsers = users <= t.userLimit
    const fitsProducts = products <= t.productLimit
    if (fitsBranches && fitsUsers && fitsProducts) {
      chosen = t.tier
      return chosen
    }
  }
  // Nothing fits cleanly → Enterprise
  return "Enterprise"
}

function branchCountBounds(value: string): [number, number] {
  return BRANCH_EXTRA[value] ?? [0, 0]
}

function staffUpperBound(value: string): number {
  switch (value) {
    case "1-5": return 5
    case "6-15": return 15
    case "16-30": return 30
    case "31-50": return 50
    case "50+": return 200
    default: return 5
  }
}

function productUpperBound(value: string): number {
  switch (value) {
    case "up-to-500": return 500
    case "500-2000": return 2000
    case "2000-5000": return 5000
    case "5000+": return 20000
    default: return 500
  }
}

/* ─── Recommendation engine ─── */

export function recommendRetail(answers: EstimateAnswers, pricing: EstimatePricing): Recommendation {
  const [minExtra, maxExtra] = branchCountBounds(answers.branches)
  const wantsOffline = answers.offlineOperation === "yes"
  const cloud = pricing.retailCloud
  const offline = pricing.retailOffline

  const tier = resolveTier(
    Math.max(1, 1 + maxExtra),
    staffUpperBound(answers.staffSize),
    productUpperBound(answers.productCount),
  )

  if (wantsOffline && offline.baseOneTime > 0) {
    const low = offline.baseOneTime + minExtra * offline.branchAddonOneTime
    const high = offline.baseOneTime + maxExtra * offline.branchAddonOneTime
    return {
      line: "retail",
      planName: "MartPoint Retail Offline",
      internalTier: tier,
      rangeLow: low,
      rangeHigh: high,
      period: "",
      inclusions: [
        "Works without internet",
        "Local installation & setup",
        "Multi-branch (LAN connected)",
        "Annual maintenance & license renewal applicable",
      ],
      rationale: "You indicated you need offline operation, so Retail Offline is the right fit.",
    }
  }

  const low = cloud.baseAnnual + minExtra * cloud.branchAddonAnnual
  const high = cloud.baseAnnual + maxExtra * cloud.branchAddonAnnual
  return {
    line: "retail",
    planName: "MartPoint Retail Cloud",
    internalTier: tier,
    rangeLow: low,
    rangeHigh: high,
    period: "/ year",
    inclusions: [
      "POS, inventory & online store",
      "WhatsApp ordering & invoices",
      "Loyalty, payments & reports",
      "Multi-branch ready",
    ],
    rationale: "Cloud keeps you connected across branches with the online store included.",
  }
}

export function recommendErp(answers: EstimateAnswers, pricing: EstimatePricing): Recommendation {
  const staff = staffUpperBound(answers.staffSize)
  const wantsModules = answers.erpModules === "yes" || answers.erpModules === "maybe"
  const branches = Math.max(1, 1 + branchCountBounds(answers.branches)[1])

  const tiers = pricing.erp
  const growth = tiers.find((t) => /growth/i.test(t.name))
  const scale = tiers.find((t) => /scale/i.test(t.name))
  const corporate = tiers.find((t) => /corporate|enterprise|custom/i.test(t.name))

  // Corporate: very large staff, complex needs, or explicit enterprise signals
  const isCorporate = staff > 100 || (answers.staffSize === "50+" && wantsModules) || branches > 10
  // Scale: mid-size or needs advanced modules
  const isScale = staff > 20 || wantsModules

  let chosen: ErpPricingTierInput = growth || scale || corporate || tiers[0]
  let rationale: string
  if (isCorporate && corporate) {
    chosen = corporate
    rationale = "Your scale and module needs point to a tailored enterprise rollout."
  } else if (isScale && scale) {
    chosen = scale
    rationale = "With your team size and module needs, the Scale edition fits best."
  } else if (growth) {
    chosen = growth
    rationale = "For a smaller team getting started with systemised operations."
  } else {
    rationale = "A tailored enterprise rollout fits your needs."
  }

  const tier = resolveTier(branches, staff, productUpperBound(answers.productCount))

  const inclusionsByPlan: Record<string, string[]> = {
    growth: [
      "Accounting & procurement",
      "Basic HR & CRM",
      "Up to 20 employees",
      "Standard reports",
    ],
    scale: [
      "Full accounting suite",
      "Manufacturing, HR & approvals",
      "Up to 100 employees",
      "Priority support",
    ],
    corporate: [
      "All modules included",
      "Custom workflows & API access",
      "Unlimited employees",
      "Dedicated support team",
    ],
  }
  const key = chosen.name.toLowerCase()
  const inclusions =
    inclusionsByPlan[key] ||
    inclusionsByPlan[isCorporate ? "corporate" : isScale ? "scale" : "growth"]

  const isCustom = chosen.baseMonthly == null || isCorporate
  return {
    line: "erp",
    planName: isCorporate && corporate ? corporate.name : chosen.name.startsWith("MartPoint") ? chosen.name : `MartPoint ERP ${chosen.name}`,
    internalTier: tier,
    rangeLow: isCustom ? null : chosen.baseMonthly,
    rangeHigh: isCustom ? null : chosen.baseMonthly,
    period: isCustom ? "" : "/ month",
    inclusions,
    rationale,
  }
}

export function buildEstimate(answers: EstimateAnswers, pricing: EstimatePricing): EstimateResult {
  return {
    retail: recommendRetail(answers, pricing),
    erp: recommendErp(answers, pricing),
  }
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
interface RawPlan {
  name?: string
  price?: string
  period?: string
  branchesIncluded?: number
  usersIncluded?: number
  branchAddonPrice?: string
  supportRenewal?: string
}

export function buildPricingFromSettings(raw: Record<string, unknown> | undefined | null): EstimatePricing {
  const pricing = (raw as Record<string, unknown> | undefined) || {}
  const cloud = (pricing.cloud as RawPlan | undefined) || {}
  const offline = (pricing.offline as RawPlan | undefined) || {}
  const erp = Array.isArray(pricing.erp) ? (pricing.erp as RawPlan[]) : []

  return {
    retailCloud: {
      baseAnnual: parseNaira(cloud.price) ?? 99999,
      branchAddonAnnual: parseNaira(cloud.branchAddonPrice) ?? 49999,
      branchesIncluded: cloud.branchesIncluded ?? 1,
      usersIncluded: cloud.usersIncluded ?? 5,
    },
    retailOffline: {
      baseOneTime: parseNaira(offline.price) ?? 250000,
      branchAddonOneTime: parseNaira(offline.branchAddonPrice) ?? 100000,
      branchesIncluded: offline.branchesIncluded ?? 1,
      supportRenewalAnnual: parseNaira(offline.supportRenewal) ?? 50000,
    },
    erp: erp.map((p, i) => ({
      name: p.name || ["Growth", "Scale", "Corporate"][i] || `Plan ${i + 1}`,
      baseMonthly: parseNaira(p.price),
      usersIncluded: p.usersIncluded ?? 5,
      branchesIncluded: p.branchesIncluded ?? 1,
    })),
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
    `ERP modules: ${answers.erpModules}`,
    `Hardware: ${answers.hardwareAvailable}`,
    `Training: ${answers.trainingPreference}`,
    "",
    `Retail recommendation: ${result.retail.planName} — ${formatRange(result.retail)}`,
    `ERP recommendation: ${result.erp.planName} — ${formatRange(result.erp)}`,
  ]
  if (contact.notes) lines.push("", `Notes: ${contact.notes}`)
  lines.push("", "Can we take this forward?")
  return lines.join("\n")
}
