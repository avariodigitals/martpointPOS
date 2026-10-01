import { NextResponse } from "next/server"
import { createHmac, timingSafeEqual } from "crypto"
import { processLead } from "@/lib/process-lead"
import { getSettings } from "@/lib/settings"

/**
 * Inbound lead webhook for TikTok Lead Generation (Instant Forms).
 *
 * Two auth modes:
 *  1. Shared secret — for Make.com/Zapier relays. Set LEADS_WEBHOOK_SECRET env
 *     or Admin → Integrations → Ad Lead Webhooks → Shared Secret, and send it
 *     as the `x-webhook-secret` header or `?secret=` query param.
 *  2. Native TikTok signature — for direct TikTok webhook subscriptions.
 *     Set TIKTOK_APP_SECRET env or the TikTok App Secret field in admin;
 *     the `tiktok-signature` header is verified as HMAC-SHA256("<t>.<raw body>")
 *     per TikTok's webhook verification docs.
 *
 * Payload shapes accepted:
 *  - Flat JSON (Make.com HTTP module): { fullName, email, phone, businessName?, leadId?, ... }
 *  - TikTok envelope: { client_key, event, create_time, content: "<json string>" }
 *    where content contains lead_id + field data (array of {field_name, field_value}
 *    or a flat key-value map).
 */

const SIGNATURE_TOLERANCE_SECONDS = 300

function verifyTikTokSignature(raw: string, header: string | null, secret: string): boolean {
  if (!secret || !header) return false

  const parts: Record<string, string> = {}
  for (const kv of header.split(",")) {
    const idx = kv.indexOf("=")
    if (idx > 0) parts[kv.slice(0, idx).trim()] = kv.slice(idx + 1).trim()
  }
  const t = parts.t
  const s = parts.s
  if (!t || !s) return false

  const ts = Number(t)
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > SIGNATURE_TOLERANCE_SECONDS) {
    return false
  }

  const expectedHex = createHmac("sha256", secret).update(`${t}.${raw}`).digest("hex")
  // TikTok may deliver the signature hex- or base64-encoded
  const providedHex = /^[0-9a-f]{64}$/i.test(s)
    ? s.toLowerCase()
    : Buffer.from(s, "base64").toString("hex")

  if (expectedHex.length !== providedHex.length) return false
  try {
    return timingSafeEqual(Buffer.from(expectedHex, "hex"), Buffer.from(providedHex, "hex"))
  } catch {
    return false
  }
}

type LeadFields = {
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

const FIELD_ALIASES: Record<string, keyof LeadFields> = {
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
  campaign_name: "campaignName",
  campaign: "campaignName",
  ad_name: "adName",
}

function aliasKey(k: string): string {
  return k.trim().toLowerCase().replace(/[\s-]+/g, "_")
}

function assignField(out: LeadFields, key: string, value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") return
  const v = String(value).trim()
  if (!v) return

  // Direct camelCase keys (Make.com simple payloads)
  const directKeys: (keyof LeadFields)[] = ["fullName", "email", "phone", "businessName", "businessType", "productInterest", "branches", "staffSize", "challenge", "message", "leadId", "campaignName", "adName"]
  if ((directKeys as string[]).includes(key)) {
    ;(out as Record<string, string>)[key] = v
    return
  }
  const target = FIELD_ALIASES[aliasKey(key)]
  if (target && !out[target]) out[target] = v
}

/** Pulls fields out of a node that may be a flat map and/or contain arrays of {name, value} pairs. */
function extractFields(node: unknown, out: LeadFields, depth = 0): void {
  if (!node || typeof node !== "object" || depth > 4) return
  const rec = node as Record<string, unknown>

  for (const [k, v] of Object.entries(rec)) {
    assignField(out, k, v)
  }

  for (const v of Object.values(rec)) {
    if (Array.isArray(v)) {
      for (const item of v) {
        if (item && typeof item === "object") {
          const it = item as Record<string, unknown>
          const fk = it.field_name ?? it.key ?? it.name ?? it.question ?? it.label
          const fv = it.field_value ?? it.value ?? it.answer
          if (fk != null && fv != null) {
            assignField(out, String(fk), fv)
          } else {
            extractFields(it, out, depth + 1)
          }
        }
      }
    }
  }
}

function normalizeProductInterest(raw: string | undefined): string {
  const v = (raw || "").trim().toLowerCase()
  if (v.includes("erp")) return "erp"
  if (v.includes("retail") || v.includes("pos") || v.includes("point of sale")) return "retail"
  return "not-sure"
}

function firstNonEmpty(...vals: (string | undefined)[]): string {
  return vals.find((v) => v && v.trim())?.trim() || ""
}

export async function GET() {
  // Health check so Make/TikTok connectivity tests succeed
  return NextResponse.json({ ok: true })
}

export async function POST(request: Request) {
  const raw = await request.text()

  // --- Auth ---
  const settings = await getSettings()
  const url = new URL(request.url)
  const sharedSecrets = [
    process.env.LEADS_WEBHOOK_SECRET,
    settings.adLeads?.webhookSecret,
  ].filter(Boolean) as string[]
  const providedSecret =
    request.headers.get("x-webhook-secret") || url.searchParams.get("secret") || ""

  let authed = sharedSecrets.length > 0 && sharedSecrets.includes(providedSecret)
  if (!authed) {
    const signature = request.headers.get("tiktok-signature")
    const appSecrets = [
      process.env.TIKTOK_APP_SECRET,
      settings.adLeads?.tiktokAppSecret,
    ].filter(Boolean) as string[]
    authed = appSecrets.some((secret) => verifyTikTokSignature(raw, signature, secret))
  }
  if (!authed) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // --- Parse ---
  let body: Record<string, unknown>
  try {
    body = JSON.parse(raw)
  } catch {
    // Authenticated but malformed — return 200 so TikTok/Make don't retry forever
    return NextResponse.json({ ok: false, reason: "invalid_json" })
  }

  const fields: LeadFields = {}

  // Native TikTok envelope: content is a serialized JSON string
  if (typeof body.content === "string") {
    const event = typeof body.event === "string" ? body.event : ""
    if (event && !/lead/i.test(event)) {
      return NextResponse.json({ ok: true, ignored: event })
    }
    try {
      const content = JSON.parse(body.content)
      extractFields(content, fields)
    } catch {
      return NextResponse.json({ ok: false, reason: "invalid_content" })
    }
  } else {
    extractFields(body, fields)
  }

  if (fields.leadId && !fields.email && !fields.phone && !fields.fullName) {
    // Webhook carried only a lead_id — full data requires a follow-up API fetch
    // (not yet implemented; needs TIKTOK_ACCESS_TOKEN + advertiser_id)
    console.warn("[tiktok-leads] received lead_id-only payload:", fields.leadId)
    return NextResponse.json({ ok: false, reason: "lead_id_only", leadId: fields.leadId })
  }

  if (!fields.email && !fields.phone) {
    return NextResponse.json({ ok: false, reason: "no_contact_fields" })
  }

  const attribution = [
    fields.campaignName ? `campaign "${fields.campaignName}"` : "",
    fields.adName ? `ad "${fields.adName}"` : "",
    fields.leadId ? `lead ${fields.leadId}` : "",
  ]
    .filter(Boolean)
    .join(" / ")

  const message = firstNonEmpty(
    fields.message,
    attribution ? `TikTok Instant Form — ${attribution}` : "TikTok Instant Form"
  )

  const result = await processLead({
    fullName: firstNonEmpty(fields.fullName, "TikTok Lead"),
    businessName: firstNonEmpty(fields.businessName, "Not provided"),
    email: fields.email || "",
    phone: fields.phone || "",
    businessType: firstNonEmpty(fields.businessType, "other"),
    productInterest: normalizeProductInterest(fields.productInterest),
    branches: firstNonEmpty(fields.branches, "1"),
    staffSize: firstNonEmpty(fields.staffSize, "1-5"),
    challenge: fields.challenge,
    message,
    source: "tiktok",
    externalId: fields.leadId ? `tiktok:${fields.leadId}` : null,
  })

  if (!result.success) {
    console.error("[tiktok-leads] processLead failed:", result.error)
    return NextResponse.json({ ok: false, reason: "processing_failed" })
  }

  return NextResponse.json({ ok: true, duplicate: !!result.duplicate })
}
