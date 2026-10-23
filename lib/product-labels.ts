/** Canonical product labels used anywhere a product is shown to a user. */
export const PARTNER_PRODUCT_OPTIONS = [
  "MartPoint Retail",
  "MartPoint ERP",
  "Not Sure — Need Guidance",
] as const

export function normalizeProductCode(value: string | null | undefined): "retail" | "erp" | "not-sure" {
  const normalized = String(value || "").trim().toLowerCase()
  if (normalized.includes("erp") || normalized === "enterprise") return "erp"
  if (normalized.includes("retail") || normalized.includes("pos") || normalized.includes("point of sale")) return "retail"
  return "not-sure"
}

export function productLabel(value: string | null | undefined, fallback = "Not Sure — Need Guidance"): string {
  const raw = String(value || "").trim()
  if (!raw) return fallback
  const normalized = raw.toLowerCase()
  switch (normalizeProductCode(raw)) {
    case "retail":
      return "MartPoint Retail"
    case "erp":
      return "MartPoint ERP"
    default:
      return normalized === "not-sure" || normalized.includes("not sure") ? "Not Sure — Need Guidance" : raw
  }
}
