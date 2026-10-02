/**
 * Shared field normalization for ad-platform lead webhooks (TikTok, Meta).
 * Both platforms deliver form answers either as flat key/value maps or as
 * arrays of {field_name/name/question, field_value/value/answer(s)} pairs.
 */

export type AdLeadFields = {
  fullName?: string
  email?: string
  phone?: string
  businessName?: string
  businessType?: string
  productInterest?: string
  branches?: string
  staffSize?: string
  challenge?: string
  message?: string
  leadId?: string
  campaignName?: string
  adName?: string
}

export const AD_LEAD_FIELD_ALIASES: Record<string, keyof AdLeadFields> = {
  fullname: "fullName",
  full_name: "fullName",
  name: "fullName",
  contact_name: "fullName",
  email: "email",
  email_address: "email",
  phone: "phone",
  phone_number: "phone",
  mobile: "phone",
  business_name: "businessName",
  businessname: "businessName",
  company: "businessName",
  company_name: "businessName",
  business_type: "businessType",
  industry: "businessType",
  product_interest: "productInterest",
  product: "productInterest",
  branches: "branches",
  branch_count: "branches",
  number_of_branches: "branches",
  staff_size: "staffSize",
  employees: "staffSize",
  message: "message",
  notes: "message",
  challenge: "challenge",
  lead_id: "leadId",
  leadid: "leadId",
  leadgen_id: "leadId",
  campaign_name: "campaignName",
  campaign: "campaignName",
  ad_name: "adName",
}

const DIRECT_KEYS: (keyof AdLeadFields)[] = [
  "fullName", "email", "phone", "businessName", "businessType", "productInterest",
  "branches", "staffSize", "challenge", "message", "leadId", "campaignName", "adName",
]

function aliasKey(k: string): string {
  return k.trim().toLowerCase().replace(/[\s-]+/g, "_")
}

export function assignAdLeadField(out: AdLeadFields, key: string, value: unknown) {
  // Meta delivers values as {name, values: [..]} — unwrap single-element arrays
  if (Array.isArray(value)) value = value[0]
  if (typeof value !== "string" && typeof value !== "number") return
  const v = String(value).trim()
  if (!v) return

  if ((DIRECT_KEYS as string[]).includes(key)) {
    ;(out as Record<string, string>)[key] = v
    return
  }
  const target = AD_LEAD_FIELD_ALIASES[aliasKey(key)]
  if (target && !out[target]) out[target] = v
}

/** Pulls fields out of a node that may be a flat map and/or contain arrays of {name, value} pairs. */
export function extractAdLeadFields(node: unknown, out: AdLeadFields, depth = 0): void {
  if (!node || typeof node !== "object" || depth > 4) return
  const rec = node as Record<string, unknown>

  for (const [k, v] of Object.entries(rec)) {
    assignAdLeadField(out, k, v)
  }

  for (const v of Object.values(rec)) {
    if (Array.isArray(v)) {
      for (const item of v) {
        if (item && typeof item === "object") {
          const it = item as Record<string, unknown>
          const fk = it.field_name ?? it.key ?? it.name ?? it.question ?? it.label
          const fv = it.field_value ?? it.value ?? it.answer ?? it.values
          if (fk != null && fv != null) {
            assignAdLeadField(out, String(fk), fv)
          } else {
            extractAdLeadFields(it, out, depth + 1)
          }
        }
      }
    }
  }
}

export function normalizeProductInterest(raw: string | undefined): string {
  const v = (raw || "").trim().toLowerCase()
  if (v.includes("erp")) return "erp"
  if (v.includes("retail") || v.includes("pos") || v.includes("point of sale")) return "retail"
  return "not-sure"
}

export function firstNonEmpty(...vals: (string | undefined)[]): string {
  return vals.find((v) => v && v.trim())?.trim() || ""
}
