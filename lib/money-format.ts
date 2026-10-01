/**
 * Shared money formatting for admin UI.
 * Nigerian Naira convention: ₦50,000 for whole amounts, ₦50,000.50 when kobo is present.
 */
export function formatMoney(n: number | string | null | undefined, currency = "NGN"): string {
  const v = typeof n === "string" ? Number.parseFloat(n) : Number(n)
  if (Number.isNaN(v)) return currency === "NGN" ? "₦0" : `${currency} 0`
  const hasMinor = Math.abs(v % 1) > 0.0000001
  const options: Intl.NumberFormatOptions = {
    minimumFractionDigits: hasMinor ? 2 : 0,
    maximumFractionDigits: 2,
  }
  if (currency === "NGN") {
    return `${v < 0 ? "-" : ""}₦${Math.abs(v).toLocaleString("en-NG", options)}`
  }
  try {
    return new Intl.NumberFormat("en-NG", { style: "currency", currency, ...options }).format(v)
  } catch {
    return `${v < 0 ? "-" : ""}${currency} ${Math.abs(v).toLocaleString("en-NG", options)}`
  }
}
