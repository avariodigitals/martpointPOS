/* ───────────────────────────  Retail pricing catalogue  ────────────────────
 * Canonical Retail Cloud licence matrix and add-on catalogue.
 *
 * Baseline: MartPoint Master Pricing & Commercial Policy / Pricing & Quotation
 * Playbook v2.1 (effective 8 September 2026). These are the reconciliation
 * baseline values — admin settings under `pricing.cloudPlans` may override
 * per-plan display fields (name, badge, price text, description, features,
 * CTA), but the licence limits below are the approved baseline and are not
 * admin-editable.
 *
 * Enterprise Retail is a Retail Cloud capacity tier. It is NOT MartPoint ERP.
 */

export interface CloudPlanLimits {
  branches: number
  namedUsers: number
  mainProducts: number
  productVariations: number
  onlineProducts: number
  services: number
  mediaGb: number
  storefronts: number
  customDomains: number
}

export type CloudPlanId = "basic" | "standard" | "premium" | "enterprise-retail"

export interface CloudPlanBaseline {
  id: CloudPlanId
  name: string
  annualPrice: number
  badge: string
  tagline: string
  limits: CloudPlanLimits
}

export const CLOUD_PLANS: CloudPlanBaseline[] = [
  {
    id: "basic",
    name: "Basic",
    annualPrice: 99999,
    badge: "",
    tagline: "For a single business getting started.",
    limits: { branches: 1, namedUsers: 5, mainProducts: 500, productVariations: 10000, onlineProducts: 500, services: 100, mediaGb: 2, storefronts: 1, customDomains: 1 },
  },
  {
    id: "standard",
    name: "Standard",
    annualPrice: 249999,
    badge: "Popular",
    tagline: "For growing businesses with a few branches.",
    limits: { branches: 3, namedUsers: 10, mainProducts: 2000, productVariations: 50000, onlineProducts: 2000, services: 300, mediaGb: 5, storefronts: 1, customDomains: 1 },
  },
  {
    id: "premium",
    name: "Premium",
    annualPrice: 499999,
    badge: "",
    tagline: "For established multi-branch retailers.",
    limits: { branches: 5, namedUsers: 25, mainProducts: 5000, productVariations: 150000, onlineProducts: 5000, services: 500, mediaGb: 10, storefronts: 1, customDomains: 1 },
  },
  {
    id: "enterprise-retail",
    name: "Enterprise Retail",
    annualPrice: 999999,
    badge: "",
    tagline: "Our largest Retail Cloud capacity tier.",
    limits: { branches: 10, namedUsers: 50, mainProducts: 10000, productVariations: 500000, onlineProducts: 20000, services: 1000, mediaGb: 20, storefronts: 1, customDomains: 1 },
  },
]

/* ─── Annual add-ons (baseline) ─── */
export interface Addon {
  id: string
  label: string
  detail: string
  annualPrice: number
}

export const ADDONS: Addon[] = [
  { id: "branch", label: "Extra Cloud branch", detail: "per branch, per year", annualPrice: 50000 },
  { id: "users", label: "Five users", detail: "per 5 users, per year", annualPrice: 25000 },
  { id: "products", label: "500 main products", detail: "per 500 products, per year", annualPrice: 15000 },
  { id: "variations", label: "10,000 product variations", detail: "per 10,000 variations, per year", annualPrice: 25000 },
  { id: "services", label: "100 services", detail: "per 100 services, per year", annualPrice: 10000 },
  { id: "basic-storage", label: "Basic storage upgrade (2 GB → 5 GB total)", detail: "Basic plan only, per year", annualPrice: 10000 },
  { id: "media-5gb", label: "Additional 5 GB media", detail: "per 5 GB, per year", annualPrice: 10000 },
]

export const BRANCH_ADDON_ANNUAL = 50000
export const USER_PACK_ADDON_ANNUAL = 25000 // per 5 named users
export const PRODUCT_PACK_ADDON_ANNUAL = 15000 // per 500 main products

/* ─── Retail Offline ───
 * Owner decision (30 Sep 2026): Offline pricing is quote-only — no public
 * price is displayed anywhere on the site. The internal baseline figures are
 * kept here for reference and for the estimator's internal tier calc.
 */
export const OFFLINE_PLAN = {
  name: "MartPoint Retail Offline",
  priceOnRequest: true,
  licencePrice: 250000, // internal baseline — NOT for public display
  branchesIncluded: 1,
  usersIncluded: 5,
  extraBranchOneTime: 100000,
  annualCarePrice: 150000,
} as const

/* ─── Settings merge ───
 * `pricing.cloudPlans` (array, keyed by id) overrides per-plan display fields.
 * The legacy `pricing.cloud` object maps onto the Basic plan for backwards
 * compatibility with the existing admin editor.
 */
export interface CloudPlanOverride {
  id?: string
  name?: string
  price?: string
  period?: string
  badge?: string
  description?: string
  features?: string[]
  ctaText?: string
  ctaLink?: string
}

export interface ResolvedCloudPlan extends CloudPlanBaseline {
  displayName: string
  priceText: string
  description: string
  features: string[]
  ctaText: string
  ctaLink: string
}

const CORE_FEATURES = [
  "POS Sales & Checkout",
  "Inventory & Stock Control",
  "Standard Online Store included",
  "WhatsApp Ordering & Invoices",
  "QR Menu Ordering",
  "PayPlan™ Installment Plans",
  "Loyalty & Rewards",
  "Customer Verification",
  "Collections Tracking",
  "Attendance (Face Capture)",
  "Daily Reports",
  "AI Assistant",
  "Mobile & Desktop Access",
]

const FEATURES_WITH_PAYMENT_LINKS = [
  ...CORE_FEATURES.slice(0, 5),
  "Payment Links",
  ...CORE_FEATURES.slice(5),
]

/* Default per-plan feature lists for the plan cards. Payment Links is not
 * included on Basic — matching the public comparison matrix. */
const PLAN_FEATURES: Record<CloudPlanId, string[]> = {
  basic: CORE_FEATURES,
  standard: FEATURES_WITH_PAYMENT_LINKS,
  premium: FEATURES_WITH_PAYMENT_LINKS,
  "enterprise-retail": FEATURES_WITH_PAYMENT_LINKS,
}

/* ─── Plan comparison matrix (public /pricing page) ───
 * Rows are ordered to match CLOUD_PLANS: [Basic, Standard, Premium, Enterprise Retail].
 * Cell values: string = shown as-is; "yes" = included check; "soon" = coming-soon badge;
 * "no" = not included dash.
 */
export type CellValue = string | "yes" | "soon" | "no"

export interface ComparisonGroup {
  title: string
  rows: { label: string; values: CellValue[] }[]
}

export const COMPARISON_GROUPS: ComparisonGroup[] = [
  {
    title: "Capacity",
    rows: [
      { label: "Annual licence", values: ["₦99,999", "₦249,999", "₦499,999", "₦999,999"] },
      { label: "Branches", values: ["1", "3", "5", "10"] },
      { label: "Users", values: ["5", "10", "25", "50"] },
      { label: "Main products", values: ["500", "2,000", "5,000", "10,000"] },
      { label: "Product variations", values: ["10,000", "50,000", "150,000", "500,000"] },
      { label: "Online store products", values: ["500", "2,000", "5,000", "20,000"] },
      { label: "Services", values: ["100", "300", "500", "1,000"] },
      { label: "Media storage", values: ["2 GB", "5 GB", "10 GB", "20 GB"] },
      { label: "Storefront", values: ["1", "1", "1", "1"] },
      { label: "Custom domain", values: ["1", "1", "1", "1"] },
    ],
  },
  {
    title: "Sell everywhere",
    rows: [
      { label: "POS sales & checkout", values: ["yes", "yes", "yes", "yes"] },
      { label: "Inventory & stock control", values: ["yes", "yes", "yes", "yes"] },
      { label: "Online store included", values: ["yes", "yes", "yes", "yes"] },
      { label: "WhatsApp ordering & invoices", values: ["yes", "yes", "yes", "yes"] },
      { label: "QR menu ordering", values: ["yes", "yes", "yes", "yes"] },
      { label: "PayPlan™ installments", values: ["yes", "yes", "yes", "yes"] },
      { label: "Loyalty & rewards", values: ["yes", "yes", "yes", "yes"] },
      { label: "Staff attendance (face capture)", values: ["yes", "yes", "yes", "yes"] },
      { label: "Daily reports & AI assistant", values: ["yes", "yes", "yes", "yes"] },
    ],
  },
  {
    title: "Payment methods",
    rows: [
      { label: "Paystack", values: ["yes", "yes", "yes", "yes"] },
      { label: "Moniepoint", values: ["yes", "yes", "yes", "yes"] },
      { label: "Flutterwave", values: ["yes", "yes", "yes", "yes"] },
      { label: "Payment links", values: ["no", "yes", "yes", "yes"] },
    ],
  },
  {
    title: "Grow your business",
    rows: [
      { label: "Customer import/export & bulk editing", values: ["yes", "yes", "yes", "yes"] },
      { label: "Automatic payment reconciliation", values: ["yes", "yes", "yes", "yes"] },
      { label: "Advertising pixels & analytics", values: ["yes", "yes", "yes", "yes"] },
      { label: "Abandoned-cart recovery", values: ["yes", "yes", "yes", "yes"] },
      { label: "Custom shipping & pickup", values: ["yes", "yes", "yes", "yes"] },
      { label: "Third-party shipping", values: ["no", "no", "yes", "yes"] },
      { label: "Tracking", values: ["no", "no", "yes", "yes"] },
      { label: "Segmentation, campaigns & back-in-stock alerts", values: ["yes", "yes", "yes", "yes"] },
      { label: "Reviews, bundles & checkout upsells", values: ["yes", "yes", "yes", "yes"] },
      { label: "Order quantity rules & coupon limits", values: ["yes", "yes", "yes", "yes"] },
    ],
  },
  {
    title: "Connect your existing setup",
    rows: [
      { label: "Migrate from WooCommerce, Shopify, Magento or a custom site", values: ["no", "yes", "yes", "yes"] },
      { label: "Merchant API", values: ["soon", "soon", "soon", "soon"] },
      { label: "International currencies", values: ["soon", "soon", "soon", "soon"] },
    ],
  },
]

const DEFAULT_CTA_LINK =
  "https://wa.me/+2348036028069?text=Hi%2C%20I%20came%20across%20your%20website%20and%20I%27m%20interested%20in%20MartPoint%20Retail%20Cloud.%20Can%20we%20talk%3F"

export function formatNairaAmount(n: number): string {
  return "₦" + n.toLocaleString("en-NG")
}

function parsePrice(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value !== "string") return null
  const match = value.match(/[\d,]+/)
  if (!match) return null
  const n = Number(match[0].replace(/,/g, ""))
  return Number.isFinite(n) ? n : null
}

export function resolveCloudPlans(settings: Record<string, unknown> | null | undefined): ResolvedCloudPlan[] {
  const pricing = (settings?.pricing as Record<string, unknown> | undefined) || {}
  const overrides = Array.isArray(pricing.cloudPlans) ? (pricing.cloudPlans as CloudPlanOverride[]) : []
  const legacyCloud = (pricing.cloud as CloudPlanOverride | undefined) || {}

  return CLOUD_PLANS.map((base) => {
    const o = overrides.find((p) => p.id === base.id) || {}
    const legacy = base.id === "basic" ? legacyCloud : {}

    const priceNum = parsePrice(o.price) ?? parsePrice(legacy.price) ?? base.annualPrice
    const features =
      (Array.isArray(o.features) && o.features.length > 0 && o.features) ||
      (Array.isArray(legacy.features) && legacy.features.length > 0 && legacy.features) ||
      PLAN_FEATURES[base.id]

    return {
      ...base,
      displayName: o.name || (base.id === "basic" && legacyCloud.name && legacyCloud.name !== "MartPoint Retail Cloud" ? legacyCloud.name : base.name),
      priceText: formatNairaAmount(priceNum),
      annualPrice: priceNum,
      description: o.description || legacy.description || base.tagline,
      features: [...features],
      ctaText: o.ctaText || legacy.ctaText || "Get Started",
      ctaLink: o.ctaLink || legacy.ctaLink || DEFAULT_CTA_LINK,
    }
  })
}
