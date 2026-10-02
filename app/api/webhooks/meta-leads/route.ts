import { NextResponse } from "next/server"
import { createHmac, timingSafeEqual } from "crypto"
import { processLead } from "@/lib/process-lead"
import { getSettings } from "@/lib/settings"
import {
  extractAdLeadFields,
  normalizeProductInterest,
  firstNonEmpty,
  type AdLeadFields,
} from "@/lib/ad-lead-fields"

/**
 * Inbound lead webhook for Meta (Facebook/Instagram) Lead Ads.
 *
 * Setup (Meta for Developers → your app → Webhooks → Page → leadgen):
 *  - Callback URL: https://<domain>/api/webhooks/meta-leads
 *  - Verify token: the "Meta Verify Token" from Admin → Integrations → Ad Lead Webhooks
 *    (or META_VERIFY_TOKEN env). Any string you choose — Meta echoes it on the GET handshake.
 *  - App secret: set "Meta App Secret" (or META_APP_SECRET env) — verifies x-hub-signature-256.
 *  - Page/System-User access token with leads_retrieval permission: "Meta Page Access Token"
 *    (or META_PAGE_ACCESS_TOKEN env) — used to fetch the actual lead via Graph API,
 *    because the webhook only delivers a leadgen_id.
 *
 * Flow: GET handshake → Meta POSTs {entry[].changes[{field:"leadgen", value:{leadgen_id}}]}
 * → we GET graph.facebook.com/v18.0/{leadgen_id} → normalize → shared lead pipeline.
 */

const GRAPH_API_VERSION = "v18.0"

function verifyMetaSignature(raw: string, header: string | null, secret: string): boolean {
  if (!secret || !header) return false
  const provided = header.startsWith("sha256=") ? header.slice(7) : header
  const expected = createHmac("sha256", secret).update(raw).digest("hex")
  if (expected.length !== provided.length) return false
  try {
    return timingSafeEqual(Buffer.from(expected, "utf8"), Buffer.from(provided, "utf8"))
  } catch {
    return false
  }
}

async function fetchMetaLead(leadgenId: string, accessToken: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${leadgenId}?access_token=${encodeURIComponent(accessToken)}`
    )
    if (!res.ok) {
      console.error("[meta-leads] Graph API fetch failed:", res.status, await res.text().catch(() => ""))
      return null
    }
    return (await res.json()) as Record<string, unknown>
  } catch (err) {
    console.error("[meta-leads] Graph API fetch error:", err)
    return null
  }
}

/* Meta webhook verification handshake */
export async function GET(request: Request) {
  const url = new URL(request.url)
  const mode = url.searchParams.get("hub.mode")
  const token = url.searchParams.get("hub.verify_token")
  const challenge = url.searchParams.get("hub.challenge")

  const settings = await getSettings()
  const validTokens = [
    process.env.META_VERIFY_TOKEN,
    settings.adLeads?.metaVerifyToken,
  ].filter(Boolean) as string[]

  if (mode === "subscribe" && token && validTokens.includes(token) && challenge) {
    return new NextResponse(challenge, { status: 200, headers: { "Content-Type": "text/plain" } })
  }
  return NextResponse.json({ error: "Forbidden" }, { status: 403 })
}

async function ingestMetaLead(fields: AdLeadFields, leadgenId: string): Promise<void> {
  if (!fields.email && !fields.phone) {
    console.warn("[meta-leads] lead has no contact fields:", leadgenId)
    return
  }

  const attribution = [
    fields.campaignName ? `campaign "${fields.campaignName}"` : "",
    fields.adName ? `ad "${fields.adName}"` : "",
    `lead ${leadgenId}`,
  ]
    .filter(Boolean)
    .join(" / ")

  const result = await processLead({
    fullName: firstNonEmpty(fields.fullName, "Meta Lead"),
    businessName: firstNonEmpty(fields.businessName, "Not provided"),
    email: fields.email || "",
    phone: fields.phone || "",
    businessType: firstNonEmpty(fields.businessType, "other"),
    productInterest: normalizeProductInterest(fields.productInterest),
    branches: firstNonEmpty(fields.branches, "1"),
    staffSize: firstNonEmpty(fields.staffSize, "1-5"),
    challenge: fields.challenge,
    message: firstNonEmpty(fields.message, `Meta Instant Form — ${attribution}`),
    source: "meta",
    externalId: `meta:${leadgenId}`,
  })

  if (!result.success) {
    console.error("[meta-leads] processLead failed for", leadgenId, result.error)
  }
}

export async function POST(request: Request) {
  const raw = await request.text()
  const settings = await getSettings()

  // --- Auth: shared secret (Make.com relay) or Meta x-hub-signature-256 (native) ---
  const url = new URL(request.url)
  const sharedSecrets = [
    process.env.LEADS_WEBHOOK_SECRET,
    settings.adLeads?.webhookSecret,
  ].filter(Boolean) as string[]
  const providedSecret =
    request.headers.get("x-webhook-secret") || url.searchParams.get("secret") || ""

  const viaSharedSecret = sharedSecrets.length > 0 && sharedSecrets.includes(providedSecret)

  if (viaSharedSecret) {
    // Relayed flat JSON: { fullName, email, phone, leadId, ... }
    try {
      const body = JSON.parse(raw)
      const fields: AdLeadFields = {}
      extractAdLeadFields(body, fields)
      if (!fields.leadId) {
        // Synthesize a dedupe key so Make retries don't duplicate
        fields.leadId = `relay:${(fields.email || fields.phone || raw.length).toString().slice(0, 64)}:${String(body.created_time || "")}`
      }
      await ingestMetaLead(fields, fields.leadId)
      return NextResponse.json({ ok: true })
    } catch {
      return NextResponse.json({ ok: false, reason: "invalid_json" })
    }
  }

  const appSecrets = [
    process.env.META_APP_SECRET,
    settings.adLeads?.metaAppSecret,
  ].filter(Boolean) as string[]
  const signature = request.headers.get("x-hub-signature-256")
  if (!appSecrets.some((s) => verifyMetaSignature(raw, signature, s))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const accessToken =
    process.env.META_PAGE_ACCESS_TOKEN || settings.adLeads?.metaPageAccessToken || ""

  try {
    const payload = JSON.parse(raw)
    const entries = Array.isArray(payload?.entry) ? payload.entry : []

    for (const entry of entries) {
      const changes = Array.isArray(entry?.changes) ? entry.changes : []
      for (const change of changes) {
        if (change?.field !== "leadgen") continue
        const leadgenId = change?.value?.leadgen_id
        if (!leadgenId) continue

        const lead = await fetchMetaLead(String(leadgenId), accessToken)
        if (!lead) {
          // Return 200 anyway — Meta retries non-200s, and a missing token won't fix itself
          console.error("[meta-leads] could not fetch lead", leadgenId)
          continue
        }

        const fields: AdLeadFields = {}
        extractAdLeadFields(lead, fields)
        fields.campaignName = firstNonEmpty(
          fields.campaignName,
          typeof lead.campaign_name === "string" ? lead.campaign_name : undefined
        )
        fields.adName = firstNonEmpty(
          fields.adName,
          typeof lead.ad_name === "string" ? lead.ad_name : undefined
        )
        await ingestMetaLead(fields, String(leadgenId))
      }
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error("[meta-leads] webhook error:", err)
    return NextResponse.json({ ok: true })
  }
}
